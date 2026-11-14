import {describe,it,expect,vi} from "vitest";
import {createTrainerAuthClient} from "../src/trainer-auth-client.js";
const API="https://handball-season-sync-235703972531.europe-west1.run.app";
const SPACE="88735513-5e3e-4a95-aa70-6a1a2fe94bf9";
const jwt="eyJhbGciOiJSUzI1NiJ9."+"A".repeat(300)+"."+"B".repeat(100);
const firebase={enabled:true,projectId:"spielanalyse-companion",
  apiKey:"AIzaSyTestApiKeyForMockOnly"};
function memoryStorage(){
  const values=new Map();
  return {getItem:k=>values.get(k)||null,
    setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k),
    entries:()=>[...values.entries()]};
}
describe("Firebase trainer browser client",()=>{
  it("reports disabled backend without attempting sign-up",async()=>{
    const session=memoryStorage(),fetcher=vi.fn(async()=>new Response(
      JSON.stringify({enabled:false}),{status:200}));
    const client=createTrainerAuthClient(API,{session,fetcher});
    expect((await client.getConfig()).enabled).toBe(false);
    await expect(client.login("a@example.org","secret")).rejects.toThrow("noch nicht konfiguriert");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("signs in and sends verified ID token in headers but never in URLs or saved exports",async()=>{
    const session=memoryStorage(),calls=[];
    const fetcher=vi.fn(async(url,options={})=>{
      calls.push({url,options});
      if(url.endsWith("/trainer-auth/config"))return new Response(JSON.stringify(firebase));
      if(url.includes("signInWithPassword"))return new Response(JSON.stringify({
        idToken:jwt,refreshToken:"fresh-session-token",expiresIn:"3600"
      }));
      if(url.endsWith("/trainer-auth/me"))return new Response(JSON.stringify({
        uid:"trainer-1",email:"trainer@example.org",status:"approved",isAdmin:false
      }));
      if(url.endsWith("/trainer-auth/spaces"))return new Response(JSON.stringify({spaces:[]}));
      throw Error("Unexpected fetch: "+url);
    });
    const client=createTrainerAuthClient(API,{fetcher,session});
    await client.login("trainer@example.org","very-secret-password");
    const profile=await client.me();
    expect(profile.status).toBe("approved");
    const list=await client.listSpaces();
    expect(list.spaces).toEqual([]);
    expect(calls.filter(c=>c.url.includes("trainer-auth/me"))[0]
      .options.headers.Authorization).toBe("Bearer "+jwt);
    expect(calls.every(c=>!c.url.includes(jwt)&&!c.url.includes("very-secret-password"))).toBe(true);
    expect(JSON.stringify(session.entries())).not.toContain("very-secret-password");
    expect(JSON.stringify(session.entries())).not.toContain(jwt);
    expect(JSON.stringify(session.entries())).toContain("fresh-session-token");
    client.logout();
    expect(session.entries()).toEqual([]);
  });
  it("requests E-Mail verification on registration without storing a password",async()=>{
    const calls=[],session=memoryStorage();
    const fetcher=vi.fn(async(url,options={})=>{
      calls.push({url,options});
      if(url.endsWith("/trainer-auth/config"))return new Response(JSON.stringify(firebase));
      if(url.includes("signUp"))return new Response(JSON.stringify({
        idToken:jwt,refreshToken:"signup-refresh",expiresIn:"3600"}));
      if(url.includes("sendOobCode"))return new Response(JSON.stringify({email:"trainer@example.org"}));
      throw Error("Unexpected "+url);
    });
    const client=createTrainerAuthClient(API,{fetcher,session});
    await client.signup("trainer@example.org","safe-password-123");
    const verification=calls.find(c=>c.url.includes("sendOobCode"));
    expect(JSON.parse(verification.options.body).requestType).toBe("VERIFY_EMAIL");
    expect(JSON.parse(verification.options.body).idToken).toBe(jwt);
    expect(JSON.stringify(session.entries())).not.toContain("safe-password-123");
  });
  it("allows approved clients to request empty season while keeping games unavailable",async()=>{
    const session=memoryStorage(),calls=[];
    const fetcher=vi.fn(async(url,opts={})=>{
      calls.push({url,opts});
      if(url.endsWith("/trainer-auth/config"))return new Response(JSON.stringify(firebase));
      if(url.includes("signInWithPassword"))return new Response(JSON.stringify({
        idToken:jwt,refreshToken:"session",expiresIn:"3600"}));
      if(url.endsWith("/trainer-auth/spaces/"+SPACE+"/seasons"))return new Response(JSON.stringify({
        spaceId:SPACE,seasonId:SPACE,name:"2027/28",gameCount:0,revision:1
      }),{status:201});
      throw Error("Unexpected "+url);
    });
    const client=createTrainerAuthClient(API,{session,fetcher});
    await client.login("trainer@example.org","passpass");
    const created=await client.createSeason(SPACE,"2027/28",0);
    expect(created.gameCount).toBe(0);
    const createCall=calls.find(c=>c.url.endsWith("/seasons"));
    expect(createCall.opts.headers.Authorization).toBe("Bearer "+jwt);
    expect(JSON.parse(createCall.opts.body)).toEqual({name:"2027/28",expectedRevision:0});
    expect(client.publishGame).toBeUndefined();
  });
  it("supports admin review and approval only through a separate authorized endpoint",async()=>{
    const session=memoryStorage(),calls=[];
    const fetcher=vi.fn(async(url,opts={})=>{
      calls.push({url,opts});
      if(url.endsWith("/trainer-auth/config"))return new Response(JSON.stringify(firebase));
      if(url.includes("signInWithPassword"))return new Response(JSON.stringify({
        idToken:jwt,refreshToken:"session",expiresIn:"3600"}));
      if(url.endsWith("/trainer-auth/admin/users"))return new Response(JSON.stringify({
        users:[{uid:"trainer-1",email:"trainer@example.org",status:"pending"}]
      }));
      if(url.endsWith("/trainer-auth/admin/users/trainer-1"))return new Response(JSON.stringify({
        uid:"trainer-1",status:"approved"
      }));
      throw Error("Unexpected "+url);
    });
    const client=createTrainerAuthClient(API,{session,fetcher});
    await client.login("admin@example.org","passpass");
    expect((await client.listUsers()).users).toHaveLength(1);
    expect((await client.setApproval("trainer-1","approved")).status).toBe("approved");
    const approval=calls.find(c=>c.url.endsWith("/admin/users/trainer-1"));
    expect(approval.opts.headers.Authorization).toBe("Bearer "+jwt);
    expect(JSON.parse(approval.opts.body)).toEqual({status:"approved"});
  });
  it("issues one-time publisher keys only through admin authenticated route",async()=>{
    const session=memoryStorage(),calls=[];
    const secret="trainer_"+("z".repeat(43));
    const fetcher=vi.fn(async(url,opts={})=>{
      calls.push({url,opts});
      if(url.endsWith("/trainer-auth/config"))return new Response(JSON.stringify(firebase));
      if(url.includes("signInWithPassword"))return new Response(JSON.stringify({
        idToken:jwt,refreshToken:"admin-session",expiresIn:"3600"
      }));
      if(url.endsWith("/trainer-auth/admin/spaces/"+SPACE+"/publisher-key"))
        return new Response(JSON.stringify({spaceId:SPACE,trainerToken:secret}));
      throw Error("Unexpected "+url);
    });
    const client=createTrainerAuthClient(API,{session,fetcher});
    await client.login("admin@example.org","adminpass");
    const issued=await client.issuePublisherKey(SPACE);
    expect(issued.trainerToken).toBe(secret);
    const call=calls.find(x=>x.url.endsWith("/publisher-key"));
    expect(call.opts.headers.Authorization).toBe("Bearer "+jwt);
    expect(call.url).not.toContain(secret);
    expect(JSON.stringify(session.entries())).not.toContain(secret);
  });

});
