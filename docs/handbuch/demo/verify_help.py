#!/usr/bin/env python3
"""Browser smoke test: the built-in help opens and its screenshot assets load."""
import argparse
import functools
import pathlib
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from playwright.sync_api import sync_playwright

WORKFLOWS = ["helpEntry", "helpW1", "helpW2", "helpW3"]


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--app", type=pathlib.Path, default=pathlib.Path("index.html"))
    p.add_argument("--output", type=pathlib.Path, default=pathlib.Path("documentation-screenshots"))
    args = p.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    handler = functools.partial(SimpleHTTPRequestHandler, directory=str(args.app.resolve().parent))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            for device, width, height in (("desktop", 1360, 900), ("phone-portrait", 390, 844)):
                context = browser.new_context(viewport={"width": width, "height": height})
                page = context.new_page()
                page.goto(f"http://127.0.0.1:{server.server_port}/{args.app.name}",
                          wait_until="domcontentloaded")
                page.wait_for_function(
                    "() => typeof document.querySelector('#continueGameInput')?.onchange === 'function'",
                    timeout=30000,
                )
                page.locator("#helpBtn").click()
                page.locator("#helpDialog[open]").wait_for(timeout=10000)
                for workflow in WORKFLOWS:
                    if not page.locator(f"#{workflow}").count():
                        raise RuntimeError(f"{device}: workflow section missing: {workflow}")
                images = page.locator("#helpDialog img")
                count = images.count()
                if count < 12:
                    raise RuntimeError(f"{device}: only {count} help images found")
                for i in range(count):
                    element = images.nth(i)
                    element.scroll_into_view_if_needed(timeout=10000)
                    page.wait_for_function(
                        "(index) => {const image = document.querySelectorAll('#helpDialog img')[index];"
                        "return Boolean(image && image.complete && image.naturalWidth > 0);}",
                        arg=i, timeout=12000,
                    )
                    actual = element.evaluate("(image) => image.currentSrc")
                    if device == "phone-portrait" and "/w1-live-desktop.jpg" in actual:
                        raise RuntimeError("Mobile help did not select mobile responsive screenshot")
                page.locator("#helpWorkflows").scroll_into_view_if_needed()
                page.screenshot(path=str(args.output / f"help-dialog-{device}.png"), full_page=False)
                print(f"HELP OK {device}: {len(WORKFLOWS)} workflows and {count} loaded images", flush=True)
                context.close()
            browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
