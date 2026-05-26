# Release Notes

Store one Markdown file here per tested release candidate.

Naming format:

- `theme-vYYYY-MM-DD-N.md`

Generate a draft automatically:

```bash
npm run theme:release-note -- "short summary"
```

Each release note should capture:

- branch
- commit SHA
- live theme ID
- staging theme ID
- preview URL
- rollback target theme ID
- operator
- validation checklist
