import { describe, expect, test, vi } from "vitest";
import { runClipCapture } from "../src/clip-recorder.js";

function fixture() {
  const video={pause:vi.fn()};
  const track={stop:vi.fn()};
  const stream={getVideoTracks:()=>[track]};
  let finish;
  const stopped=new Promise(resolve=>{finish=resolve});
  const recorder={state:"inactive",start:vi.fn(function(){this.state="recording"}),stop:vi.fn(function(){this.state="inactive";finish()})};
  const restore=vi.fn().mockResolvedValue();
  return {video,track,stream,recorder,stopped,restore};
}

describe("clip capture cleanup",()=>{
  test("finishes recorder, video tracks and restoration on success",async()=>{
    const f=fixture();const run=vi.fn().mockResolvedValue();
    await runClipCapture({...f,run});
    expect(run).toHaveBeenCalledOnce();expect(f.recorder.stop).toHaveBeenCalledOnce();
    expect(f.track.stop).toHaveBeenCalledOnce();expect(f.restore).toHaveBeenCalledOnce();
  });
  test("cleans up on cancellation or playback error and retains rejection",async()=>{
    const f=fixture();
    await expect(runClipCapture({...f,run:()=>Promise.reject(Error("Clip-Export abgebrochen."))})).rejects.toThrow("abgebrochen");
    expect(f.video.pause).toHaveBeenCalled();expect(f.track.stop).toHaveBeenCalledOnce();expect(f.restore).toHaveBeenCalledOnce();
  });
  test("restores when recorder cannot start",async()=>{
    const f=fixture();f.recorder.start=()=>{throw Error("unsupported")};
    await expect(runClipCapture({...f,run:vi.fn()})).rejects.toThrow("unsupported");
    expect(f.recorder.stop).not.toHaveBeenCalled();expect(f.track.stop).toHaveBeenCalledOnce();expect(f.restore).toHaveBeenCalledOnce();
  });
});
