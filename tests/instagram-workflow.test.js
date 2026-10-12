import { describe, expect, test } from "vitest";
import { readInstagramTemplates, saveInstagramTemplates, halftimeScore } from "../src/instagram-workflow.js";

describe("Instagram workflow",()=>{
 test("persists all three template types independently",()=>{
  const memory=new Map();const storage={getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,value)};
  saveInstagramTemplates(storage,{matchday:"<html>match</html>",endstand:"<html>result</html>",highlight:"<html>video</html>",other:"bad"});
  expect(readInstagramTemplates(storage)).toEqual({matchday:"<html>match</html>",endstand:"<html>result</html>",highlight:"<html>video</html>"});
 });
 test("handles empty and corrupt storage",()=>{expect(readInstagramTemplates({getItem:()=>"{oops"})).toEqual({});});
 test("counts only first-half goals",()=>{
  const events=[{type:"goal",team:"home",half:1},{type:"goal",team:"away",half:1},{type:"goal",team:"home",half:2},{type:"miss",team:"home",half:1}];
  expect(halftimeScore(events,25,event=>event.half)).toEqual([1,1]);
 });
});
