// nuLiga HTML demonstration adapter.
// Operates only on HTML explicitly supplied by the user (or a CORS-permitted fetch).
// No authentication, crawler, background requests or remote proxy.
const clean = value => String(value ?? "").replace(/\u00a0/g," ").replace(/\s+/g," ").trim();
const norm = value => clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("de");
const cellText = cell => clean(cell?.textContent);
const cellsOf = tr => [...tr.children].filter(e => /^(TD|TH)$/i.test(e.tagName));
const dateRe = /\b(\d{2})\.(\d{2})\.(20\d{2})\b/;
const timeRe = /\b(\d{1,2}):(\d{2})\b/;
const scoreRe = /^(\d{1,3}):(\d{1,3})$/;

export function nuLigaUrlInfo(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || !/^[a-z0-9-]+\.liga\.nu$/i.test(url.hostname)) {
    throw new Error("Nur HTTPS-Seiten der nuLiga-Domain liga.nu sind zulässig.");
  }
  if (!url.pathname.includes("/nuLigaHBDE.woa/wa/")) throw new Error("Keine nuLiga-Handballseite.");
  return {url:url.href,group:url.searchParams.get("group")||"",
    championship:url.searchParams.get("championship")||"",
    teamtable:url.searchParams.get("teamtable")||""};
}
function parseDocument(html) {
  if (typeof DOMParser === "undefined") throw new Error("HTML-Auswertung benötigt einen Browser.");
  const doc=new DOMParser().parseFromString(String(html), "text/html");
  if (!doc.querySelector("table")) throw new Error("Die HTML-Datei enthält keine nuLiga-Tabelle.");
  return doc;
}
function sourceLink(tr, baseUrl) {
  for(const anchor of tr.querySelectorAll("a[href]")){
    const href=anchor.getAttribute("href")||"";
    if(!/groupMeetingReport|clubMeetingReport/.test(href))continue;
    try{
      const url=new URL(href,baseUrl);
      if(!/\.liga\.nu$/i.test(url.hostname))continue;
      return {href:url.href,meetingId:url.searchParams.get("meeting")||null};
    }catch{}
  }
  return {href:null,meetingId:null};
}
// Schedule columns vary between team, group and court pages. A nuLiga
// match number must come from the "Nr."/"Spiel-Nr." header, not from the
// first long number in a row (often the six-digit venue/hall identifier).
const scheduleHeader = value => norm(value).replace(/[^a-z0-9]/g,"");
function scheduleColumns(table) {
  for(const row of [...table.querySelectorAll("tr")].slice(0,12)){
    const cols=cellsOf(row),labels=cols.map(c=>scheduleHeader(cellText(c)));
    const home=labels.findIndex(v=>/^(heimmannschaft|heimteam|heim)$/.test(v));
    const away=labels.findIndex(v=>/^(gastmannschaft|gastteam|gast)$/.test(v));
    if(home<0||away<0)continue;
    const number=labels.findIndex(v=>/^(nr|spielnr|spielnummer|spielno|spnr|nummer)$/.test(v));
    const date=labels.findIndex(v=>/^(datum|spieltag|date)$/.test(v));
    const time=labels.findIndex(v=>/^(zeit|uhrzeit|anpfiff)$/.test(v));
    const hall=labels.findIndex(v=>/^(halle|hallennr|spielort|spielstatte|spielstaette)$/.test(v));
    const result=labels.findIndex(v=>/^(ergebnis|tore|resultat)$/.test(v));
    return {home,away,number,date,time,hall,result};
  }
  return null;
}
function rowDate(texts, dateCol, previous) {
  const candidate=dateCol>=0?texts[dateCol]:"";
  const match=(candidate.match(dateRe)||texts.join(" ").match(dateRe));
  return match?match[3]+"-"+match[2]+"-"+match[1]:previous;
}
function scheduleNumber(texts,columns) {
  if(columns?.number>=0){
    const number=clean(texts[columns.number]);
    // nuLiga competitions include short game numbers (1, 25, 104 etc.).
    return /^\d{1,9}$/.test(number)?number:null;
  }
  // No usable header: take the numeric cell immediately before the age
  // class/competition column, never an arbitrary earlier venue identifier.
  const ageIndex=texts.findIndex((t,i)=>i>=2 && /^(?:M|F|mJ[A-E]|wJ[A-E]|MJA|MJB|MJC|MJD|WJA|WJB|WJC|WJD)$/i.test(t));
  const candidate=ageIndex>0?texts[ageIndex-1]:"";
  if(/^\d{1,9}$/.test(candidate))return candidate;
  return null;
}
// nuLiga may omit day and date in following rows. Carry the most recent
// date forward within that specific schedule table only.
export function parseNuLigaScheduleHtml(html,sourceUrl,{teamName=""}={}) {
  const info=nuLigaUrlInfo(sourceUrl),doc=parseDocument(html),found=new Map();
  const wanted=norm(teamName);
  for(const table of doc.querySelectorAll("table")){
    let day="";
    const columns=scheduleColumns(table);
    for(const row of table.querySelectorAll("tr")){
      const texts=cellsOf(row).map(cellText);
      if(texts.length<5)continue;
      day=rowDate(texts,columns?.date??-1,day);
      if(!day)continue;
      const number=scheduleNumber(texts,columns);
      if(!number)continue;
      const home=columns?texts[columns.home]:null;
      const away=columns?texts[columns.away]:null;
      if(!home||!away||/^(heim|gast|heimmannschaft|gastmannschaft)$/i.test(home))continue;
      if(wanted&&norm(home)!==wanted&&norm(away)!==wanted)continue;
      const clockRaw=columns?.time>=0?texts[columns.time]:"";
      const clock=clockRaw.match(timeRe) || texts.slice(0,columns?.number??0).map(t=>t.match(timeRe)).find(Boolean);
      const time=clock?String(clock[1]).padStart(2,"0")+":"+clock[2]:"";
      const score=columns?.result>=0?texts[columns.result].match(scoreRe):
        texts.slice(Math.max(columns?.away??0,0)+1).map(t=>t.match(scoreRe)).find(Boolean);
      const report=sourceLink(row,info.url);
      const id=[info.group||"group",info.championship||"season",number].join(":");
      // Two different source tables may show the same match; keep the
      // version with the richer report link / result instead of duplicating.
      const previous=found.get(id);
      const item={id,gameNumber:number,meetingId:report.meetingId,reportUrl:report.href,
        home,away,date:day,time,matchDate:day+(time?"T"+time+":00":"T00:00:00"),
        result:score?score[0]:null,sourceUrl:info.url,group:info.group,
        championship:info.championship,teamtable:info.teamtable};
      if(!previous || (!previous.meetingId&&item.meetingId) || (!previous.result&&item.result))found.set(id,item);
    }
  }
  const matches=[...found.values()]
    .sort((a,b)=>a.matchDate.localeCompare(b.matchDate)||a.gameNumber.localeCompare(b.gameNumber));
  if(!matches.length)throw new Error("Keine Begegnungen erkannt. Prüfe die nuLiga-Staffel und die genaue Mannschaftsbezeichnung.");
  return matches;
}

