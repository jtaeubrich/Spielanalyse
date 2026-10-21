#!/usr/bin/env python3
"""Publish a small, deterministic screenshot set for the built-in help dialog.

Run after capture_screenshots.py has generated browser screenshots.
Only pseudonymized JSON fixtures are used; no actual game video is bundled.
"""
from __future__ import annotations

import argparse
from pathlib import Path
from PIL import Image, ImageStat

# Source screenshot, output image, viewport bounds to crop (if full-page).
IMAGES = [
    ("desktop/00-setup-setup.png", "setup-desktop.jpg", (1440, 900)),
    ("desktop/01-live-early-match.png", "w1-live-desktop.jpg", (1440, 900)),
    ("phone-portrait/01-live-early-match.png", "w1-live-mobile.jpg", (390, 844)),
    ("desktop/04-live-video-review-match.png", "w2-review-desktop.jpg", (1440, 900)),
    ("phone-portrait/04-live-video-review-match.png", "w2-review-mobile.jpg", (390, 844)),
    ("desktop/05-video-scouting-early-match.png", "w3-video-desktop.jpg", (1440, 900)),
    ("phone-portrait/05-video-scouting-early-match.png", "w3-video-mobile.jpg", (390, 844)),
    ("desktop/03-live-complete-analysis.png", "analysis-desktop.jpg", (1440, 900)),
    ("desktop/04-live-video-review-video.png", "video-desktop.jpg", (1440, 900)),
    ("desktop/03-live-complete-data.png", "data-desktop.jpg", (1440, 900)),
]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--screenshots", type=Path, default=Path("documentation-screenshots"))
    parser.add_argument("--output", type=Path,
                        default=Path("docs/handbuch/images/generated"))
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)

    created = []
    for source_name, output_name, (w, h) in IMAGES:
        source = args.screenshots / source_name
        if not source.is_file():
            parser.error(f"Required PWA screenshot missing: {source}")
        with Image.open(source) as image:
            image.load()
            if image.width < w or image.height < h:
                parser.error(f"Screenshot unexpectedly small: {source}, {image.size}")
            # Crop the first real browser viewport: avoid huge, unreadable
            # full-page screenshots in the small help-dialog content area.
            image = image.crop((0, 0, w, h)).convert("RGB")
            if max(ImageStat.Stat(image).stddev) < 6:
                parser.error(f"Suspiciously empty screenshot: {source}")
            if w > 1280:
                image.thumbnail((1280, 900), Image.Resampling.LANCZOS)
            output = args.output / output_name
            image.save(output, format="JPEG", quality=89, subsampling=0,
                       optimize=True, progressive=True)
            created.append((str(output), output.stat().st_size))
    for file, size in created:
        print(f"PUBLISHED {file} ({size} bytes)", flush=True)
    print(f"Ready: {len(created)} built-in help images", flush=True)


if __name__ == "__main__":
    main()
