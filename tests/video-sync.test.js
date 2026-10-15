import { describe, expect, test } from "vitest";
import {
  syncPointSeconds,
  eventHalf,
  syncForHalf,
  eventVideoSeconds,
  eventVideoPosition,
  estimateReviewGameTime,
  reviewPosition,
  eventRealTimeFromVideoPosition,
  videoScoutingEventStamp,
  reconstructedGameClock,
  scoreAtVideoPosition
} from "../src/video-sync.js";

describe("video synchronization core", () => {
  test("normalizes sync points in seconds or legacy milliseconds", () => {
    expect(syncPointSeconds(12.5, "seconds")).toBe(12.5);
    expect(syncPointSeconds(12500, "ms")).toBe(12.5);
    expect(Number.isNaN(syncPointSeconds(null))).toBe(true);
  });

  test("derives event half with legacy boundary behavior", () => {
    expect(eventHalf({ time: 1499 }, 25)).toBe(1);
    expect(eventHalf({ time: 1500 }, 25)).toBe(1);
    expect(eventHalf({ time: 1500 }, 25, { boundaryToSecondHalf: true })).toBe(2);
    expect(eventHalf({ time: 10, half: 2 }, 25)).toBe(2);
  });

  test("uses kickoff as first-half sync fallback", () => {
    expect(syncForHalf({ kickoff: 3.25, syncUnit: "seconds" }, 1)).toBe(3.25);
    expect(syncForHalf({ h2SyncRealTime: 1800 }, 2)).toBe(1800);
  });

  test("video-scouting event video offset stays absolute across halves", () => {
    const event = {half:2,time:1520,realTime:1620000};
    expect(eventVideoSeconds(event,{video:{h1SyncRealTime:5,h2SyncRealTime:1600},isVideoscoutingFile:true,durationMinutes:25})).toBe(1620);
  });

  test("never derives video offset from game time for unassigned video events", () => {
    const event={type:"goal",time:740,half:1,realTime:null};
    expect(Number.isNaN(eventVideoSeconds(event,{isVideoscoutingFile:true,video:{h1SyncRealTime:5},durationMinutes:25}))).toBe(true);
  });

  test("preserves null game time for a pure video event", () => {
    const event={type:"goal",time:null,displayTime:null,half:null,realTime:754000};
    expect(eventVideoSeconds(event,{isVideoscoutingFile:true,video:{},durationMinutes:25})).toBe(754);
  });

  test("estimates official first-half video positions from H1 sync", () => {
    const e={officialSource:"handball.net",time:120,half:1,realTime:null};
    expect(eventVideoPosition(e,{isVideoscoutingFile:true,video:{h1SyncRealTime:8},durationMinutes:25}).seconds).toBe(128);
    expect(eventVideoPosition(e,{isVideoscoutingFile:true,video:{h1SyncRealTime:8}}).status).toBe("estimated");
    expect(e.realTime).toBeNull();
  });

  test("uses H2 sync separately and does not invent missing synchronization", () => {
    const e={officialSource:"handball.net",time:1515,half:2,realTime:null};
    expect(eventVideoPosition(e,{isVideoscoutingFile:true,video:{h1SyncRealTime:5,h2SyncRealTime:1800},durationMinutes:25}).seconds).toBe(1815);
    expect(eventVideoPosition(e,{isVideoscoutingFile:true,video:{h1SyncRealTime:5},durationMinutes:25}).status).toBe("unassigned");
  });

  test("manual timestamp takes priority and acts as a post-cut anchor", () => {
    const anchor={officialSource:"handball.net",time:200,half:1,realTime:96000,officialTimestamp:"2026-10-03T16:03:20Z"};
    const next={officialSource:"handball.net",time:230,half:1,realTime:null,officialTimestamp:"2026-10-03T16:03:50Z"};
    const options={isVideoscoutingFile:true,video:{h1SyncRealTime:8},events:[anchor,next],durationMinutes:25};
    expect(eventVideoPosition(anchor,options)).toEqual({seconds:96,status:"confirmed"});
    expect(eventVideoPosition(next,options)).toEqual({seconds:126,status:"estimated"});
  });

  test("an event without official time stays unassigned", () => {
    const e={time:null,half:null,realTime:null};
    expect(eventVideoPosition(e,{isVideoscoutingFile:true,video:{h1SyncRealTime:8}}).status).toBe("unassigned");
  });

  test("maps video-scouting realTime directly to video seconds", () => {
    expect(eventVideoSeconds(
      { time: 30, realTime: 12345, half: 1 },
      {
        video: {},
        isVideoscoutingFile: true,
        durationMinutes: 25
      }
    )).toBe(12.345);
  });

  test("maps live timestamps through half sync points", () => {
    const video = {
      h1SyncRealTime: 5,
      h1LiveStartMs: 100000,
      syncUnit: "seconds"
    };
    const event = {
      half: 1,
      time: 10,
      realTime: 112000
    };

    expect(eventVideoSeconds(event, {
      video,
      isVideoscoutingFile: false,
      durationMinutes: 25
    })).toBe(17);
  });

  test("maps second-half game time without realTime", () => {
    const video = {
      h1SyncRealTime: 2,
      h2SyncRealTime: 1600,
      syncUnit: "seconds"
    };
    const event = {
      half: 2,
      time: 1510
    };

    expect(eventVideoSeconds(event, {
      video,
      durationMinutes: 25
    })).toBe(1610);
  });

  test("interpolates review game time between known events", () => {
    const video = {
      h1SyncRealTime: 0,
      syncUnit: "seconds"
    };
    const events = [
      { half: 1, time: 10, realTime: 10000 },
      { half: 1, time: 30, realTime: 30000 }
    ];

    expect(estimateReviewGameTime(20, 1, {
      events,
      video,
      isVideoscoutingFile: true,
      durationMinutes: 25
    })).toBe(20);
  });

  test("selects second half near its sync marker", () => {
    const result = reviewPosition(1600, {
      events: [],
      video: {
        h1SyncRealTime: 5,
        h2SyncRealTime: 1600,
        h2LiveStartMs: 500000,
        syncUnit: "seconds"
      },
      durationMinutes: 25
    });

    expect(result).toEqual({
      half: 2,
      elapsed: 0,
      time: 1500,
      realTime: 500000
    });
  });

  test("returns null before first-half sync", () => {
    expect(reviewPosition(2, {
      video: { h1SyncRealTime: 5, syncUnit: "seconds" }
    })).toBeNull();
  });

  test("writes event realTime from current video position", () => {
    expect(eventRealTimeFromVideoPosition(
      { half: 2, time: 1600 },
      1700,
      {
        video: {
          h2SyncRealTime: 1600,
          h2LiveStartMs: 300000,
          syncUnit: "seconds"
        },
        durationMinutes: 25
      }
    )).toEqual({
      ok: true,
      half: 2,
      realTime: 400000
    });
  });

  test("reports missing sync instead of inventing a timestamp", () => {
    expect(eventRealTimeFromVideoPosition(
      { half: 2, time: 1600 },
      1700,
      { video: {}, durationMinutes: 25 }
    )).toEqual({
      ok: false,
      reason: "missing-sync",
      half: 2
    });
  });
});