export function buildNuLigaSeasonGame(match,preferredTeam="") {
  const own=norm(match.home)===norm(preferredTeam)?"home":"away";
  const matchId=String(match.meetingId||match.gameNumber);
  const state={
    format:"handball-spielanalyse",version:1,
    gameName:match.home+" - "+match.away,
    gameDate:match.matchDate,competition:match.championship||"nuLiga",
    analysisPerspective:own,ownTeam:own,
    home:{name:match.home,players:[]},away:{name:match.away,players:[]},
    events:[],gameTime:0,timer:{duration:30,half:1,secondsElapsed:0,active:false},
    isHistorical:false,isVideoscoutingFile:false,
    officialSource:{provider:"nuliga",matchId,gameNumber:match.gameNumber,
      meetingId:match.meetingId||null,reportUrl:match.reportUrl||null,
      teamPageUrl:match.sourceUrl,group:match.group,championship:match.championship,
      matchDate:match.matchDate,reportedScore:match.result,rosterSource:"not-imported"}
  };
  return {fileName:"nuliga_"+(match.group||"season")+"_"+match.gameNumber+".json",
    state,selected:false,ownTeam:own,opponentTeam:own==="home"?"away":"home"};
}
function reportPerson(cell,side) {
  const text=cellText(cell),match=text.match(/^(\d{1,3})\s+(.+)$/);
  return match?{nr:match[1],name:match[2]}:null;
}
function splitName(value) {
  const bits=clean(value).split(",");
  if(bits.length>1)return {nachname:clean(bits[0]),vorname:clean(bits.slice(1).join(","))};
  const words=clean(value).split(" ");
  return {vorname:words.slice(0,-1).join(" "),nachname:words.at(-1)||""};
}
function playerIdFromLink(cell) {
  const link=cell?.querySelector("a[href]");if(!link)return "";
  const href=link.getAttribute("href")||"";
  return /(?:person|personId|personPortrait|personnel|player)=(\d+)/i.exec(href)?.[1]||"";
}
export function parseNuLigaReportHtml(html) {
  const doc=parseDocument(html),bodyText=clean(doc.body?.textContent);
  const gameNumber=/(?:Spielnummer|Spiel-Nr\.?|Spielnr\.?)\s*[:#]?\s*(\d{5,9})\b/i.exec(bodyText)?.[1]||null;
  const rosters={home:[],away:[]},events=[];
  let rosterTables=0;
  for(const table of doc.querySelectorAll("table")){
    const rows=[...table.querySelectorAll("tr")];
    if(!rows.length)continue;
    const headings=rows.slice(0,3).map(tr=>cellsOf(tr).map(cellText).join(" ")).join(" ");
    if(/(?:Trikot|Nr\.?|Nummer)/i.test(headings)&&/Name/i.test(headings)&&!/Zeit.+Stand.+Ereignis/i.test(headings)){
      if(rosterTables>=2)continue;
      const side=rosterTables++===0?"home":"away";
      for(const tr of rows) {
        const cols=cellsOf(tr);
        if(cols.length<2)continue;
        const nr=cellText(cols[0]),name=cellText(cols[1]);
        if(!/^\d{1,3}$/.test(nr)||!name||/^(Name|Trikot)/i.test(name))continue;
        const bits=splitName(name),nuLigaId=playerIdFromLink(cols[1]);
        rosters[side].push({id:"nuliga-"+side+"-"+(nuLigaId||nr+"-"+norm(name).replace(/ /g,"-")),
          nr:Number(nr),...bits,isTW:false,nuLigaId});
      }
      continue;
    }
    if(!/Team/.test(headings)||!/Zeit/.test(headings)||!/Ereignis/.test(headings))continue;
    for(const tr of rows){
      const cols=cellsOf(tr);
      // Printed nuLiga reports often put two timelines beside each other.
      // Treat every five-column block as a separate sequence.
      for(let offset=0;offset+4<cols.length;offset+=5){
        const chunk=cols.slice(offset,offset+5),c=chunk.map(cellText);
        const side=/^Heim$/i.test(c[0])?"home":/^Gast$/i.test(c[0])?"away":null;
        const tm=c[1]?.match(/^(\d{1,3}):(\d{2})$/);
        if(!tm)continue;
        const seconds=Number(tm[1])*60+Number(tm[2]),action=c[3]||"";
        const key=norm(action);
        let type=null;
        if(/^(7m mit tor|tor)$/.test(key))type="goal";
        else if(/^7m ohne tor/.test(key))type="miss";
        else if(/2 minuten/.test(key))type="2min";
        else if(/verwarnung/.test(key))type="yellow";
        else if(/disqualifikation|rote karte/.test(key))type="red";
        else if(/auszeit/.test(key))type="timeout";
        if(!type)continue;
        const person=reportPerson(chunk[4],side);
        const player=side&&person?rosters[side].find(p=>String(p.nr)===person.nr):null;
        const score=(c[2]||"").match(scoreRe),is7=/7m/.test(key);
        events.push({id:"nuliga-"+(gameNumber||"report")+"-"+events.length,
          time:seconds,displayTime:String(tm[1]).padStart(2,"0")+":"+tm[2],half:seconds>=1800?2:1,
          type,team:side||(/heim/.test(key)?"home":/gast/.test(key)?"away":null),
          pId:player?.id||null,pName:person?.name||"Unbekannt",pNr:person?.nr?Number(person.nr):null,
          scoreH:score?Number(score[1]):null,scoreA:score?Number(score[2]):null,
          scoreChanged:type==="goal",is7:is7||undefined,z:is7?"7M":undefined,
          tags:[],playerTags:[],attackPhase:is7?"7-Meter":null,
          officialSource:"nuliga",officialEventType:action,
          endedPossessionOf:["goal","miss"].includes(type)?side:undefined});
      }
    }
  }
  if(!rosters.home.length&&!rosters.away.length&&!events.length){
    throw new Error("Kein unterstützter vollständiger nuLiga-Spielbericht erkannt.");
  }
  events.sort((a,b)=>a.time-b.time||String(a.id).localeCompare(String(b.id)));
  return {gameNumber,rosters,events,reportStatus:/Spielbericht\s*\(genehmigt\)/i.test(bodyText)?"genehmigt":"ungeprüft"};
}
function joinPlayers(existing,incoming,side){
  const result=structuredClone(existing||[]),used=new Set(result.map(p=>String(p.id)));
  for(const raw of incoming){
    const key=norm(raw.vorname+" "+raw.nachname);
    const byId=result.filter(p=>raw.nuLigaId&&String(p.nuLigaId||"")===raw.nuLigaId);
    const byName=result.filter(p=>norm(p.vorname+" "+p.nachname)===key);
    let found=byId.length===1?byId[0]:(byId.length===0&&byName.length===1?byName[0]:null);
    if(found){
      // Conflicting person IDs must not be silently linked.
      if(found.nuLigaId&&raw.nuLigaId&&found.nuLigaId!==raw.nuLigaId)found=null;
    }
    if(found){
      if(!found.nuLigaId&&raw.nuLigaId)found.nuLigaId=raw.nuLigaId;
      if(!found.nr && raw.nr)found.nr=raw.nr;
    }else{
      const added=structuredClone(raw);let candidate=String(added.id),n=2;
      while(used.has(candidate))candidate=String(added.id)+"-"+n++;
      added.id=candidate;used.add(candidate);result.push(added);
    }
  }
  return result;
}
// Import a nuLiga protocol next to an existing scouting match, including
// matches first created manually or through handball.net. Never add protocol
// events to the scouting timeline, where they would count as duplicate goals.
export function attachNuLigaReportForComparison(game,report,{reportUrl=""}={}) {
  if(!game?.state || !Array.isArray(report?.events))throw new Error("Kein gültiger Spielbericht.");
  const source=game.state.officialSource||{};
  if(source.provider==="nuliga" && source.gameNumber &&
    String(source.gameNumber)!==String(report.gameNumber))
    throw new Error("Spielnummer stimmt nicht mit dem bestehenden nuLiga-Spiel überein.");
  const updated=structuredClone(game);
  for(const side of ["home","away"]){
    updated.state[side].players=joinPlayers(updated.state[side].players,report.rosters?.[side]||[],side);
  }
  const officialEvents=report.events.map(event=>{
    const side=event.team,number=event.pNr;
    const player=side&&["home","away"].includes(side)
      ?updated.state[side].players.find(p=>number!==null&&number!==undefined &&
        String(p.nr)===String(number)&&norm(p.nachname)===norm(splitName(event.pName).nachname))
      :null;
    return {...event,pId:player?.id||null};
  });
  updated.state.officialData={...(updated.state.officialData||{}),
    nuLigaEvents:officialEvents,
    nuLigaReport:{gameNumber:String(report.gameNumber||""),status:report.reportStatus||"ungeprüft",
      importedAt:new Date().toISOString(),reportUrl:reportUrl||source.reportUrl||""}};
  if(source.provider==="nuliga")updated.state.officialSource={
    ...source,rosterSource:"report",reportStatus:report.reportStatus,
    reportEventCount:officialEvents.length,reportImportedAt:new Date().toISOString()};
  return updated;
}

export function applyNuLigaReport(game,report){
  const source=game?.state?.officialSource||{};
  if(source.provider!=="nuliga"||String(source.gameNumber)!==String(report.gameNumber))
    throw new Error("Spielnummer aus dem Bericht stimmt nicht mit dem gewählten nuLiga-Spiel überein.");
  const updated=structuredClone(game.state),hasOwnEvents=Boolean(updated.events?.length);
  for(const side of ["home","away"])updated[side].players=joinPlayers(updated[side].players,report.rosters[side],side);
  // Re-link only imported nuLiga events against the merged roster: never alter
  // previously-scanned events or their historical local player references.
  const officialEvents=report.events.map(e=>{
    const same=e.team&&updated[e.team].players.find(p=>
      (e.pNr!==null&&String(p.nr)===String(e.pNr))&&norm(p.nachname)===norm(splitName(e.pName).nachname));
    return {...e,pId:same?.id||null};
  });
  if(!hasOwnEvents) {
    updated.events=officialEvents;
    updated.isHistorical=Boolean(officialEvents.length);
    updated.isVideoscoutingFile=Boolean(officialEvents.length);
  }
  updated.officialSource={...source,reportStatus:report.reportStatus,
    rosterSource:"report",reportImportedAt:new Date().toISOString(),
    reportEventCount:officialEvents.length};
  // Store separate official events only when user-generated scouting exists.
  if(hasOwnEvents)updated.officialData={...(updated.officialData||{}),nuLigaEvents:officialEvents};
  return {...game,state:updated,selected:updated.events.length>0};
}
