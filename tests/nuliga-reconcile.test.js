import {describe,it,expect} from "vitest";
import {previewNuLigaEventMatches,applyNuLigaEventSelections} from "../src/nuliga-reconcile.js";
const player={id:"own-7",nr:7,nachname:"Meyer",vorname:"Hans"};
const other={id:"own-4",nr:4,nachname:"Schulze",vorname:"Max"};
const official=[
  {id:"report-1",type:"goal",team:"away",time:91,scoreH:0,scoreA:1,pNr:7,pName:"Meyer, Hans"},
  {id:"report-2",type:"goal",team:"home",time:181,scoreH:1,scoreA:1,pNr:4,pName:"Schulze, Max"},
  {id:"report-3",type:"goal",team:"away",time:735,scoreH:1,scoreA:2,pNr:7,pName:"Meyer, Hans"}
];
const game=()=>({id:"match-1",state:{home:{name:"SG Achim",players:[other]},away:{name:"HC Bremen",players:[player]},
  events:[
    {id:"own-1",type:"goal",team:"away",time:92,displayTime:"01:32",scoreH:0,scoreA:1,pId:null,comment:"Beobachtung",z:"RL-9m",gz:"UL",realTime:30000},
    {id:"own-2",type:"goal",team:"home",time:183,scoreH:1,scoreA:1,pId:null},
    {id:"own-3",type:"goal",team:"away",time:738,scoreH:1,scoreA:2,pId:null},
    {id:"own-4",type:"save",team:"home",time:739,pId:null,throwerId:null}
  ]}});
describe("nuLiga scorer reconciliation",()=>{
  it("suggests unique team/type/score matches without altering scouting events",()=>{
    const before=game(),copy=structuredClone(before);
    const preview=previewNuLigaEventMatches(before,official);
    expect(preview.rows).toHaveLength(3);
    expect(preview.safeCount).toBe(3);
    expect(preview.rows.map(r=>r.suggestedIndex)).toEqual([0,1,2]);
    expect(before).toEqual(copy);
    const {game:updated,applied}=applyNuLigaEventSelections(before,official,[{localIndex:0,localId:"own-1",officialIndex:0}]);
    expect(applied).toBe(1);
    expect(updated.state.events).toHaveLength(4);
    expect(updated.state.events[0]).toMatchObject({
      id:"own-1",type:"goal",team:"away",pId:"own-7",pNr:7,pName:"Meyer, Hans",
      scoreA:1,comment:"Beobachtung",z:"RL-9m",gz:"UL",realTime:30000});
    expect(updated.state.events[1].pId).toBeNull();
    expect(before).toEqual(copy);
  });
  it("does not propose wrong team, type or nonexistent player",()=>{
    const target=game();
    target.state.away.players=[];
    const preview=previewNuLigaEventMatches(target,official);
    expect(preview.safeCount).toBe(1);
    expect(preview.rows[0].candidates).toHaveLength(0);
  });
  it("does not overwrite existing attribution and rejects duplicate official matching",()=>{
    const target=game();
    target.state.events[0].pId="own-7";
    expect(previewNuLigaEventMatches(target,official).rows.map(r=>r.localIndex)).toEqual([1,2]);
    const two=game();two.state.events.push({id:"copy",type:"goal",team:"away",time:94,scoreH:0,scoreA:1,pId:null});
    const preview=previewNuLigaEventMatches(two,official);
    expect(preview.rows.filter(r=>r.localIndex===0||r.localIndex===4).every(r=>!r.safe)).toBe(true);
    expect(()=>applyNuLigaEventSelections(two,official,[
      {localIndex:0,officialIndex:0},{localIndex:4,officialIndex:0}])).toThrow(/mehrdeutige/);
  });
  it("allows manual time proximity but never selects it as safe",()=>{
    const target=game();delete target.state.events[0].scoreH;delete target.state.events[0].scoreA;
    const row=previewNuLigaEventMatches(target,official).rows[0];
    expect(row.suggestedIndex).toBe(0);
    expect(row.safe).toBe(false);
  });
  it("rejects swapped manual assignments to another team's goal",()=>{
    expect(()=>applyNuLigaEventSelections(game(),official,[{localIndex:0,officialIndex:1}]))
      .toThrow(/Ungültige/);
  });
});
