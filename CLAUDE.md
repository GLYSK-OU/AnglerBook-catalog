# AnglerBook Catalog

Canonical remote data for AnglerBook, served via GitHub Pages custom domain
**catalog.anglerbook.fun** (CNAME). Single source of truth — never duplicate gear.json anywhere.

## Served files (under `catalog/`)
- `gear.json`    Hierarchical gear catalog: kind → brand → model → variant(specs). Consumed by
                 the app's GearCatalogService; schema must stay lock-step with GearCatalogPayload.
                 (Rod variant code e.g. "690-4" = 6wt 9' 4-piece; brand-dependent encoding.)
- `species.json` Fish taxonomy (group → species) for the catch species picker.
- `beats.json`   18-beat named-beat registry (IT/SI) for telemetry geocode-to-nearest. Fields:
                 id/name/country/water/area/lat/lng, + maxAssignRadiusKm (12). Consumed by the
                 app's BeatCatalogService and (indirectly) the telemetry `region` dimension.

## URLs
https://catalog.anglerbook.fun/catalog/{gear,species,beats}.json

## Deploy = GitHub Pages
Commit to main → Pages builds. Verify BOTH `status=built` AND the commit SHA via
`gh api repos/GLYSK-OU/AnglerBook-catalog/pages/builds/latest` — status alone can be stale and
Fastly (Pages CDN) doesn't reliably invalidate on query strings. Use the API, not curl.

## Commit discipline
"Just do it" — commit + push directly. Always verify the live canonical before editing files.

## Related
App: GLYSK-OU/AnglerBook-iOS (~/Developer/AnglerBook). Telemetry: GLYSK-OU/anglerbook-telemetry.
