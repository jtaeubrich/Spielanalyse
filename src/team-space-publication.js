// Team Space publication is an explicit trainer action. Within an action
// scouting data, comments, key moments and drawings are shared by default.
// Every annotation may be explicitly excluded via local opt-out fields.
// Player-side edits never upload because player credentials are read-only.
const PRIVATE_FIELD=/(?:comment|note|annotation|drawing|bookmark|personal|private|video|realTime|highlight)/i;
const LOCAL_FIELDS=new Set([
  "video","videoFileName","videoPath","videoSource","videoHandle",
  "theme","shotCapture","gameTime","activeTw","activeDefense",
  "possession","attackPhase","preflight","videoUrl","videoName","fileHandle"
]);
const clean=value=>{
  if(Array.isArray(value))return value.map(clean);
  if(!value||typeof value!=="object")return value;
  const result={};
  for(const [key,item] of Object.entries(value)){
    if(PRIVATE_FIELD.test(key))continue;
    // Empty optional IDs inserted by the migrator are not user edits.
    if(key==="handballNetId"&&(item==null||item===""))continue;
    if(key==="tags"){
      if(Array.isArray(item))result.tags=item.filter(tag=>typeof tag==="string");
      continue;
    }
    result[key]=clean(item);
  }
  return result;
};
// A Team Space may share a YouTube reference and synchronization metadata,
// never the device-local video object, file names, handles or file paths.
const YOUTUBE_ID=/^[A-Za-z0-9_-]{11}$/;
function youtubeIdFromVideo(video){
  const candidate=String(video?.youtubeId||"").trim();
  if(YOUTUBE_ID.test(candidate))return candidate;
  try{
    const url=new URL(String(video?.youtubeUrl||""));
    const host=url.hostname.toLowerCase();
    let id="";
    if(host==="youtu.be"||host==="www.youtu.be"){
      id=url.pathname.split("/")[1]||"";
    }else if(["youtube.com","www.youtube.com","m.youtube.com",
      "youtube-nocookie.com","www.youtube-nocookie.com"].includes(host)){
      id=url.searchParams.get("v")||
        /^\/(?:shorts|embed|live)\/([^/]+)/.exec(url.pathname)?.[1]||"";
    }
    return YOUTUBE_ID.test(id)?id:"";
  }catch{return ""}
}
function sharedYoutubeVideo(video){
  if(!video||typeof video!=="object"||Array.isArray(video))return null;
  const id=youtubeIdFromVideo(video);
  if(!id)return null;
  const shared={
    youtubeId:id,youtubeUrl:"https://www.youtube.com/watch?v="+id,
    // Explicit units avoid legacy migration interpreting a video clock as ms.
    syncUnit:video.syncUnit==="ms"?"ms":"seconds"
  };
  if(["youtube-absolute-ms","video-absolute-ms","live-elapsed-ms"]
    .includes(video.analysisTimeBasis))
    shared.analysisTimeBasis=video.analysisTimeBasis;
  for(const key of ["h1SyncRealTime","h2SyncRealTime","kickoff",
    "h1LiveStartMs","h2LiveStartMs"]){
    if(video[key]===null||video[key]===undefined||video[key]==="")continue;
    const number=Number(video[key]);
    if(Number.isFinite(number)&&number>=0)shared[key]=number;
  }
  if(Array.isArray(video.reviewClockAnchors)){
    const anchors=video.reviewClockAnchors.filter(anchor=>
      [1,2].includes(Number(anchor?.half))&&
      anchor?.videoAt!==null&&anchor?.videoAt!==undefined&&
      anchor?.gameAt!==null&&anchor?.gameAt!==undefined&&
      Number.isFinite(Number(anchor.videoAt))&&
      Number.isFinite(Number(anchor.gameAt))&&
      Number(anchor.videoAt)>=0&&Number(anchor.gameAt)>=0
    ).map(anchor=>({
      half:Number(anchor.half),videoAt:Number(anchor.videoAt),
      gameAt:Number(anchor.gameAt),running:anchor.running!==false
    }));
    if(anchors.length)shared.reviewClockAnchors=anchors;
  }
  return shared;
}
function privateSettings(event){
  const settings=event?.teamSpacePrivate;
  return settings&&typeof settings==="object"&&!Array.isArray(settings)?settings:{};
}
function publicEvent(event,{shareVideoTime=false}={}){
  if(!event||typeof event!=="object")return null;
  const privacy=privateSettings(event);
  if(event.type==="keyMoment"&&privacy.moment===true)return null;
  const result=clean(event);
  // realTime is a relative millisecond offset: an absolute video position
  // for video scouting, or the live timer position for a live-scouted game.
  // H1/H2 synchronization anchors map either timeline to the YouTube video.
  if(shareVideoTime&&event.realTime!==null&&
    event.realTime!==undefined&&event.realTime!==""&&
    Number.isFinite(Number(event.realTime))&&Number(event.realTime)>=0)
    result.realTime=Number(event.realTime);
  if(Array.isArray(event.tags)){
    const hiddenTags=Array.isArray(privacy.tags)?privacy.tags:[];
    const tags=event.tags.filter(tag=>typeof tag==="string"&&!hiddenTags.includes(tag));
    if(tags.length)result.tags=tags;
    else delete result.tags;
  }
  if(event.note!=null&&privacy.note!==true)result.note=event.note;
  if(event.comment!=null&&privacy.comment!==true)result.comment=event.comment;
  if(event.highlight!=null&&privacy.highlight!==true)result.highlight=event.highlight;
  const annotation=event.videoAnnotation;
  if(annotation&&typeof annotation==="object"){
    const shapes=Array.isArray(annotation.shapes)
      ?annotation.shapes.filter(shape=>shape&&shape.teamSpacePrivate!==true).map(clean):[];
    const comment=privacy.comment===true?"":String(annotation.comment||"");
    if(comment||shapes.length){
      result.videoAnnotation={
        ...(comment?{comment}:{}),
        ...(shapes.length?{shapes}:{}),
        ...(shapes.length&&annotation.startSeconds!=null?{startSeconds:annotation.startSeconds}:{}),
        ...(shapes.length&&annotation.endSeconds!=null?{endSeconds:annotation.endSeconds}:{})
      };
    }
  }
  return result;
}
export function publicGameForTeamSpace(game){
  if(!game||typeof game!=="object"||Array.isArray(game)||
    !game.home||!game.away||!Array.isArray(game.events))
    throw Error("Spiel enthält keine gültigen Team- und Ereignisdaten.");
  const source={};
  const youtubeVideo=sharedYoutubeVideo(game.video);
  for(const [key,value] of Object.entries(game)){
    // Whether the source was video-scouted changes the interpretation of
    // event.realTime and must survive cross-device transfer.
    if(key==="isVideoscoutingFile"){source.isVideoscoutingFile=Boolean(value);continue;}
    if(LOCAL_FIELDS.has(key)||PRIVATE_FIELD.test(key))continue;
    if(key==="timer"){
      source.timer={duration:value?.duration||25};
    }else if(key==="events"){
      source.events=value.map(event=>publicEvent(event,{
        shareVideoTime:Boolean(youtubeVideo)
      })).filter(Boolean);
    }else source[key]=clean(value);
  }
  if(youtubeVideo)source.video=youtubeVideo;
  return source;
}
export function publicSeasonForTeamSpace(archive){
  if(!archive||!Array.isArray(archive.games))throw Error("Saison enthält keine Spiele.");
  const {games,...metadata}=archive;
  return {...clean(metadata),games:games.map(item=>{
    const {state,data,...recordMetadata}=item;
    return {...clean(recordMetadata),data:publicGameForTeamSpace(data??state)};
  })};
}
// Includes only counts, not any personal content or upload credentials.
export function publicationSharingSummary(data){
  const games=Array.isArray(data?.games)
    ?data.games.map(item=>item.data??item.state):[data];
  const summary={games:games.length,comments:0,drawings:0,keyMoments:0,
    highlights:0,excluded:0};
  for(const game of games){
    for(const event of game?.events||[]){
      const privacy=privateSettings(event);
      if(event.type==="keyMoment"){
        if(privacy.moment===true){summary.excluded++;continue}
        summary.keyMoments++;
      }
      if(event.highlight){
        if(privacy.highlight===true)summary.excluded++;
        else summary.highlights++;
      }
      if(event.note&&privacy.note===true)summary.excluded++;
      if(Array.isArray(privacy.tags))summary.excluded+=privacy.tags
        .filter(tag=>Array.isArray(event.tags)&&event.tags.includes(tag)).length;
      const annotation=event.videoAnnotation;
      if((annotation?.comment||event.comment)){
        if(privacy.comment===true)summary.excluded++;
        else summary.comments++;
      }
      for(const shape of annotation?.shapes||[]){
        if(shape?.teamSpacePrivate===true)summary.excluded++;
        else summary.drawings++;
      }
    }
  }
  return summary;
}
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
  const added=a.events.filter(e=>e.id==null||!cloudById.has(String(e.id))).length;
  const removed=b.events.filter(e=>e.id==null||!localById.has(String(e.id))).length;
  const edited=a.events.filter(e=>e.id!=null&&cloudById.has(String(e.id))&&
    JSON.stringify(canonical(e))!==
    JSON.stringify(canonical(cloudById.get(String(e.id))))).length;
  return {equal,localEvents:a.events.length,cloudEvents:b.events.length,
    added,removed,edited};
}
