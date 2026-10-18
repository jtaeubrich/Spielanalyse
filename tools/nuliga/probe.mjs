#!/usr/bin/env node
// Isolated nuLiga API reconnaissance. No modification of Spielanalyse state.
// Usage: node tools/nuliga/probe.mjs --meeting-id 8279189
const BASE = 'https://hbde-portal.liga.nu/rs';
export const endpoints = id => {
  if (!/^\d+$/.test(String(id))) throw new Error('Meeting ID must contain digits only');
  const root = BASE + '/2014/meetings/' + id;
  return { meeting:root, players:root+'/players', events:root+'/meetingEvents' };
};
export function summarize(body) {
  if (!body || typeof body !== 'object') return {kind:typeof body,valid:false};
  const keys = Object.keys(body);
  return {kind:Array.isArray(body)?'array':'object',keys:keys.slice(0,40),
    arrayLengths:Object.fromEntries(keys.filter(k=>Array.isArray(body[k])).map(k=>[k,body[k].length])),
    itemCount:Array.isArray(body)?body.length:undefined,valid:true};
}
export async function probe(id,{fetchImpl=fetch,timeoutMs=12000}={}) {
  const results={meetingId:String(id),base:BASE,checkedAt:new Date().toISOString(),resources:{}};
  for (const [name,url] of Object.entries(endpoints(id))) {
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try {
      const response=await fetchImpl(url,{headers:{Accept:'application/json'},signal:controller.signal,redirect:'follow'});
      const type=response.headers?.get?.('content-type') || '';
      const item={url,status:response.status,contentType:type,ok:response.ok};
      if(response.ok && /json/i.test(type)) {
        const data=await response.json();
        item.schema=summarize(data);
      } else {
        item.issue=response.ok?'Response is not JSON':'HTTP status is not successful';
      }
      results.resources[name]=item;
    } catch(error) {
      results.resources[name]={url,ok:false,issue:error.name==='AbortError'?'timeout':'connection_failed',detail:String(error.message).slice(0,140)};
    } finally {clearTimeout(timer);}
  }
  results.importReady=false; // Requires verified nuLiga schema and a separate event/player mapper.
  return results;
}
if(process.argv[1] && import.meta.url===new URL('file://'+process.argv[1]).href){
  const id=process.argv[process.argv.indexOf('--meeting-id')+1];
  if(!id){console.error('Usage: node tools/nuliga/probe.mjs --meeting-id <nuLiga REST meetingId>');process.exitCode=2;}
  else {try{const report=await probe(id);console.log(JSON.stringify(report,null,2));if(Object.values(report.resources).some(r=>!r.ok))process.exitCode=1;}catch(e){console.error(e.message);process.exitCode=2;}}
}