describe("new video scouting event timestamps", () => {
  test("stores estimated first-half game clock and absolute video time", () => {
    expect(videoScoutingEventStamp(145, {
      video: { h1SyncRealTime: 20, syncUnit: "seconds" },
      isVideoscoutingFile: true, durationMinutes: 25
    })).toEqual({ time: 125, displayTime: "2:05", half: 1, realTime: 145000 });
  });
  test("stores second-half game clock based on H2 sync", () => {
    expect(videoScoutingEventStamp(1650, {
      video: { h1SyncRealTime: 10, h2SyncRealTime: 1600 },
      isVideoscoutingFile: true, durationMinutes: 25
    })).toEqual({ time: 1550, displayTime: "25:50", half: 2, realTime: 1650000 });
  });
  test("uses interpolated existing event time where available", () => {
    expect(videoScoutingEventStamp(180, {
      video: { h1SyncRealTime: 20 },
      events: [
        { half: 1, time: 100, realTime: 120000 },
        { half: 1, time: 160, realTime: 240000 }
      ],
      isVideoscoutingFile: true, durationMinutes: 25
    })).toEqual({ time: 130, displayTime: "2:10", half: 1, realTime: 180000 });
  });
  test("preserves video time but no estimated game time without sync", () => {
    expect(videoScoutingEventStamp(145, {
      video: {}, isVideoscoutingFile: true, durationMinutes: 25
    })).toEqual({ time: null, displayTime: null, half: null, realTime: 145000 });
  });
});

