// Team Space catalog: stable game IDs across standalone and season publications.
// Metadata is private; game contents are immutable per version in GCS.
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GAME=/^sg-[a-z0-9_-]{1,80}$/i;
const label=x=>String(x||"").trim();
const matchId=g=>String(g?.officialSource?.matchId||"").trim();
const title=g=>label(g?.gameName)||[g?.home?.name,g?.away?.name].filter(Boolean).join(" – ")||"Spiel";
const date=g=>String(g?.gameDate||"").slice(0,10);
export function publicTeamCatalog(meta){
  return {spaceId:meta.id,name:meta.name,revision:meta.revision,updatedAt:meta.updatedAt,
    trainerAccess:meta.trainerHash?"individual":"legacy",
    seasons:Object.values(meta.seasons||{}).map(s=>({
      id:s.id,name:s.name,revision:s.revision,publishedAt:s.publishedAt,
      gameCount:s.gameIds.length,gameIds:s.gameIds,preferredTeam:s.preferredTeam||""
    })).sort((a,b)=>a.name.localeCompare(b.name,"de")),
    games:Object.values(meta.games||{}).map(g=>({
      id:g.id,name:g.name,date:g.date,revision:g.revision,
      sha256:g.sha256,publishedAt:g.publishedAt,seasonIds:g.seasonIds,
      matchId:g.matchId||""
    })).sort((a,b)=>String(b.date).localeCompare(String(a.date)))};
}
export async function handleTeamSpace(req,res,url,{store,adminToken,now,idFactory,readerFactory,
  trainerFactory,trainer,trainerSpace,reader,send,err,bodyJson,sha}){
  if(url.pathname!=="/spaces"&&!url.pathname.startsWith("/spaces/"))return false;
  if(url.pathname==="/spaces"){
    if(req.method!=="POST")throw err(405,"METHOD_NOT_ALLOWED","POST erforderlich.");
    trainer(req,adminToken);
    const body=await bodyJson(req);
    const name=label(body?.name);
    if(!name||name.length>200)throw err(400,"INVALID_NAME","Ungültiger Teamname.");
    const spaceId=idFactory(),readToken=readerFactory(),
      trainerToken=trainerFactory(),stamp=now().toISOString();
    await store.createSpace(spaceId,{id:spaceId,name,readerHash:sha(readToken),
      trainerHash:sha(trainerToken),authVersion:2,
      revision:0,updatedAt:stamp,createdAt:stamp,seasons:{},games:{}});
    // Raw credentials are returned once and are never stored in cloud metadata.
    send(res,201,{spaceId,name,readToken,trainerToken,revision:0});return true;
  }
  const match=/^\/spaces\/([^/]+)\/(catalog|publish-season|publish-game|rotate-reader|rotate-trainer|claim-trainer|seasons\/([^/]+)\/download|games\/([^/]+)\/download)$/.exec(url.pathname);
  if(!match||!ID.test(match[1]))throw err(404,"NOT_FOUND","Team Space nicht gefunden.");
  const [,spaceId,action,seasonId,gameId]=match;
  const write=["publish-season","publish-game","rotate-reader",
    "rotate-trainer","claim-trainer"].includes(action);
  if(req.method!==(write?"POST":"GET"))
    throw err(405,"METHOD_NOT_ALLOWED",write?"POST erforderlich.":"GET erforderlich.");
  const {metadata:stored,generation}=await store.readSpace(spaceId);
  if(!stored)throw err(404,"NOT_FOUND","Team Space nicht gefunden.");
  // One-time migration for spaces created before per-space trainer keys.
  // The registration token cannot claim or write to a migrated/new space.
  if(action==="claim-trainer"){
    trainer(req,adminToken);
    if(stored.trainerHash)
      throw err(409,"ALREADY_CLAIMED","Dieser Team Space hat bereits einen eigenen Trainer-Schlüssel.");
    const trainerToken=trainerFactory();
    await store.updateSpace(spaceId,{...stored,trainerHash:sha(trainerToken),
      authVersion:2,updatedAt:now().toISOString()},generation);
    send(res,200,{spaceId,trainerToken});return true;
  }
  if(write)trainerSpace(req,stored,adminToken);
  else reader(req,stored);
  const meta=structuredClone(stored);
  if(action==="catalog"){send(res,200,publicTeamCatalog(meta));return true;}
  const stamp=now().toISOString();
  if(action==="rotate-reader"){
    const readToken=readerFactory();
    meta.readerHash=sha(readToken);meta.updatedAt=stamp;
    await store.updateSpace(spaceId,meta,generation);
    send(res,200,{spaceId,readToken});return true;
  }
  if(action==="rotate-trainer"){
    const trainerToken=trainerFactory();
    meta.trainerHash=sha(trainerToken);meta.authVersion=2;meta.updatedAt=stamp;
    await store.updateSpace(spaceId,meta,generation);
    send(res,200,{spaceId,trainerToken});return true;
  }
  const headers=(revision,hash)=>({
    "Content-Type":"application/json; charset=utf-8",
    "Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff",
    "X-Item-Revision":String(revision),"X-Content-Sha256":hash,
    "Access-Control-Expose-Headers":"X-Item-Revision, X-Content-Sha256"
  });
  if(action.startsWith("games/")){
    const game=GAME.test(gameId)?meta.games[gameId]:null;
    if(!game)throw err(404,"NOT_FOUND","Spiel nicht gefunden.");
    const data=await store.readSpaceGame(game.objectKey);
    res.writeHead(200,headers(game.revision,game.sha256));res.end(data);return true;
  }
  if(action.startsWith("seasons/")){
    const season=ID.test(seasonId)?meta.seasons[seasonId]:null;
    if(!season)throw err(404,"NOT_FOUND","Saison nicht gefunden.");
    const games=await Promise.all(season.gameIds.map(async id=>{
      const game=meta.games[id];
      if(!game)throw err(503,"INCOMPLETE_SEASON","Saisonspiel fehlt.");
      const bytes=await store.readSpaceGame(game.objectKey);
      return {id,fileName:game.fileName,selected:game.selected!==false,
        data:JSON.parse(bytes.toString("utf8"))};
    }));
    const archive={format:"handball-spielanalyse-season",version:1,
      name:season.name,createdAt:season.publishedAt,preferredTeam:season.preferredTeam||"",
      archiveTeam:season.archiveTeam||"",playerAliases:season.playerAliases||{},
      lastEditedGameId:season.lastEditedGameId||"",games};
    const bytes=Buffer.from(JSON.stringify(archive),"utf8");
    if(bytes.length>25*1024*1024)throw err(413,"TOO_LARGE","Saison übersteigt 25 MB.");
    res.writeHead(200,headers(season.revision,sha(bytes)));res.end(bytes);return true;
  }
  const body=await bodyJson(req);
  if(!Number.isInteger(body?.expectedRevision)||body.expectedRevision!==meta.revision)
    throw err(409,"REVISION_CONFLICT","Team Space wurde inzwischen geändert. Bitte erneut laden.");
  const used=new Set();
  async function upsert(inputId,data,fileName,selected,season=null){
    if(!data||typeof data!=="object"||!data.home||!data.away||!Array.isArray(data.events))
      throw err(400,"INVALID_GAME","Ungültige Spiel-JSON.");
    const existingMatch=matchId(data);
    const collision=existingMatch&&Object.values(meta.games).find(g=>g.matchId===existingMatch);
    if(collision&&inputId&&inputId!==collision.id&&meta.games[inputId])
      throw err(409,"MATCH_CONFLICT","Offizielles Spiel und angegebene Spielkennung widersprechen sich.");
    const id=collision?.id||inputId||"sg-"+idFactory().replaceAll("-","");
    if(!GAME.test(id))throw err(400,"INVALID_GAME_ID","Ungültige Spielkennung.");
    if(used.has(id))throw err(409,"DUPLICATE_GAME","Dasselbe Spiel ist mehrfach enthalten.");
    used.add(id);
    const old=meta.games[id];
    if(old?.matchId&&existingMatch&&old.matchId!==existingMatch)
      throw err(409,"MATCH_CONFLICT","Spielkennung gehört zu einer anderen Begegnung.");
    // Guard against accidental hash-ID collisions even without official IDs.
    if(old&&!old.matchId&&!existingMatch&&old.date&&date(data)&&
      old.date!==date(data)&&old.name!==title(data))
      throw err(409,"GAME_ID_CONFLICT","Spielkennung ist bereits für eine andere Begegnung vergeben.");
    const bytes=Buffer.from(JSON.stringify(data),"utf8");
    if(bytes.length>25*1024*1024)throw err(413,"TOO_LARGE","Spiel übersteigt 25 MB.");
    const hash=sha(bytes),changed=!old||old.sha256!==hash;
    let key=old?.objectKey||"";
    if(changed){
      key="spaces/"+spaceId+"/games/"+id+"/"+((old?.revision||0)+1)+"-"+idFactory()+".json";
      await store.writeSpaceGame(key,bytes);
    }
    const links=old?.seasonIds?.slice()||[];
    if(season&&!links.includes(season))links.push(season);
    meta.games[id]={id,name:title(data),date:date(data),matchId:existingMatch,
      fileName:fileName||old?.fileName||id+".json",selected:selected!==false,
      revision:(old?.revision||0)+(changed?1:0),sha256:hash,objectKey:key,
      publishedAt:changed?stamp:old?.publishedAt,seasonIds:links};
    if(changed)for(const linked of old?.seasonIds||[])if(linked!==season&&meta.seasons[linked]){
      meta.seasons[linked].revision++;
      meta.seasons[linked].publishedAt=stamp;
    }
    return {id,changed};
  }
  if(action==="publish-season"){
    const archive=body.archive;
    if(!archive||archive.format!=="handball-spielanalyse-season"||archive.version!==1||
      !label(archive.name)||!Array.isArray(archive.games)||
      !archive.games.length||archive.games.length>200)
      throw err(400,"INVALID_SEASON","Saison-JSON Version 1 mit Spielen erforderlich.");
    const id=body.seasonId||idFactory();
    if(!ID.test(id)||(body.seasonId&&!meta.seasons[id]))
      throw err(404,"NOT_FOUND","Saison nicht gefunden.");
    if(Object.keys(meta.games).length+archive.games.length>2000)
      throw err(409,"CATALOG_FULL","Team Space enthält zu viele Spiele.");
    const ids=[];
    for(const game of archive.games){
      if(!GAME.test(game?.id||""))throw err(400,"INVALID_GAME_ID","Ungültige Spielkennung in Saison.");
      const result=await upsert(game?.id,game?.data,game?.fileName,game?.selected,id);
      ids.push(result.id);
    }
    for(const game of Object.values(meta.games))
      if(!ids.includes(game.id))game.seasonIds=game.seasonIds.filter(s=>s!==id);
    const old=meta.seasons[id];
    meta.seasons[id]={id,name:archive.name,gameIds:ids,
      preferredTeam:archive.preferredTeam||"",archiveTeam:archive.archiveTeam||"",
      playerAliases:archive.playerAliases||{},
      lastEditedGameId:archive.lastEditedGameId||"",
      revision:(old?.revision||0)+1,createdAt:old?.createdAt||stamp,publishedAt:stamp};
    meta.revision++;meta.updatedAt=stamp;
    await store.updateSpace(spaceId,meta,generation);
    send(res,200,{spaceId,seasonId:id,revision:meta.revision,
      itemRevision:meta.seasons[id].revision,gameCount:ids.length});return true;
  }
  if(action==="publish-game"){
    if(Object.keys(meta.games).length>=2000)
      throw err(409,"CATALOG_FULL","Team Space enthält zu viele Spiele.");
    const linked=body.seasonId||null;
    if(linked&&(!ID.test(linked)||!meta.seasons[linked]))
      throw err(404,"NOT_FOUND","Saisonzuordnung nicht gefunden.");
    const {id,changed}=await upsert(body.gameId||null,body.game,body.fileName,true,linked);
    if(linked){
      const season=meta.seasons[linked];
      if(!season.gameIds.includes(id))season.gameIds.push(id);
      if(changed||!stored.seasons[linked].gameIds.includes(id))season.revision++;
      season.publishedAt=stamp;
    }
    meta.revision++;meta.updatedAt=stamp;
    await store.updateSpace(spaceId,meta,generation);
    send(res,200,{spaceId,gameId:id,revision:meta.revision,
      itemRevision:meta.games[id].revision});return true;
  }
  throw err(404,"NOT_FOUND","Team-Space-Endpunkt nicht gefunden.");
}
