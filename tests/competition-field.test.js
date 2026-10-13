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
  expect(html).toContain("const venue=[source.venue");
  expect(html).toContain("return{matchDate,matchTime,venue}");
 });
});
