// Browser client for a private, read-only-to-players season cloud service.
// Cloud service credentials stay outside the v1 game and season JSON files.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const token=/^[A-Za-z0-9_-]{32,256}$/;
export function validSeasonCloudId(value){return uuid.test(String(value||""))}
export function validSeasonCloudToken(value){return token.test(String(value||""))}
export function seasonCloudEndpoint(input){
  let url;
  try{url=new URL(String(input||"").trim())}
  catch{throw Error("Ungültige Saison-Cloud-Adresse.")}
  if(url.protocol!=="https:"||url.username||url.password||
    url.pathname!=="/"||url.search||url.hash||url.port)
    throw Error("Saison-Cloud muss eine HTTPS-Root-URL ohne Pfad oder Zugangsdaten sein.");
  const host=url.hostname.toLowerCase();
  if(!host.startsWith("handball-season-sync-")||!host.endsWith(".run.app"))
    throw Error("Nur der separate handball-season-sync Cloud-Run-Dienst wird unterstützt.");
  return url.origin;
}
export function makeSeasonInvite(appUrl,connection){
  const link=new URL(appUrl);
  const api=seasonCloudEndpoint(connection.api);
  if(!validSeasonCloudId(connection.seasonId)||!validSeasonCloudToken(connection.readToken))
    throw Error("Cloud-Saisonkennung oder Lesezugang ungültig.");
  link.hash=new URLSearchParams({saison:connection.seasonId,
    key:connection.readToken,api}).toString();
  return link.href;
}
export function parseSeasonInvite(hash){
  const text=String(hash||"").replace(/^#/,"");
  if(!text)return null;
  const params=new URLSearchParams(text);
  if(!params.has("saison")&&!params.has("key"))return null;
  const seasonId=params.get("saison"),readToken=params.get("key");
  if(!validSeasonCloudId(seasonId)||!validSeasonCloudToken(readToken))
    throw Error("Ungültiger Saison-Einladungslink.");
  const api=seasonCloudEndpoint(params.get("api"));
  return {api,seasonId,readToken,role:"reader",revision:0};
}
export async function seasonCloudCall(connection,path,{method="GET",data,authToken,fetcher=fetch}={}){
  const api=seasonCloudEndpoint(connection.api);
  const key=authToken||connection.readToken;
  if(!validSeasonCloudToken(key))throw Error("Cloud-Zugang fehlt oder ist ungültig.");
  const response=await fetcher(api+path,{
    method,cache:"no-store",redirect:"error",
    headers:{"Authorization":"Bearer "+key,"Accept":"application/json",
      ...(data!==undefined?{"Content-Type":"application/json"}:{})},
    ...(data!==undefined?{body:JSON.stringify(data)}:{})
  });
  if(!response.ok){
    const detail=await response.json().catch(()=>null);
    const error=new Error(detail?.error?.message||"Saison-Cloud HTTP "+response.status);
    error.status=response.status;error.code=detail?.error?.code;
    throw error;
  }
  return response;
}
function path(connection,suffix=""){
  if(!validSeasonCloudId(connection?.seasonId))throw Error("Cloud-Saisonkennung ungültig.");
  return "/seasons/"+connection.seasonId+suffix;
}
export async function createCloudSeason(api,adminToken,{fetcher=fetch}={}){
  const prepared={api:seasonCloudEndpoint(api)};
  const res=await seasonCloudCall(prepared,"/seasons",{
    method:"POST",authToken:adminToken,fetcher
  });
  const json=await res.json();
  if(!validSeasonCloudId(json.seasonId)||!validSeasonCloudToken(json.readToken))
    throw Error("Cloud hat ungültige Zugangsdaten zurückgegeben.");
  return {api:prepared.api,seasonId:json.seasonId,readToken:json.readToken,
    role:"trainer",revision:0};
}
export async function latestCloudSeason(connection,{fetcher=fetch}={}){
  const res=await seasonCloudCall(connection,path(connection,"/latest"),{fetcher});
  const data=await res.json();
  if(data.seasonId!==connection.seasonId||
    !Number.isInteger(data.revision)||data.revision<0)
    throw Error("Ungültige Versionsinformationen der Cloud.");
  return data;
}
export async function downloadCloudSeason(connection,{fetcher=fetch}={}){
  const response=await seasonCloudCall(connection,path(connection,"/download"),{fetcher});
  const text=await response.text();
  const expected=response.headers.get("x-season-sha256");
  if(!/^[0-9a-f]{64}$/i.test(expected||""))
    throw Error("Prüfsumme der Cloud-Saison fehlt.");
  const bytes=new TextEncoder().encode(text);
  const hashed=await crypto.subtle.digest("SHA-256",bytes);
  const actual=[...new Uint8Array(hashed)].map(x=>x.toString(16).padStart(2,"0")).join("");
  if(actual.toLowerCase()!==expected.toLowerCase())
    throw Error("Die geladene Saisondatei hat eine ungültige Prüfsumme.");
  let archive;
  try{archive=JSON.parse(text)}
  catch{throw Error("Die Cloud-Saison enthält ungültiges JSON.")}
  const revision=Number(response.headers.get("x-season-revision"));
  if(!Number.isInteger(revision)||revision<1)
    throw Error("Ungültiger Veröffentlichungsstand.");
  return {archive,revision,sha256:actual};
}
export async function publishCloudSeason(connection,archive,adminToken,revision,{fetcher=fetch}={}){
  if(!Number.isInteger(revision)||revision<0)throw Error("Veröffentlichungsstand ungültig.");
  const response=await seasonCloudCall(connection,path(connection,"/publish"),{
    fetcher,method:"POST",authToken:adminToken,
    data:{expectedRevision:revision,archive}
  });
  return response.json();
}
export async function rotateCloudReadKey(connection,adminToken,{fetcher=fetch}={}){
  const response=await seasonCloudCall(connection,path(connection,"/rotate-reader"),{
    fetcher,method:"POST",authToken:adminToken
  });
  const json=await response.json();
  if(!validSeasonCloudToken(json.readToken))throw Error("Ungültiger neuer Leseschlüssel.");
  return {...connection,readToken:json.readToken};
}
