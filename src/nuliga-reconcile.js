// Read-only nuLiga-to-scouting comparison and explicit player-attribution patch.
// No inferred goals or penalties are inserted; only existing local events are enriched.
const key = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase();
const hasPlayer = event => event?.pId !== undefined && event?.pId !== null && String(event.pId) !== "";
const kinds = new Set(["goal","miss","2min","yellow","red"]);
const scoreOf = event => Number.isFinite(Number(event?.scoreH)) && Number.isFinite(Number(event?.scoreA)) &&
  event?.scoreH != null && event?.scoreA != null ? String(event.scoreH)+":"+String(event.scoreA) : null;
const timing = event => Number.isFinite(Number(event?.time)) && event?.time != null ? Number(event.time) : null;
const candidate = (own,official) => own?.team === official?.team &&
  kinds.has(own?.type) && own.type === official?.type &&
  (own.type !== "miss" || (own.is7 || own.z==="7M") && (official.is7 || official.z==="7M"));
function matchedPlayer(game, event) {
  if(!event?.team || !["home","away"].includes(event.team))return null;
  const players = game?.state?.[event.team]?.players || [];
  if(hasPlayer(event)){
    const direct=players.filter(p=>String(p.id)===String(event.pId));
    if(direct.length===1)return direct[0];
  }
  // A shared jersey number without a person-name match is insufficient.
  const full=key(event.pName);
  const same=players.filter(p=>event.pNr!=null && String(p.nr)===String(event.pNr) &&
    (full === key(p.nachname+", "+p.vorname) || full === key(p.vorname+" "+p.nachname)));
  return same.length===1?same[0]:null;
}
export function previewNuLigaEventMatches(game, officialEvents) {
  const own=game?.state?.events||[],official=Array.isArray(officialEvents)?officialEvents:[];
  const rows=[];
  for(let localIndex=0;localIndex<own.length;localIndex++){
    const local=own[localIndex];
    if(!kinds.has(local?.type) || !["home","away"].includes(local?.team) || hasPlayer(local))continue;
    const possibilities=official.map((event,officialIndex)=>({
      event,officialIndex,player:matchedPlayer(game,event)
    })).filter(x=>candidate(local,x.event) && x.player);
    const ownScore=local.type==="goal"?scoreOf(local):null;
    const scoreCandidates=ownScore ? possibilities.filter(x=>scoreOf(x.event)===ownScore) : [];
    const ownTime=timing(local);
    let suggestedIndex=null,reason="",safe=false;
    if(scoreCandidates.length===1) {
      const match=scoreCandidates[0],otherTime=timing(match.event);
      suggestedIndex=match.officialIndex;
      safe=ownTime===null || otherTime===null || Math.abs(ownTime-otherTime)<=300;
      reason=safe?"Spielstand eindeutig":"Spielstand passt, Spielzeit stark abweichend";
    }else if(!ownScore || possibilities.every(x=>scoreOf(x.event)===null)){
      const close=possibilities.map(x=>({...x,distance:ownTime===null||timing(x.event)===null?Infinity:Math.abs(ownTime-timing(x.event))}))
        .filter(x=>x.distance<=45).sort((a,b)=>a.distance-b.distance);
      if(close.length && (close.length===1 || close[1].distance-close[0].distance>=30)){
        suggestedIndex=close[0].officialIndex;
        reason="Zeitnähe (manuell prüfen)";
      }
    }
    rows.push({
      localIndex,localId:local.id,localType:local.type,localTeam:local.team,
      localTime:timing(local),localScore:scoreOf(local),
      candidates:possibilities.map(x=>({officialIndex:x.officialIndex,playerId:x.player.id})),
      suggestedIndex,reason,safe
    });
  }
  // Avoid marking any proposal safe if it reuses an official event.
  const owners=new Map();
  for(const row of rows)if(row.safe && row.suggestedIndex!==null){
    owners.set(row.suggestedIndex,(owners.get(row.suggestedIndex)||0)+1);
  }
  for(const row of rows)if(row.safe && owners.get(row.suggestedIndex)>1){
    row.safe=false;row.reason="Mehrere Scouting-Ereignisse passen auf dasselbe Tor";
  }
  return {rows,localCount:own.length,officialCount:official.length,
    safeCount:rows.filter(row=>row.safe).length,
    unresolvedCount:rows.filter(row=>row.suggestedIndex===null).length};
}
export function applyNuLigaEventSelections(game, officialEvents, selections) {
  const next=structuredClone(game),own=next.state.events||[];
  const analysis=previewNuLigaEventMatches(next,officialEvents);
  const byIndex=new Map(analysis.rows.map(r=>[r.localIndex,r]));
  const used=new Set();
  let applied=0;
  for(const selection of selections){
    const localIndex=Number(selection.localIndex),officialIndex=Number(selection.officialIndex);
    const row=byIndex.get(localIndex),local=own[localIndex],ref=officialEvents[officialIndex];
    if(!Number.isInteger(localIndex)||!Number.isInteger(officialIndex)||!row||!ref||
      (selection.localId!==undefined&&String(selection.localId)!==String(local?.id))||
      !row.candidates.some(candidate=>candidate.officialIndex===officialIndex) ||
      used.has(officialIndex) || hasPlayer(local))
      throw new Error("Ungültige oder mehrdeutige Ereigniszuordnung. Bitte Auswahl erneut prüfen.");
    const player=matchedPlayer(next,ref);
    if(!player)throw new Error("Offizieller Spieler ist nicht eindeutig im Kader zugeordnet.");
    used.add(officialIndex);
    // Preserve event ID, original time, scorer event type, score,
    // video timing, goal location, comments and every other scouting field.
    local.pId=player.id;
    local.pNr=player.nr??null;
    local.pName=[player.nachname,player.vorname].filter(Boolean).join(", ") || ref.pName || "";
    local.nuLigaAttribution={officialEventId:ref.id??null,source:"nuliga",
      officialTime:timing(ref),officialScore:scoreOf(ref),appliedAt:new Date().toISOString()};
    applied++;
  }
  return {game:next,applied};
}
