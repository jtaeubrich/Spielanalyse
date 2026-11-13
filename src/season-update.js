// Non-destructive refresh of an existing season from its next published JSON.
// All personal annotations remain local. The last *published* snapshot lives in
// a separate IndexedDB record, not in the v1 season/game JSON format.
const copy = value => structuredClone(value);
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const norm = value => String(value??"").trim().toLocaleLowerCase("de").replace(/\s+/g," ");
const name = game => String(game?.state?.gameName || game?.fileName || "Spiel").trim();

const eventIdentifier = event => event?.id==null ? "" : "id:"+String(event.id);
const officialIdentifier = event => event?.officialEventId==null ? ""
  : "official:"+String(event.officialSource||"")+":"+String(event.officialEventId);
const fallbackIdentifier = event => [
  String(event?.type||""),String(event?.team||""),
  event?.half??"",event?.time??"",event?.scoreH??"",event?.scoreA??""
].join("|");
const selectable = (events, predicate, used=new Set()) => {
  const found=[];
  for(let i=0;i<events.length;i++)if(!used.has(i)&&predicate(events[i]))found.push(i);
  return found.length===1 ? found[0] : -1;
};
function findRelated(event, events, used=new Set()){
  if(!event)return -1;
  const id=eventIdentifier(event);
  if(id){
    const index=selectable(events, item=>eventIdentifier(item)===id, used);
    if(index>=0)return index;
  }
  const official=officialIdentifier(event);
  if(official){
    const index=selectable(events,item=>officialIdentifier(item)===official,used);
    if(index>=0)return index;
  }
  // Stable event IDs are authoritative. A newly created local key moment
  // with a different ID must never be collapsed into a published one even
  // if it happens at the same moment.
  if(id)return -1;
  // For very old events lacking IDs, use a unique fallback only.
  return selectable(events,item=>!eventIdentifier(item)&&
    fallbackIdentifier(item)===fallbackIdentifier(event),used);
}
function hasValue(value){
  return value!==undefined&&value!==null&&value!=="" &&
    (!Array.isArray(value)||value.length>0);
}
const scalarFields=["comment","note","highlight","videoComment"];
function personalPatch(base,event){
  const changed={};
  for(const field of scalarFields){
    if(base ? !same(base[field],event[field]) : hasValue(event[field])){
      changed[field]=copy(event[field]);
    }
  }
  const source=base?.videoAnnotation||{},own=event.videoAnnotation||{};
  const ann={};
  for(const field of new Set([...Object.keys(source),...Object.keys(own)])){
    if(field==="shapes"){
      // A user's drawings and newly published coaching drawings are separate
      // additions. Keep both rather than replacing the coach's new shapes.
      const oldShapes=Array.isArray(source.shapes)?source.shapes:[],
        localShapes=Array.isArray(own.shapes)?own.shapes:[];
      const oldKeys=oldShapes.map(shape=>JSON.stringify(shape)),
        localKeys=localShapes.map(shape=>JSON.stringify(shape));
      const added=localShapes.filter(shape=>!oldKeys.includes(JSON.stringify(shape)));
      const removed=base?oldKeys.filter(shape=>!localKeys.includes(shape)):[];
      if(added.length||removed.length)ann.shapeDiff={added:copy(added),removed};
      continue;
    }
    if(base?!same(source[field],own[field]):hasValue(own[field]))
      ann[field]=copy(own[field]);
  }
  if(Object.keys(ann).length)changed.videoAnnotation=ann;
  const from=new Set(Array.isArray(base?.tags)?base.tags:[]);
  const local=new Set(Array.isArray(event.tags)?event.tags:[]);
  const added=[...local].filter(tag=>!from.has(tag));
  const removed=base?[...from].filter(tag=>!local.has(tag)):[];
  if(added.length||removed.length)changed.tagDiff={added,removed};
  if(event.type==="keyMoment" &&
    (base?!same(base.playerTags,event.playerTags):hasValue(event.playerTags)))
    changed.playerTags=copy(event.playerTags);
  return changed;
}
function applyPersonalPatch(target,patch){
  for(const field of scalarFields)if(Object.hasOwn(patch,field)){
    if(patch[field]===undefined)delete target[field];
    else target[field]=copy(patch[field]);
  }
  if(patch.videoAnnotation){
    const annotation={...(target.videoAnnotation||{})};
    for(const [field,value] of Object.entries(patch.videoAnnotation)){
      if(field==="shapeDiff"){
        const existing=Array.isArray(annotation.shapes)?annotation.shapes:[];
        const shapes=existing.filter(shape=>!value.removed.includes(JSON.stringify(shape)));
        for(const shape of value.added){
          if(!shapes.some(item=>same(item,shape)))shapes.push(copy(shape));
        }
        annotation.shapes=shapes;
        continue;
      }
      if(value===undefined)delete annotation[field];
      else annotation[field]=copy(value);
    }
    target.videoAnnotation=annotation;
  }
  if(patch.tagDiff){
    const tags=(Array.isArray(target.tags)?target.tags:[])
      .filter(tag=>!patch.tagDiff.removed.includes(tag));
    for(const tag of patch.tagDiff.added)if(!tags.includes(tag))tags.push(tag);
    target.tags=tags;
  }
  if(Object.hasOwn(patch,"playerTags"))target.playerTags=copy(patch.playerTags);
}
function patchCount(patch){
  return Object.keys(patch).length;
}
function rekeyIfColliding(event,existing){
  const next=copy(event),ids=new Set(existing.map(e=>eventIdentifier(e)));
  if(!eventIdentifier(next)||!ids.has(eventIdentifier(next)))return next;
  let i=1;const original=String(next.id);
  while(ids.has("id:"+original+"-local-"+i))i++;
  next.id=original+"-local-"+i;
  return next;
}
function mergeEvents(oldGame,newGame,baseGame){
  const local=oldGame?.state?.events||[],
    remote=copy(newGame.state.events||[]),
    base=baseGame?.state?.events||null,
    usedLocal=new Set(),usedRemote=new Set(),usedBase=new Set();
  let annotations=0,localEvents=0,recovered=0;
  // First attach all local changes to their unique published counterparts.
  for(let ri=0;ri<remote.length;ri++){
    const localIndex=findRelated(remote[ri],local,usedLocal);
    if(localIndex<0)continue;
    const localEvent=local[localIndex];
    usedLocal.add(localIndex);usedRemote.add(ri);
    const baseIndex=base?findRelated(localEvent,base,usedBase):-1;
    if(baseIndex>=0)usedBase.add(baseIndex);
    const patch=personalPatch(baseIndex<0?null:base[baseIndex],localEvent);
    const count=patchCount(patch);
    if(count){
      applyPersonalPatch(remote[ri],patch);
      annotations+=count;
    }
  }
  for(let li=0;li<local.length;li++){
    if(usedLocal.has(li))continue;
    const localEvent=local[li];
    const baseIndex=base?findRelated(localEvent,base,usedBase):-1;
    if(baseIndex>=0)usedBase.add(baseIndex);
    const patch=personalPatch(baseIndex<0?null:base[baseIndex],localEvent);
    // If we know the previous publication and this was a dropped official
    // event with no personal annotations, allow the publisher to remove it.
    if(baseIndex>=0&&!patchCount(patch))continue;
    // Unknown-baseline entries and locally created key moments are retained.
    const preserved=rekeyIfColliding(localEvent,remote);
    remote.push(preserved);
    if(baseIndex>=0)recovered+=1;
    else localEvents+=1;
  }
  return {events:remote,annotations,localEvents,recovered};
}
function datePart(s){return String(s||"").slice(0,10)}
function matchId(game){return String(game?.state?.officialSource?.matchId||"").trim()}
function assertGameIdentity(local,incoming){
  const one=matchId(local),two=matchId(incoming);
  if(one&&two&&one!==two)
    throw new Error("Die Spiel-ID von "+name(local)+" unterscheidet sich. Die Aktualisierung wurde gestoppt.");
  const a=datePart(local?.state?.gameDate),b=datePart(incoming?.state?.gameDate);
  const sides=["home","away"];
  const teams=sides.every(side=>
    norm(local?.state?.[side]?.name)===norm(incoming?.state?.[side]?.name));
  if(a&&b&&a!==b&&!teams&&!one)
    throw new Error("Spieltermin und Mannschaften unterscheiden sich bei "+name(local)+". Bitte Saison prüfen.");
}
function seasonYears(value){
  const match=/(20\d{2})\s*[-\/]\s*(\d{2,4})/.exec(String(value||""));
  if(!match)return "";
  const start=Number(match[1]);
  const end=match[2].length===2?Math.floor(start/100)*100+Number(match[2]):Number(match[2]);
  return end===start+1?start+"/"+String(end).slice(-2):"";
}
function publicationChanged(a,b){
  // Presentation-state differences from local users must not count as a
  // published update. Compare against the last published snapshot if present.
  return !same(a?.state,b?.state)||!same(a?.fileName,b?.fileName);
}
export function prepareSeasonRefresh(existing,incoming,previousSource=null){
  const oldGames=Array.isArray(existing?.games)?existing.games:[];
  const newGames=Array.isArray(incoming?.games)?incoming.games:[];
  if(!newGames.length)throw new Error("Die neue Saisondatei enthält keine Spiele.");
  if(!oldGames.length)throw new Error("Es gibt noch keine bestehende Saison zum Aktualisieren.");
  const sameId=new Set(oldGames.map(g=>g.id));
  const shared=newGames.filter(g=>sameId.has(g.id)).length;
  if(shared===0)throw new Error(
    "Keine gemeinsamen Spielkennungen. Bitte prüfe, ob die Datei zur ausgewählten Saison gehört.");
  const oldPreferred=norm(existing?.preferredTeam),newPreferred=norm(incoming?.preferredTeam);
  if(oldPreferred&&newPreferred&&oldPreferred!==newPreferred)
    throw new Error("Die Mannschaft der Saison stimmt nicht überein.");
  const previousYear=seasonYears(existing?.name),
    nextYear=seasonYears(incoming?.name);
  if(previousYear&&nextYear&&previousYear!==nextYear)
    throw new Error("Die Saisonjahre unterscheiden sich. Die Datei gehört möglicherweise zu einer anderen Saison.");
  const prev=previousSource?.createdAt ? Date.parse(previousSource.createdAt) : NaN;
  const current=incoming?.createdAt ? Date.parse(incoming.createdAt) : NaN;
  if(Number.isFinite(prev)&&Number.isFinite(current)&&current+1000<prev)
    throw new Error("Diese Saisondatei ist älter als die bereits übernommene Veröffentlichung.");
  const prevById=new Map((previousSource?.games||[]).map(g=>[g.id,g]));
  const localById=new Map(oldGames.map(g=>[g.id,g]));
  const seen=new Set();
  const games=[];
  const summary={newGames:0,updatedGames:0,unchangedGames:0,retainedGames:0,
    personalAnnotations:0,personalEvents:0,recoveredAnnotations:0};
  for(const published of newGames){
    if(seen.has(published.id))throw new Error("Doppelte Spielkennung in der Saisondatei.");
    seen.add(published.id);
    const old=localById.get(published.id);
    const next=copy(published);
    if(!old){summary.newGames++;games.push(next);continue;}
    assertGameIdentity(old,published);
    const prior=prevById.get(published.id);
    const result=mergeEvents(old,next,prior);
    next.state.events=result.events;
    next.selected=old.selected!==false;
    summary.personalAnnotations+=result.annotations;
    summary.personalEvents+=result.localEvents;
    summary.recoveredAnnotations+=result.recovered;
    if(publicationChanged(prior||old,published))summary.updatedGames++;
    else summary.unchangedGames++;
    games.push(next);
  }
  // Keep local games absent from the new publication. Never silently delete
  // a season game that may contain personal notes, recordings or markups.
  for(const old of oldGames)if(!seen.has(old.id)){
    games.push(copy(old));summary.retainedGames++;
  }
  return {games,summary,shared,source:copy(incoming)};
}
// Merge a separately published game into an existing local game.
// Keep the local stable ID and preserve user-created comments/events via the
// last publisher snapshot. Never merge two different official matches.
export function preparePublishedGameRefresh(local,published,previousSource=null){
  if(!local?.state||!published?.state)
    throw Error("Spielstände für die Aktualisierung fehlen.");
  assertGameIdentity(local,published);
  const next=copy(published),changes=mergeEvents(local,next,previousSource);
  next.state.events=changes.events;
  next.id=local.id;
  next.selected=local.selected!==false;
  return {game:next,source:copy(published),summary:{
    personalAnnotations:changes.annotations,
    personalEvents:changes.localEvents,
    recoveredAnnotations:changes.recovered
  }};
}
export function exportPublishedSeason(source){
  if(!source?.games)return null;
  return copy(source);
}
