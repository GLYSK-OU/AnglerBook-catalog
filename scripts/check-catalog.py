#!/usr/bin/env python3
"""Validate the published catalog before it ships. Read-only: never fetches, never writes.

Replaces the old pull-logos.sh, which auto-fetched brand marks from the web and wrote a
logo.url for every brand whether or not the fetch succeeded. That produced two defects:
the Far Bank corporate mark on Sage/Rio/Redington (sibling brands serve the parent's
touch icon), and 33 brand entries advertising PNGs that were never committed, each one a
404 on every catalog render in both apps.

The invariant this enforces:

    Never declare a logo.url without the PNG already committed to catalog/logos/.

Add the file first, then the block. Marks are hand-supplied — never scripted, never
scraped. See catalog/logos/README.md for the procedure.

Exit 0 = safe to publish. Exit 1 = do not publish.
"""

import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CATALOG = os.path.join(ROOT, "catalog")
LOGO_DIR = os.path.join(CATALOG, "logos")

# Logos are self-hosted. Anything pointing elsewhere is either a distributor mark or a
# third-party CDN, both of which we have been burned by.
URL_PREFIX = (
    "https://raw.githubusercontent.com/GLYSK-OU/AnglerBook-catalog/main/catalog/logos/"
)

errors: list[str] = []
warnings: list[str] = []


def slug(name: str) -> str:
    """Brand name -> logo filename stem. 'G. Loomis' -> 'g-loomis'."""
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", name.lower())).strip("-")


def load(name: str):
    """Parse a served JSON file. A file that does not parse must never reach the CDN."""
    path = os.path.join(CATALOG, name)
    try:
        with open(path, encoding="utf-8") as handle:
            return json.load(handle)
    except FileNotFoundError:
        errors.append(f"{name}: missing — it is a served file and must exist")
    except json.JSONDecodeError as exc:
        errors.append(f"{name}: does not parse ({exc})")
    return None


def check_logos(gear) -> None:
    """Every declared logo.url must resolve to a committed PNG, and vice versa."""
    on_disk = {f for f in os.listdir(LOGO_DIR) if f.endswith(".png")}
    referenced: set[str] = set()
    # iOS logoURL(forBrand:) returns the first match across kinds, so a brand that
    # disagrees with itself resolves unpredictably depending on dict ordering.
    per_brand: dict[str, set[str | None]] = {}

    for kind in gear.get("kinds", []):
        for brand in kind.get("brands", []):
            name = brand.get("brand", "<unnamed>")
            logo = brand.get("logo")
            per_brand.setdefault(name, set()).add(
                logo.get("url") if isinstance(logo, dict) else None
            )
            if logo is None:
                continue  # No block at all: the app shows initials. Legitimate.

            url = logo.get("url")
            where = f"{kind.get('kind', '?')}/{name}"
            if not url:
                errors.append(
                    f"{where}: has a logo block with no url — drop the block instead, "
                    f"a partial block declares a mark that cannot render"
                )
                continue
            if not url.startswith(URL_PREFIX):
                errors.append(
                    f"{where}: logo.url is not self-hosted ({url}) — "
                    f"must start with {URL_PREFIX}"
                )
                continue

            filename = url[len(URL_PREFIX):]
            referenced.add(filename)
            expected = f"{slug(name)}.png"
            if filename != expected:
                errors.append(
                    f"{where}: logo filename {filename!r} does not match brand slug "
                    f"(expected {expected!r})"
                )
            if filename not in on_disk:
                errors.append(
                    f"{where}: declares {filename} but catalog/logos/{filename} "
                    f"does not exist — this is a 404 on every catalog render"
                )

    for name, urls in sorted(per_brand.items()):
        if len(urls) > 1:
            shown = ", ".join(sorted(str(u) for u in urls))
            errors.append(
                f"{name}: disagrees with itself across kinds ({shown}) — "
                f"a brand must declare the same logo everywhere or nowhere"
            )

    # Committing the PNG before the JSON block is the documented order, so an
    # unreferenced file is a valid intermediate state, not a failure.
    for orphan in sorted(on_disk - referenced):
        warnings.append(
            f"catalog/logos/{orphan} is not referenced by any brand — "
            f"add its logo block to gear.json, or delete the file"
        )


def main() -> int:
    gear = load("gear.json")
    load("species.json")
    load("beats.json")

    if gear is not None:
        if os.path.isdir(LOGO_DIR):
            check_logos(gear)
        else:
            errors.append("catalog/logos/ is missing")

    for warning in warnings:
        print(f"warning: {warning}")
    for error in errors:
        print(f"ERROR: {error}", file=sys.stderr)

    if errors:
        print(
            f"\n{len(errors)} problem(s) — not safe to publish. "
            f"Logos are hand-supplied: add the PNG to catalog/logos/ first, "
            f"then the logo block. Never fetch marks from the web.",
            file=sys.stderr,
        )
        return 1

    print(f"catalog OK ({len(warnings)} warning(s))")
    return 0


if __name__ == "__main__":
    sys.exit(main())
