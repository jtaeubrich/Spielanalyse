import {describe,test,expect} from "vitest";
import {instagramTemplate,teamLogoFor,INSTAGRAM_SIZE} from "../src/instagram-template.js";

describe("Instagram HTML templates",()=>{
 test("exposes required metadata slots and 4:5 dimensions",()=>{
  const html=instagramTemplate({kind:"highlight",home:"Kronshagen",away:"Gast",score:"18 : 16",gameTime:"42:13",player:"Jespe",eventType:"Tor",comment:"Schön gespielt"});
  expect(INSTAGRAM_SIZE).toEqual({width:1080,height:1350});
  for(const slot of ["homeLogo","awayLogo","score","matchTime","playerName","eventType","comment","videoArea"])expect(html).toContain('data-field="'+slot+'"');
  expect(html).toContain("SPIELZEIT: 42:13");
  expect(html).toContain("Schön gespielt");
 });
 test("matchday and endstand omit video placeholder",()=>{
  for(const kind of ["matchday","endstand"])expect(instagramTemplate({kind})).not.toContain('data-field="videoArea"');
 });
 test("escapes values rather than injecting markup",()=>{
  expect(instagramTemplate({player:'<script>alert("x")</script>'})).not.toContain('<script>');
 });
 test("logo resolves from matching known team, never an unrelated team",()=>{
  const data="data:image/png;base64,AA==";
  const list=[{teamName:"TSV Kronshagen",aliases:["Kronshagen"],logoDataUrl:data,players:[]}];
  expect(teamLogoFor(list,{name:"Kronshagen"})).toBe(data);
  expect(teamLogoFor(list,{name:"Unbekannt"})).toBe("");
 });
});
