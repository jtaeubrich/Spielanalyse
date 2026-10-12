export const INSTAGRAM_TEMPLATE_KEY="handballSpielanalyse.instagramTemplates.v1";
export const INSTAGRAM_KINDS=["matchday","endstand","highlight"];
export function readInstagramTemplates(storage){
 try{const value=JSON.parse(storage.getItem(INSTAGRAM_TEMPLATE_KEY)||"{}");return Object.fromEntries(INSTAGRAM_KINDS.filter(k=>typeof value[k]==="string").map(k=>[k,value[k]]));}catch{return {}; }
}
export function saveInstagramTemplates(storage,templates){
 storage.setItem(INSTAGRAM_TEMPLATE_KEY,JSON.stringify(Object.fromEntries(INSTAGRAM_KINDS.filter(k=>typeof templates[k]==="string").map(k=>[k,templates[k]]))));
}
export function halftimeScore(events,duration=25,halfOf){
 return (Array.isArray(events)?events:[]).filter(event=>halfOf(event,Number(duration))===1&&event?.type==="goal").reduce((scores,event)=>{if(event.team==="home")scores[0]++;else if(event.team==="away")scores[1]++;return scores;},[0,0]);
}
