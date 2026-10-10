export function scoreEvents(events = []) {
  let home = 0;
  let away = 0;

  for (const event of Array.isArray(events) ? events : []) {
    if (event?.type !== "goal") continue;
    if (event.team === "home") home += 1;
    else if (event.team === "away") away += 1;
  }

  return [home, away];
}
