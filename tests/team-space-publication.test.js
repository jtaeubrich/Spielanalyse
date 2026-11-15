import {describe,it,expect} from "vitest";
import {publicGameForTeamSpace,publicSeasonForTeamSpace,
  publicGameSignature,comparePublicGames,publicationSharingSummary} from "../src/team-space-publication.js";
import {eventVideoSeconds} from "../src/video-sync.js";

const original=()=>({
  format:"handball-match-flow",version:1,gameName:"Kronshagen gegen Gegner",
  gameDate:"2026-11-14",home:{name:"TSV Kronshagen",players:[{id:7,nr:7}]},
  away:{name:"Gegner",players:[]},events:[
    {id:"1",time:45,type:"goal",team:"home",pId:7,scoreH:1,scoreA:0,
      tags:["Deckung:3:2:1","Auslöser:Mensa","Freie Bewertung"],
      highlight:true,comment:"Freie Spielbewertung",note:"Meine taktische Notiz",
      videoAnnotation:{comment:"Kommentar zur Zeichnung",
        shapes:[{tool:"arrow",points:[{x:0.1,y:0.2},{x:0.4,y:0.7}]}]},
      realTime:50000,videoTime:123},
    {id:"2",type:"keyMoment",team:"away",time:47,note:"Wichtiger Moment",
      playerTags:[{pId:7}]},
    {id:"3",time:90,type:"error",team:"away",scoreH:1,scoreA:0}
  ],
  gameTime:230,shotCapture:{active:true},videoFileName:"Privat.mov",
  isVideoscoutingFile:true,
  video:{
    youtubeId:"sLAq3M30ZBY",youtubeUrl:"https://youtu.be/sLAq3M30ZBY",
    syncUnit:"seconds",analysisTimeBasis:"youtube-absolute-ms",
    h1SyncRealTime:30,h2SyncRealTime:1505,h1LiveStartMs:25000,
    reviewClockAnchors:[{half:1,videoAt:84,gameAt:55,running:false}],
    analysisClockMs:82000,localFileName:"Privat.mov",
    localPath:"file:///private/recordings/Privat.mov",deviceSecret:"DO_NOT_SHARE"
  },
  theme:"dark",ownTeam:"home",
  timer:{duration:25,active:true,secondsElapsed:231,half:1}
});

