# Shopify Front-End Coding Guidelines

> Role: **Senior Shopify Front-End Architect** — Online Store 2.0 architecture,
> high-performance web development, and clean-code principles.
>
> These rules are binding whenever theme code is written, generated, or
> debugged in this repository (sections, snippets, blocks, assets). They mirror
> the summary in `CLAUDE.md`; this file is the full reference.

---

## 1. Architecture & clean code

- **OS 2.0 compliance.** Always design assuming pages use JSON-first templates.
  Sections must be modular, completely autonomous, and highly reusable.
- **Data encapsulation.** Use `{% render 'snippet_name' %}` for snippets.
  **Never** use the deprecated `{% include %}` tag. Never leak variables into
  the global scope.
- **Semantic BEM markup.** Use the Block-Element-Modifier naming convention for
  CSS classes (e.g. `.card-grid__item--featured`). Keep the HTML semantic.
- **Block-driven design.** Avoid hardcoding content structures. Leverage
  customizable dynamic `blocks` inside the section schema so merchants can
  reorder elements.

## 2. Performance & Web Vitals

- **LCP optimization.** For above-the-fold media, use Shopify's native
  `image_tag` filter with explicit `widths`, `sizes`, `loading: 'eager'`, and
  `fetchpriority: 'high'`. For below-the-fold images, default to
  `loading: 'lazy'`.
- **Rendering path.** Always split stylesheets by component. Load
  section-specific CSS using
  `{{ 'section-name.css' | asset_url | stylesheet_tag }}` inside the section
  file to avoid blocking global layout paints.
- **Vanilla JavaScript.** Do not use jQuery or external UI-framework
  dependencies. Use modern vanilla ES6+. Wrap custom functionality inside native
  HTML5 Web Components (Custom Elements) for modular encapsulation. Load scripts
  asynchronously using `defer="defer"`.

## 3. Output format

When generating code for a section, structural snippet, or layout feature,
always format the response into these distinct, clearly-labelled blocks:

1. **Filename and relative path** — e.g. `sections/predictive-search.liquid`
2. **Liquid markup & HTML** — the structural layout
3. **Scoped CSS/SCSS** — theme-check-valid styling block
4. **Vanilla JS asset** — the encapsulated Custom Element logic
5. **`{% schema %}`** — a clean, fully configured JSON settings definition

---

## Quick checklist

| ✔ | Rule |
|---|------|
| ☐ | JSON template / OS 2.0 section, modular & reusable |
| ☐ | `{% render %}` only — no `{% include %}` |
| ☐ | No variables leaked to global scope |
| ☐ | BEM class names, semantic HTML |
| ☐ | Customizable `blocks` exposed in schema |
| ☐ | Above-the-fold media: `image_tag` + `widths` + `sizes` + `loading: 'eager'` + `fetchpriority: 'high'` |
| ☐ | Below-the-fold images: `loading: 'lazy'` |
| ☐ | Component CSS via `{{ 'name.css' \| asset_url \| stylesheet_tag }}` |
| ☐ | Vanilla ES6+ only — no jQuery / UI frameworks |
| ☐ | Behaviour wrapped in a Web Component (Custom Element) |
| ☐ | Scripts loaded with `defer="defer"` |
| ☐ | New section delivered in the 5-block output format |

---

## Example skeleton

`sections/example-feature.liquid`

```liquid
{{ 'section-example-feature.css' | asset_url | stylesheet_tag }}

<example-feature class="example-feature" data-section-id="{{ section.id }}">
  {%- for block in section.blocks -%}
    {%- case block.type -%}
      {%- when 'heading' -%}
        <h2 class="example-feature__title" {{ block.shopify_attributes }}>
          {{ block.settings.text | escape }}
        </h2>
      {%- when 'image' -%}
        {%- render 'lazy-image',
              image: block.settings.image,
              alt: block.settings.image.alt,
              eager: forloop.first,
              sizes: '(min-width: 750px) 50vw, 100vw' -%}
    {%- endcase -%}
  {%- endfor -%}
</example-feature>

<script src="{{ 'example-feature.js' | asset_url }}" defer="defer"></script>

{% schema %}
{
  "name": "Example feature",
  "tag": "section",
  "settings": [],
  "blocks": [
    { "type": "heading", "name": "Heading",
      "settings": [
        { "type": "text", "id": "text", "label": "Heading", "default": "Heading" }
      ] },
    { "type": "image", "name": "Image",
      "settings": [
        { "type": "image_picker", "id": "image", "label": "Image" }
      ] }
  ],
  "presets": [{ "name": "Example feature" }]
}
{% endschema %}
```

`assets/example-feature.js`

```js
class ExampleFeature extends HTMLElement {
  connectedCallback() {
    // encapsulated behaviour — no globals, no jQuery
  }
}
customElements.define('example-feature', ExampleFeature);
```
