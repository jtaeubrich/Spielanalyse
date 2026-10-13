import {describe,it,expect,vi} from "vitest";
import {drawClipFrame} from "../src/clip-renderer.js";

describe("Video comments remain metadata, not an overlay",()=>{
 it("does not render comment text or a comment box, while still drawing annotations",()=>{
  const ctx={fillRect:vi.fn(),drawImage:vi.fn(),save:vi.fn(),translate:vi.fn(),restore:vi.fn(),fillText:vi.fn()};
  const canvas={width:1080,height:608};
  const video={videoWidth:1920,videoHeight:1080};
  const annotation={comment:"Aus dem Nichts 👨‍🍳",shapes:[{tool:"pen",points:[{x:0.1,y:0.1}]}]};
  const shape=vi.fn();
  drawClipFrame(ctx,canvas,video,{id:1},"",{profile:"original",labels:false},{eventAnnotation:()=>annotation,drawAnnotationShape:shape,socialFrameInfo:()=>({})});
  expect(ctx.fillText).not.toHaveBeenCalled();
  expect(shape).toHaveBeenCalledTimes(1);
 });
 it("does not burn comments into labeled social exports",()=>{
  const ctx={fillRect:vi.fn(),drawImage:vi.fn(),save:vi.fn(),translate:vi.fn(),restore:vi.fn(),fillText:vi.fn(),measureText:vi.fn(()=>({width:100}))};
  drawClipFrame(ctx,{width:1080,height:1350},{videoWidth:1920,videoHeight:1080},{id:2},"",{profile:"feed",labels:true},{eventAnnotation:()=>({comment:"Nicht ins Bild!",shapes:[]}),drawAnnotationShape:vi.fn(),socialFrameInfo:()=>({team:"Kronshagen",match:"Spiel",action:"Tor",player:"Spieler",time:"12:34"})});
  expect(ctx.fillText.mock.calls.some(args=>String(args[0]).includes("Nicht ins Bild"))).toBe(false);
  expect(ctx.fillText).toHaveBeenCalled();
 });
});
