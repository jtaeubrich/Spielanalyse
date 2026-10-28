// One short export name for the season JSON and the portable ZIP archive.
// These helpers do not modify saved season titles or archive contents.
function slug(text) {
  const cleaned=String(text||"").trim()
    .replace(/ä/gi,m=>m==="Ä"?"Ae":"ae")
    .replace(/ö/gi,m=>m==="Ö"?"Oe":"oe")
    .replace(/ü/gi,m=>m==="Ü"?"Ue":"ue")
    .replace(/ß/g,"ss")
    .normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-zA-Z0-9]+/g,"_")
    .replace(/^_+|_+$/g,"").replace(/_+/g,"_");
  return cleaned.slice(0,60).replace(/_+$/g,"");
}

function seasonYears(title,games) {
  const text=String(title||"");
  const match=/(?:^|[^\d])(20\d{2}|\d{2})\s*[-_\/.]\s*(20\d{2}|\d{2})(?!\d)/.exec(text);
  if(match) {
    const year=Number(match[1].length===2?"20"+match[1]:match[1]);
    const next=Number(match[2].length===2?String(Math.floor(year/100))+match[2]:match[2]);
    if(next===year+1)return year+"-"+String(next).slice(-2);
  }
  const dates=(Array.isArray(games)?games:[]).map(game=>{
    const state=game?.state||game?.data||{};
    const raw=String(state.officialSource?.matchDate||state.gameDate||"");
    return /^\d{4}-\d{2}-\d{2}/.test(raw)?raw.slice(0,10):"";
  }).filter(Boolean).sort();
  if(!dates.length)return "";
  const earliest=dates[0],year=Number(earliest.slice(0,4)),month=Number(earliest.slice(5,7));
  if(month<1||month>12)return "";
  const start=month>=7?year:year-1;
  return start+"-"+String(start+1).slice(-2);
}
function inferredTeam(games) {
  const votes=new Map();
  for(const game of Array.isArray(games)?games:[]) {
    const state=game?.state||game?.data||{};
    const own=game?.ownTeam||state?.ownTeam;
    const name=String(state?.[own]?.name||"").trim();
    if(!name)continue;
    const key=name.toLocaleLowerCase("de");
    const previous=votes.get(key);
    votes.set(key,{name,count:(previous?.count||0)+1});
  }
  const sorted=[...votes.values()].sort((a,b)=>b.count-a.count);
  return sorted[0]&&sorted[0].count>(sorted[1]?.count||0)?sorted[0].name:"";
}

export function seasonExportStem({seasonName="",preferredTeam="",archiveTeam="",games=[]}={}) {
  // Official season team identity is preferred over an editable display title.
  const explicit=String(preferredTeam||"").trim();
  const archived=String(archiveTeam||"").trim();
  const title=String(seasonName||"").trim();
  const prefix=/^(.+?)\s*(?:[·|]\s*|\s+)Saison\s+(?:20)?\d{2}[-_\/.]\d{2,4}\s*$/i.exec(title)?.[1]||"";
  const team=explicit||archived||inferredTeam(games)||prefix||"Saison";
  const base=slug(team)||"Saison",years=seasonYears(title,games);
  return years?base+"_"+years:base==="Saison"?"Saison":base+"_Saison";
}
export function seasonExportFileName(metadata={},kind="json"){
  const stem=seasonExportStem(metadata);
  return kind==="zip"?stem+"_archiv.zip":stem+".json";
}
