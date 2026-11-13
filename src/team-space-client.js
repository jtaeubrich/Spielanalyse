// Team Space browser API. All player requests are read-only. Credentials
// travel in Authorization headers, never in request URLs or exported games.
import {seasonCloudCall,seasonCloudEndpoint,validSeasonCloudId,
  validSeasonCloudToken} from "./season-sync-client.js";
const gameId=/^sg-[a-z0-9_-]{1,80}$/i;
export const teamSpaceGameId=value=>gameId.test(String(value||""));
function requireConnection(connection){
  if(!validSeasonCloudId(connection?.spaceId)||!validSeasonCloudToken(connection?.readToken))
    throw Error("Team-Space-Zugang fehlt oder ist ungültig.");
  return {api:seasonCloudEndpoint(connection.api),...connection};
}
export function parseTeamSpaceInvite(fragment){
  const params=new URLSearchParams(String(fragment||"").replace(/^#/,""));
  if(!params.has("teamspace"))return null;
  const spaceId=params.get("teamspace"),readToken=params.get("key");
  if(!validSeasonCloudId(spaceId)||!validSeasonCloudToken(readToken))
    throw Error("Team-Space-Einladung enthält ungültige Zugangsdaten.");
  return {spaceId,api:seasonCloudEndpoint(params.get("api")),readToken,
    role:"reader"};
}
export function makeTeamSpaceInvite(appUrl,connection){
  const link=new URL(appUrl);
  const config=requireConnection(connection);
  link.hash=new URLSearchParams({teamspace:config.spaceId,
    key:config.readToken,api:config.api}).toString();
  return link.href;
}
async function request(connection,suffix,{fetcher=fetch,method="GET",data,adminToken}={}){
  const config=adminToken?{api:seasonCloudEndpoint(connection.api)}:requireConnection(connection);
  return seasonCloudCall(config,"/spaces/"+connection.spaceId+suffix,{
    method,data,authToken:adminToken,fetcher
  });
}
export async function createTeamSpace(api,teamName,adminToken,{fetcher=fetch}={}){
  const root=seasonCloudEndpoint(api);
  if(!String(teamName||"").trim())throw Error("Teamname fehlt.");
  const res=await seasonCloudCall({api:root},"/spaces",{
    fetcher,method:"POST",authToken:adminToken,data:{name:String(teamName).trim()}
  });
  const data=await res.json();
  if(!validSeasonCloudId(data.spaceId)||!validSeasonCloudToken(data.readToken))
    throw Error("Der Dienst hat ungültige Team-Space-Daten zurückgegeben.");
  return {api:root,spaceId:data.spaceId,readToken:data.readToken,
    name:data.name,role:"trainer",revision:data.revision||0};
}
export async function teamSpaceCatalog(connection,{fetcher=fetch}={}){
  const response=await request(connection,"/catalog",{fetcher});
  const catalog=await response.json();
  if(catalog.spaceId!==connection.spaceId||
     !Number.isInteger(catalog.revision)||catalog.revision<0||
     !Array.isArray(catalog.seasons)||!Array.isArray(catalog.games))
    throw Error("Der Team-Space-Katalog ist unvollständig.");
  for(const season of catalog.seasons){
    if(!validSeasonCloudId(season.id)||!Number.isInteger(season.revision))
      throw Error("Ungültiger Saisoneintrag im Team Space.");
  }
  for(const game of catalog.games){
    if(!teamSpaceGameId(game.id)||!Number.isInteger(game.revision)||
      !/^[a-f0-9]{64}$/i.test(game.sha256||""))
      throw Error("Ungültiger Spieleintrag im Team Space.");
  }
  return catalog;
}
async function verifiedDownload(connection,suffix,{fetcher=fetch}={}){
  const response=await request(connection,suffix,{fetcher});
  const text=await response.text(),expected=response.headers.get("x-content-sha256");
  if(!/^[a-f0-9]{64}$/i.test(expected||""))throw Error("Prüfsumme des Team-Space-Downloads fehlt.");
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));
  const actual=[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,"0")).join("");
  if(actual!==expected.toLowerCase())throw Error("Der Team-Space-Download ist beschädigt.");
  const revision=Number(response.headers.get("x-item-revision"));
  if(!Number.isInteger(revision)||revision<1)throw Error("Ungültige Veröffentlichungsversion.");
  let data;
  try{data=JSON.parse(text)}catch{throw Error("Ungültige JSON-Datei im Team Space.")}
  return {data,revision,sha256:actual};
}
export function downloadTeamSpaceSeason(connection,seasonId,options){
  if(!validSeasonCloudId(seasonId))throw Error("Saisonkennung ungültig.");
  return verifiedDownload(connection,"/seasons/"+seasonId+"/download",options);
}
export function downloadTeamSpaceGame(connection,gameId,options){
  if(!teamSpaceGameId(gameId))throw Error("Spielkennung ungültig.");
  return verifiedDownload(connection,"/games/"+gameId+"/download",options);
}
export async function publishTeamSpaceSeason(connection,archive,adminToken,
    expectedRevision,seasonId=null,{fetcher=fetch}={}){
  if(!Number.isInteger(expectedRevision)||expectedRevision<0)
    throw Error("Katalogversion ungültig.");
  const data={expectedRevision,archive};
  if(seasonId){
    if(!validSeasonCloudId(seasonId))throw Error("Saisonkennung ungültig.");
    data.seasonId=seasonId;
  }
  const response=await request(connection,"/publish-season",{
    method:"POST",data,adminToken,fetcher
  });
  return response.json();
}
export async function publishTeamSpaceGame(connection,game,adminToken,
    expectedRevision,{gameId,seasonId,fileName}={}, {fetcher=fetch}={}){
  if(!Number.isInteger(expectedRevision)||expectedRevision<0)
    throw Error("Katalogversion ungültig.");
  if(gameId&&!teamSpaceGameId(gameId))throw Error("Spielkennung ungültig.");
  if(seasonId&&!validSeasonCloudId(seasonId))throw Error("Saisonkennung ungültig.");
  const response=await request(connection,"/publish-game",{
    method:"POST",adminToken,fetcher,
    data:{expectedRevision,game,...(gameId?{gameId}:{}),
      ...(seasonId?{seasonId}:{}),...(fileName?{fileName}:{})}
  });
  return response.json();
}
export async function rotateTeamSpaceReadToken(connection,adminToken,{fetcher=fetch}={}){
  const response=await request(connection,"/rotate-reader",{
    fetcher,method:"POST",adminToken
  });
  const data=await response.json();
  if(!validSeasonCloudToken(data.readToken))
    throw Error("Neuer Team-Space-Leseschlüssel ungültig.");
  return {...connection,readToken:data.readToken};
}
