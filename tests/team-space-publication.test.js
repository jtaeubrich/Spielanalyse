import {describe,it,expect} from "vitest";
import {publicGameForTeamSpace,publicSeasonForTeamSpace,
  publicGameSignature,comparePublicGames} from "../src/team-space-publication.js";

const original=()=>({
  format:"handball-match-flow",version:1,gameName:"Kronshagen gegen Gegner",
  gameDate:"2026-11-14",home:{name:"TSV Kronshagen",players:[{id:7,nr:7}]},
  away:{name:"Gegner",players:[]},
  events:[
    {id:"1",time:45,type:"goal",team:"home",pId:7,scoreH:1,scoreA:0,
      tags:["Deckung:3:2:1","Auslöser:Mensa","Meine private Notiz"],
      highlight:true,comment:"Geheimer Trainerkommentar",note:"Nur für mich",
      videoAnnotation:{shapes:[{type:"line",x:1}],comment:"Private Zeichnung"},
      realTime:50000,videoTime:123},
    {id:"2",type:"keyMoment",team:"away",time:47,note:"Privater Moment",
      playerTags:[{pId:7}]},
    {id:"3",time:90,type:"error",team:"away",scoreH:1,scoreA:0}
  ],
  gameTime:230,shotCapture:{active:true},videoFileName:"Private.mov",
  video:{youtubeId:"private",h1SyncRealTime:30000},
  theme:"dark",isHistorical:true,ownTeam:"home",timer:{duration:25,active:true,
    secondsElapsed:231,half:1},privateMetadata:"not for sharing"
});

describe("Team Space public publication boundary",()=>{
  it("publishes scouting statistics and tactical labels but no private comments, drawings, clips or key moments",()=>{
    const input=original(),before=structuredClone(input);
    const pub=publicGameForTeamSpace(input);
    expect(pub.events).toHaveLength(2);
    expect(pub.events[0]).toMatchObject({id:"1",type:"goal",scoreH:1,pId:7,
      tags:["Deckung:3:2:1","Auslöser:Mensa"]});
    expect(pub.events[1].type).toBe("error");
    expect(pub.timer).toEqual({duration:25});
    expect(pub).not.toHaveProperty("video");
    expect(pub).not.toHaveProperty("videoFileName");
    expect(pub).not.toHaveProperty("theme");
    expect(pub).not.toHaveProperty("privateMetadata");
    for(const secret of ["Geheimer Trainerkommentar","Nur für mich",
      "Private Zeichnung","Meine private Notiz","Privater Moment","Private.mov",
      "private","50000","123"]){
      expect(JSON.stringify(pub)).not.toContain(secret);
    }
    expect(input).toEqual(before);
  });

  it("prepares whole seasons as independent public copies, never destroying local annotations",()=>{
    const game=original(),archive={format:"handball-spielanalyse-season",
      version:1,name:"Kronshagen 2026/27",games:[
        {id:"sg-one",fileName:"game.json",selected:true,data:game}
      ]};
    const copy=structuredClone(archive);
    const published=publicSeasonForTeamSpace(archive);
    expect(published.games[0].data.events).toHaveLength(2);
    expect(published.games[0].fileName).toBe("game.json");
    expect(published.games[0].id).toBe("sg-one");
    expect(archive).toEqual(copy);
  });

  it("changes to local private notes, highlights, videos or key moments never create false public updates",()=>{
    const remote=original(),local=structuredClone(remote);
    local.events[0].comment="Neuer privater Text";
    local.events[0].videoAnnotation.shapes=[{type:"circle",cx:9}];
    local.events[0].tags.push("Ganz private Beobachtung");
    local.events[0].highlight=false;
    local.events[1].note="Neuer Schlüssel-Moment";
    local.videoFileName="Neu.mov";
    local.timer.secondsElapsed=9999;
    expect(comparePublicGames(local,remote)).toEqual({
      equal:true,localEvents:2,cloudEvents:2,added:0,removed:0,edited:0
    });
    expect(publicGameSignature(local)).toBe(publicGameSignature(remote));
  });

  it("detects newly captured, corrected, and deleted public events",()=>{
    const remote=original(),local=structuredClone(remote);
    local.events[0].pId=10;
    local.events.push({id:"4",type:"goal",time:320,team:"home",scoreH:2,scoreA:0});
    expect(comparePublicGames(local,remote)).toMatchObject({
      equal:false,added:1,removed:0,edited:1,
      localEvents:3,cloudEvents:2
    });
    local.events=local.events.filter(event=>event.id!=="3");
    expect(comparePublicGames(local,remote)).toMatchObject({
      equal:false,added:1,removed:1,edited:1
    });
  });

  it("does not treat the migrator's empty player IDs as a public edit",()=>{
    const remote=original(),local=structuredClone(remote);
    local.home.players[0].handballNetId="";
    local.away.players=[];
    expect(comparePublicGames(local,remote).equal).toBe(true);
  });

  it("does not classify object-key order as local edits",()=>{
    const a=original(),b=structuredClone(a);
    b.events[0]={time:b.events[0].time,...b.events[0]};
    b.home={players:b.home.players,name:b.home.name};
    expect(publicGameSignature(a)).toBe(publicGameSignature(b));
  });
});
