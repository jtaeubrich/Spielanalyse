// Private season distribution. All writes require the trainer-only token.
// Reader capabilities never grant write access or upload personal notes.
import {createHash,randomBytes,randomUUID,timingSafeEqual} from "node:crypto";
const MAX_BYTES=25*1024*1024;
const VALID_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GAME_ID=/^sg-[a-z0-9_-]{1,80}$/i;
const sha=x=>createHash("sha256").update(x).digest("hex");
function equals(a,b){
  const first=Buffer.from(sha(String(a)),"hex"),second=Buffer.from(sha(String(b)),"hex");
  return timingSafeEqual(first,second);
}
class ApiError extends Error{
  constructor(status,code,message){super(message);this.status=status;this.code=code}
}
const err=(status,code,message)=>new ApiError(status,code,message);
const bearer=req=>/^Bearer ([A-Za-z0-9_-]{32,256})$/.exec(req.headers.authorization||"")?.[1]||"";
function trainer(req,secret){
  if(!secret||secret.length<32)throw err(503,"NOT_CONFIGURED","Trainer-Schlüssel fehlt.");
  if(!equals(bearer(req),secret))throw err(401,"NOT_AUTHORIZED","Trainerzugang erforderlich.");
}
function reader(req,meta){
  if(!equals(sha(bearer(req)),meta.readerHash))
    throw err(401,"NOT_AUTHORIZED","Saison-Zugang ungültig oder widerrufen.");
}
function send(res,status,data,headers={}){
  res.writeHead(status,{"Content-Type":"application/json; charset=utf-8",
    "Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff",...headers});
  res.end(JSON.stringify(data));
}
async function bodyJson(req){
  if(!/^application\/json(?:;|$)/i.test(req.headers["content-type"]||""))
    throw err(415,"CONTENT_TYPE","application/json erforderlich.");
  let size=0;const chunks=[];
  for await(const chunk of req){
    size+=chunk.length;
    if(size>MAX_BYTES)throw err(413,"TOO_LARGE","Datei übersteigt 25 MB.");
    chunks.push(chunk);
  }
  if(!size)throw err(400,"EMPTY_BODY","JSON fehlt.");
  try{return JSON.parse(Buffer.concat(chunks).toString("utf8"))}
  catch{throw err(400,"INVALID_JSON","Ungültiges JSON.")}
}
function validateArchive(archive){
  if(!archive||typeof archive!=="object"||Array.isArray(archive)
    ||archive.format!=="handball-spielanalyse-season"||archive.version!==1
    ||!Array.isArray(archive.games)||!archive.games.length||archive.games.length>200)
    throw err(400,"INVALID_SEASON","Saison-JSON Version 1 mit 1–200 Spielen erforderlich.");
  if(typeof archive.name!=="string"||!archive.name.trim()||archive.name.length>200)
    throw err(400,"INVALID_SEASON","Ungültiger Saisonname.");
  const ids=new Set();
  for(const game of archive.games){
    if(!game||!GAME_ID.test(game.id||"")||ids.has(game.id)
      ||!game.data||typeof game.data!=="object"||Array.isArray(game.data)
      ||!game.data.home||!game.data.away||!Array.isArray(game.data.events))
      throw err(400,"INVALID_GAME","Doppelte oder ungültige Spielkennung bzw. Spieldaten.");
    ids.add(game.id);
  }
}
function cors(req,res,allowed){
  if(!req.headers.origin)return;
  if(!allowed.has(req.headers.origin))throw err(403,"ORIGIN_DENIED","Frontend-Origin nicht freigegeben.");
  res.setHeader("Access-Control-Allow-Origin",req.headers.origin);
  res.setHeader("Vary","Origin");
}
function safeError(error){
  if(error instanceof ApiError)return error;
  if(error?.code===412||error?.code==="412")
    return err(409,"REVISION_CONFLICT","Veröffentlichungsstand ist zwischenzeitlich geändert worden.");
  if(error?.code===404||error?.code==="404")return err(404,"NOT_FOUND","Saison nicht gefunden.");
  console.error("Season-Sync Fehler:",error?.code||error?.name||"unknown");
  return err(503,"STORAGE_FAILED","Cloud-Speicher ist nicht erreichbar.");
}
export function createSeasonSyncHandler({store,adminToken,allowedOrigins=[],
  now=()=>new Date(),idFactory=randomUUID,readerFactory=()=>randomBytes(32).toString("base64url")}){
  const allowed=new Set(allowedOrigins);
  return async(req,res)=>{
    try{
      cors(req,res,allowed);
      if(req.method==="OPTIONS"){
        if(!req.headers.origin||!allowed.has(req.headers.origin))
          throw err(403,"ORIGIN_DENIED","Frontend-Origin nicht freigegeben.");
        const headers=(req.headers["access-control-request-headers"]||"")
          .split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);
        if(headers.some(x=>!["authorization","content-type"].includes(x)))
          throw err(403,"HEADER_DENIED","Header nicht freigegeben.");
        res.writeHead(204,{"Access-Control-Allow-Methods":"GET, POST, OPTIONS",
          "Access-Control-Allow-Headers":"Authorization, Content-Type",
          "Access-Control-Max-Age":"600","Cache-Control":"no-store"});
        return res.end();
      }
      const url=new URL(req.url||"/","http://localhost");
      if(url.pathname==="/health"&&req.method==="GET")return send(res,200,{status:"ok"});
      if(url.pathname==="/seasons"&&req.method==="POST"){
        trainer(req,adminToken);
        const seasonId=idFactory(),readToken=readerFactory();
        const meta={id:seasonId,readerHash:sha(readToken),
          revision:0,createdAt:now().toISOString(),publishedAt:null,
          archiveObject:null,sha256:null,name:null,gameCount:0,byteSize:0};
        await store.create(seasonId,meta);
        return send(res,201,{seasonId,readToken,revision:0});
      }
      const match=/^\/seasons\/([^/]+)\/(latest|download|publish|rotate-reader)$/.exec(url.pathname);
      if(!match||!VALID_ID.test(match[1]))
        throw err(404,"NOT_FOUND","Endpunkt nicht gefunden.");
      const [,id,action]=match;
      const write=["publish","rotate-reader"].includes(action);
      if(req.method!==(write?"POST":"GET"))
        throw err(405,"METHOD_NOT_ALLOWED",write?"POST erforderlich.":"GET erforderlich.");
      if(write)trainer(req,adminToken);
      const {metadata,generation}=await store.read(id);
      if(!metadata)throw err(404,"NOT_FOUND","Saison nicht gefunden.");
      if(!write)reader(req,metadata);
      if(action==="latest"){
        return send(res,200,{seasonId:id,revision:metadata.revision,
          publishedAt:metadata.publishedAt,sha256:metadata.sha256,
          gameCount:metadata.gameCount,byteSize:metadata.byteSize,name:metadata.name});
      }
      if(action==="download"){
        if(!metadata.archiveObject)throw err(404,"NOT_PUBLISHED","Saison noch nicht veröffentlicht.");
        const bytes=await store.readArchive(metadata.archiveObject);
        res.writeHead(200,{"Content-Type":"application/json; charset=utf-8",
          "Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff",
          "X-Season-Revision":String(metadata.revision),"X-Season-Sha256":metadata.sha256,
          "Access-Control-Expose-Headers":"X-Season-Revision, X-Season-Sha256"});
        return res.end(bytes);
      }
      if(action==="rotate-reader"){
        const readToken=readerFactory();
        await store.update(id,{...metadata,readerHash:sha(readToken)},generation);
        return send(res,200,{seasonId:id,readToken,revision:metadata.revision});
      }
      if(action==="publish"){
        const input=await bodyJson(req);
        if(!Number.isInteger(input?.expectedRevision)||input.expectedRevision!==metadata.revision)
          throw err(409,"REVISION_CONFLICT","Bitte vor dem Hochladen den aktuellen Stand laden.");
        validateArchive(input.archive);
        const bytes=Buffer.from(JSON.stringify(input.archive),"utf8");
        if(bytes.length>MAX_BYTES)throw err(413,"TOO_LARGE","Datei übersteigt 25 MB.");
        const revision=metadata.revision+1;
        const object="seasons/"+id+"/versions/"+revision+"-"+randomUUID()+".json";
        await store.writeArchive(object,bytes);
        const next={...metadata,revision,publishedAt:now().toISOString(),
          archiveObject:object,sha256:sha(bytes),name:input.archive.name,
          gameCount:input.archive.games.length,byteSize:bytes.length};
        await store.update(id,next,generation);
        return send(res,200,{seasonId:id,revision,publishedAt:next.publishedAt,
          sha256:next.sha256,gameCount:next.gameCount,byteSize:next.byteSize});
      }
      throw err(404,"NOT_FOUND","Endpunkt nicht gefunden.");
    }catch(error){
      const e=safeError(error);
      if(!res.headersSent)send(res,e.status,{error:{code:e.code,message:e.message}});
      else res.end();
    }
  };
}
