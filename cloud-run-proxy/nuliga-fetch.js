// One user-triggered public HTML retrieval. Restricted to the HVNB nuLiga
// handball site; no link traversal, login, redirects or background crawling.
const HOST = "hvnb-handball.liga.nu";
const ROOT = "/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/";
const ACTIONS = new Set(["teamPortrait","groupPage","groupMeetingReport","clubMeetingReport"]);
const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 12_000;

export function validateNuLigaUrl(raw) {
  let url;
  try { url = new URL(String(raw ?? "")); } catch { throw Error("Ungültige nuLiga-URL."); }
  const action=url.pathname.startsWith(ROOT)?url.pathname.slice(ROOT.length):"";
  if(url.protocol!=="https:" || url.hostname!==HOST || url.port ||
     url.username || url.password || url.hash || !ACTIONS.has(action)) {
    throw Error("Nur öffentliche nuLiga-HVNB-Team-, Staffel- und Spielbericht-URLs sind erlaubt.");
  }
  if(url.href.length>2048)throw Error("nuLiga-URL zu lang.");
  for(const [key,value] of url.searchParams){
    if(key.length>64 || value.length>250)throw Error("Ungültiger nuLiga-Parameter.");
  }
  return url.href;
}

export async function fetchNuLigaHtml(raw,{fetchImpl=fetch,timeoutMs=TIMEOUT_MS,maxBytes=MAX_BYTES}={}) {
  const url=validateNuLigaUrl(raw);
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),timeoutMs);
  try {
    const response=await fetchImpl(url,{
      signal:controller.signal,
      redirect:"error",
      headers:{"Accept":"text/html,application/xhtml+xml","User-Agent":"Spielanalyse-Demo/1.0"}
    });
    if(!response.ok)throw Error("nuLiga-Server meldet HTTP "+response.status+".");
    const type=(response.headers.get("content-type")||"").toLowerCase();
    if(type && !/text\/html|application\/xhtml\+xml/.test(type))throw Error("nuLiga lieferte keine HTML-Seite.");
    const announced=Number(response.headers.get("content-length")||0);
    if(announced>maxBytes)throw Error("nuLiga-Seite überschreitet das 2-MB-Limit.");
    const chunks=[];let length=0;
    for await(const chunk of response.body||[]){
      length+=chunk.length;
      if(length>maxBytes)throw Error("nuLiga-Seite überschreitet das 2-MB-Limit.");
      chunks.push(Buffer.from(chunk));
    }
    if(!length)throw Error("Leere nuLiga-Antwort.");
    const bytes=Buffer.concat(chunks);
    const first=new TextDecoder("windows-1252").decode(bytes.subarray(0,1024));
    const charset=(/charset=["']?([\w-]+)/i.exec(type)?.[1] ||
      /<meta[^>]+charset=["']?([\w-]+)/i.exec(first)?.[1] ||
      /<meta[^>]+content=["'][^"']*charset=([\w-]+)/i.exec(first)?.[1] || "utf-8").toLowerCase();
    let html;
    try{html=new TextDecoder(charset).decode(bytes);}catch{html=new TextDecoder("utf-8").decode(bytes);}
    return {url,html};
  } catch(error){
    if(controller.signal.aborted)throw Error("nuLiga-Abruf hat das Zeitlimit überschritten.");
    throw error;
  } finally {clearTimeout(timeout);controller.abort();}
}
