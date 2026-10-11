import { findKnownTeamRecord } from "./team-rosters.js";
export const INSTAGRAM_SIZE = Object.freeze({width:1080,height:1350});
export function teamLogoFor(records,team) {
  const record=findKnownTeamRecord(records,{teamName:team?.name||"",players:team?.players||[]})?.record;
  return typeof record?.logoDataUrl==="string" && /^data:image\/(png|jpeg|webp);base64,/.test(record.logoDataUrl) ? record.logoDataUrl : "";
}
export function escapeTemplateText(value) {return String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));}
export function instagramTemplate({kind="highlight",home="Heim",away="Gast",homeLogo="",awayLogo="",score="",gameTime="",player="",eventType="",comment="",competition="",date="",background="#07131b"}={}) {
 const safe=escapeTemplateText;
 const logo=(src,label)=>src?`<img class="logo" src="${safe(src)}" alt="${safe(label)}">`:`<div class="logo empty" aria-label="${safe(label)}">LOGO</div>`;
 const video=kind==="highlight";
 return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
 :root{font-family:Impact,"Arial Narrow",system-ui,sans-serif;color:#fff;background:${safe(background)}}
 *{box-sizing:border-box}body{margin:0}.poster{width:1080px;height:1350px;position:relative;overflow:hidden;padding:70px 66px;background:linear-gradient(150deg,rgba(0,0,0,.05),rgba(0,0,0,.65))}
 .eyebrow{font:700 33px system-ui;letter-spacing:.2em;text-transform:uppercase;color:#e7e7e7;text-align:center}
 .header{display:grid;grid-template-columns:175px 1fr 175px;align-items:center;gap:20px;margin-top:35px}
 .logo{width:170px;height:170px;object-fit:contain}.logo.empty{border:2px dashed #ffffff70;border-radius:14px;display:grid;place-items:center;font:700 26px system-ui;color:#ffffff88}
 .teams{text-align:center;font-size:43px;font-weight:900;line-height:1.12;text-transform:uppercase;overflow-wrap:anywhere}
 .score{text-align:center;font-size:125px;font-weight:900;line-height:1.1;margin-top:28px}
 .caption{text-align:center;font:700 27px system-ui;letter-spacing:.16em;text-transform:uppercase}
 .video-area{position:absolute;left:44px;top:475px;width:992px;height:558px;border:2px dashed #ffffff88;display:grid;place-items:center;font:700 34px system-ui;background:#0005}
 .footer{position:absolute;left:66px;right:66px;bottom:75px;display:grid;gap:15px}.action{font-size:59px;font-weight:900;text-transform:uppercase;line-height:1.05}
 .meta{display:flex;justify-content:space-between;font:700 29px system-ui;gap:22px}
 .comment{font:600 27px system-ui;min-height:38px;overflow-wrap:anywhere}
 .static .score{font-size:165px;margin-top:135px}.static .footer{bottom:100px}
 </style></head><body><article class="poster ${video?"highlight":"static"}" data-template="${safe(kind)}">
 <div class="eyebrow" data-field="competition">${safe(competition||kind.toUpperCase())}</div>
 <header class="header"><div data-field="homeLogo">${logo(homeLogo,"Heimlogo")}</div><div class="teams"><div data-field="home">${safe(home)}</div><div style="font-size:34px;opacity:.7">VS</div><div data-field="away">${safe(away)}</div></div><div data-field="awayLogo">${logo(awayLogo,"Gastlogo")}</div></header>
 <div class="score" data-field="score">${safe(score||"– : –")}</div><div class="caption">${safe(video?"SPIELSTAND":kind==="matchday"?"SPIELTAG":"ENDSTAND")}</div>
 ${video?`<div class="video-area" data-field="videoArea">VIDEO · 16:9</div>`:""}
 <footer class="footer"><div class="action" data-field="eventType">${safe(video?eventType:kind==="matchday"?"MATCHDAY":"ENDSTAND")}</div>
 <div class="meta"><span data-field="playerName">${safe(player||date)}</span><span data-field="matchTime">${video?"SPIELZEIT: "+safe(gameTime):""}</span></div><div class="comment" data-field="comment">${safe(comment)}</div></footer>
 </article></body></html>`;
}
