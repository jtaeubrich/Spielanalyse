import {describe,it,expect} from "vitest";
import {prepareSeasonRefresh,exportPublishedSeason} from "../src/season-update.js";

const event=(id,time,extra={})=>({id,type:"goal",team:"home",time,
  half:1,scoreH:1,scoreA:0,realTime:time*1000,...extra});
const game=(id,events,name="Heim gegen Gast")=>({
  id,fileName:id+".json",selected:true,ownTeam:"home",
  state:{
    format:"handball-spielanalyse",version:1,
    gameName:name,gameDate:"2026-11-08",
    home:{name:"TSV Kronshagen",players:[]},away:{name:"Gegner",players:[]},
    video:{youtubeId:"my-video"},events:structuredClone(events)
  }
});
const season=(games,createdAt="2026-11-08T18:00:00Z")=>({
  format:"handball-spielanalyse-season",version:1,
  name:"TSV Kronshagen · Saison 2026/27",
  preferredTeam:"TSV Kronshagen",createdAt,
  games:structuredClone(games)
});
describe("safe three-way season refresh",()=>{
  const original=()=>season([
    game("sg-1",[event("a",35,{comment:"Trainerhinweis",videoAnnotation:{comment:"Trainerzeichnung",shapes:[]},
      tags:["Deckung:3:2:1"]}),event("b",70)]),
    game("sg-2",[event("x",60)])
  ]);
  it("updates official goals, adds new games, retains personal comments, highlights, drawings, tags and key moments",()=>{
    const base=original();
    const local=structuredClone(base);
    local.games[0].state.events[0].comment="Meine Wurfanalyse";
    local.games[0].state.events[0].note="Darauf achten";
    local.games[0].state.events[0].highlight=true;
    local.games[0].state.events[0].videoAnnotation={comment:"Meine Zeichnung",
      shapes:[{type:"arrow",x1:10,y1:20,x2:40,y2:50}]};
    local.games[0].state.events[0].tags=["Deckung:3:2:1","Mein Marker"];
    local.games[0].state.events.push({
      id:"my-moment",type:"keyMoment",team:"home",time:35,half:1,
      scoreH:1,scoreA:0,note:"Meine eigene Szene",videoAnnotation:{shapes:[],comment:""}
    });
    const update=original();
    update.createdAt="2026-11-11T20:00:00Z";
    update.games[0].state.events[0].scoreH=2;
    update.games[0].state.events[0].videoAnnotation.shapes=[
      {type:"arrow",x1:1,y1:2,x2:3,y2:4}];
    update.games[0].state.events[0].comment="Neuer Trainerhinweis";
    update.games[0].state.events[0].tags=["Deckung:6:0"];
    update.games[0].state.events.push(event("c",100));
    update.games.push(game("sg-3",[event("z",90)]));
    const result=prepareSeasonRefresh(local,update,base);
    expect(result.summary.newGames).toBe(1);
    expect(result.games).toHaveLength(3);
    const match=result.games[0].state.events;
    const annotated=match.find(e=>e.id==="a");
    expect(annotated.scoreH).toBe(2);
    expect(annotated.comment).toBe("Meine Wurfanalyse");
    expect(annotated.note).toBe("Darauf achten");
    expect(annotated.highlight).toBe(true);
    expect(annotated.videoAnnotation.comment).toBe("Meine Zeichnung");
    expect(annotated.videoAnnotation.shapes).toHaveLength(2);
    expect(annotated.videoAnnotation.shapes.some(s=>s.x1===10)).toBe(true);
    expect(annotated.videoAnnotation.shapes.some(s=>s.x1===1)).toBe(true);
    expect(annotated.tags).toEqual(["Deckung:6:0","Mein Marker"]);
    expect(match.map(e=>e.id)).toContain("my-moment");
    expect(match.map(e=>e.id)).toContain("c");
    expect(local.games[0].state.events[0].scoreH).toBe(1);
    expect(exportPublishedSeason(result.source).games[0].state.events[0].comment)
      .toBe("Neuer Trainerhinweis");
    expect(exportPublishedSeason(result.source).games[0].state.events.map(e=>e.id))
      .not.toContain("my-moment");
  });
  it("does not overwrite the published change when the local event was not edited",()=>{
    const base=original();
    const next=original();next.createdAt="2026-11-11T20:00:00Z";
    next.games[0].state.events[0].comment="Neue Trainerbewertung";
    const result=prepareSeasonRefresh(base,next,base);
    expect(result.games[0].state.events[0].comment).toBe("Neue Trainerbewertung");
  });
  it("supports repeated updates without duplicating personal events",()=>{
    const base=original(),mine=structuredClone(base);
    mine.games[0].state.events.push({id:"my-key",type:"keyMoment",team:"home",time:210,
      note:"Mein Tipp",scoreH:1,scoreA:0});
    const update=original();update.createdAt="2026-11-09T18:00:00Z";
    update.games[0].state.events.push(event("c",99));
    const one=prepareSeasonRefresh(mine,update,base);
    const next=structuredClone(update);next.createdAt="2026-11-10T18:00:00Z";
    next.games[0].state.events.push(event("d",121));
    const two=prepareSeasonRefresh({...mine,games:one.games},next,one.source);
    const ids=two.games[0].state.events.map(e=>e.id);
    expect(ids.filter(x=>x==="my-key")).toHaveLength(1);
    expect(ids.filter(x=>x==="c")).toHaveLength(1);
    expect(ids.filter(x=>x==="d")).toHaveLength(1);
  });
  it("preserves a locally annotated event removed by the publisher",()=>{
    const old=original(),local=structuredClone(old);
    local.games[0].state.events[1].comment="Meine Beobachtung";
    const update=original();update.createdAt="2026-11-11T20:00:00Z";
    update.games[0].state.events.splice(1,1);
    const result=prepareSeasonRefresh(local,update,old);
    expect(result.games[0].state.events.find(e=>e.id==="b")?.comment)
      .toBe("Meine Beobachtung");
    expect(result.summary.recoveredAnnotations).toBe(1);
  });
  it("preserves manually annotated original events on first refresh without a baseline",()=>{
    const old=original(),update=original();
    old.games[0].state.events[0].videoAnnotation.shapes=[{type:"line"}];
    update.createdAt="2026-11-11T20:00:00Z";
    update.games[0].state.events[0].videoAnnotation={comment:"",shapes:[]};
    const result=prepareSeasonRefresh(old,update);
    expect(result.games[0].state.events[0].videoAnnotation.shapes)
      .toEqual([{type:"line"}]);
  });
  it("retains locally available games missing in the update",()=>{
    const old=original(),update=original();
    update.createdAt="2026-11-11T20:00:00Z";update.games.pop();
    const result=prepareSeasonRefresh(old,update,old);
    expect(result.summary.retainedGames).toBe(1);
    expect(result.games).toHaveLength(2);
    expect(result.games[1].id).toBe("sg-2");
  });
  it("rejects wrong-team, wrong-season, stale and mismatched match IDs",()=>{
    const old=original();
    const other=original();other.preferredTeam="Andere Mannschaft";
    expect(()=>prepareSeasonRefresh(old,other,old)).toThrow(/Mannschaft/);
    other.preferredTeam=old.preferredTeam;
    other.name="TSV Kronshagen · Saison 2027/28";
    expect(()=>prepareSeasonRefresh(old,other,old)).toThrow(/Saisonjahre/);
    other.name=old.name;other.createdAt="2026-11-01T18:00:00Z";
    expect(()=>prepareSeasonRefresh(old,other,old)).toThrow(/älter/);
    other.createdAt="2026-11-11T18:00:00Z";
    old.games[0].state.officialSource={provider:"handball.net",matchId:"123"};
    other.games[0].state.officialSource={provider:"handball.net",matchId:"999"};
    expect(()=>prepareSeasonRefresh(old,other,old)).toThrow(/Spiel-ID/);
    other.games[0].id="sg-unrelated";other.games[1].id="sg-unrelated-too";
    expect(()=>prepareSeasonRefresh(old,other,old)).toThrow(/Keine gemeinsamen Spielkennungen/);
  });
});
