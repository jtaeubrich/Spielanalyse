import {describe,it,expect,vi} from "vitest";
import {
  seasonCloudEndpoint,makeSeasonInvite,parseSeasonInvite,
  createCloudSeason,latestCloudSeason,publishCloudSeason,rotateCloudReadKey,
  validSeasonCloudId,validSeasonCloudToken
} from "../src/season-sync-client.js";
const id="88735513-5e3e-4a95-aa70-6a1a2fe94bf9";
const api="https://handball-season-sync-235703972531.europe-west1.run.app";
const key="reader_"+("q".repeat(40));
const admin="admin_"+("T".repeat(40));
describe("season invitation",()=>{
  it("roundtrips an invite in a URL fragment without game file metadata",()=>{
    const href=makeSeasonInvite("https://jtaeubrich.github.io/Spielanalyse/",{
      seasonId:id,api,readToken:key});
    const url=new URL(href);
    expect(url.search).toBe("");
    expect(url.hash).toContain("saison=");
    expect(parseSeasonInvite(url.hash)).toEqual({seasonId:id,api,readToken:key,
      role:"reader",revision:0});
    expect(parseSeasonInvite("#unrelated=true")).toBe(null);
  });
  it("rejects arbitrary and insecure API hosts, invalid season and keys",()=>{
    for(const invalid of ["http://handball-season-sync-123.run.app",
      "https://evil.example","https://handball360-proxy-123.run.app",
      "https://handball-season-sync-123.run.app/private",
      "https://handball-season-sync-123.run.app?token=secret"])
      expect(()=>seasonCloudEndpoint(invalid)).toThrow();
    expect(validSeasonCloudId(id)).toBe(true);
    expect(validSeasonCloudToken(key)).toBe(true);
    expect(()=>makeSeasonInvite("https://jtaeubrich.github.io/",{
      seasonId:"broken",api,readToken:key})).toThrow();
  });
});
describe("season-sync requests",()=>{
  it("requests are authenticated only by headers and trainer key never enters URL",async()=>{
    const fetcher=vi.fn(async(url,options)=>new Response(JSON.stringify({
      seasonId:id,readToken:key,revision:0}),{status:201,
      headers:{"Content-Type":"application/json"}}));
    const created=await createCloudSeason(api,admin,{fetcher});
    expect(created.role).toBe("trainer");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe(api+"/seasons");
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe("Bearer "+admin);
    expect(JSON.stringify(fetcher.mock.calls[0][0])).not.toContain(admin);
  });
  it("loads metadata, publishes with optimistic revision and rotates reader",async()=>{
    const fetcher=vi.fn(async(url,options)=>{
      if(url.endsWith("/latest"))return new Response(JSON.stringify({seasonId:id,revision:3}));
      if(url.endsWith("/publish"))return new Response(JSON.stringify({seasonId:id,revision:4}));
      return new Response(JSON.stringify({seasonId:id,readToken:key,revision:4}));
    });
    const config={api,seasonId:id,readToken:key};
    expect((await latestCloudSeason(config,{fetcher})).revision).toBe(3);
    await publishCloudSeason(config,{format:"handball-spielanalyse-season"},admin,3,{fetcher});
    const call=fetcher.mock.calls[1][1];
    expect(JSON.parse(call.body).expectedRevision).toBe(3);
    expect(call.headers.Authorization).toBe("Bearer "+admin);
    const rotated=await rotateCloudReadKey(config,admin,{fetcher});
    expect(rotated.readToken).toBe(key);
  });
});
