import { describe, expect, test } from "vitest";
import {
  createTeamArchive, buildTeamArchiveEntries, seasonMatchFolder
} from "../src/season-archive.js";
import {
  assignHandball360Match,
  enrichSeasonGameFromOfficial,
  seedKnownSeasonRosters,
  seasonMatchIdentity
} from "../src/season-handball360.js";

const match = {
  id: "378112", date: "2026-11-07T16:00:00Z",
  local: { id: "85814", name: "TSV Kronshagen" },
  visitor: { id: "200", name: "Gast" },
  phase: { competition: { name: "Oberliga" } }
};
function baseGame(id="manuell-1",events=[]) {
  return {
    id, fileName:"scouting.json",selected:events.length>0,ownTeam:"home",opponentTeam:"away",
    state:{
      format:"handball-spielanalyse",version:1,gameName:"TSV Kronshagen - Gast",
      gameDate:match.date,
      home:{name:"TSV Kronshagen",players:[{vorname:"Mia",nachname:"Muster",nr:7,handballNetId:"21"}]},
      away:{name:"Gast",players:[]},
      events:structuredClone(events),
      video:{youtubeUrl:"https://www.youtube.com/watch?v=abc",annotations:[{text:"Eigene Zeichnung"}]}
    }
  };
}
describe("portable per-team game archive",()=>{
  test("uses team -> home vs away + match ID -> game, video and export folders without year/team ID layers",async()=>{
    const game=baseGame();
    game.state.officialSource={matchId:"378112",provider:"handball.net",teamId:"85814"};
    const {entries,index,team}=buildTeamArchiveEntries({
      teamName:"TSV Kronshagen mB",seasonName:"Saison 2026/27",games:[game],
      createdAt:"2026-10-24T00:00:00Z"
    });
    expect(team).toBe("TSV_Kronshagen_mB");
    expect(entries.map(item=>item.path)).toEqual([
      "TSV_Kronshagen_mB/TSV_Kronshagen_vs_Gast_378112/spiel.json",
      "TSV_Kronshagen_mB/TSV_Kronshagen_vs_Gast_378112/videos/",
      "TSV_Kronshagen_mB/TSV_Kronshagen_vs_Gast_378112/exports/",
      "TSV_Kronshagen_mB/Saison_2026_27_index.json"
    ]);
    expect(JSON.parse(entries[0].data).events).toEqual([]);
    expect(index.games[0].path).toBe("TSV_Kronshagen_vs_Gast_378112/spiel.json");
    expect(seasonMatchFolder(baseGame())).toBe("TSV_Kronshagen_vs_Gast_manuell_manuell-1");
    const zip=createTeamArchive({teamName:"TSV Kronshagen mB",seasonName:"2026-27",games:[game]});
    expect(zip.fileName).toBe("TSV_Kronshagen_mB_2026-27_archiv.zip");
    const buffer=new Uint8Array(await zip.blob.arrayBuffer());
    const view=new DataView(buffer.buffer);
    expect(view.getUint32(0,true)).toBe(0x04034b50);
    expect(view.getUint32(buffer.length-22,true)).toBe(0x06054b50);
    expect(view.getUint16(buffer.length-12,true)).toBe(4);
  });
  test("keeps home/away order and stable IDs distinct for different fixtures",()=>{
    const first=baseGame("one");
    first.state.officialSource={matchId:"378112"};
    const second=structuredClone(first);
    second.id="two";
    second.state.officialSource.matchId="378113";
    second.state.home.name="Gast";
    second.state.away.name="TSV Kronshagen";
    expect(seasonMatchFolder(first)).toBe("TSV_Kronshagen_vs_Gast_378112");
    expect(seasonMatchFolder(second)).toBe("Gast_vs_TSV_Kronshagen_378113");
    const entries=buildTeamArchiveEntries({teamName:"Team",games:[first,second]}).entries;
    expect(entries.filter(entry=>entry.path.endsWith("/spiel.json"))).toHaveLength(2);
  });
  test("does not produce unsafe paths or duplicate match folders",()=>{
    const game=baseGame();
    game.state.officialSource={matchId:"378112"};
    expect(buildTeamArchiveEntries({teamName:"../TSV\\foo",games:[game]}).entries[0].path)
      .not.toContain("..");
    expect(()=>buildTeamArchiveEntries({teamName:"Team",games:[game,{...game,id:"another"}]}))
      .toThrow(/Doppelte Spiel-ID/);
  });
});
describe("safe manual match association and official refresh",()=>{
  test("associates manual scouting without changing events, video or original filename",()=>{
    const game=baseGame("mine",[{id:"evt",type:"goal",comment:"Meine Notiz"}]);
    const before=structuredClone(game.state.video);
    const associated=assignHandball360Match([game],"mine",match,"85814");
    expect(associated[0].id).toBe("mine");
    expect(associated[0].fileName).toBe("scouting.json");
    expect(associated[0].state.events).toEqual(game.state.events);
    expect(associated[0].state.video).toEqual(before);
    expect(seasonMatchIdentity(associated[0])).toBe("378112");
    expect(game.state.officialSource).toBeUndefined();
    expect(()=>assignHandball360Match(associated,"mine",{...match,id:"378113"},"85814"))
      .toThrow(/anderen/);
  });
  test("refreshes explicitly linked scouting despite abbreviated manual team labels",()=>{
    const original=baseGame("abbrev",[{id:"a",type:"goal",comment:"Bleibt"}]);
    original.state.home.name="TSV Kronshagen B";
    const linked=assignHandball360Match([original],"abbrev",match,"85814")[0];
    const fetched=baseGame("fetched",[{id:"b",type:"goal",comment:"offiziell"}]);
    fetched.state.officialSource={provider:"handball.net",matchId:"378112"};
    const refreshed=enrichSeasonGameFromOfficial(linked,fetched);
    expect(refreshed.state.home.name).toBe("TSV Kronshagen B");
    expect(refreshed.state.events).toEqual(original.state.events);
  });
  test("prohibits assigning one official fixture twice",()=>{
    const a=assignHandball360Match([baseGame("a"),baseGame("b")],"a",match,"85814");
    expect(()=>assignHandball360Match(a,"b",match,"85814")).toThrow(/bereits/);
  });
  test("enriches metadata and missing roster fields but keeps manual observations unchanged",()=>{
    const own=assignHandball360Match([baseGame("a",[{id:42,type:"goal",comment:"manuell"}])],"a",match,"85814")[0];
    const incoming=baseGame("new",[{id:1,type:"goal",comment:"official"}]);
    incoming.state.officialSource={provider:"handball.net",matchId:"378112",matchDate:match.date};
    incoming.state.competition="Oberliga";
    incoming.state.home.players=[{vorname:"Mia",nachname:"Muster",nr:7,handballNetId:"21",position:"RL"},
      {vorname:"Tom",nachname:"Neu",nr:8,handballNetId:"22"}];
    const updated=enrichSeasonGameFromOfficial(own,incoming);
    expect(updated.state.events).toEqual(own.state.events);
    expect(updated.state.video).toEqual(own.state.video);
    expect(updated.state.home.players).toHaveLength(2);
    expect(updated.state.home.players[0].position).toBe("RL");
    expect(updated.selected).toBe(true);
    expect(updated.state.competition).toBe("Oberliga");
  });
  test("keeps known rosters provisional until official lineups arrive",()=>{
    const known=baseGame("known",[{type:"goal"}]);
    const future=baseGame("future");
    future.state.home.players=[];
    const seeded=seedKnownSeasonRosters(future,[known]);
    expect(seeded.state.home.players).toHaveLength(1);
    expect(seeded.state.provisionalRosters.home).toBe(true);
    expect(future.state.home.players).toEqual([]);
    seeded.state.officialSource={provider:"handball.net",matchId:"378112"};
    const fetched=baseGame("official",[{type:"goal"}]);
    fetched.state.officialSource={provider:"handball.net",matchId:"378112",rosterSource:"lineups"};
    fetched.state.home.players=[{vorname:"Alex",nachname:"Aktuell",nr:11,handballNetId:"99"}];
    const updated=enrichSeasonGameFromOfficial(seeded,fetched);
    expect(updated.state.provisionalRosters.home).toBeUndefined();
    expect(updated.state.home.players).toEqual(fetched.state.home.players);
    expect(updated.state.events).toEqual(fetched.state.events);
    expect(updated.selected).toBe(true);
  });
});
