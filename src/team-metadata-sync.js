import { normalizeTeamName, findKnownTeamRecord } from "./team-rosters.js";
import { rosterTeamKey } from "./roster.js";

export const TEAM_COLLECTION_FORMAT="handball-spielanalyse-teams";
export function exportTeamCollection(records){
  return {format:TEAM_COLLECTION_FORMAT,version:1,exportedAt:new Date().toISOString(),teams:structuredClone(records)};
}
export function parseTeamCollection(data){
  if(!data||data.format!==TEAM_COLLECTION_FORMAT||data.version!==1||!Array.isArray(data.teams))throw Error("Keine gültige Mannschaftssammlung (Version 1).");
  if(data.teams.length>1000)throw Error("Zu viele Mannschaften.");
  return data.teams.map(record=>{
    if(!record||typeof record.teamName!=="string"||!record.teamName.trim()||!Array.isArray(record.players))throw Error("Ungültiger Mannschaftseintrag.");
    if(record.logoDataUrl&&(!/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(record.logoDataUrl)||record.logoDataUrl.length>1500000))throw Error("Ungültiges oder zu großes Logo.");
    return structuredClone(record);
  });
}
export function mergeTeamCollections(existing, incoming){
  const result=structuredClone(existing), conflicts=[];
  for(const next of incoming){
    const match=findKnownTeamRecord(result,{teamName:next.teamName,players:next.players})?.record;
    if(!match){const id=next.id&&!result.some(r=>r.id===next.id)?next.id:rosterTeamKey(next.teamName);result.push({...next,id});continue}
    const aliases=[...new Set([...(match.aliases||[]),...(next.aliases||[]),next.teamName].filter(name=>normalizeTeamName(name)!==normalizeTeamName(match.teamName)))];
    const updates={aliases};
    for(const key of ["logoDataUrl","logoUrl","handball360TeamId","handball360ClubId"]){
      if(!match[key]&&next[key])updates[key]=next[key];
      else if(match[key]&&next[key]&&match[key]!==next[key]&&key!=="logoDataUrl")conflicts.push(match.teamName+": "+key);
    }
    const ids=new Set((match.players||[]).map(p=>String(p.handballNetId||"")).filter(Boolean));
    const names=new Set((match.players||[]).map(p=>normalizeTeamName((p.vorname||"")+" "+(p.nachname||""))).filter(Boolean));
    const players=structuredClone(match.players||[]);
    for(const player of next.players||[]){
      const id=String(player.handballNetId||"");
      const name=normalizeTeamName((player.vorname||"")+" "+(player.nachname||""));
      if(id&&ids.has(id))continue;
      if(name&&names.has(name))continue;
      players.push(structuredClone(player));if(id)ids.add(id);if(name)names.add(name);
    }
    Object.assign(match,updates,{players});
  }
  return {records:result,conflicts};
}
export function mapOfficialSides(state,official){
 const current=[normalizeTeamName(state.home?.name),normalizeTeamName(state.away?.name)];
 const imported=[normalizeTeamName(official.teams?.home),normalizeTeamName(official.teams?.away)];
 if(current.some(v=>!v)||imported.some(v=>!v)||current[0]===current[1])throw Error("Mannschaftsnamen fehlen oder sind nicht eindeutig.");
 if(current[0]===imported[0]&&current[1]===imported[1])return {home:"home",away:"away"};
 if(current[0]===imported[1]&&current[1]===imported[0])return {home:"away",away:"home"};
 throw Error("Mannschaftsnamen stimmen nicht überein. Bitte die Spielzuordnung vor dem Import prüfen.");
}
