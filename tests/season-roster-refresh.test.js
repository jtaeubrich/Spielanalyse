import { describe, expect, test } from "vitest";
import { previewOfficialSeasonRosters, applyOfficialSeasonRosters } from "../src/season-roster-refresh.js";

function makeGame() {
  return {
    id:"sg-1",fileName:"handball360_378122.json",selected:false,
    state:{
      format:"handball-spielanalyse",version:1,
      home:{name:"TSV Kronshagen",players:[
        {id:"local-11",handballNetId:"11",vorname:"Mia",nachname:"Muster",nr:7,isTW:false,customNote:"Eigene Spieler-Info"},
        {id:"local-12",handballNetId:"12",vorname:"Nicht",nachname:"Gemeldet",nr:9,isTW:false}
      ]},
      away:{name:"Gast",players:[
        {id:"local-22",handballNetId:"22",vorname:"Timo",nachname:"Gast",nr:1,isTW:true}
      ]},
      gameDate:"2026-11-15T16:00:00Z",
      officialSource:{matchId:"378122",provider:"handball.net"},
      events:[],video:{youtubeUrl:"https://youtu.be/example",annotations:[{label:"Test"}]},
      timer:{half:1,secondsElapsed:99,active:false},
      provisionalRosters:{home:true,away:true}
    }
  };
}
function makeOfficial({withAway=true,withHome=true,id="378122"}={}) {
  return {
    match_id:id,
    match:{data:[{
      id,date:"2026-11-15T16:00:00Z",
      local:{id:100,name:"TSV Kronshagen"},
      visitor:{id:200,name:"Gast"},
      duration:{minutes_per_period:25}
    }]},
    events:[],
    lineups:{data:{
      local:{players:withHome?[
        {player:{id:11,first_name:"Mia",last_name:"Muster"},number:17,is_goalkeeper:false},
        {player:{id:13,first_name:"Neuer",last_name:"Spieler"},number:6,is_goalkeeper:false}
      ]:[]},
      visitor:{players:withAway?[
        {player:{id:22,first_name:"Timo",last_name:"Gast"},number:1,is_goalkeeper:true}
      ]:[]}
    }}
  };
}
describe("pregame Handball360 lineup refresh",()=>{
  test("previews added, removed and changed players without mutating the current game",()=>{
    const game=makeGame(), before=structuredClone(game);
    const plan=previewOfficialSeasonRosters(game,makeOfficial());
    expect(plan.matchId).toBe("378122");
    expect(plan.availableSides).toBe(2);
    expect(plan.sides.home.added).toHaveLength(1);
    expect(plan.sides.home.removed).toHaveLength(1);
    expect(plan.sides.home.changed[0].changes).toContain("Nr. 7 → 17");
    expect(plan.sides.away.changed).toHaveLength(0);
    expect(game).toEqual(before);
  });
  test("replaces confirmed match roster, preserves local player IDs, videos and events",()=>{
    const game=makeGame(), original=structuredClone(game),plan=previewOfficialSeasonRosters(game,makeOfficial());
    const updated=applyOfficialSeasonRosters(game,plan,"2026-11-15T15:30:00Z");
    expect(updated.id).toBe(game.id);
    expect(updated.selected).toBe(false);
    expect(updated.state.home.players).toHaveLength(2);
    expect(updated.state.home.players.find(p=>p.handballNetId==="11")).toMatchObject({
      id:"local-11",handballNetId:"11",nr:17,customNote:"Eigene Spieler-Info"
    });
    expect(updated.state.home.players.map(p=>p.handballNetId).sort()).toEqual(["11","13"]);
    expect(updated.state.away.players[0].id).toBe("local-22");
    expect(updated.state.video).toEqual(original.state.video);
    expect(updated.state.events).toEqual([]);
    expect(updated.state.timer).toEqual(original.state.timer);
    expect(updated.state.lineupSync).toMatchObject({matchId:"378122",homeConfirmed:true,awayConfirmed:true});
    expect(updated.state.provisionalRosters).toEqual({});
    expect(game).toEqual(original);
  });
  test("does not overwrite a side without confirmed official players",()=>{
    const game=makeGame(),plan=previewOfficialSeasonRosters(game,makeOfficial({withAway:false}));
    expect(plan.availableSides).toBe(1);
    const updated=applyOfficialSeasonRosters(game,plan);
    expect(updated.state.away.players).toEqual(game.state.away.players);
    expect(updated.state.provisionalRosters.away).toBe(true);
    expect(updated.state.lineupSync.awayConfirmed).toBe(false);
  });
  test("refuses unavailable or incorrect match data",()=>{
    expect(()=>previewOfficialSeasonRosters(makeGame(),makeOfficial({withHome:false,withAway:false}))).toThrow(/noch keine offizielle Aufstellung/);
    expect(()=>previewOfficialSeasonRosters(makeGame(),makeOfficial({id:"999999"}))).toThrow(/anderen Match-ID/);
    expect(()=>previewOfficialSeasonRosters({...makeGame(),fileName:"manual.json",state:{...makeGame().state,officialSource:{}}},makeOfficial())).toThrow(/keine Handball360-Match-ID/);
  });
  test("blocks accidentally reversed home/away assignments while allowing abbreviations",()=>{
    const swapped=makeGame();
    swapped.state.home.name="Gast";
    swapped.state.away.name="TSV Kronshagen";
    expect(()=>previewOfficialSeasonRosters(swapped,makeOfficial())).toThrow(/vertauscht/);
    const abbreviated=makeGame();
    abbreviated.state.home.name="TSV Kronshagen B-Jugend";
    expect(previewOfficialSeasonRosters(abbreviated,makeOfficial()).availableSides).toBe(2);
  });
  test("safely reconciles a historical game without changing event references",()=>{
    const game=makeGame();
    game.state.events=[
      {id:"e1",team:"home",type:"goal",pId:"local-11",comment:"Eigener Treffer",assistPId:"local-12"},
      {id:"e2",team:"away",type:"save",pId:"local-22",throwerId:"local-11",
        playerTags:[{pId:"local-12"}],comment:"Video-Notiz",videoTime:123},
      {id:"e3",team:"home",type:"goal",pId:"local-12",scoreH:2}
    ];
    game.state.activeTw={away:"local-22"};
    const before=structuredClone(game);
    const plan=previewOfficialSeasonRosters(game,makeOfficial());
    expect(plan.hasScoutingEvents).toBe(true);
    expect(plan.sides.home.removed).toEqual([]);
    expect(plan.sides.home.retained).toContain("#9 Nicht Gemeldet");
    expect(plan.sides.home.added).toContain("#6 Neuer Spieler");
    const updated=applyOfficialSeasonRosters(game,plan);
    expect(updated.state.events).toEqual(before.state.events);
    expect(updated.state.video).toEqual(before.state.video);
    expect(updated.state.activeTw).toEqual(before.state.activeTw);
    expect(updated.state.home.players).toHaveLength(3);
    expect(updated.state.home.players.find(p=>p.id==="local-11")).toMatchObject({
      handballNetId:"11",nr:17,customNote:"Eigene Spieler-Info"
    });
    expect(updated.state.home.players.find(p=>p.id==="local-12")).toEqual(before.state.home.players[1]);
    expect(updated.state.home.players.find(p=>p.handballNetId==="13")).toBeDefined();
    expect(game).toEqual(before);
    const again=previewOfficialSeasonRosters(updated,makeOfficial());
    expect(again.totalChanges).toBe(0);
    expect(again.sides.home.retained).toContain("#9 Nicht Gemeldet");
  });
  test("does not apply a stale pregame preview if scouting began after preview",()=>{
    const game=makeGame(),plan=previewOfficialSeasonRosters(game,makeOfficial());
    game.state.events=[{id:"e1",team:"home",pId:"local-11"}];
    expect(()=>applyOfficialSeasonRosters(game,plan)).toThrow(/Scouting-Status/);
  });
  test("historical ambiguous names and conflicting IDs never merge or erase existing players",()=>{
    const game=makeGame();
    game.state.events=[{id:"e1",pId:"local-11",team:"home"}];
    game.state.home.players=[
      {id:"local-11",handballNetId:"888",vorname:"Mia",nachname:"Muster",nr:7},
      {id:"local-12",vorname:"Mia",nachname:"Muster",nr:12},
      {id:"local-13",vorname:"Neuer",nachname:"Spieler",nr:6}
    ];
    const plan=previewOfficialSeasonRosters(game,makeOfficial());
    const updated=applyOfficialSeasonRosters(game,plan);
    expect(updated.state.events).toEqual(game.state.events);
    expect(updated.state.home.players.find(p=>p.id==="local-11").handballNetId).toBe("888");
    expect(updated.state.home.players.find(p=>p.id==="local-12").handballNetId).toBeUndefined();
    expect(updated.state.home.players.find(p=>p.id==="local-13").handballNetId).toBe("13");
    expect(updated.state.home.players.some(p=>p.handballNetId==="11")).toBe(true);
  });
  test("new historical official players get distinct IDs even when their official ID equals another local ID",()=>{
    const game=makeGame();
    game.state.events=[{id:"e1",team:"home",pId:"13"}];
    game.state.home.players.push({id:"13",vorname:"Unbekannt",nachname:"Alt",nr:44});
    const updated=applyOfficialSeasonRosters(game,previewOfficialSeasonRosters(game,makeOfficial()));
    const newcomer=updated.state.home.players.find(p=>p.handballNetId==="13");
    expect(newcomer.id).not.toBe("13");
    expect(updated.state.home.players.find(p=>p.id==="13").nachname).toBe("Alt");
    expect(updated.state.events[0].pId).toBe("13");
  });
  test("reports zero changes on a second refresh with identical official lineup",()=>{
    const game=makeGame(), updated=applyOfficialSeasonRosters(game,previewOfficialSeasonRosters(game,makeOfficial()));
    const again=previewOfficialSeasonRosters(updated,makeOfficial());
    expect(again.totalChanges).toBe(0);
  });
});
