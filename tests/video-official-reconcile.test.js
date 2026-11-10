import {describe,it,expect} from "vitest";
import {previewVideoOfficialAdditions,applyVideoOfficialAdditions,
  prepareHandball360VideoComparison,applyVideoOfficialPlayerSelections} from "../src/video-official-reconcile.js";

const own=()=>({
  home:{name:"SG Achim",players:[{id:"home-4",nr:4,vorname:"Max",nachname:"Schulze",isTW:false}]},
  away:{name:"HC Bremen",players:[{id:"away-7",nr:7,vorname:"Hans",nachname:"Meyer",isTW:true}]},
  events:[
    {id:"local-1",type:"goal",team:"away",time:91,scoreH:0,scoreA:1,
      pId:null,pName:"Unbekannt",realTime:91400,comment:"Video-Notiz",z:"RL-9m",gz:"UL"},
    {id:"local-2",type:"shot",team:"home",time:220,realTime:220000,comment:"Gegenstoß"}
  ],
  video:{h1SyncRealTime:0},gameName:"SG Achim – HC Bremen"
});
const official=[
  {id:"n-1",type:"goal",team:"away",time:91,scoreH:0,scoreA:1,pName:"Meyer, Hans",pNr:7,officialSource:"nuliga"},
  {id:"n-2",type:"2min",team:"home",time:320,pName:"Schulze, Max",pNr:4,officialSource:"nuliga"},
  {id:"n-3",type:"2min",team:"home",time:345,pName:"Schulze, Max",pNr:4,officialSource:"nuliga"},
  {id:"n-4",type:"goal",team:"home",time:210,scoreH:1,scoreA:1,pName:"Schulze, Max",pNr:4,officialSource:"nuliga"}
];

describe("shared official comparison",()=>{
  it("shows present and missing without changing any scouting property",()=>{
    const state=own(),before=structuredClone(state);
    const result=previewVideoOfficialAdditions(state,official);
    expect(result.presentCount).toBe(1);
    expect(result.missingCount).toBe(3);
    expect(result.possibleCount).toBe(0);
    expect(state).toEqual(before);
  });
  it("adds only explicitly selected official events, never existing goals, and is idempotent",()=>{
    const state=own(),before=structuredClone(state);
    const result=applyVideoOfficialAdditions(state,official,[1]);
    expect(result.added).toBe(1);
    expect(result.state.events).toHaveLength(3);
    const ownGoal=result.state.events.find(e=>e.id==="local-1");
    expect(ownGoal).toEqual(before.events[0]);
    const added=result.state.events.find(e=>e.officialEventId==="n-2");
    expect(added).toMatchObject({team:"home",type:"2min",time:320,realTime:null});
    expect(state).toEqual(before);
    expect(previewVideoOfficialAdditions(result.state,official).rows[1].status).toBe("present");
    expect(()=>applyVideoOfficialAdditions(result.state,official,[1])).toThrow(/bereits vorhanden/);
  });
  it("does not automatically add close possible duplicates or wrong event types",()=>{
    const state=own();
    state.events.push({id:"maybe",type:"2min",team:"home",time:315,pName:"Unbekannt"});
    expect(previewVideoOfficialAdditions(state,official).rows[1].status).toBe("present");
    state.events.push({id:"maybe2",type:"2min",team:"home",time:320,pName:"Unbekannt"});
    expect(previewVideoOfficialAdditions(state,official).rows[1].status).toBe("possible");
    expect(()=>applyVideoOfficialAdditions(state,official,[1])).toThrow(/nicht eindeutig/);
  });
  it("maps Handball360 external identities without replacing local roster properties",()=>{
    const state=own(),before=structuredClone(state);
    const prepared={
      homePlayers:[{id:"api-4",handballNetId:"api-4",nr:9,vorname:"Max",nachname:"Schulze",isTW:true}],
      awayPlayers:[{id:"api-7",handballNetId:"api-7",nr:7,vorname:"Hans",nachname:"Meyer",isTW:false}],
      normalized:[{id:910,officialEventId:910,officialSource:"handball.net",type:"goal",team:"away",pId:"api-7",time:91,scoreH:0,scoreA:1},
        {id:911,officialEventId:911,officialSource:"handball.net",type:"2min",team:"home",pId:"api-4",time:320}]
    };
    const result=prepareHandball360VideoComparison(state,prepared);
    expect(result.officialEvents.map(e=>e.pId)).toEqual(["away-7","home-4"]);
    expect(result.state.home.players[0]).toMatchObject({id:"home-4",nr:4,isTW:false});
    expect(result.state.away.players[0]).toMatchObject({id:"away-7",nr:7,isTW:true});
    expect(state).toEqual(before);
  });
  it("applies only selected missing-player attribution without touching video or comments",()=>{
    const game={state:own()},before=structuredClone(game);
    const result=applyVideoOfficialPlayerSelections(game,official,
      [{localIndex:0,localId:"local-1",officialIndex:0}]);
    expect(result.applied).toBe(1);
    expect(result.game.state.events[0]).toMatchObject({pId:"away-7",pName:"Meyer, Hans",
      comment:"Video-Notiz",realTime:91400,z:"RL-9m"});
    expect(result.game.state.events[1]).toEqual(before.state.events[1]);
    expect(game).toEqual(before);
  });
});
