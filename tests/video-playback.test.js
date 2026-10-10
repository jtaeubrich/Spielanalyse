import { describe, test, expect, vi } from 'vitest';
import { createScenePlayback, localVideoAdapter, youtubeAdapter } from '../src/video-playback.js';

function fixture() {
  let position = 80;
  const pending = [];
  const media = { identity: {}, duration: () => 100, seconds: () => position,
    pause: vi.fn(), play: vi.fn().mockResolvedValue(),
    seek: vi.fn((at) => new Promise(resolve => pending.push(() => { position = at; resolve(); }))) };
  const onError = vi.fn();
  const controller = createScenePlayback({ getMedia: () => media, onError });
  return { media, pending, controller, onError, setPosition: value => { position = value; } };
}

describe('shared scene playback', () => {
  test('waits for seeking before playing or checking the scene end', async () => {
    const f = fixture();
    const result = f.controller.playAt(10);
    f.controller.tick();
    expect(f.media.play).not.toHaveBeenCalled();
    expect(f.media.pause).toHaveBeenCalledTimes(1);
    f.pending.shift()();
    expect(await result).toMatchObject({ start: 6, end: 12 });
    f.setPosition(12);
    f.controller.tick();
    f.controller.tick();
    expect(f.media.pause).toHaveBeenCalledTimes(2);
  });

  test('a rapidly selected second event supersedes pending playback', async () => {
    const f = fixture();
    const first = f.controller.playAt(10);
    const second = f.controller.playAt(30);
    f.pending.shift()();
    expect(await first).toBeNull();
    expect(f.media.play).not.toHaveBeenCalled();
    f.pending.shift()();
    expect(await second).toMatchObject({ start: 26, end: 32 });
    expect(f.media.play).toHaveBeenCalledTimes(1);
  });

  test('manual seek or source change cancels a pending scene', async () => {
    const f = fixture();
    const result = f.controller.playAt(10);
    f.controller.cancel();
    f.pending.shift()();
    expect(await result).toBeNull();
    expect(f.media.play).not.toHaveBeenCalled();
  });

  test('reports playback rejection and clears the scene stop', async () => {
    const f = fixture();
    const error = new Error('play blocked');
    f.media.play.mockRejectedValueOnce(error);
    const result = f.controller.playAt(10);
    f.pending.shift()();
    expect(await result).toBeNull();
    expect(f.onError).toHaveBeenCalledWith(error);
    f.setPosition(90);
    f.controller.tick();
    expect(f.media.pause).toHaveBeenCalledTimes(1);
  });

  test('rejects missing sync times and clamps to source duration', async () => {
    const f = fixture();
    expect(await f.controller.playAt(NaN)).toBeNull();
    expect(f.media.seek).not.toHaveBeenCalled();
    const result = f.controller.playAt(99, { preRoll: 4, postRoll: 5 });
    f.pending.shift()();
    expect(await result).toMatchObject({ start: 95, end: 100 });
  });

  test('local adapter waits for seeked', async () => {
    const video = Object.assign(new EventTarget(), { currentTime: 0, seeking: false, duration: 100, pause: vi.fn(), play: vi.fn() });
    const promise = localVideoAdapter(video).seek(12);
    expect(video.currentTime).toBe(12);
    video.dispatchEvent(new Event('seeked'));
    await promise;
  });

  test('YouTube adapter waits for its position and stops polling on cancellation', async () => {
    vi.useFakeTimers();
    try {
      let position = 0, current = true;
      const player = { seekTo: vi.fn(), getCurrentTime: () => position, getDuration: () => 100, pauseVideo: vi.fn(), playVideo: vi.fn() };
      const adapter = youtubeAdapter(player);
      const seek = adapter.seek(12, () => current);
      position = 12;
      await vi.advanceTimersByTimeAsync(100);
      await seek;
      expect(player.seekTo).toHaveBeenCalledWith(12, true);
      const cancelled = adapter.seek(40, () => current);
      current = false;
      await vi.advanceTimersByTimeAsync(100);
      await cancelled;
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });
});