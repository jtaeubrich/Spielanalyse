#!/usr/bin/env python3
"""Regenerate documentation clip metadata from the pseudonymized match fixture.

The source MP4 is not needed to generate this metadata. Times refer to the
same source-video timeline as the H1/H2 sync anchors stored in the fixture.
"""
import argparse
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
FIXTURE = HERE / "fixtures" / "04-live-video-review.json"
DESTINATION = HERE / "companion-documentation-manifest.json"

# IDs are stable in the documentation fixture. Never infer scene contents
# from unrelated events or change the source footage without recalibrating.
SCENES = [
    ("01-live-tor", "Live Scouting: Torabschluss", "doku_01_live_tor",
     [1791036959483], 10, 5),
    ("02-abwehr-situation", "Video-Nachanalyse: Abwehrsituation und Schlüssel-Moment",
     "doku_02_abwehr_situation", [1791037146649, 1791103307408], 10, 10),
    ("03-parade-gegenstoss", "Video Scouting: Parade und anschließender Gegenstoß",
     "doku_03_parade_gegenstoss", [1791037211424, 1791037229072], 10, 8),
    ("04-highlight", "Eventdetails, Zeichnung und Highlight",
     "doku_04_highlight", [1791038054765], 12, 6),
    ("05-zweite-halbzeit", "H2-Synchronisation: Parade und Tor",
     "doku_05_zweite_halbzeit", [1791039382672, 1791039416266], 12, 9),
]


def event_video_time(event, video):
    half = int(event["half"])
    if half not in (1, 2) or event.get("realTime") is None:
        raise ValueError(f"Missing valid live anchor for event {event['id']}")
    sync = video["h2SyncRealTime" if half == 2 else "h1SyncRealTime"]
    live_start = video["h2LiveStartMs" if half == 2 else "h1LiveStartMs"]
    if sync is None or live_start is None:
        raise ValueError(f"Missing H{half} synchronization data")
    return float(sync) + (float(event["realTime"]) - float(live_start)) / 1000


def generate(game):
    events = {str(e["id"]): e for e in game["events"]}
    video = game["video"]
    outputs = []
    for key, label, file_base, ids, pre, post in SCENES:
        refs = [events[str(event_id)] for event_id in ids]
        positions = [event_video_time(event, video) for event in refs]
        start = round(max(0.0, min(positions) - pre), 3)
        end = round(max(positions) + post, 3)
        if end <= start:
            raise ValueError(f"Invalid video cut: {key}")
        outputs.append({
            "outputId": key,
            "label": label,
            "fileBase": file_base,
            "fileName": file_base + ".mp4",
            "visibility": "private",
            "playlistTargets": [],
            "segments": [{
                "start": start, "end": end,
                "eventId": refs[0]["id"],
                "eventType": refs[0]["type"],
                "gameTime": refs[0]["displayTime"],
                "videoTime": round(positions[0], 3),
                "eventIds": ids,
            }],
            "documentationEvents": [{
                "eventId": event["id"],
                "type": event["type"],
                "gameTime": event["displayTime"],
                "videoTime": round(video_pos, 3),
                "clipTime": round(video_pos - start, 3),
            } for event, video_pos in zip(refs, positions)],
        })
    return {
        "format": "handball-match-flow-clip-upload-manifest",
        "version": 1,
        "source": {"localFileName": "referenzspiel.mp4"},
        "game": {"name": game["gameName"], "competition": game["competition"]},
        "preset": {"name": "Spielanalyse Dokumentation", "filters": {"type": "all"}},
        "documentation": {
            "fixture": "docs/handbuch/demo/fixtures/04-live-video-review.json",
            "matchDurationPerHalfMinutes": 25,
            "referenceTiming": "H1/H2-video-sync + live-realTime",
            "note": "Nur korrekt bei gleicher Video-Zeitachse wie der ursprünglich synchronisierten Aufnahme. Vor Nutzung gegenprüfen.",
        },
        "outputs": outputs,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--fixture", type=Path, default=FIXTURE)
    parser.add_argument("--output", type=Path, default=DESTINATION)
    parser.add_argument("--check", action="store_true", help="Fail if the manifest differs")
    args = parser.parse_args()
    game = json.loads(args.fixture.read_text(encoding="utf-8"))
    value = generate(game)
    if args.check:
        if not args.output.exists() or json.loads(args.output.read_text(encoding="utf-8")) != value:
            parser.error("Documentation clip manifest out of date; run generator without --check")
        print(f"OK: {len(value['outputs'])} reproducible Companion clips")
    else:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"Wrote {args.output} ({len(value['outputs'])} clips)")


if __name__ == "__main__":
    main()
