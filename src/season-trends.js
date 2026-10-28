import { percentage } from "./analysis-core.js";
import { seasonTeamAggregate, seasonPlayerAggregate, seasonAttackTeam } from "./season-core.js";

export const TREND_METRICS = [
  {id:"goals",label:"Tore",unit:"count"},
  {id:"penalties",label:"Zeitstrafen",unit:"count"},
  {id:"shotRate",label:"Wurfeffizienz",unit:"percent"},
  {id:"errors",label:"Technische Fehler",unit:"count"},
  {id:"against",label:"Gegentore",unit:"count"},
  {id:"saves",label:"Paraden",unit:"count"}
];
export function trendMetric(id){return TREND_METRICS.find(m=>m.id===id)||TREND_METRICS[0]}

/* One series per team or player, ordered by fixture date. Missing games and
   undefined percentages are null rather than misleading zero values. */
export function seasonTrendSeries(games=[],{metric="goals",scope="team",playerKey="",resolvePlayer}={}) {
  const definition=trendMetric(metric);
  const ordered=[...games].sort((a,b)=>String(a?.state?.officialSource?.matchDate||a?.state?.gameDate||"")
    .localeCompare(String(b?.state?.officialSource?.matchDate||b?.state?.gameDate||"")));
  const rows=ordered.map((game,index)=>{
    const events=game?.state?.events||[];
    const base={index:index+1,id:game?.id,date:String(game?.state?.gameDate||"").slice(0,10),
      name:game?.state?.gameName||game?.fileName||"Spiel "+(index+1)};
    if(!events.length||!["home","away"].includes(game?.ownTeam))
      return {...base,first:null,second:null};
    if(scope==="player"){
      if(!playerKey||typeof resolvePlayer!=="function")return {...base,first:null,second:null};
      const player=seasonPlayerAggregate([game],{playerKey:resolvePlayer}).find(row=>row.key===playerKey);
      if(!player)return {...base,first:null,second:null};
      const value=metric==="shotRate"?(player.isTW||!player.decidedShots?null:percentage(player.goals,player.decidedShots)):
        metric==="against"?(player.isTW?player.against:null):
        metric==="goals"?(player.isTW?null:player.goals):Number(player[metric]||0);
      return {...base,first:value,second:null,
        firstDetail:metric==="shotRate"&&value!==null?player.goals+" Tore / "+player.decidedShots+" Würfe":""};
    }
    const own=seasonTeamAggregate([game],"own"),opp=seasonTeamAggregate([game],"opponent");
    if(metric==="against")return {...base,first:opp.goals,second:null};
    if(metric==="shotRate"){
      const decided=team=>events.filter(event=>
        ["shot","goal","save","miss","block"].includes(event?.type)&&
        event.type!=="shot"&&seasonAttackTeam(event)===team).length;
      const ownCount=decided(game.ownTeam),oppCount=decided(game.opponentTeam);
      return {...base,first:ownCount?own.shotRate:null,second:oppCount?opp.shotRate:null,
        firstDetail:ownCount?own.goals+" Tore / "+ownCount+" Würfe":"",
        secondDetail:oppCount?opp.goals+" Tore / "+oppCount+" Würfe":""};
    }
    return {...base,first:own[metric],second:opp[metric]};
  });
  return {metric:definition,scope,rows,labels:scope==="player"?["Spieler"]:metric==="against"?["Gegentore"]:["Mein Team","Gegner"]};
}
