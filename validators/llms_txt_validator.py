import sys, re, json, argparse, urllib.request as req
from typing import Optional
from pydantic import BaseModel, Field, field_validator, model_validator, ValidationError

REQUIRED_ENTITIES = ["TipTop360","UAE","Dubai","free delivery","tiptop360.com"]
REQUIRED_HANDLES  = ["kids-u-shaped-toothbrush-uae","ai-voice-recorder"]
GEO_SIGNALS       = ["UAE","Dubai","Abu Dhabi","Sharjah","Ajman","Emirates"]

class LlmsTxtDocument(BaseModel):
    raw: str
    title: str
    description: str
    section_count: int
    internal_url_count: int
    byte_size: int

    @field_validator("byte_size")
    @classmethod
    def check_size(cls, v):
        if v < 500:    raise ValueError(f"Too small ({v} bytes)")
        if v > 100000: raise ValueError(f"Too large ({v} bytes)")
        return v

    @field_validator("title")
    @classmethod
    def check_title(cls, v):
        if not v.strip(): raise ValueError("Missing # title")
        if "TipTop360" not in v and "tiptop360" not in v.lower():
            raise ValueError(f"Brand missing from title: '{v}'")
        return v

    @field_validator("description")
    @classmethod
    def check_desc(cls, v):
        if not v: raise ValueError("Missing > description")
        if len(v) < 80: raise ValueError(f"Description too short ({len(v)} chars, need 80+)")
        return v

    @field_validator("section_count")
    @classmethod
    def check_sections(cls, v):
        if v < 2: raise ValueError(f"Only {v} section(s), need 2+")
        return v

    @model_validator(mode='after')
    def cross_checks(self):
        raw = self.raw
        missing_entities = [e for e in REQUIRED_ENTITIES if e.lower() not in raw.lower()]
        if len(missing_entities) > 2:
            raise ValueError(f"Missing required entities: {missing_entities}")
        geo_hits = [g for g in GEO_SIGNALS if g.lower() in raw.lower()]
        if len(geo_hits) < 2:
            raise ValueError(f"Only {len(geo_hits)} geo signals, need 2+")
        for h in REQUIRED_HANDLES:
            if h not in raw:
                raise ValueError(f"Required product handle missing: {h}")
        return self

def parse(text):
    title_m = re.search(r'^# (.+)', text, re.M)
    desc_m  = re.search(r'^> (.+)', text, re.M)
    title   = title_m.group(1).strip() if title_m else ""
    desc    = desc_m.group(1).strip()  if desc_m  else ""
    return {
        "raw":                text,
        "title":              title,
        "description":        desc,
        "section_count":      len(re.findall(r'^## .+', text, re.M)),
        "internal_url_count": len(re.findall(r'\(https?://tiptop360\.com[^)]*\)', text)),
        "byte_size":          len(text.encode("utf-8")),
    }

def score(text, doc):
    s = 0
    s += 10 if doc.title else 0
    s += 10 if len(doc.description) >= 80 else 0
    s += min(20, doc.section_count * 5)
    s += min(25, len([e for e in REQUIRED_ENTITIES if e.lower() in text.lower()]) * 5)
    s += min(20, doc.internal_url_count // 6)
    s += min(15, len(re.findall(r'\b(what|how|why|is|does)\b.+\?', text, re.I)) * 3)
    return min(100, s)

def run(source, is_file=False, as_json=False):
    if is_file:
        text = open(source, encoding="utf-8").read()
    else:
        r    = req.urlopen(req.Request(source, headers={"User-Agent":"TipTop360-Validator/1.0"}), timeout=10)
        text = r.read().decode("utf-8")

    data = parse(text)
    try:
        doc     = LlmsTxtDocument(**data)
        geo     = score(text, doc)
        result  = {"status":"PASS","score":geo,"byte_size":doc.byte_size,
                   "title":doc.title,"description_length":len(doc.description),
                   "section_count":doc.section_count,"internal_url_count":doc.internal_url_count}
        if as_json:
            print(json.dumps(result, indent=2))
        else:
            print(f"\n{'='*50}")
            print(f"  Status   : PASS")
            print(f"  Score    : {geo}/100")
            print(f"  Bytes    : {doc.byte_size:,}")
            print(f"  Title    : {doc.title}")
            print(f"  Desc len : {len(doc.description)} chars")
            print(f"  Sections : {doc.section_count}")
            print(f"  URLs     : {doc.internal_url_count}")
            print(f"{'='*50}\n")
    except ValidationError as e:
        errs = [{"field": str(err["loc"]), "msg": err["msg"]} for err in e.errors()]
        if as_json:
            print(json.dumps({"status":"FAIL","validation_errors":errs}, indent=2))
        else:
            print("FAIL")
            for err in errs:
                print(f"  [{err['field']}] {err['msg']}")
        sys.exit(1)

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    g = p.add_mutually_exclusive_group(required=True)
    g.add_argument("--url")
    g.add_argument("--file")
    p.add_argument("--no-url-check", action="store_true")
    p.add_argument("--json", dest="as_json", action="store_true")
    args = p.parse_args()
    run(args.url or args.file, is_file=bool(args.file), as_json=args.as_json)
