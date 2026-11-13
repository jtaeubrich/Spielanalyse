// handball.net/Handball360 match.date encodes the *published local kickoff*
// as the literal hour/minute even when the ISO suffix says +00:00 / Z.
// The season file retains that source string unchanged. Do not use Date()
// followed by Europe/Berlin here: it would add CET/CEST a second time.
// This parsing rule is deliberately limited to Handball360 official fields.
export function handball360Kickoff(value) {
  const raw=String(value??"").trim();
  const match=/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.exec(raw);
  if(!match)return null;
  const [,date,hour,minute]=match;
  const d=new Date(date+"T12:00:00Z");
  if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==date)return null;
  if(hour===undefined)return {date,time:""};
  if(Number(hour)>23||Number(minute)>59)return null;
  return {date,time:hour+":"+minute};
}
