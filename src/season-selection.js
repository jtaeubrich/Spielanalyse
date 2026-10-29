// Choosing a view does not load a fixture into the active scouting session.
// Explicitly edited games win; old season files fall back to completed matches.
export function selectSeasonPreviewGame(games=[],lastEditedId="",today=new Date().toISOString().slice(0,10)){
  const list=Array.isArray(games)?games.filter(game=>game?.id&&game?.state):[];
  if(lastEditedId){
    const edited=list.find(game=>game.id===lastEditedId);
    if(edited)return edited;
  }
  const completed=list.filter(game=>{
    const date=String(game.state?.officialSource?.matchDate||game.state?.gameDate||"").slice(0,10);
    return /^\d{4}-\d{2}-\d{2}$/.test(date)&&date<=today&&
      (game.state?.events?.length||0)>0;
  });
  return completed.sort((a,b)=>String(b.state?.officialSource?.matchDate||b.state?.gameDate||"")
    .localeCompare(String(a.state?.officialSource?.matchDate||a.state?.gameDate||"")))[0]||null;
}
