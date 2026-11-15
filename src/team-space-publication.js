// Shared Team Space release boundary. This is deliberately separate from the
// private/local export. Never mutate an existing game or season in-place.
//
// A label beginning with "Deckung:" or "Auslöser:" is a tactical scouting
// classification used in analysis, not an arbitrary free-form player note.
// Other tags are personal unless the product introduces an explicit sharing
// control for them.
const PUBLIC_TACTICAL_TAG=/^(?:Deckung|Auslöser):/;
const PRIVATE_FIELD=/(?:comment|note|annotation|drawing|highlight|bookmark|personal|private|video|realTime)/i;
const LOCAL_FIELDS=new Set([
  "video","videoFileName","videoPath","videoSource","videoHandle",
  "isVideoscoutingFile","isHistorical","theme","shotCapture",
  "gameTime","activeTw","activeDefense","possession","attackPhase",
  "preflight","videoUrl","videoName","fileHandle"
]);
const clean=value=>{
  if(Array.isArray(value))return value.map(clean);
  if(!value||typeof value!=="object")return value;
  const result={};
  for(const [key,item] of Object.entries(value)){
    if(PRIVATE_FIELD.test(key))continue;
    // The legacy game migrator adds an empty handballNetId on every player.
    // Do not misinterpret this harmless schema normalization as an edit.
    if(key==="handballNetId"&&(item==null||item===""))continue;
    if(key==="tags"){
      if(Array.isArray(item)){
        const tags=item.filter(tag=>typeof tag==="string"&&PUBLIC_TACTICAL_TAG.test(tag));
        if(tags.length)result.tags=tags;
      }
      continue;
    }
    result[key]=clean(item);
  }
  return result;
};
export function publicGameForTeamSpace(game){
  if(!game||typeof game!=="object"||Array.isArray(game)||
    !game.home||!game.away||!Array.isArray(game.events))
    throw Error("Spiel enthält keine gültigen Team- und Ereignisdaten.");
  const source={};
  for(const [key,value] of Object.entries(game)){
    if(LOCAL_FIELDS.has(key)||PRIVATE_FIELD.test(key))continue;
    if(key==="timer"){
      // Duration is a game rule, elapsed time and running state are private
      // editing/session state and should never trigger a publication.
      source.timer={duration:value?.duration||25};
    }else if(key==="events"){
      source.events=value.filter(event=>event&&event.type!=="keyMoment").map(clean);
    }else source[key]=clean(value);
  }
  return source;
}
export function publicSeasonForTeamSpace(archive){
  if(!archive||!Array.isArray(archive.games))throw Error("Saison enthält keine Spiele.");
  return {...archive,games:archive.games.map(item=>{
    const {state,...rest}=item;
    return {...rest,data:publicGameForTeamSpace(item.data??state)};
  })};
}
// Canonicalize key order (not array order) so a cloud JSON roundtrip or a
// different object insertion order cannot appear as an unsent local edit.
function canonical(value){
  if(Array.isArray(value))return value.map(canonical);
  if(!value||typeof value!=="object")return value;
  const result={};
  for(const key of Object.keys(value).sort())result[key]=canonical(value[key]);
  return result;
}
export function publicGameSignature(game){
  return JSON.stringify(canonical(publicGameForTeamSpace(game)));
}
export function comparePublicGames(local,cloud){
  const a=publicGameForTeamSpace(local),b=publicGameForTeamSpace(cloud);
  const equal=JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
  const cloudById=new Map(b.events.filter(e=>e.id!=null).map(e=>[String(e.id),e]));
  const localById=new Map(a.events.filter(e=>e.id!=null).map(e=>[String(e.id),e]));
  const added=a.events.filter(e=>e.id==null||
    !cloudById.has(String(e.id))).length;
  const removed=b.events.filter(e=>e.id==null||
    !localById.has(String(e.id))).length;
  const edited=a.events.filter(e=>e.id!=null&&cloudById.has(String(e.id))&&
    JSON.stringify(canonical(e))!==
    JSON.stringify(canonical(cloudById.get(String(e.id))))).length;
  return {equal,localEvents:a.events.length,cloudEvents:b.events.length,
    added,removed,edited};
}
