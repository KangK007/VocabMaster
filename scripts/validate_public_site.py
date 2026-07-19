"""Validate the static public release pages."""
import argparse
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"
REQUIRED_PAGES = [
    SITE / "index.html",
    SITE / "support" / "index.html",
    SITE / "privacy" / "index.html",
    SITE / "downloads" / "vocabmaster" / "2.0.0" / "index.html",
]
PLACEHOLDER_TEXT = [
    "your-domain.example",
    "待替换",
    "<github-username>",
    "<repo-name>",
]


class LinkParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.images = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == "a" and values.get("href"):
            self.links.append(values["href"])
        if tag == "img" and values.get("src"):
            self.images.append(values["src"])


def _resolve_reference(source, reference):
    if reference.startswith(("http://", "https://", "mailto:", "#")):
        return None
    return (source.parent / reference).resolve()


def validate_public_site(root=ROOT):
    errors = []
    for page in REQUIRED_PAGES:
        if not page.exists():
            errors.append(f"missing page: {page.relative_to(root)}")
            continue

        text = page.read_text(encoding="utf-8-sig")
        if "<title>" not in text or 'meta name="description"' not in text:
            errors.append(f"missing title or description: {page.relative_to(root)}")

        parser = LinkParser()
        parser.feed(text)
        for image in parser.images:
            target = _resolve_reference(page, image)
            if target and not target.exists():
                errors.append(f"broken image from {page.relative_to(root)}: {image}")
        for link in parser.links:
            target = _resolve_reference(page, link)
            if target and not target.exists():
                errors.append(f"broken link from {page.relative_to(root)}: {link}")

    readme = SITE / "README.md"
    if not readme.exists():
        errors.append("missing site/README.md")
    else:
        readme_text = readme.read_text(encoding="utf-8-sig")
        for text in PLACEHOLDER_TEXT:
            if text not in readme_text:
                errors.append(f"site/README.md should document placeholder: {text}")

    return errors


def validate_release_content(root=ROOT):
    errors = []
    for page in REQUIRED_PAGES:
        if not page.exists():
            continue
        text = page.read_text(encoding="utf-8-sig")
        for placeholder in PLACEHOLDER_TEXT:
            if placeholder in text:
                errors.append(
                    f"release placeholder remains in {page.relative_to(root)}: {placeholder}"
                )
    return errors


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--strict",
        action="store_true",
        help="fail if public HTML still contains release placeholders",
    )
    args = parser.parse_args()

    errors = validate_public_site()
    if args.strict:
        errors.extend(validate_release_content())
    if errors:
        for error in errors:
            print(error)
        return 1
    print("Public site OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
