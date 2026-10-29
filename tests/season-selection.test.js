import {describe,it,expect} from "vitest";
import {selectSeasonPreviewGame} from "../src/season-selection.js";

const game=(id,date,count=0)=>({id,state:{gameDate:date,events:Array.from({length:count},()=>({type:"goal"}))}});
describe("season preview selection",()=>{
  const games=[game("first","2026-09-01",12),game("recent","2026-10-01",30),game("future","2026-11-10")];
  it("prefers explicitly edited game over fixture order",()=>{
    expect(selectSeasonPreviewGame(games,"first","2026-10-29")?.id).toBe("first");
  });
  it("defaults to the most recent recorded past fixture, never an unplayed future fixture",()=>{
    expect(selectSeasonPreviewGame(games,"missing","2026-10-29")?.id).toBe("recent");
    expect(selectSeasonPreviewGame(games,"","2026-10-29")?.id).toBe("recent");
  });
  it("leaves an empty viewer if no completed recording is available",()=>{
    expect(selectSeasonPreviewGame([game("future","2026-11-10"),game("past","2026-09-01")],"","2026-10-29")).toBeNull();
    expect(selectSeasonPreviewGame([],"","2026-10-29")).toBeNull();
  });
  it("ignores obsolete last-edited IDs after a fixture has been deleted",()=>{
    expect(selectSeasonPreviewGame([game("new","2026-10-07",4)],"deleted","2026-10-29")?.id).toBe("new");
  });
});
