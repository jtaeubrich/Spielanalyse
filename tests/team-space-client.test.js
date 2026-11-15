import {describe,it,expect,vi} from "vitest";
import {createHash} from "node:crypto";
import {parseTeamSpaceInvite,makeTeamSpaceInvite,createTeamSpace,teamSpaceCatalog,
  chronologicalTeamSpaceGames,downloadTeamSpaceGame,publishTeamSpaceGame,claimTeamSpaceTrainerToken,
  verifyTeamSpaceTrainerToken,rotateTeamSpaceTrainerToken} from "../src/team-space-client.js";
const API="https://handball-season-sync-235703972531.europe-west1.run.app";
const SPACE="88735513-5e3e-4a95-aa70-6a1a2fe94bf9";
const TOKEN="reader_"+("q".repeat(40));
const ADMIN="trainer_"+("t".repeat(44));
const PERSONAL="trainer_"+("p".repeat(44));
const conn={api:API,spaceId:SPACE,readToken:TOKEN,role:"reader"};
describe("Team Space invitations",()=>{
  it("carries reader only in a removable hash, never a query or a trainer token",()=>{
    const url=new URL(makeTeamSpaceInvite("https://jtaeubrich.github.io/Spielanalyse/",conn));
    expect(url.search).toBe("");
    expect(url.hash).toContain("teamspace=");
    expect(url.href).not.toContain(ADMIN);
    expect(parseTeamSpaceInvite(url.hash)).toEqual(conn);
    expect(parseTeamSpaceInvite("#saison=legacy")).toBeNull();
  });
  it("rejects missing token, invalid team IDs and untrusted cloud origins",()=>{
    expect(()=>parseTeamSpaceInvite("#teamspace=broken&key=bad&api="+encodeURIComponent(API))).toThrow();
    expect(()=>parseTeamSpaceInvite("#teamspace="+SPACE+"&key="+TOKEN+
      "&api=https://untrusted.example")).toThrow();
  });
});
describe("Team Space API client",()=>{
  it("creates workspace with registration header and returns a separate trainer token",async()=>{
    const fetcher=vi.fn(async(url,opts)=>new Response(JSON.stringify({
      spaceId:SPACE,readToken:TOKEN,trainerToken:PERSONAL,name:"TSV Kronshagen",revision:0
    }),{status:201,headers:{"Content-Type":"application/json"}}));
    const created=await createTeamSpace(API,"TSV Kronshagen",ADMIN,{fetcher});
    expect(created.role).toBe("trainer");
    expect(created.trainerToken).toBe(PERSONAL);
    expect(created.trainerToken).not.toBe(ADMIN);
    expect(JSON.parse(fetcher.mock.calls[0][1].body).authVersion).toBe(2);
    expect(fetcher.mock.calls[0][0]).toBe(API+"/spaces/v2");
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe("Bearer "+ADMIN);
    expect(fetcher.mock.calls[0][0]).not.toContain(ADMIN);
  });
  it("rejects any new Team Space response that lacks its trainer credential",async()=>{
    const fetcher=vi.fn(async()=>new Response(JSON.stringify({
      spaceId:SPACE,readToken:TOKEN,name:"TSV",revision:0
    }),{status:201}));
    await expect(createTeamSpace(API,"TSV",ADMIN,{fetcher})).rejects.toThrow();
  });
  it("refuses registration on outdated Cloud Run deployments",async()=>{
    const fetcher=vi.fn(async()=>new Response(JSON.stringify({
      error:{code:"NOT_FOUND",message:"Endpoint not found"}
    }),{status:404}));
    await expect(createTeamSpace(API,"TSV",ADMIN,{fetcher}))
      .rejects.toThrow("zuerst das Backend aktualisieren");
  });
  it("validates version catalog and authenticates read requests",async()=>{
    const fetcher=vi.fn(async()=>new Response(JSON.stringify({
      spaceId:SPACE,name:"TSV Kronshagen",revision:2,updatedAt:"2026-11-13",
      seasons:[{id:SPACE,revision:2,gameIds:["sg-1"],gameCount:1}],
      games:[{id:"sg-1",revision:3,sha256:"0".repeat(64)}]
    })));
    const catalog=await teamSpaceCatalog(conn,{fetcher});
    expect(catalog.seasons).toHaveLength(1);
    expect(catalog.games[0].revision).toBe(3);
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe("Bearer "+TOKEN);
  });
  it("downloads and checks SHA-256 of one published game",async()=>{
    const data={format:"handball-spielanalyse",version:1,
      home:{name:"TSV"},away:{name:"Gast"},events:[]};
    const raw=JSON.stringify(data);
    const sha=createHash("sha256").update(raw).digest("hex");
    const fetcher=vi.fn(async()=>new Response(raw,{headers:{
      "x-content-sha256":sha,"x-item-revision":"4"
    }}));
    const result=await downloadTeamSpaceGame(conn,"sg-1",{fetcher});
    expect(result.revision).toBe(4);expect(result.data).toEqual(data);
    expect(result.sha256).toBe(sha);
    const broken=vi.fn(async()=>new Response(raw,{headers:{
      "x-content-sha256":"0".repeat(64),"x-item-revision":"4"
    }}));
    await expect(downloadTeamSpaceGame(conn,"sg-1",{fetcher:broken}))
      .rejects.toThrow("beschädigt");
  });
  it("uses trainer key for publishing and sends expected catalog revision",async()=>{
    const fetcher=vi.fn(async()=>new Response(JSON.stringify({
      spaceId:SPACE,gameId:"sg-1",revision:4,itemRevision:1
    })));
    await publishTeamSpaceGame(conn,{gameName:"Test"},PERSONAL,3,{
      gameId:"sg-1",seasonId:SPACE,fileName:"test.json"
    },{fetcher});
    const [url,opts]=fetcher.mock.calls[0];
    expect(url).toBe(API+"/spaces/"+SPACE+"/publish-game");
    expect(opts.headers.Authorization).toBe("Bearer "+PERSONAL);
    expect(JSON.parse(opts.body).expectedRevision).toBe(3);
  });
  it("claims legacy spaces with registration key and verifies separate trainer access",async()=>{
    const calls=[];
    const fetcher=vi.fn(async(url,opts)=>{
      calls.push({url,authorization:opts.headers.Authorization});
      return new Response(JSON.stringify(url.endsWith("/claim-trainer")
        ?{spaceId:SPACE,trainerToken:PERSONAL}
        :{spaceId:SPACE,trainerAccess:"individual"}));
    });
    const acquired=await claimTeamSpaceTrainerToken(conn,ADMIN,{fetcher});
    expect(acquired).toBe(PERSONAL);
    const checked=await verifyTeamSpaceTrainerToken(conn,PERSONAL,{fetcher});
    expect(checked.trainerAccess).toBe("individual");
    expect(calls).toEqual([
      {url:API+"/spaces/"+SPACE+"/claim-trainer",authorization:"Bearer "+ADMIN},
      {url:API+"/spaces/"+SPACE+"/verify-trainer",authorization:"Bearer "+PERSONAL}
    ]);
    expect(calls.every(item=>!item.url.includes(PERSONAL)&&!item.url.includes(ADMIN))).toBe(true);
  });
  it("rotates a single trainer credential without putting it in URLs",async()=>{
    const next="trainer_"+("n".repeat(43));
    const fetcher=vi.fn(async()=>new Response(JSON.stringify({
      spaceId:SPACE,trainerToken:next
    })));
    const updated=await rotateTeamSpaceTrainerToken(conn,PERSONAL,{fetcher});
    expect(updated).toBe(next);
    const [url,opts]=fetcher.mock.calls[0];
    expect(url).toBe(API+"/spaces/"+SPACE+"/rotate-trainer");
    expect(opts.headers.Authorization).toBe("Bearer "+PERSONAL);
  });


  it("reads an account Team Space without a player invite on a second device",async()=>{
    const connection={api:API,spaceId:SPACE,name:"TSV Kronshagen",role:"account"};
    const data={gameName:"Fernzugriff",home:{},away:{},events:[]};
    const raw=JSON.stringify(data);
    const digest=createHash("sha256").update(raw).digest("hex");
    const calls=[];
    const accountClient={fetchTeamSpaceResource:vi.fn(async(id,suffix)=>{
      calls.push([id,suffix]);
      if(suffix==="/catalog")return new Response(JSON.stringify({
        spaceId:SPACE,name:"TSV Kronshagen",revision:3,
        seasons:[],games:[{id:"sg-1",revision:1,sha256:digest}]
      }));
      if(suffix==="/games/sg-1/download")
        return new Response(raw,{headers:{"x-item-revision":"1","x-content-sha256":digest}});
      throw Error("Unexpected "+suffix);
    })};
    const cat=await teamSpaceCatalog(connection,{accountClient});
    expect(cat.games).toHaveLength(1);
    const downloaded=await downloadTeamSpaceGame(connection,"sg-1",{accountClient});
    expect(downloaded.data).toEqual(data);
    expect(downloaded.sha256).toBe(digest);
    expect(calls).toEqual([[SPACE,"/catalog"],[SPACE,"/games/sg-1/download"]]);
  });

});

describe("Team Space game order",()=>{
  it("shows oldest games first without changing the cloud catalog",()=>{
    const newest={id:"sg-march",date:"2027-03-20",name:"März"};
    const oldest={id:"sg-september",date:"2026-09-12",name:"September"};
    const middle={id:"sg-january",date:"2027-01-23",name:"Januar"};
    const undated={id:"sg-no-date",date:"",name:"Noch ohne Datum"};
    const source=[newest,undated,middle,oldest];
    expect(chronologicalTeamSpaceGames(source).map(game=>game.id)).toEqual([
      "sg-september","sg-january","sg-march","sg-no-date"
    ]);
    expect(source.map(game=>game.id)).toEqual([
      "sg-march","sg-no-date","sg-january","sg-september"
    ]);
  });
  it("preserves the input order for games on the same date",()=>{
    const items=[
      {id:"sg-first",date:"2026-11-15"},
      {id:"sg-second",date:"2026-11-15"},
      {id:"sg-prior",date:"2026-11-14"}
    ];
    expect(chronologicalTeamSpaceGames(items).map(g=>g.id)).toEqual([
      "sg-prior","sg-first","sg-second"
    ]);
  });
});
