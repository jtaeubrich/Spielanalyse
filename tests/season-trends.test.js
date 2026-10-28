import {describe,it,expect} from "vitest";
import {seasonTrendSeries,trendMetric} from "../src/season-trends.js";

const roster=[
  {id:"p1",nr:7,vorname:"Lena",nachname:"Beispiel",isTW:false},
  {id:"p2",nr:1,vorname:"Matti",nachname:"Test",isTW:true}
];
const match=(id,date,ownTeam,events,players=roster)=>{
  const home={name:"TSV Kronshagen",players:ownTeam==="home"?players:[]};
  const away={name:"Gegner",players:ownTeam==="away"?players:[]};
  return {id,selected:true,ownTeam,opponentTeam:ownTeam==="home"?"away":"home",
    state:{gameDate:date,gameName:"Match "+id,home,away,events}};
};
const p1={type:"goal",team:"home",pId:"p1"};
const game1=match("1","2026-09-05","home",[
  p1,{type:"miss",team:"home",pId:"p1"},
  {type:"goal",team:"away",pId:"opponent"},
  {type:"save",team:"home",pId:"p2",throwerId:"opponent"},
  {type:"error",team:"home",pId:"p1"},
  {type:"2plus2",team:"home",pId:"p1"},
  {type:"2min",team:"away",pId:"opponent"}
]);
const game2=match("2","2026-09-12","away",[
  {type:"goal",team:"away",pId:"p1"},
  {type:"2min",team:"away",pId:"p1"},
  {type:"goal",team:"home",pId:"opponent"}
]);
const future=match("3","2026-11-12","home",[]);
const playerKey=p=>p?.id==="p1"?"same-player":p?.id==="p2"?"keeper":null;

describe("Saisonverlauf: responsive chart data",()=>{
  it("orders fixtures chronologically and uses own/opponent metrics for both home and away",()=>{
    const trend=seasonTrendSeries([future,game2,game1],{metric:"goals"});
    expect(trend.rows.map(r=>r.id)).toEqual(["1","2","3"]);
    expect(trend.rows.map(r=>r.first)).toEqual([1,1,null]);
    expect(trend.rows.map(r=>r.second)).toEqual([1,1,null]);
    expect(seasonTrendSeries([game2,game1],{metric:"against"}).rows.map(r=>r.first)).toEqual([1,1]);
  });
  it("counts penalty units and technical errors consistently with existing season statistics",()=>{
    const penalty=seasonTrendSeries([game1,game2],{metric:"penalties"});
    expect(penalty.rows.map(r=>[r.first,r.second])).toEqual([[2,1],[1,0]]);
    expect(seasonTrendSeries([game1,game2],{metric:"errors"}).rows.map(r=>r.first)).toEqual([1,0]);
  });
  it("reports percentage per game and skips empty matches rather than drawing a false zero",()=>{
    const rate=seasonTrendSeries([game1,game2,future],{metric:"shotRate"});
    expect(rate.rows.map(r=>r.first)).toEqual([50,100,null]);
    expect(rate.rows.map(r=>r.second)).toEqual([50,100,null]);
    expect(rate.rows[0].firstDetail).toContain("1 Tore / 2 Würfe");
    expect(trendMetric("shotRate").unit).toBe("percent");
  });
  it("selects individual players across home/away assignments without opponent contamination",()=>{
    const trend=seasonTrendSeries([game1,game2,future],{
      metric:"goals",scope:"player",playerKey:"same-player",resolvePlayer:playerKey
    });
    expect(trend.rows.map(r=>r.first)).toEqual([1,1,null]);
    expect(trend.rows.map(r=>r.second)).toEqual([null,null,null]);
    expect(seasonTrendSeries([game1,game2],{
      metric:"penalties",scope:"player",playerKey:"same-player",resolvePlayer:playerKey
    }).rows.map(r=>r.first)).toEqual([2,1]);
    expect(seasonTrendSeries([game1],{
      metric:"shotRate",scope:"player",playerKey:"same-player",resolvePlayer:playerKey
    }).rows[0].first).toBe(50);
    expect(seasonTrendSeries([game1],{
      metric:"saves",scope:"player",playerKey:"keeper",resolvePlayer:playerKey
    }).rows[0].first).toBe(1);
  });
});
