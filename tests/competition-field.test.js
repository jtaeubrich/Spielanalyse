import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { hbPrepare } from "../src/handball360.js";

const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
describe("Wettbewerb im Setup und Instagram-Export",()=>{
 it("setzt Freundschaftsspiel als Standard für manuelle Spiele",()=>{
  expect(html).toContain('competition:"Freundschaftsspiel"');
  expect(html).toContain('id="setupCompetition"');
  expect(html).toContain('$("setupCompetition").onchange');
 });
 it("überträgt den Wettbewerb an Matchday, Halbzeit/Endstand und Highlights",()=>{
  expect(html).toContain('fillInstagramHtml(importedInstagramTemplates.matchday,"matchday",{...matchdayMetadata(),competition:');
  expect(html).toContain('fillInstagramHtml(importedInstagramTemplates[kind],kind,{competition:');
  expect(html).toContain('fillInstagramHtml(importedInstagramTemplates.highlight,"highlight",{competition:');
 });
 it("wertet den Wettbewerb aus Handball360-Metadaten aus",()=>{
  const imported=hbPrepare({match_id:"378110",match:{data:[{id:378110,local:{name:"TSV Kronshagen"},visitor:{name:"HSG HKN"},phase:{competition:{name:"Regionalliga Nord männliche B-Jugend"}}}]}});
  expect(imported.competition).toBe("Regionalliga Nord männliche B-Jugend");
  expect(html).toContain('state.competition=x.competition||"Freundschaftsspiel"');
  expect(html).toContain('if(chosen.competition&&imported.competition)state.competition=imported.competition;');
 });
 it("nimmt bei fehlenden Metadaten keine erfundene Spielklasse an",()=>{
  const imported=hbPrepare({match:{data:[{id:378110,local:{name:"A"},visitor:{name:"B"}}]}});
  expect(imported.competition).toBeNull();
 });
});

describe("Freiwurf als Torwurfabschluss",()=>{
 it("speichert Freiwurf und behält Ballbesitz",()=>{
  expect(html).toContain('data-result="freethrow">Freiwurf');
  expect(html).toContain('draft.result==="freethrow")delete e.endedPossessionOf');
  expect(html).toContain('draft.result==="freethrow"?draft.team:');
  expect(html).not.toContain('shotKeepsPossession');
  expect(html).not.toContain('data-retain="true"');
 });
});

describe("Matchday Metadaten",()=>{
 it("ersetzt auch Spielort, Datum und Anwurf statt Template-Beispielwerte zu behalten",()=>{
  expect(html).toContain("...matchdayMetadata(),competition:");
  expect(html).toContain("source.venue||hbVenue(meta,additional)");
  expect(html).toContain("return{matchDate,matchTime,venue}");
 });
});

describe("Matchday Importregression 378110",()=>{
 it("liest die Halle aus dem Handball360-Feldobjekt",()=>{
  const imported=hbPrepare({match_id:"378110",match:{data:[{id:378110,date:"2026-10-03T16:00:00+00:00",field:{name:"TEGELSBARG",installation:{address:"TEGELSBARG 2, 22399 HAMBURG"}},local:{name:"SG HAMBURG-NORD"},visitor:{name:"THW KIEL II"}}]}});
  expect(imported.venue).toBe("TEGELSBARG");
  expect(imported.matchDate).toBe("2026-10-03T16:00:00+00:00");
  expect(new Intl.DateTimeFormat("de-DE",{hour:"2-digit",minute:"2-digit",timeZone:"Europe/Berlin"}).format(new Date(imported.matchDate))).toBe("18:00");
 });
 it("verwendet denselben Hallenparser beim Matchday-Export und erkennt ISO-Uhrzeiten",()=>{
  expect(html).toContain("source.venue||hbVenue(meta,additional)");
  expect(html).toContain("if(/[T ]\\d{2}:\\d{2}/.test(String(rawDate)))");
  expect(html).not.toContain("if(/[T ]\\\\d{2}:\\\\d{2}/.test(String(rawDate)))");
 });
});
