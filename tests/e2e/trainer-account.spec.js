import {test,expect} from "@playwright/test";
const API="https://handball-season-sync-235703972531.europe-west1.run.app";
const SPACE="88735513-5e3e-4a95-aa70-6a1a2fe94bf9";
const SEASON="88735513-5e3e-4a95-aa70-6a1a2fe94bfa";
const KEY="reader_"+("R".repeat(43));
const ID_TOKEN="eyJhbGciOiJSUzI1NiJ9."+"A".repeat(300)+"."+"B".repeat(100);
const firebase={enabled:true,projectId:"spielanalyse-companion",
  apiKey:"AIzaSyTestApiKeyForMockOnly"};
const success=(data,status=200)=>({status,contentType:"application/json",
  headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Authorization,Content-Type"},
  body:JSON.stringify(data)});
function catalog(seasons=[]){return {spaceId:SPACE,name:"TSV Kronshagen",revision:seasons.length,
  trainerAccess:"individual",seasons,games:[],updatedAt:"2026-11-14"};}
async function openTrainerAccount(page){
  await page.goto("/");
  await page.locator("#homeChooseTeamSpace").click();
  await page.locator("#trainerAccountPanel summary").click();
  await expect(page.locator("#trainerAccountLogin")).toBeVisible();
}
test("Account registration stays unavailable until Firebase is configured, legacy panel remains",async({page})=>{
  await page.route(API+"/trainer-auth/config",route=>route.fulfill(success({enabled:false})));
  await page.goto("/");
  await page.locator("#homeChooseTeamSpace").click();
  await page.locator("#trainerAccountPanel summary").click();
  await expect(page.locator("#trainerAccountStatus")).toContainText("noch nicht aktiviert");
  await expect(page.locator("#trainerAccountLogin")).toBeHidden();
  await page.locator("#teamSpaceConnect summary").click();
  await expect(page.locator("#teamSpaceRegistrationToken")).toBeVisible();
});
test("Approved Firebase trainer can register team and empty season without publish-game access",async({page})=>{
  const cloud={spaces:[],seasons:[],writes:[],firebasePassword:null};
  await page.route("https://identitytoolkit.googleapis.com/**",route=>{
    const req=route.request(),data=req.postDataJSON();
    cloud.firebasePassword=data.password;
    return route.fulfill(success({idToken:ID_TOKEN,refreshToken:"mock-refresh",
      expiresIn:"3600",localId:"trainer-1"}));
  });
  await page.route(API+"/spaces/"+SPACE+"/catalog",route=>{
    if(route.request().headers().authorization!=="Bearer "+KEY)
      return route.fulfill(success({error:{message:"not authorized"}},401));
    return route.fulfill(success(catalog(cloud.seasons)));
  });
  await page.route(API+"/trainer-auth/**",async route=>{
    const request=route.request(),url=new URL(request.url()),path=url.pathname;
    if(path==="/trainer-auth/config")return route.fulfill(success(firebase));
    if(request.headers().authorization!=="Bearer "+ID_TOKEN)
      return route.fulfill(success({error:{message:"Not authenticated"}},401));
    if(path==="/trainer-auth/me")
      return route.fulfill(success({uid:"trainer-1",email:"trainer@example.org",
        status:"approved",isAdmin:false}));
    if(path==="/trainer-auth/spaces"&&request.method()==="GET")
      return route.fulfill(success({spaces:cloud.spaces}));
    if(path==="/trainer-auth/spaces"&&request.method()==="POST"){
      const body=request.postDataJSON();
      cloud.writes.push({path,body});
      cloud.spaces.push({spaceId:SPACE,name:body.name,revision:0,seasonCount:0});
      return route.fulfill(success({spaceId:SPACE,name:body.name,readToken:KEY,revision:0},201));
    }
    if(path==="/trainer-auth/spaces/"+SPACE+"/catalog")
      return route.fulfill(success(catalog(cloud.seasons)));
    if(path==="/trainer-auth/spaces/"+SPACE+"/seasons"&&request.method()==="POST"){
      const body=request.postDataJSON();
      cloud.writes.push({path,body});
      cloud.seasons.push({id:SEASON,name:body.name,gameCount:0,gameIds:[],revision:1});
      cloud.spaces[0].seasonCount=1;
      return route.fulfill(success({spaceId:SPACE,seasonId:SEASON,
        name:body.name,gameCount:0,revision:1,itemRevision:1},201));
    }
    return route.fulfill(success({error:{message:"Unmocked trainer endpoint"}},404));
  });
  await openTrainerAccount(page);
  await page.locator("#trainerAccountEmail").fill("trainer@example.org");
  await page.locator("#trainerAccountPassword").fill("super-secret");
  await page.locator("#trainerAccountSignIn").click();
  await expect(page.locator("#trainerAccountCreator")).toBeVisible();
  await expect(page.locator("#trainerAccountStatus")).toContainText("freigegeben");
  await page.locator("#trainerAccountSpaceName").fill("TSV Kronshagen");
  await page.locator("#trainerAccountCreateSpace").click();
  await expect(page.locator("#trainerAccountSpaces")).toHaveValue(SPACE);
  await page.locator("#trainerAccountSeasonName").fill("B-Jugend 2027/28");
  await page.locator("#trainerAccountCreateSeason").click();
  await expect(page.locator("#teamSpaceSeasons")).toContainText("B-Jugend 2027/28");
  await expect(page.locator("#teamSpaceSeasons")).toContainText("Noch keine Spiele");
  await expect(page.locator("#teamSpacePublish")).toBeHidden();
  const invite=await page.locator("#teamSpaceInviteLink").inputValue();
  expect(invite).toContain("#teamspace=");
  expect(invite).not.toContain(ID_TOKEN);
  expect(cloud.writes.map(c=>c.path)).toEqual([
    "/trainer-auth/spaces","/trainer-auth/spaces/"+SPACE+"/seasons"
  ]);
  expect(cloud.writes[1].body.expectedRevision).toBe(0);
  expect(cloud.firebasePassword).toBe("super-secret");
  const stored=await page.evaluate(()=>Object.keys(sessionStorage).map(k=>sessionStorage.getItem(k)));
  expect(JSON.stringify(stored)).not.toContain("super-secret");
  expect(JSON.stringify(stored)).not.toContain(ID_TOKEN);
});
test("Bootstrap administrator can approve trainer requests, not create games on their behalf",async({page})=>{
  let status="pending";
  await page.route("https://identitytoolkit.googleapis.com/**",route=>route.fulfill(success({
    idToken:ID_TOKEN,refreshToken:"admin-refresh",expiresIn:"3600"
  })));
  await page.route(API+"/trainer-auth/**",route=>{
    const request=route.request(),path=new URL(request.url()).pathname;
    if(path==="/trainer-auth/config")return route.fulfill(success(firebase));
    if(request.headers().authorization!=="Bearer "+ID_TOKEN)
      return route.fulfill(success({error:{message:"Unauthorized"}},401));
    if(path==="/trainer-auth/me")return route.fulfill(success({
      uid:"admin",email:"admin@example.org",isAdmin:true,status:"approved"}));
    if(path==="/trainer-auth/spaces")return route.fulfill(success({spaces:[]}));
    if(path==="/trainer-auth/admin/users"&&request.method()==="GET")
      return route.fulfill(success({users:[{
        uid:"new-trainer",email:"trainer@example.org",status
      }]}));
    if(path==="/trainer-auth/admin/users/new-trainer"&&request.method()==="POST"){
      status=request.postDataJSON().status;
      return route.fulfill(success({uid:"new-trainer",status}));
    }
    return route.fulfill(success({error:{message:"not found"}},404));
  });
  page.on("dialog",dialog=>dialog.accept());
  await openTrainerAccount(page);
  await page.locator("#trainerAccountEmail").fill("admin@example.org");
  await page.locator("#trainerAccountPassword").fill("adminpassword");
  await page.locator("#trainerAccountSignIn").click();
  await expect(page.locator("#trainerAccountAdmin")).toBeVisible();
  await expect(page.locator("#trainerAccountUserList")).toContainText("trainer@example.org");
  await page.locator("#trainerAccountUserList").getByRole("button",{name:"Freigeben"}).click();
  await expect(page.locator("#trainerAccountUserList")).toContainText("approved");
  expect(status).toBe("approved");
});
