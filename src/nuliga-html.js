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
// nuLiga repeats the date only in the first row of each day. Carry it
// forward within a table, but never across different tables.
export function parseNuLigaScheduleHtml(html,sourceUrl,{teamName=""}={}) {
  const info=nuLigaUrlInfo(sourceUrl),doc=parseDocument(html),found=new Map();
  for(const table of doc.querySelectorAll("table")){
    let day="";
    for(const row of table.querySelectorAll("tr")){
      const cols=cellsOf(row),texts=cols.map(cellText);
      if(texts.length<7)continue;
      const date=texts.join(" ").match(dateRe);
      if(date)day=date[3]+"-"+date[2]+"-"+date[1];
      const numberIndex=texts.findIndex(t=>/^\d{5,9}$/.test(t));
      if(numberIndex<0 || !day || numberIndex+2>=texts.length)continue;
      const gameNumber=texts[numberIndex];
      const home=texts[numberIndex+1],away=texts[numberIndex+2];
      if(!home||!away||/^(heim|gast|heimmannschaft|gastmannschaft)$/i.test(home))continue;
      // For the standard groupPage schedule, time comes before the game no.
      const before=texts.slice(0,numberIndex);
      const clock=[...before].reverse().map(t=>t.match(timeRe)).find(Boolean);
      const time=clock?String(clock[1]).padStart(2,"0")+":"+clock[2]:"";
      const result=texts.slice(numberIndex+3).map(t=>t.match(scoreRe)).find(Boolean);
      const report=sourceLink(row,info.url);
      const id=[info.group||"group",info.championship||"season",gameNumber].join(":");
      found.set(id,{id,gameNumber,meetingId:report.meetingId,reportUrl:report.href,
        home,away,date:day,time,matchDate:day+(time?"T"+time+":00":"T00:00:00"),
        result:result?result[0]:null,sourceUrl:info.url,group:info.group,
        championship:info.championship,teamtable:info.teamtable});
    }
  }
  const matches=[...found.values()].filter(m=>!teamName || norm(m.home)===norm(teamName)||norm(m.away)===norm(teamName))
    .sort((a,b)=>a.matchDate.localeCompare(b.matchDate)||a.gameNumber.localeCompare(b.gameNumber));
  if(!matches.length)throw new Error("Keine erkennbaren Saisonspiele gefunden. Bitte den vollständigen nuLiga-Spielplan (Gesamt) als HTML speichern.");
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
  const gameNumber=/Spielnummer\s+(\d{5,9})\b/.exec(bodyText)?.[1]||null;
  const rosters={home:[],away:[]},events=[];
  let rosterTables=0;
  for(const table of doc.querySelectorAll("table")){
    const rows=[...table.querySelectorAll("tr")];
    if(!rows.length)continue;
    const headings=rows.slice(0,3).map(tr=>cellsOf(tr).map(cellText).join(" ")).join(" ");
    if(/Trikot/.test(headings)&&/Name[, ]+Vorname/i.test(headings)){
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
      const cols=cellsOf(tr),c=cols.map(cellText);
      if(c.length<4)continue;
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
      const person=reportPerson(cols[4],side);
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
  if(!gameNumber || (!rosters.home.length&&!rosters.away.length&&!events.length)){
    throw new Error("Kein unterstützter vollständiger nuLiga-Spielbericht erkannt.");
  }
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
