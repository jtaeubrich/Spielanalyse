import {describe,expect,test} from "vitest";
import {crc32,makeInstagramZip,chronologicalHighlights,instagramMp4Type} from "../src/instagram-export.js";
describe("Instagram ZIP export",()=>{
  test("ZIP uses valid signatures and stores PNG and MP4",async()=>{
    const zip=await makeInstagramZip([{name:"01_matchday.png",blob:new Blob(["png"])},{name:"03_highlight.mp4",blob:new Blob(["mp4"])}]);
    const bytes=new Uint8Array(await zip.arrayBuffer());
    expect(Array.from(bytes.slice(0,4))).toEqual([0x50,0x4b,0x03,0x04]);
    expect(Array.from(bytes.slice(-22,-18))).toEqual([0x50,0x4b,0x05,0x06]);
    expect(zip.type).toBe("application/zip");
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });
  test("only manually marked highlights, sorted by event time",()=>{
    const list=[{index:3,event:{highlight:true,time:300}},{index:1,event:{highlight:false,time:10}},{index:2,event:{highlight:true,time:100}},{index:4,event:{highlight:true,time:300}}];
    expect(chronologicalHighlights(list).map(x=>x.index)).toEqual([2,3,4]);
  });
  test("MP4 must be supported, no WebM fallback",()=>{
    expect(instagramMp4Type(type=>type==="video/mp4")).toBe("video/mp4");
    expect(()=>instagramMp4Type(type=>type==="video/webm")).toThrow(/kein MP4/);
  });
});