describe("Team Space: trainer content shared by default with explicit opt-out",()=>{
  it("shares event notes, comments, drawings, highlights, tags and key moments by default",()=>{
    const input=original(),copy=structuredClone(input);
    const pub=publicGameForTeamSpace(input);
    expect(pub.events).toHaveLength(3);
    expect(pub.events[0]).toMatchObject({
      id:"1",type:"goal",scoreH:1,pId:7,
      tags:["Deckung:3:2:1","Auslöser:Mensa","Freie Bewertung"],
      comment:"Freie Spielbewertung",note:"Meine taktische Notiz",highlight:true,
      videoAnnotation:{comment:"Kommentar zur Zeichnung",
        shapes:[{tool:"arrow",points:[{x:0.1,y:0.2},{x:0.4,y:0.7}]}]}
    });
    expect(pub.events[1]).toMatchObject({id:"2",type:"keyMoment",note:"Wichtiger Moment"});
    expect(pub.events[0].realTime).toBe(50000);
    expect(pub.events[0]).not.toHaveProperty("videoTime");
    expect(pub.isVideoscoutingFile).toBe(true);
    expect(pub.video).toEqual({
      youtubeId:"sLAq3M30ZBY",
      youtubeUrl:"https://www.youtube.com/watch?v=sLAq3M30ZBY",
      syncUnit:"seconds",analysisTimeBasis:"youtube-absolute-ms",
      h1SyncRealTime:30,h2SyncRealTime:1505,h1LiveStartMs:25000,
      reviewClockAnchors:[{half:1,videoAt:84,gameAt:55,running:false}]
    });
    expect(pub).not.toHaveProperty("videoFileName");
    expect(JSON.stringify(pub)).not.toContain("Privat.mov");
    expect(JSON.stringify(pub)).not.toContain("DO_NOT_SHARE");
    expect(eventVideoSeconds(pub.events[0],{
      video:pub.video,isVideoscoutingFile:pub.isVideoscoutingFile
    })).toBe(50);
    expect(pub.timer).toEqual({duration:25});
    expect(input).toEqual(copy);
    expect(publicationSharingSummary(input)).toMatchObject({
      games:1,comments:1,drawings:1,keyMoments:1,highlights:1,excluded:0
    });
  });

  it("sends a YouTube link and live clock anchors but never local file metadata",()=>{
    const game=original();
    game.isVideoscoutingFile=false;
    game.video.analysisTimeBasis="live-elapsed-ms";
    game.video.h1LiveStartMs=25000;
    const pub=publicGameForTeamSpace(game);
    expect(pub.video.youtubeUrl).toBe("https://www.youtube.com/watch?v=sLAq3M30ZBY");
    expect(pub.video.h1LiveStartMs).toBe(25000);
    expect(pub.video.reviewClockAnchors[0].running).toBe(false);
    expect(pub.events[0].realTime).toBe(50000);
    expect(eventVideoSeconds(pub.events[0],{
      video:pub.video,isVideoscoutingFile:pub.isVideoscoutingFile
    })).toBe(55);
    expect(pub.isVideoscoutingFile).toBe(false);
    expect(pub.video).not.toHaveProperty("analysisClockMs");
    expect(pub.video).not.toHaveProperty("localFileName");
    expect(pub.video).not.toHaveProperty("localPath");
  });
  it("keeps YouTube synchronization when publishing a season and detects link-only changes",()=>{
    const local=original(),archive={name:"2026/27",games:[{
      id:"sg-match",data:local,fileName:"match.json"
    }]};
    const cloud=publicSeasonForTeamSpace(archive);
    const restored=cloud.games[0].data;
    expect(restored.video.youtubeUrl).toBe("https://www.youtube.com/watch?v=sLAq3M30ZBY");
    expect(restored.video.reviewClockAnchors).toEqual([
      {half:1,videoAt:84,gameAt:55,running:false}
    ]);
    expect(restored.events[0].realTime).toBe(50000);
    expect(comparePublicGames(local,restored).equal).toBe(true);
    const updated=structuredClone(local);
    updated.video.youtubeId="dQw4w9WgXcQ";
    updated.video.youtubeUrl="https://youtu.be/dQw4w9WgXcQ";
    const difference=comparePublicGames(updated,restored);
    expect(difference).toMatchObject({
      equal:false,localEvents:3,cloudEvents:3,added:0,removed:0,edited:0
    });
  });
  it("never exports device-only video files or invalid YouTube links",()=>{
    const local=original();
    local.video={localFileName:"local.mov",localPath:"/private/local.mov",
      playbackRate:1.5,reviewClockAnchors:[{half:1,videoAt:12,gameAt:4}]};
    let shared=publicGameForTeamSpace(local);
    expect(shared).not.toHaveProperty("video");
    expect(shared.events[0]).not.toHaveProperty("realTime");
    local.video.youtubeUrl="https://untrusted.example/watch?v=sLAq3M30ZBY";
    shared=publicGameForTeamSpace(local);
    expect(shared).not.toHaveProperty("video");
    local.video.youtubeUrl="https://www.youtube.com/watch?v=sLAq3M30ZBY";
    shared=publicGameForTeamSpace(local);
    expect(shared.video.youtubeId).toBe("sLAq3M30ZBY");
    expect(shared.video).not.toHaveProperty("localPath");
  });
  it("excludes only expressly private event content and shapes without mutating source",()=>{
    const input=original(),snapshot=structuredClone(input);
    input.events[0].teamSpacePrivate={
      note:true,comment:true,highlight:true,tags:["Freie Bewertung"]
    };
    input.events[0].videoAnnotation.shapes.push({
      tool:"circle",points:[{x:0.1,y:0.2}],teamSpacePrivate:true
    });
    input.events[1].teamSpacePrivate={moment:true};
    const expectedLocal=structuredClone(input),pub=publicGameForTeamSpace(input);
    expect(pub.events).toHaveLength(2);
    expect(pub.events[0].tags).toEqual(["Deckung:3:2:1","Auslöser:Mensa"]);
    expect(pub.events[0]).not.toHaveProperty("note");
    expect(pub.events[0]).not.toHaveProperty("comment");
    expect(pub.events[0]).not.toHaveProperty("highlight");
    expect(pub.events[0].videoAnnotation).toMatchObject({shapes:[{tool:"arrow"}]});
    expect(pub.events[0].videoAnnotation).not.toHaveProperty("comment");
    expect(JSON.stringify(pub)).not.toContain("teamSpacePrivate");
    expect(publicationSharingSummary(input)).toMatchObject({
      games:1,comments:0,drawings:1,keyMoments:0,highlights:0
    });
    expect(publicationSharingSummary(input).excluded).toBeGreaterThanOrEqual(6);
    expect(input).toEqual(expectedLocal);
    expect(input.events[1].note).toBe(snapshot.events[1].note);
  });
  it("supports independent private annotations while sharing the key moment",()=>{
    const input=original();
    input.events[1].teamSpacePrivate={note:true};
    const pub=publicGameForTeamSpace(input);
    const key=pub.events.find(event=>event.type==="keyMoment");
    expect(key).toBeDefined();
    expect(key).not.toHaveProperty("note");
    expect(key.playerTags).toEqual([{pId:7}]);
  });
  it("keeps season and record private metadata off the server",()=>{
    const game=original(),archive={format:"handball-spielanalyse-season",
      version:1,name:"Kronshagen 2026/27",comment:"Interne Saisonplanung",
      games:[{id:"sg-one",fileName:"game.json",selected:true,data:game,
        note:"Private Spielnotiz"}]
    },copy=structuredClone(archive);
    const published=publicSeasonForTeamSpace(archive);
    expect(published.games[0].data.events).toHaveLength(3);
    expect(published.games[0].id).toBe("sg-one");
    expect(JSON.stringify(published)).not.toContain("Interne Saisonplanung");
    expect(JSON.stringify(published)).not.toContain("Private Spielnotiz");
    expect(archive).toEqual(copy);
  });
  it("changes to explicitly private data and local video information do not create cloud edits",()=>{
    const remote=original(),local=structuredClone(remote);
    local.events[0].teamSpacePrivate={note:true,comment:true,highlight:true};
    remote.events[0].teamSpacePrivate={note:true,comment:true,highlight:true};
    local.events[0].note="Neuer privater Text";
    local.events[0].videoAnnotation.comment="Neuer privater Kommentar";
    local.events[0].videoAnnotation.shapes.push({tool:"circle",points:[],
      teamSpacePrivate:true});
    local.events[0].highlight=false;
    remote.events[0].highlight=false;
    local.videoFileName="Neu.mov";
    local.timer.secondsElapsed=9999;
    expect(comparePublicGames(local,remote)).toEqual({
      equal:true,localEvents:3,cloudEvents:3,added:0,removed:0,edited:0
    });
  });
  it("detects shared comment edits and public event additions and removals",()=>{
    const remote=original(),local=structuredClone(remote);
    local.events[0].videoAnnotation.comment="Korrigierte Traineranalyse";
    local.events[0].pId=10;
    local.events.push({id:"4",type:"goal",time:320,team:"home",scoreH:2,scoreA:0});
    expect(comparePublicGames(local,remote)).toMatchObject({
      equal:false,added:1,removed:0,edited:1,localEvents:4,cloudEvents:3
    });
    local.events=local.events.filter(event=>event.id!=="3");
    expect(comparePublicGames(local,remote)).toMatchObject({
      equal:false,added:1,removed:1,edited:1
    });
  });
  it("normalizes object order and empty migrated IDs",()=>{
    const remote=original(),local=structuredClone(remote);
    local.home.players[0].handballNetId="";
    local.home={players:local.home.players,name:local.home.name};
    local.events[0]={time:local.events[0].time,...local.events[0]};
    expect(publicGameSignature(local)).toBe(publicGameSignature(remote));
  });
});
