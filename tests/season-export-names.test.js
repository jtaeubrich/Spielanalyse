import {describe,it,expect} from "vitest";
import {seasonExportStem,seasonExportFileName} from "../src/season-export-names.js";

describe("short, stable season download filenames",()=>{
  const games=[{ownTeam:"home",state:{
    home:{name:"TSV Kronshagen"},away:{name:"VfL Bad Schwartau II"},gameDate:"2026-09-05"
  }}];
  it("uses team identity and season years, not editable display name",()=>{
    const a={preferredTeam:"TSV Kronshagen",seasonName:"TSV Kronshagen · Saison 2026/27",games};
    const b={...a,seasonName:"Crowntown 2026/27"};
    expect(seasonExportFileName(a)).toBe("TSV_Kronshagen_2026-27.json");
    expect(seasonExportFileName(b)).toBe(seasonExportFileName(a));
    expect(seasonExportFileName(b,"zip")).toBe("TSV_Kronshagen_2026-27_archiv.zip");
  });
  it("keeps different teams separate and supports title-only imported seasons",()=>{
    expect(seasonExportStem({preferredTeam:"HC Bremen I",seasonName:"Saison 2026/27"}))
      .toBe("HC_Bremen_I_2026-27");
    expect(seasonExportFileName({seasonName:"TSV Kronshagen · Saison 2026/27"}))
      .toBe("TSV_Kronshagen_2026-27.json");
    expect(seasonExportFileName({seasonName:"Saison 2026/27",games}))
      .toBe("TSV_Kronshagen_2026-27.json");
    expect(seasonExportFileName({seasonName:"Saison 2026/27"}))
      .toBe("Saison_2026-27.json");
  });
  it("derives seasons from actual matches where the title has no year",()=>{
    expect(seasonExportFileName({seasonName:"Training",preferredTeam:"TSV Kronshagen",games}))
      .toBe("TSV_Kronshagen_2026-27.json");
    expect(seasonExportFileName({seasonName:"Training",preferredTeam:"TSV Kronshagen",games:[{
      state:{gameDate:"2027-05-01"}
    }]})).toBe("TSV_Kronshagen_2026-27.json");
    expect(seasonExportFileName({seasonName:"Test",preferredTeam:"HC Bremen"}))
      .toBe("HC_Bremen_Saison.json");
  });
  it("sanitizes illegal filename characters without affecting the stored title",()=>{
    const name="HSG Mölln / Büchen";
    expect(seasonExportFileName({seasonName:"Saison 2026/27",preferredTeam:name}))
      .toBe("HSG_Moelln_Buechen_2026-27.json");
    expect(name).toBe("HSG Mölln / Büchen");
  });
});
