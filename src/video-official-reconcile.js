// Shared, non-destructive comparison for both Match video workflows.
// Existing game/season formats are not changed: only explicitly selected
// additions or empty player attributions are applied to existing state fields.
import { previewNuLigaEventMatches } from "./nuliga-reconcile.js";

const supported = new Set(["goal","miss","yellow","2min","red","blue","timeout"]);
const key = value => String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
  .toLocaleLowerCase("de").replace(/[^a-z0-9]+/g," ").trim();
const second = event => event?.time==null?null:Number.isFinite(Number(event.time))?Number(event.time):null;
const validScore = e => e?.scoreH!=null && e?.scoreA!=null &&
  Number.isInteger(Number(e.scoreH)) && Number.isInteger(Number(e.scoreA));
function typeMatch(a,b) {
  return a?.type===b?.type && a?.team===b?.team &&
    (a?.type!=="miss" || Boolean(a.is7||a.z==="7M")===Boolean(b.is7||b.z==="7M"));
}
function sourceIdentity(event) {
  const id=event?.officialEventId??(event?.officialSource?event?.id:null);
  return id==null?"":String(id);
}
function samePerson(a,b) {
  const na=key(a?.pName),nb=key(b?.pName);
  if(na&&nb&&na!=="unbekannt"&&nb!=="unbekannt")return na===nb;
  return a?.pNr!=null&&b?.pNr!=null&&String(a.pNr)===String(b.pNr);
}
function scoreMatch(a,b) {
  return validScore(a)&&validScore(b)&&
    Number(a.scoreH)===Number(b.scoreH)&&Number(a.scoreA)===Number(b.scoreA);
}
function matchQuality(local,official) {
  if(!typeMatch(local,official))return 0;
  const a=sourceIdentity(local),b=sourceIdentity(official);
  if(a&&b&&a===b)return 4;
  if(local.type==="goal" && scoreMatch(local,official))return 3;
  const la=second(local),lb=second(official);
  if(la===null||lb===null)return 0;
  const distance=Math.abs(la-lb);
  if(distance<=8 && (local.type!=="goal"||!validScore(local)||!validScore(official)||scoreMatch(local,official)) &&
    (samePerson(local,official)||!key(local.pName)||!key(official.pName)||
      key(local.pName)==="unbekannt"||key(official.pName)==="unbekannt"))
    return 2;
  if(distance<=90)return 1;
  return 0;
}
export function previewVideoOfficialAdditions(state,officialEvents) {
  const own=Array.isArray(state?.events)?state.events:[];
  const official=Array.isArray(officialEvents)?officialEvents:[];
  const occupied=new Set();
  const rows=[];
  for(let officialIndex=0;officialIndex<official.length;officialIndex++){
    const event=official[officialIndex];
    if(!supported.has(event?.type)||!["home","away"].includes(event?.team)){
      rows.push({officialIndex,status:"unsupported",localIndex:null,reason:"Nicht unterstütztes Ereignis"});
      continue;
    }
    const scored=own.map((local,localIndex)=>({localIndex,quality:matchQuality(local,event)}))
      .filter(candidate=>candidate.quality>0).sort((a,b)=>b.quality-a.quality);
    const top=scored[0];
    if(top && top.quality>=2 && (!scored[1]||scored[1].quality<top.quality) && !occupied.has(top.localIndex)){
      occupied.add(top.localIndex);
      rows.push({officialIndex,status:"present",localIndex:top.localIndex,
        reason:top.quality===4?"Offizielle Ereignis-ID":top.quality===3?"Spielstand eindeutig":"Spielzeit und Spieler"});
    }else if(scored.length){
      rows.push({officialIndex,status:"possible",localIndex:top.localIndex,
        reason:"Mögliche Dublette – manuell im Video prüfen"});
    }else{
      rows.push({officialIndex,status:"missing",localIndex:null,reason:"Kein entsprechendes Scouting-Ereignis"});
    }
  }
  return {
    rows,
    presentCount:rows.filter(row=>row.status==="present").length,
    possibleCount:rows.filter(row=>row.status==="possible").length,
    missingCount:rows.filter(row=>row.status==="missing").length
  };
}
export function applyVideoOfficialAdditions(state,officialEvents,selectedIndices) {
  const preview=previewVideoOfficialAdditions(state,officialEvents);
  const allowed=new Set(preview.rows.filter(row=>row.status==="missing").map(row=>row.officialIndex));
  const indexes=[...selectedIndices].map(Number);
  if(new Set(indexes).size!==indexes.length ||
    indexes.some(index=>!Number.isInteger(index)||!allowed.has(index)))
    throw new Error("Ein ausgewähltes Ereignis ist bereits vorhanden oder nicht eindeutig fehlend. Bitte erneut vergleichen.");
  const next=structuredClone(state);
  const used=new Set((next.events||[]).map(event=>String(event.id)));
  let id=Math.max(Date.now(),...next.events.map(event=>Number.isSafeInteger(Number(event.id))?Number(event.id)+1:0));
  for(const index of indexes){
    const event=structuredClone(officialEvents[index]);
    while(used.has(String(id)))id++;
    const officialId=event.officialEventId??(event.officialSource?event.id:null);
    event.id=id++;
    if(officialId!=null)event.officialEventId=officialId;
    // Official protocol timestamps are game times; the video time must still
    // be synchronized by the user. Never copy a foreign video timestamp.
    event.realTime=null;
    used.add(String(event.id));
    next.events.push(event);
  }
  next.events.sort((a,b)=>Number(a.time||0)-Number(b.time||0));
  return {state:next,added:indexes.length};
}
export function applyVideoOfficialPlayerSelections(game,officialEvents,selections) {
  const next=structuredClone(game);
  const rows=previewNuLigaEventMatches(next,officialEvents).rows;
  const byLocal=new Map(rows.map(row=>[row.localIndex,row]));
  const usedOfficial=new Set(),usedLocal=new Set();
  for(const item of selections){
    const localIndex=Number(item.localIndex),officialIndex=Number(item.officialIndex);
    const local=next.state.events[localIndex],ref=officialEvents[officialIndex],row=byLocal.get(localIndex);
    if(!row||!ref||!local||usedOfficial.has(officialIndex)||usedLocal.has(localIndex)||
      (item.localId!==undefined&&String(item.localId)!==String(local.id))||
      !row.candidates.some(candidate=>candidate.officialIndex===officialIndex) ||
      (local.pId!==undefined&&local.pId!==null&&String(local.pId)!==""))
      throw new Error("Ungültige oder doppelte Spielerzuordnung. Bitte Vorschau aktualisieren.");
    const candidate=row.candidates.find(c=>c.officialIndex===officialIndex);
    const player=next.state[ref.team]?.players.find(p=>String(p.id)===String(candidate.playerId));
    if(!player)throw new Error("Der offizielle Spieler wurde nicht eindeutig im Kader gefunden.");
    local.pId=player.id;local.pNr=player.nr??null;
    local.pName=[player.nachname,player.vorname].filter(Boolean).join(", ")||ref.pName||"";
    usedOfficial.add(officialIndex);usedLocal.add(localIndex);
  }
  return {game:next,applied:selections.length};
}
