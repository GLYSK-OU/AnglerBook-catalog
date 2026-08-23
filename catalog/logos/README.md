# Brand logos

PNG (transparent, square, >=256px preferred) named by brand slug, e.g. `sage.png`.
Referenced by each brand's `logo.url` in `../gear.json`.

## The invariant

**Never declare a `logo.url` without the PNG already committed here.** A declared URL
with no file behind it is an HTTP 404 on every catalog render in both apps. The apps
hide it — they fall back to the brand initials — so the badge looks fine while the
request fails underneath. `scripts/check-catalog.py` enforces this and gates the Pages
deploy.

## Marks are hand-supplied

Never fetch, script or scrape a logo. Auto-fetching from a brand's domain returns the
*parent company's* mark for any brand under a group — that is how the Far Bank logo
ended up on Sage, Rio and Redington. The script that did it (`pull-logos.sh`) has been
removed; `check-catalog.py` validates, it never downloads.

## Adding a logo

1. Obtain the mark by hand.
2. Process for the circular badge: background flood-filled to transparent, trimmed,
   centred on a square, resized to 256px.
3. Commit the PNG here **first**, as `<brand-slug>.png`.
4. Then add the `logo` block to that brand in `../gear.json` — in **every** kind the
   brand appears under, identically.
5. `python3 scripts/check-catalog.py` must exit 0 before you push.
6. After deploy, confirm the live URL returns 200.

A PNG here that no brand references yet is fine — the checker warns, it does not fail,
because committing the file before the block is the correct order.

Missing file and no `logo` block -> the app shows the brand initial. That is the
intended fallback, not a bug.
