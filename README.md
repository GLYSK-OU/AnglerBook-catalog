# AnglerBook

The **AnglerBook Gear Archive** — a structured, searchable reference of real
fly-fishing gear (rods, reels, lines, flies, waders and more), published by
GLYSK OÜ.

Live: https://www.glysk.eu/development/AnglerBook

## What's here

| Path | Purpose |
| --- | --- |
| `index.html` | The Gear Archive web page |
| `assets/css/styles.css` | Styles |
| `assets/js/app.js` | App logic — loads the catalog, filtering, detail view, submission flow |
| `catalog/gear.json` | The gear catalog (`kind → brand → model → variant(specs)`) |

## Features

- **Browse the catalog** — filter by category, brand, line weight, and free-text
  search across brand / model / code / notes.
- **Model detail** — click any product line to see every variant and its specs
  in a normalized table.
- **Reference** — line-weight, tippet (X) sizing, rod actions, tapers and
  densities pulled straight from the catalog.
- **Submit your catalog** — a guided form for manufacturers/distributors. It
  validates input, builds a structured JSON submission matching the catalog
  schema, and lets you email it (prefilled `mailto:`) or download it for the
  AnglerBook catalog team.

## Running locally

It's a static site — serve the folder over HTTP so the browser can `fetch` the
catalog JSON:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Opening `index.html` directly via `file://` will not work because browsers
block `fetch` of local files.

## Catalog data

`catalog/gear.json` is the single source of truth. The app reads `counts`,
`kinds[].brands[].models[].variants[].specs`, and the `reference` block — add or
edit entries there and the page reflects them on reload. Each category declares
its own `variantSpecFields`, which drive both the detail tables and the
submission form's per-variant fields.
