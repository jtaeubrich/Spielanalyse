import { percentage } from "./analysis-core.js";
import { seasonTeamAggregate, seasonPlayerAggregate, seasonAttackTeam } from "./season-core.js";

export const TREND_METRICS = [
  {id:"goals",label:"Tore",unit:"count"},
  {id:"penalties",label:"Zeitstrafen",unit:"count"},
  {id:"shotRate",label:"Wurfeffizienz",unit:"percent"},
  {id:"errors",label:"Technische Fehler",unit:"count"},
  {id:"against",label:"Gegentore",unit:"count"},
  {id:"saves",label:"Paraden",unit:"count"},
  {id:"assists",label:"Assists",unit:"count"},
  {id:"saveRate",label:"Paradenquote",unit:"percent"}
];
export function trendMetric(id){return TREND_METRICS.find(item=>item.id===id)||TREND_METRICS[0]}

// Dates are always sorted before applying venue filters or cumulative values.
export function seasonTrendGames(games=[],venue="all"){
  return [...games].filter(game=>venue==="all"||game?.ownTeam===venue)
    .sort((a,b)=>String(a?.state?.officialSource?.matchDate||a?.state?.gameDate||"")
      .localeCompare(String(b?.state?.officialSource?.matchDate||b?.state?.gameDate||"")));
}
function decidedShots(events=[],team){
  return events.filter(event=>["goal","save","miss","block"].includes(event?.type)&&seasonAttackTeam(event)===team).length;
}
function assists(events=[],team){
  return events.filter(event=>event?.team===team&&event.type==="goal"&&event.assistPId!=null).length;
}
// A season/player roster can contain the entire squad, not just match participants.
// A recorded action is positive evidence for this specific game; a roster entry alone
// does not establish that the player participated or that zero is a valid statistic.
function hasTrackedPlayerEvent(game,playerKey,resolvePlayer){
  const own=game?.ownTeam;
  const roster=game?.state?.[own]?.players||[];
  const ids=new Set(roster.filter(p=>resolvePlayer(p)===playerKey)
    .map(p=>String(p?.id)).filter(id=>id&&id!=="undefined"&&id!=="null"));
  if(!ids.size)return false;
  const matches=id=>id!==null&&id!==undefined&&ids.has(String(id));
  return (game?.state?.events||[]).some(event=>{
    if(event.team===own&&[event.pId,event.assistPId,event.attackerId,event.defenderId].some(matches))
      return true;
    // An opponent save/block may identify our thrower, an opponent shot our keeper.
    if(event.team&&event.team!==own&&
       (((event.type==="save"||event.type==="block")&&matches(event.throwerId))||
         matches(event.againstTwId)))return true;
    return (event.playerTags||[]).some(tag=>tag?.team===own&&matches(tag.pId));
  });
}
function playerMetric(player,metric){
  if(metric==="shotRate")return {
    value:player.isTW||!player.decidedShots?null:percentage(player.goals,player.decidedShots),
    numerator:player.goals,denominator:player.decidedShots,detail:player.goals+" Tore / "+player.decidedShots+" Würfe"
  };
  if(metric==="saveRate")return {
    value:!player.isTW||!(player.saves+player.against)?null:percentage(player.saves,player.saves+player.against),
    numerator:player.saves,denominator:player.saves+player.against,detail:player.saves+" Paraden / "+(player.saves+player.against)+" Würfe"
  };
  if(metric==="goals"&&player.isTW)return {value:null};
  if(metric==="against"&&!player.isTW)return {value:null};
  return {value:Number(player[metric]||0)};
}
function teamMetric(game,teamRole,metric){
  const events=game.state.events||[];
  const team=teamRole==="own"?game.ownTeam:game.opponentTeam;
  const data=seasonTeamAggregate([game],teamRole);
  if(metric==="against")return {value:seasonTeamAggregate([game],teamRole==="own"?"opponent":"own").goals};
  if(metric==="assists")return {value:assists(events,team)};
  if(metric==="shotRate"){
    const count=decidedShots(events,team);
    return {value:count?data.shotRate:null,numerator:data.goals,denominator:count,
      detail:data.goals+" Tore / "+count+" Würfe"};
  }
  if(metric==="saveRate"){
    const count=data.saves+data.against;
    return {value:count?percentage(data.saves,count):null,numerator:data.saves,denominator:count,
      detail:data.saves+" Paraden / "+count+" Würfe"};
  }
  return {value:Number(data[metric]||0)};
}
export function seasonTrendSeries(games=[],{
  metric="goals",scope="team",playerKey="",resolvePlayer,venue="all",view="perGame"
}={}){
  const definition=trendMetric(metric);
  const ordered=seasonTrendGames(games,venue);
  const totals={first:0,second:0},numerators={first:0,second:0},denominators={first:0,second:0};
  const cumulative=view==="cumulative";
  const rows=ordered.map((game,index)=>{
    const events=game?.state?.events||[];
    const opponentTeam=["home","away"].includes(game?.opponentTeam)?game.opponentTeam
      :game?.ownTeam==="home"?"away":game?.ownTeam==="away"?"home":null;
    const opponent=String(opponentTeam?game?.state?.[opponentTeam]?.name||"":"").trim();
    const base={index:index+1,id:game?.id,date:String(game?.state?.gameDate||"").slice(0,10),
      name:game?.state?.gameName||game?.fileName||"Spiel "+(index+1),
      opponent:opponent||"Spiel "+(index+1)};
    if(!events.length||!["home","away"].includes(game?.ownTeam))
      return {...base,first:null,second:null};
    let values;
    if(scope==="player"){
      if(!playerKey||typeof resolvePlayer!=="function")return {...base,first:null,second:null};
      const player=seasonPlayerAggregate([game],{playerKey:resolvePlayer})
        .find(row=>row.key===playerKey);
      if(!player||!hasTrackedPlayerEvent(game,playerKey,resolvePlayer))
        return {...base,first:null,second:null,
          firstMissingReason:"Keine erfasste Spieleraktion – Einsatz nicht bestätigt"};
      values={first:playerMetric(player,metric)};
    }else{
      values={first:teamMetric(game,"own",metric)};
      if(metric!=="against")values.second=teamMetric(game,"opponent",metric);
    }
    const result={...base,first:null,second:null};
    for(const side of ["first","second"]){
      const data=values[side];
      if(!data||!Number.isFinite(data.value))continue;
      if(cumulative){
        if(definition.unit==="percent"){
          numerators[side]+=data.numerator;
          denominators[side]+=data.denominator;
          result[side]=denominators[side]?percentage(numerators[side],denominators[side]):null;
          result[side+"Detail"]=numerators[side]+" / "+denominators[side]+" Würfe";
        }else{
          totals[side]+=data.value;
          result[side]=totals[side];
        }
      }else{
        result[side]=data.value;
        if(data.detail)result[side+"Detail"]=data.detail;
      }
    }
    return result;
  });
  return {metric:definition,scope,view,venue,rows,
    labels:scope==="player"?["Spieler"]:metric==="against"?["Gegentore"]:["Mein Team","Gegner"]};
}

// Shared date positions for comparing multiple players, including non-appearances.
export function seasonPlayerComparison(games=[],{
  metric="goals",playerKeys=[],resolvePlayer,venue="all",view="perGame"
}={}){
  const unique=[...new Set(playerKeys.filter(Boolean))].slice(0,4);
  return unique.map(key=>({
    key,
    ...seasonTrendSeries(games,{metric,scope:"player",playerKey:key,resolvePlayer,venue,view})
  }));
}

// Choose actual integer grid values. Rounding fractional tick positions would
// label e.g. 0, .25, .5, .75, 1 as 0, 0, 1, 1, 1.
export function seasonTrendYAxisTicks(values=[],unit="count"){
  if(unit==="percent")return {max:100,ticks:[0,25,50,75,100]};
  const highest=Math.max(0,...values.filter(Number.isFinite));
  let step=1;
  if(highest>4){
    const wanted=highest/4;
    const magnitude=10**Math.floor(Math.log10(wanted));
    step=([1,2,5,10].find(factor=>factor*magnitude>=wanted)??10)*magnitude;
  }
  const intervals=Math.max(1,Math.ceil(highest/step));
  return {max:step*intervals,ticks:Array.from({length:intervals+1},(_,i)=>i*step)};
}
