import { describe, test, expect, vi } from "vitest";
import { connectClipAudio } from "../src/clip-audio.js";
import { drawClipFrame } from "../src/clip-renderer.js";

describe("clip audio and rendering", () => {
  test("connects audio once and reuses its source", async () => {
    const destination={stream:{getAudioTracks:()=>["audio"]}};
    const source={connect:vi.fn()};
    const context={createMediaElementSource:vi.fn(()=>source),createMediaStreamDestination:vi.fn(()=>destination),destination:{},resume:vi.fn().mockResolvedValue()};
    let state={};
    const stream={addTrack:vi.fn()};
    const args={video:{},stream,getState:()=>state,setState:value=>{state=value},AudioContextClass:class{constructor(){return context}}};
    expect((await connectClipAudio(args)).withAudio).toBe(true);
    expect((await connectClipAudio(args)).withAudio).toBe(true);
    expect(context.createMediaElementSource).toHaveBeenCalledTimes(1);
    expect(stream.addTrack).toHaveBeenCalledTimes(2);
  });
  test("falls back to silent video on audio failure", async () => {
    const result=await connectClipAudio({video:{},stream:{},getState:()=>({}),setState:()=>{},AudioContextClass:class{constructor(){throw Error("blocked")}}});
    expect(result.withAudio).toBe(false);
  });
  test("renders original frames and injected annotations", () => {
    const ctx={fillRect:vi.fn(),drawImage:vi.fn(),save:vi.fn(),translate:vi.fn(),restore:vi.fn()};
    const canvas={width:1280,height:720};
    const video={videoWidth:1920,videoHeight:1080};
    const annotations=vi.fn(()=>({shapes:[{x:1}]})),drawShape=vi.fn();
    drawClipFrame(ctx,canvas,video,{},"",{profile:"original",labels:false},{eventAnnotation:annotations,drawAnnotationShape:drawShape,socialFrameInfo:()=>({})});
    expect(ctx.drawImage).toHaveBeenCalledOnce();
    expect(drawShape).toHaveBeenCalledOnce();
  });
});
