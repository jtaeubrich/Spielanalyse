"""Reproducible anonymized season demo for screenshots.

Fixture dates, pairings and official match IDs follow the season schedule
provided for documentation. Names of minors and original scouting events are
never copied into the repository: events/players use existing pseudonymous
demo data and are only illustrative.
"""
import copy
import datetime as dt
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
CLUB = "TSV Kronshagen"
TEAM_ID = "85814"
# Date/time values reflect the supplied season export (ISO 8601, UTC).
FIXTURES = [
    ("378087","2026-09-05T14:00:00+00:00","VfL Bad Schwartau II","TSV Kronshagen"),
    ("378092","2026-09-13T17:30:00+00:00","HC Treia/Jübek","TSV Kronshagen"),
    ("378097","2026-09-20T14:00:00+00:00","HTS/BW96 Handball","TSV Kronshagen"),
    ("378102","2026-09-27T17:00:00+00:00","MTV Lübeck II","TSV Kronshagen"),
    ("378107","2026-10-03T16:00:00+00:00","HSG Herzhorn/Kollmar/Neuendorf","TSV Kronshagen"),
    ("378112","2026-11-07T15:00:00+00:00","TSV Kronshagen","SG Flensburg-Handewitt II"),
    ("378117","2026-11-15T11:30:00+00:00","SG Hamburg-Nord","TSV Kronshagen"),
    ("378081","2026-11-22T12:45:00+00:00","Walddörfer SV","TSV Kronshagen"),
    ("378122","2026-11-28T17:00:00+00:00","TSV Kronshagen","THW Kiel II"),
    ("378126","2026-12-05T19:00:00+00:00","TSV Kronshagen","Walddörfer SV"),
    ("378132","2026-12-12T15:00:00+00:00","TSV Kronshagen","VfL Bad Schwartau II"),
    ("378137","2027-01-09T14:00:00+00:00","TSV Kronshagen","HC Treia/Jübek"),
    ("378142","2027-01-23T15:00:00+00:00","TSV Kronshagen","HTS/BW96 Handball"),
    ("378147","2027-01-31T11:00:00+00:00","TSV Kronshagen","MTV Lübeck II"),
    ("378152","2027-02-06T17:00:00+00:00","TSV Kronshagen","HSG Herzhorn/Kollmar/Neuendorf"),
    ("378157","2027-02-21T17:30:00+00:00","SG Flensburg-Handewitt II","TSV Kronshagen"),
    ("378162","2027-03-13T15:00:00+00:00","TSV Kronshagen","SG Hamburg-Nord"),
    ("378167","2027-03-20T15:30:00+00:00","THW Kiel II","TSV Kronshagen")
]
def season_demo():
    sample = json.loads((HERE/"fixtures"/"03-live-complete.json").read_text(encoding="utf-8"))
    # Refuse accidental inclusion of private information: only verified
    # pseudonymous names already in our checked-in demo fixture are permitted.
    for side in ("home","away"):
        for player in sample[side]["players"]:
            assert player["nachname"].startswith("Spieler ")
    games=[]
    for idx,(match_id,date,home,away) in enumerate(FIXTURES):
        played=idx<5
        data=copy.deepcopy(sample)
        data["home"]["name"]=home
        data["away"]["name"]=away
        data["gameDate"]=date
        data["gameName"]=dt.datetime.fromisoformat(date).strftime("%d.%m.%Y")+" | "+home+" - "+away
        data["competition"]="Regionalliga Nord männliche B-Jugend"
        data["ownTeam"]="home" if home==CLUB else "away"
        data["officialSource"]={
            "provider":"handball.net","matchId":match_id,"matchDate":date,
            "teamId":TEAM_ID,"rosterSource":"events" if played else "provisional"
        }
        data["gameTime"]=0
        data["timer"]["half"]=1
        data["timer"]["secondsElapsed"]=0
        data["timer"]["active"]=False
        data["video"]={"h1SyncRealTime":None,"h2SyncRealTime":None}
        data["isHistorical"]=played
        data["isVideoscoutingFile"]=played
        data["events"]=copy.deepcopy(sample["events"]) if played else []
        if not played:data["provisionalRosters"]={"home":True,"away":True}
        games.append({
            "id":"sg-demo-"+match_id,
            "fileName":"handball360_"+match_id+".json",
            "selected":played,
            "data":data
        })
    result={
        "format":"handball-spielanalyse-season","version":1,
        "name":"Saison 2026/27 – Demo",
        "preferredTeam":CLUB,
        "archiveTeam":"TSV Kronshagen mB",
        "playerAliases":{},
        "games":games
    }
    assert len(result["games"])==18
    assert sum(g["selected"] for g in games)==5
    assert len({g["data"]["officialSource"]["matchId"] for g in games})==18
    return result

def mock_schedule():
    return {"teamId":TEAM_ID,"total":len(FIXTURES),"dateFrom":"2026-07-01",
        "dateTo":"2027-06-30",
        "matches":[{
            "id":mid,"date":date,"status":"scheduled",
            "local":{"name":home,"id":TEAM_ID if home==CLUB else "other-"+mid},
            "visitor":{"name":away,"id":TEAM_ID if away==CLUB else "other-"+mid},
            "phase":{"competition":{"name":"Regionalliga Nord männliche B-Jugend"}}
        } for mid,date,home,away in FIXTURES]}

def mock_match(mid="378112"):
    match=next((item for item in mock_schedule()["matches"] if item["id"]==mid),None)
    if not match:raise ValueError("Unknown demo match "+mid)
    def player(n):
        return {"player":{"id":8000+n,"first_name":"Demo","last_name":f"Spieler {n:02d}"},
                "number":n,"is_goalkeeper":n==1}
    return {
        "match_id":mid,
        "match":{"data":[{
            "id":mid,"date":match["date"],
            "local":match["local"],"visitor":match["visitor"],
            "duration":{"minutes_per_period":25}
        }]},
        "events":[],
        "lineups":{"data":{
            "local":{"players":[player(n) for n in (1,3,5,7,9,11)]},
            "visitor":{"players":[player(n) for n in (2,4,6,8,10,12)]}
        }}
    }
