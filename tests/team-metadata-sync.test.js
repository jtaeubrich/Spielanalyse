import {describe,it,expect} from "vitest";
import {exportTeamCollection,parseTeamCollection,mergeTeamCollections,mapOfficialSides} from "../src/team-metadata-sync.js";

const team=(name,extra={})=>({id:"id-"+name,teamName:name,aliases:[],players:[],...extra});
describe("Mannschaftssammlung übertragen",()=>{
 it("exportiert und liest Logos sowie IDs unverändert",()=>{
   const records=[team("TSV Kronshagen",{logoDataUrl:"data:image/png;base64,AAAA",handball360ClubId:"04ea29f"})];
   const output=parseTeamCollection(exportTeamCollection(records));
   expect(output).toEqual(records);
 });
 it("lehnt fremde Formate, defekte Kader und gefährliche Bild-URLs ab",()=>{
   expect(()=>parseTeamCollection({format:"wrong",version:1,teams:[]})).toThrow();
   expect(()=>parseTeamCollection({format:"handball-spielanalyse-teams",version:1,teams:[{teamName:"X"}]})).toThrow();
   expect(()=>parseTeamCollection({format:"handball-spielanalyse-teams",version:1,teams:[team("X",{logoDataUrl:"https://evil.test/x.png"})]})).toThrow();
 });
 it("ergänzt fehlende Logos ohne existierende Logos zu überschreiben",()=>{
  const old=[team("TSV Kronshagen",{logoDataUrl:"data:image/png;base64,AAAA"})];
  const incoming=[team("TSV Kronshagen",{logoDataUrl:"data:image/png;base64,BBBB",logoUrl:"https://example.org/logo.jpg"}),team("HSG HKN")];
  const merged=mergeTeamCollections(old,incoming);
  expect(merged.records).toHaveLength(2);
  expect(merged.records[0].logoDataUrl).toBe("data:image/png;base64,AAAA");
  expect(merged.records[0].logoUrl).toBe("https://example.org/logo.jpg");
 });
 it("importiert dieselbe Sammlung wiederholt ohne Duplikate",()=>{
  const records=[team("TSV Kronshagen",{players:[{vorname:"A",nachname:"B",handballNetId:"13"}]})];
  const first=mergeTeamCollections([],records).records;
  const second=mergeTeamCollections(first,records).records;
  expect(second).toHaveLength(1);
  expect(second[0].players).toHaveLength(1);
 });
});
describe("Handball360 Altspiel-Verknüpfung",()=>{
 const official={teams:{home:"HSG HKN",away:"TSV Kronshagen"}};
 it("gleicht identische Heim-/Gastteams ab",()=>{
  expect(mapOfficialSides({home:{name:"HSG HKN"},away:{name:"TSV Kronshagen"}},official)).toEqual({home:"home",away:"away"});
 });
 it("erkennt vertauschte Seiten",()=>{
  expect(mapOfficialSides({home:{name:"TSV Kronshagen"},away:{name:"HSG HKN"}},official)).toEqual({home:"away",away:"home"});
 });
 it("bricht bei unbekannten Mannschaften ab, statt Events falsch zuzuordnen",()=>{
  expect(()=>mapOfficialSides({home:{name:"Anderer Verein"},away:{name:"TSV Kronshagen"}},official)).toThrow();
 });
 it("ändert Spielereignisse, Spieler und Video nicht",()=>{
  const state={home:{name:"HSG HKN",players:[{id:1}]},away:{name:"TSV Kronshagen",players:[]},events:[{id:5,type:"goal"}],video:{youtubeId:"x"}};
  const copy=structuredClone(state);
  mapOfficialSides(state,official);
  expect(state).toEqual(copy);
 });
});
