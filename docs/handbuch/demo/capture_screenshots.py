#!/usr/bin/env python3
"""Genuine Chromium screenshots of Spielanalyse fixtures using the real UI."""
import argparse
import pathlib
import json
import hashlib
from playwright.sync_api import sync_playwright

VIEWPORTS = {"phone-portrait": (390, 844), "phone-landscape": (844, 390),
             "tablet": (1024, 768), "desktop": (1440, 900)}
STATES = ["00-setup.json", "01-live-early.json", "02-live-mid.json",
          "03-live-complete.json", "04-live-video-review.json",
          "05-video-scouting-early.json", "06-video-scouting-complete.json"]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--app", type=pathlib.Path, default=pathlib.Path("index.html"))
    parser.add_argument("--fixtures", type=pathlib.Path, default=pathlib.Path("docs/handbuch/demo/fixtures"))
    parser.add_argument("--output", type=pathlib.Path, default=pathlib.Path("docs/handbuch/demo/screenshots"))
    parser.add_argument("--only-device", choices=VIEWPORTS)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for device, (width, height) in VIEWPORTS.items():
            if args.only_device and device != args.only_device:
                continue
            context = browser.new_context(viewport={"width": width, "height": height}, device_scale_factor=1)
            page = context.new_page()
            for filename in STATES:
                page.goto(args.app.resolve().as_uri(), wait_until="domcontentloaded")
                page.locator("#continueGameInput").set_input_files(str((args.fixtures / filename).resolve()))
                page.locator("#matchTab.tab-pane.active").wait_for(timeout=10000)
                page.locator("#continueGameInput").evaluate("(el) => { if (el.files.length) throw new Error('input was not cleared') }")
                expected = json.loads((args.fixtures / filename).read_text(encoding="utf-8"))
                page.locator("#setupGameName").wait_for(state="attached")
                actual_name = page.locator("#setupGameName").input_value()
                if actual_name != expected["gameName"]:
                    raise RuntimeError(f"{filename}: fixture not loaded: got {actual_name!r}; expected {expected['gameName']!r}")
                expected_events = len(expected["events"])
                expected_visible = min(expected_events, 12)
                actual_visible = page.locator("#eventList .event").count()
                if actual_visible != expected_visible:
                    raise RuntimeError(
                        f"{filename}: expected {expected_visible} visible events "
                        f"(from {expected_events}), got {actual_visible}"
                    )
                expected_mode = "video" if expected.get("isVideoscoutingFile") else "live"
                actual_mode = page.locator("#modeSelect").input_value()
                if actual_mode != expected_mode:
                    raise RuntimeError(f"{filename}: expected {expected_mode} mode, got {actual_mode}")
                goal_events = [e for e in expected["events"] if e.get("type") == "goal" and e.get("scoreChanged")]
                if goal_events:
                    last_goal = goal_events[-1]
                    expected_score = (last_goal["scoreH"], last_goal["scoreA"])
                    actual_score = page.locator("#score").inner_text().strip().replace(" ", "")
                    if actual_score != f"{expected_score[0]}:{expected_score[1]}":
                        raise RuntimeError(f"{filename}: score mismatch {actual_score}; expected {expected_score}")
                print(f"VERIFIED {device} {filename}: {expected_events} events, mode={actual_mode}", flush=True)
                page.locator('[data-tab="setup"]').click()
                page.locator("#setupTab.tab-pane.active").wait_for(timeout=10000)
                folder = args.output / device
                folder.mkdir(parents=True, exist_ok=True)
                stem = pathlib.Path(filename).stem
                page.screenshot(path=str(folder / (stem + "-setup.png")), full_page=True)
                page.locator('[data-tab="match"]').click()
                page.locator("#matchTab.tab-pane.active").wait_for(timeout=10000)
                page.screenshot(path=str(folder / (stem + "-match.png")), full_page=True)
                print(f"CAPTURED {device} {filename}", flush=True)
            context.close()
        browser.close()

if __name__ == "__main__":
    main()
