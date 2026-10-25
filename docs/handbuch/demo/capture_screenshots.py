#!/usr/bin/env python3
"""Genuine Chromium screenshots of Spielanalyse fixtures using the real UI."""
import argparse
import pathlib
import json
import functools
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from playwright.sync_api import sync_playwright
from season_demo import season_demo, mock_schedule, mock_match

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
    handler = functools.partial(SimpleHTTPRequestHandler, directory=str(args.app.resolve().parent))
    server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    app_url = f'http://127.0.0.1:{server.server_port}/{args.app.name}'
    try:
      with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for device, (width, height) in VIEWPORTS.items():
            if args.only_device and device != args.only_device:
                continue
            context = browser.new_context(viewport={"width": width, "height": height}, device_scale_factor=1)
            page = context.new_page()
            for filename in STATES:
                page.goto(app_url, wait_until="domcontentloaded")
                page.wait_for_function("() => typeof document.querySelector('#continueGameInput')?.onchange === 'function'", timeout=30000)
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
                total_seconds = int(expected["gameTime"])
                expected_clock = f"{total_seconds // 60:02d}:{total_seconds % 60:02d}"
                page.wait_for_function(
                    "(clock) => document.querySelector('#gameClock')?.textContent.trim() === clock",
                    arg=expected_clock, timeout=10000,
                )
                print(f"VERIFIED {device} {filename}: {expected_events} events, "
                      f"mode={actual_mode}, clock={expected_clock}", flush=True)
                page.locator('[data-tab="setup"]').click()
                page.locator("#setupTab.tab-pane.active").wait_for(timeout=10000)
                folder = args.output / device
                folder.mkdir(parents=True, exist_ok=True)
                stem = pathlib.Path(filename).stem
                # Do not capture the temporary "Spiel zum Fortsetzen geladen" toast.
                page.locator("#toast").wait_for(state="hidden", timeout=5000)
                page.screenshot(path=str(folder / (stem + "-setup.png")), full_page=True)
                page.locator('[data-tab="match"]').click()
                page.locator("#matchTab.tab-pane.active").wait_for(timeout=10000)
                if filename == "04-live-video-review.json":
                    page.locator("#matchReviewToggle").click()
                    page.locator("body.match-review-mode").wait_for(timeout=10000)
                else:
                    if page.locator("body.match-review-mode").count():
                        raise RuntimeError(f"{filename}: unexpected video-review mode")
                page.locator("#toast").wait_for(state="hidden", timeout=5000)
                page.screenshot(path=str(folder / (stem + "-match.png")), full_page=True)
                if filename == "03-live-complete.json":
                    for tab in ("analysis", "data"):
                        page.locator(f'[data-tab="{tab}"]').click()
                        page.locator(f"#{tab}Tab.tab-pane.active").wait_for(timeout=10000)
                        page.screenshot(path=str(folder / (stem + f"-{tab}.png")),
                                        full_page=False)
                if filename == "04-live-video-review.json":
                    page.locator('[data-tab="video"]').click()
                    page.locator("#videoTab.tab-pane.active").wait_for(timeout=10000)
                    page.screenshot(path=str(folder / (stem + "-video.png")),
                                    full_page=False)
                print(f"CAPTURED {device} {filename}", flush=True)
            # Extended documentation: reproduce the user's 18-match season
            # through the real UI, using anonymized fixture players and events.
            def mock_handball360(route):
                url=route.request.url
                cors={"Access-Control-Allow-Origin":"*",
                      "Access-Control-Allow-Headers":"Authorization",
                      "Access-Control-Allow-Methods":"GET,OPTIONS"}
                if route.request.method=="OPTIONS":
                    return route.fulfill(status=204,headers=cors)
                if "/team/85814/matches" in url:
                    data=mock_schedule()
                elif "/match/378112" in url:
                    data=mock_match("378112")
                else:
                    return route.fulfill(status=404,headers=cors,
                                         content_type="application/json",body='{"error":"unknown demo match"}')
                return route.fulfill(status=200,headers=cors,
                                     content_type="application/json",
                                     body=json.dumps(data,ensure_ascii=False))
            page.route("**/handball360-proxy-235703972531.europe-west1.run.app/**",mock_handball360)
            page.goto(app_url,wait_until="domcontentloaded")
            page.wait_for_function("() => typeof document.querySelector('#seasonImportInput')?.onchange === 'function'",timeout=30000)
            season=season_demo()
            page.locator('[data-tab="setup"]').click()
            page.locator("#setupModeSeason").click()
            page.locator("#seasonImportInput").set_input_files({
                "name":"anonymisierte-saison-demo.json",
                "mimeType":"application/json",
                "buffer":json.dumps(season,ensure_ascii=False).encode("utf-8")
            })
            page.wait_for_function("() => document.querySelectorAll('#seasonGameList .season-game-item').length === 18",timeout=10000)
            # Activate the upcoming fixture before documenting the season, so
            # the global app header no longer shows an unrelated demo game.
            page.locator('[data-tab="setup"]').click()
            page.locator("#setupSeasonGameSelect").select_option(value="sg-demo-378112")
            page.locator("#setupSeasonContinue").click()
            page.locator('[data-tab="setup"]').click()
            page.locator("#setupModeSeason").click()
            page.locator("#toast").wait_for(state="hidden",timeout=10000)
            page.screenshot(path=str(folder/"season-overview.png"),full_page=False)
            page.locator('[data-tab="season"]').click()
            page.locator("#seasonStats").scroll_into_view_if_needed()
            page.screenshot(path=str(folder/"season-analytics.png"),full_page=False)
            page.locator('[data-tab="setup"]').click()
            page.locator("#setupSeasonGameSelect").select_option(value="sg-demo-378112")
            page.locator("#setupSeasonGameSelect").scroll_into_view_if_needed()
            page.screenshot(path=str(folder/"setup-season-game.png"),full_page=False)
            page.locator("#setupSeasonRosterRefresh").click()
            page.locator("#setupOfficialRosterDialog[open]").wait_for(timeout=10000)
            page.screenshot(path=str(folder/"setup-lineup-review.png"),full_page=False)
            page.locator("#setupOfficialRosterCancel").click()
            page.locator('[data-tab="setup"]').click()
            page.locator("#setupModeSeason").click()
            # One manual game is deliberately left without its official match ID
            # to illustrate the reassociation UI without using private data.
            manual=season_demo()
            manual["games"][0]["fileName"]="manual-demo.json"
            manual["games"][0]["data"].pop("officialSource",None)
            page.locator("#seasonImportInput").set_input_files({
                "name":"anonymisierte-saison-manuell.json",
                "mimeType":"application/json",
                "buffer":json.dumps(manual,ensure_ascii=False).encode("utf-8")
            })
            page.wait_for_function("() => document.querySelectorAll('#seasonGameList .season-game-item').length === 18",timeout=10000)
            page.locator("#seasonHandball360Open").click()
            page.locator("#seasonH360Team").fill("https://www.handball.net/team/85814?phaseId=13580")
            page.locator("#seasonH360Preview").click()
            page.wait_for_function("() => document.querySelectorAll('#seasonH360List input[data-match-id]').length === 18",timeout=15000)
            page.locator("#seasonH360List .season-h360-row").first.scroll_into_view_if_needed()
            page.screenshot(path=str(folder/"season-import-preview.png"),full_page=False)
            page.locator("#seasonH360Close").click()
            print(f"VERIFIED {device} season demo: 18 matches (5 completed), lineup preview, manual match link",flush=True)
            context.close()
        browser.close()
    finally:
      server.shutdown()
      server.server_close()

if __name__ == "__main__":
    main()
