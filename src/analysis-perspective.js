// Analysis-only side resolution. The recorded scouting team is never modified.
export function analysisViewSide(perspective="neutral",role="own") {
  const focus=perspective==="away"?"away":"home";
  return role==="opponent"?(focus==="home"?"away":"home"):focus;
}
export function analysisVideoRole(perspective,role,scoutingOwnTeam="away") {
  if(role==="all")return "all";
  const side=analysisViewSide(perspective,role);
  return side===scoutingOwnTeam?"own":"opponent";
}
export function analysisPerspectiveText(perspective,home,away) {
  if(perspective==="home")return "Sicht Heim · "+home;
  if(perspective==="away")return "Sicht Gast · "+away;
  return "Neutral · beide Mannschaften";
}