describe("video cuts and confirmed positioning anchors", () => {
  test("shifts only subsequent estimated events after setting a corrected video position", () => {
    const previous={officialSource:"handball.net",half:1,time:80,realTime:null};
    const anchor={officialSource:"handball.net",half:1,time:100,realTime:null};
    const next={officialSource:"handball.net",half:1,time:115,realTime:null};
    const later={officialSource:"handball.net",half:1,time:130,realTime:90000};
    const after={officialSource:"handball.net",half:1,time:140,realTime:null};
    const options={isVideoscoutingFile:true,video:{h1SyncRealTime:10},events:[previous,anchor,next,later,after],durationMinutes:25};
    expect(eventVideoPosition(previous,options).seconds).toBe(90);
    expect(eventVideoPosition(next,options).seconds).toBe(125);
    anchor.realTime=70000;
    expect(eventVideoPosition(previous,options).seconds).toBe(90);
    expect(eventVideoPosition(anchor,options)).toEqual({seconds:70,status:"confirmed"});
    expect(eventVideoPosition(next,options)).toEqual({seconds:85,status:"estimated"});
    expect(eventVideoPosition(later,options)).toEqual({seconds:90,status:"confirmed"});
    expect(eventVideoPosition(after,options)).toEqual({seconds:100,status:"estimated"});
    expect(next.realTime).toBeNull();
  });
  test("manual anchor works without an initial half sync", () => {
    const anchor={officialSource:"handball.net",half:2,time:1600,realTime:600000};
    const next={officialSource:"handball.net",half:2,time:1620,realTime:null};
    const options={isVideoscoutingFile:true,video:{},events:[anchor,next],durationMinutes:25};
    expect(eventVideoPosition(next,options)).toEqual({seconds:620,status:"estimated"});
  });
  test("confirmed anchor in H1 never shifts H2 estimates", () => {
    const h1={officialSource:"handball.net",half:1,time:200,realTime:80000};
    const h2={officialSource:"handball.net",half:2,time:1510,realTime:null};
    const options={isVideoscoutingFile:true,video:{h2SyncRealTime:400},events:[h1,h2],durationMinutes:25};
    expect(eventVideoPosition(h2,options)).toEqual({seconds:410,status:"estimated"});
  });
});

describe("reconstructed clock manual controls",()=>{
 test("manual pause survives later estimated events",()=>{
   const events=[{video:20,game:20},{video:60,game:500},{video:90,game:550}];
   const anchors=[{half:1,videoAt:40,gameAt:40,running:false}];
   expect(reconstructedGameClock(100,1,0,1500,events,anchors)).toMatchObject({seconds:40,running:false});
 });
 test("manual resume runs at normal speed despite later event timing",()=>{
   const events=[{video:60,game:500},{video:90,game:550}];
   const anchors=[{half:1,videoAt:40,gameAt:40,running:false},{half:1,videoAt:70,gameAt:40,running:true}];
   expect(reconstructedGameClock(80,1,0,1500,events,anchors)).toMatchObject({seconds:50,running:true});
 });
 test("estimated events never accelerate clock beyond video elapsed time",()=>{
   const events=[{video:20,game:800},{video:40,game:900}];
   expect(reconstructedGameClock(30,1,0,1500,events,[]).seconds).toBe(810);
 });
});

describe("score displayed beside reconstructed video clock",()=>{
 test("counts only goals reached at video position",()=>{
  const events=[
   {type:"goal",team:"home",time:20,half:1,realTime:25000,officialSource:"handball.net"},
   {type:"goal",team:"away",time:40,half:1,realTime:null,officialSource:"handball.net"},
   {type:"goal",team:"home",time:70,half:1,realTime:75000,officialSource:"handball.net"}
  ];
  const options={events,video:{h1SyncRealTime:5},isVideoscoutingFile:true,durationMinutes:25};
  expect(scoreAtVideoPosition(30,options)).toEqual([1,0]);
  expect(scoreAtVideoPosition(50,options)).toEqual([1,1]);
  expect(scoreAtVideoPosition(80,options)).toEqual([2,1]);
 });
 test("does not count goals from a future half",()=>{
  const events=[{type:"goal",team:"home",time:1510,half:2,realTime:null,officialSource:"handball.net"}];
  expect(scoreAtVideoPosition(100,{events,video:{h1SyncRealTime:0,h2SyncRealTime:1500},isVideoscoutingFile:true})).toEqual([0,0]);
 });
});
