import {describe,it,expect} from "vitest";
import {analysisViewSide,analysisVideoRole,analysisPerspectiveText} from "../src/analysis-perspective.js";

describe("analysis-only home and away perspective mapping",()=>{
  it("maps offensive and defensive roles to the requested team",()=>{
    expect(analysisViewSide("neutral")).toBe("home");
    expect(analysisViewSide("neutral","opponent")).toBe("away");
    expect(analysisViewSide("home")).toBe("home");
    expect(analysisViewSide("home","opponent")).toBe("away");
    expect(analysisViewSide("away")).toBe("away");
    expect(analysisViewSide("away","opponent")).toBe("home");
  });
  it("routes map drilldowns to the real scouting team without changing it",()=>{
    expect(analysisVideoRole("neutral","own","away")).toBe("opponent");
    expect(analysisVideoRole("neutral","opponent","away")).toBe("own");
    expect(analysisVideoRole("home","own","home")).toBe("own");
    expect(analysisVideoRole("away","own","home")).toBe("opponent");
    expect(analysisVideoRole("away","opponent","home")).toBe("own");
    expect(analysisVideoRole("neutral","all","away")).toBe("all");
  });
  it("provides explicit labels with team names",()=>{
    expect(analysisPerspectiveText("home","TSV Kronshagen","SG Flensburg")).toBe("Sicht Heim · TSV Kronshagen");
    expect(analysisPerspectiveText("away","TSV Kronshagen","SG Flensburg")).toBe("Sicht Gast · SG Flensburg");
    expect(analysisPerspectiveText("neutral","TSV Kronshagen","SG Flensburg")).toContain("Neutral");
  });
});
