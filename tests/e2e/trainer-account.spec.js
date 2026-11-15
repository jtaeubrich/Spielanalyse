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
  await page.locator("#homeNew").click();
  await page.locator("#teamSpaceTrainerEntry").click();
  await expect(page.locator("#trainerAccountPanel")).toHaveAttribute("open","");
  await expect(page.locator("#trainerAccountLogin")).toBeVisible();
}
test("Safari and password managers receive correctly mapped login fields, Enter signs in",async({page})=>{
  let loginRequests=0;
  await page.route(API+"/trainer-auth/config",route=>route.fulfill(success(firebase)));
  await page.route("https://identitytoolkit.googleapis.com/**",route=>{
    const req=route.request();
    if(req.url().includes("signInWithPassword")){
      loginRequests++;
      expect(req.postDataJSON().email).toBe("trainer@example.org");
      expect(req.postDataJSON().password).toBe("test-password");
      return route.fulfill(success({idToken:ID_TOKEN,refreshToken:"mock-session",expiresIn:"3600"}));
    }
    return route.fulfill(success({error:{message:"Unexpected request"}},400));
  });
  await page.route(API+"/trainer-auth/me",route=>{
    expect(route.request().headers().authorization).toBe("Bearer "+ID_TOKEN);
    return route.fulfill(success({uid:"trainer-1",email:"trainer@example.org",
      status:"pending",isAdmin:false}));
  });
  await openTrainerAccount(page);
  const form=page.locator("#trainerAccountLogin");
  const email=page.locator("#trainerAccountEmail");
  const password=page.locator("#trainerAccountPassword");
  await expect(form).toHaveAttribute("method","post");
  await expect(email).toHaveAttribute("type","email");
  await expect(email).toHaveAttribute("name","username");
  await expect(email).toHaveAttribute("autocomplete","username");
  await expect(password).toHaveAttribute("type","password");
  await expect(password).toHaveAttribute("name","password");
  await expect(password).toHaveAttribute("autocomplete","current-password");
  await email.fill("trainer@example.org");
  await password.fill("test-password");
  await password.press("Enter");
  await expect(page.locator("#trainerAccountStatus")).toContainText("Freigabe beantragt");
  expect(loginRequests).toBe(1);
  // A successful login must not leave the now-blank password box visible.
  await expect(form).toBeHidden();
  await expect(page.locator("#trainerAccountDashboard")).toBeVisible();
  await expect(page.locator("#trainerAccountSessionActions")).toBeVisible();
  await expect(page.locator("#trainerAccountSignOut")).toBeVisible();
  await expect(password).toHaveValue("");
  await page.locator("#trainerAccountSignOut").click();
  await expect(form).toBeVisible();
  await expect(page.locator("#trainerAccountSessionActions")).toBeHidden();
  await expect(page.locator("#trainerAccountDashboard")).toBeHidden();
  expect(loginRequests).toBe(1);
});

test("Autofilled credentials stay present until a user submits the form",async({page})=>{
  await page.route(API+"/trainer-auth/config",route=>route.fulfill(success(firebase)));
  await openTrainerAccount(page);
  const username=page.locator("#trainerAccountEmail");
  const password=page.locator("#trainerAccountPassword");
  await username.fill("trainer@example.org");
  await password.fill("stored-password");
  // Equivalent to input/change events triggered by password autofill.
  await password.dispatchEvent("input");
  await password.dispatchEvent("change");
  await expect(username).toHaveValue("trainer@example.org");
  await expect(password).toHaveValue("stored-password");
  await expect(page.locator("#trainerAccountLogin")).toBeVisible();
  await expect(page.locator("#trainerAccountSessionActions")).toBeHidden();
});

test("Unverified Firebase session keeps verification and sign-out controls available",async({page})=>{
  await page.route(API+"/trainer-auth/config",route=>route.fulfill(success(firebase)));
  await page.route("https://identitytoolkit.googleapis.com/**",route=>{
    if(route.request().url().includes("signInWithPassword"))
      return route.fulfill(success({idToken:ID_TOKEN,refreshToken:"unverified-session",expiresIn:"3600"}));
    return route.fulfill(success({error:{message:"Unexpected request"}},400));
  });
  await page.route(API+"/trainer-auth/me",route=>route.fulfill(
    success({error:{code:"EMAIL_NOT_VERIFIED",message:"Bitte zuerst die E-Mail-Adresse bestätigen."}},403)));
  await openTrainerAccount(page);
  await page.locator("#trainerAccountEmail").fill("trainer@example.org");
  await page.locator("#trainerAccountPassword").fill("secret-password");
  await page.locator("#trainerAccountSignIn").click();
  await expect(page.locator("#trainerAccountStatus")).toContainText("E-Mail-Adresse bestätigen");
  await expect(page.locator("#trainerAccountLogin")).toBeVisible();
  await expect(page.locator("#trainerAccountSessionActions")).toBeVisible();
  await expect(page.locator("#trainerAccountVerifyMail")).toBeVisible();
  await page.locator("#trainerAccountSignOut").click();
  await expect(page.locator("#trainerAccountSessionActions")).toBeHidden();
  await expect(page.locator("#trainerAccountLogin")).toBeVisible();
});

test("Pending trainer becomes first admin once using a central key without Cloud Console",async({page})=>{
  const registrationToken="trainer_"+("s".repeat(44));
  let claimed=false,requests=0;
  await page.route("https://identitytoolkit.googleapis.com/**",route=>
    route.fulfill(success({idToken:ID_TOKEN,refreshToken:"bootstrap-session",expiresIn:"3600"})));
  await page.route(API+"/trainer-auth/**",route=>{
    const req=route.request(),path=new URL(req.url()).pathname;
    if(path==="/trainer-auth/config")return route.fulfill(success(firebase));
    if(req.headers().authorization!=="Bearer "+ID_TOKEN)
      return route.fulfill(success({error:{message:"Unauthenticated"}},401));
    if(path==="/trainer-auth/me")
      return route.fulfill(success({uid:"trainer-1",email:"trainer@example.org",
        isAdmin:claimed,status:claimed?"approved":"pending",
        adminBootstrapAvailable:!claimed}));
    if(path==="/trainer-auth/admin/bootstrap"&&req.method()==="POST"){
      requests++;
      expect(req.postDataJSON()).toEqual({registrationToken});
      claimed=true;
      return route.fulfill(success({uid:"trainer-1",isAdmin:true,status:"approved"}));
    }
    if(path==="/trainer-auth/spaces")return route.fulfill(success({spaces:[]}));
    if(path==="/trainer-auth/admin/users")return route.fulfill(success({users:[]}));
    return route.fulfill(success({error:{message:"Unmocked path"}},404));
  });
  page.on("dialog",d=>d.accept());
  await openTrainerAccount(page);
  await page.locator("#trainerAccountEmail").fill("trainer@example.org");
  await page.locator("#trainerAccountPassword").fill("secret-login");
  await page.locator("#trainerAccountSignIn").click();
  await expect(page.locator("#trainerAccountStatus")).toContainText("Freigabe beantragt");
  await expect(page.locator("#trainerAccountBootstrap")).toBeVisible();
  await expect(page.locator("#trainerAccountAdmin")).toBeHidden();
  const input=page.locator("#trainerAccountBootstrapToken");
  await expect(input).toHaveAttribute("type","password");
  await expect(input).toHaveAttribute("autocomplete","off");
  await input.fill(registrationToken);
  await page.locator("#trainerAccountClaimAdmin").click();
  await expect(page.locator("#trainerAccountStatus")).toContainText("Administratorkonto aktiviert");
  await expect(page.locator("#trainerAccountAdmin")).toBeVisible();
  await expect(page.locator("#trainerAccountBootstrap")).toBeHidden();
  await expect(input).toHaveValue("");
  expect(requests).toBe(1);
  const persisted=await page.evaluate(()=>JSON.stringify([
    Object.values(sessionStorage),Object.values(localStorage)]));
  expect(persisted).not.toContain(registrationToken);
});

test("An existing administrator prevents the first-admin registration form appearing",async({page})=>{
  await page.route("https://identitytoolkit.googleapis.com/**",route=>
    route.fulfill(success({idToken:ID_TOKEN,refreshToken:"session",expiresIn:"3600"})));
  await page.route(API+"/trainer-auth/**",route=>{
    const req=route.request(),path=new URL(req.url()).pathname;
    if(path==="/trainer-auth/config")return route.fulfill(success(firebase));
    if(path==="/trainer-auth/me")return route.fulfill(success({
      uid:"trainer-1",email:"trainer@example.org",isAdmin:false,status:"pending",
      adminBootstrapAvailable:false
    }));
    return route.fulfill(success({error:{message:"Not found"}},404));
  });
  await openTrainerAccount(page);
  await page.locator("#trainerAccountEmail").fill("trainer@example.org");
  await page.locator("#trainerAccountPassword").fill("secret-login");
  await page.locator("#trainerAccountSignIn").click();
  await expect(page.locator("#trainerAccountStatus")).toContainText("Freigabe beantragt");
  await expect(page.locator("#trainerAccountBootstrap")).toBeHidden();
});
test("Account registration stays unavailable until Firebase is configured, legacy panel remains",async({page})=>{
  await page.route(API+"/trainer-auth/config",route=>route.fulfill(success({enabled:false})));
  await page.goto("/");
  await page.locator("#homeChooseTeamSpace").click();
  await page.locator("#homeNew").click();
  await page.locator("#teamSpaceTrainerEntry").click();
  await expect(page.locator("#trainerAccountPanel")).toHaveAttribute("open","");
  await expect(page.locator("#trainerAccountStatus")).toContainText("noch nicht aktiviert");
  await expect(page.locator("#trainerAccountLogin")).toBeHidden();
  await expect(page.locator("#teamSpaceConnect")).toBeHidden();
  await page.locator("#teamSpaceLegacyEntry").click();
  await expect(page.locator("#teamSpaceConnect")).toHaveAttribute("open","");
  await expect(page.locator("#teamSpaceRegistrationToken")).toBeVisible();
});
test("Registration requires matching passwords before contacting Firebase and clears credentials",async({page})=>{
  const calls=[];
  await page.route(API+"/trainer-auth/config",route=>route.fulfill(success(firebase)));
  await page.route("https://identitytoolkit.googleapis.com/**",route=>{
    calls.push({url:route.request().url(),body:route.request().postDataJSON()});
    return route.fulfill(success({idToken:ID_TOKEN,refreshToken:"mock-refresh",expiresIn:"3600"}));
  });
  await openTrainerAccount(page);
  const password=page.locator("#trainerAccountPassword");
  const confirmation=page.locator("#trainerAccountPasswordConfirm");
  await expect(confirmation).toBeHidden();
  await expect(password).toHaveAttribute("autocomplete","current-password");
  await page.locator("#trainerAccountEmail").fill("trainer@example.org");
  await password.fill("secure test password");
  await page.locator("#trainerAccountSignUp").click();
  await expect(confirmation).toBeVisible();
  expect(calls).toEqual([]);
  await expect(password).toHaveAttribute("autocomplete","new-password");
  await expect(confirmation).toHaveAttribute("autocomplete","new-password");
  await page.getByRole("button",{name:"Konto erstellen",exact:true}).click();
  await expect(page.locator("#trainerAccountStatus")).toContainText("stimmen nicht überein");
  expect(calls).toEqual([]);
  await confirmation.fill("different password");
  await page.getByRole("button",{name:"Konto erstellen",exact:true}).click();
  await expect(page.locator("#trainerAccountStatus")).toContainText("stimmen nicht überein");
  expect(calls).toEqual([]);
  await page.getByRole("button",{name:"Passwort anzeigen",exact:true}).click();
  await expect(password).toHaveAttribute("type","text");
  await expect(confirmation).toHaveAttribute("type","text");
  await expect(page.locator("#trainerAccountShowPassword")).toHaveAttribute("aria-pressed","true");
  await confirmation.fill("secure test password");
  await page.getByRole("button",{name:"Konto erstellen",exact:true}).click();
  await expect(page.locator("#trainerAccountStatus")).toContainText("Registriert. Bitte den Bestätigungslink");
  await expect(page.locator("#trainerAccountSessionActions")).toBeVisible();
  await expect(page.locator("#trainerAccountLogin")).toBeVisible();
  expect(calls).toHaveLength(2);
  expect(calls[0].url).toContain("accounts:signUp?");
  expect(calls[0].body.password).toBe("secure test password");
  expect(calls[0].body).not.toHaveProperty("passwordConfirm");
  expect(calls[1].body.requestType).toBe("VERIFY_EMAIL");
  await expect(password).toHaveValue("");
  await expect(confirmation).toHaveValue("");
  await expect(confirmation).toBeHidden();
  await expect(password).toHaveAttribute("type","password");
  const stored=await page.evaluate(()=>JSON.stringify([Object.values(localStorage),Object.values(sessionStorage)]));
  expect(stored).not.toContain("secure test password");
});

test("Cancelling registration clears passwords and restores sign-in without confirmation",async({page})=>{
  await page.route(API+"/trainer-auth/config",route=>route.fulfill(success(firebase)));
  await openTrainerAccount(page);
  await page.locator("#trainerAccountSignUp").click();
  await page.locator("#trainerAccountPassword").fill("test password");
  await page.locator("#trainerAccountPasswordConfirm").fill("test password");
  await page.locator("#trainerAccountShowPassword").click();
  await page.getByRole("button",{name:"Zur Anmeldung",exact:true}).click();
  await expect(page.locator("#trainerAccountSignIn")).toBeVisible();
  await expect(page.locator("#trainerAccountPasswordConfirm")).toBeHidden();
  for(const id of ["trainerAccountPassword","trainerAccountPasswordConfirm"]){
    await expect(page.locator("#"+id)).toHaveValue("");
    await expect(page.locator("#"+id)).toHaveAttribute("type","password");
  }
  await expect(page.locator("#trainerAccountPassword")).toHaveAttribute("autocomplete","current-password");
});

test("Approved Firebase trainer can create a Team Space and publish local season into an existing cloud season",async({page})=>{
  const cloud={spaces:[],seasons:[],writes:[],firebasePassword:null,lastPublish:null};
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
  await page.route(API+"/spaces/"+SPACE+"/publish-season",route=>{
    const request=route.request();
    if(request.headers().authorization!=="Bearer "+ID_TOKEN)
      return route.fulfill(success({error:{message:"not authorized"}},401));
    cloud.lastPublish=request.postDataJSON();
    const uploaded=cloud.lastPublish.archive.games;
    cloud.seasons[0].gameCount=uploaded.length;
    cloud.seasons[0].gameIds=uploaded.map(g=>g.id);
    cloud.seasons[0].revision=2;
    return route.fulfill(success({spaceId:SPACE,seasonId:SEASON,
      revision:2,itemRevision:2,gameCount:uploaded.length}));
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
  await expect(page.locator("#teamSpaceSelect")).toHaveValue(SPACE);
  await page.locator("#trainerAccountSeasonName").fill("B-Jugend 2027/28");
  await page.locator("#trainerAccountCreateSeason").click();
  await expect(page.locator("#teamSpaceSeasons")).toContainText("B-Jugend 2027/28");
  await expect(page.locator("#teamSpaceSeasons")).toContainText("Noch keine Spiele");
  await expect(page.locator("#teamSpaceSelect")).toHaveValue(SPACE);
  await expect(page.locator("#teamSpaceSelectedIdInfo")).toContainText(SPACE);
  await expect(page.locator("#trainerAccountStatus")).toContainText("ID …"+SPACE.slice(-8));
  await expect(page.locator("#trainerAccountCatalogStatus")).toContainText(
    "Direkt vom Cloud-Server");
  await expect(page.locator("#trainerAccountCatalogStatus")).toContainText(
    "1 Saisons · 0 Spiele");
  await page.locator("#trainerAccountVerifyCatalog").click();
  await expect(page.locator("#trainerAccountCatalogStatus")).toContainText(
    "B-Jugend 2027/28 (0 Spiele)");
  await expect(page.locator("#teamSpacePublish")).toBeVisible();
  const invite=await page.locator("#teamSpaceInviteLink").inputValue();
  expect(invite).toContain("#teamspace=");
  expect(invite).not.toContain(ID_TOKEN);
  expect(cloud.writes.map(c=>c.path)).toEqual([
    "/trainer-auth/spaces","/trainer-auth/spaces/"+SPACE+"/seasons"
  ]);
  expect(cloud.writes[1].body.expectedRevision).toBe(0);
  expect(cloud.firebasePassword).toBe("super-secret");
  // A trainer may publish into the empty cloud season directly, using their
  // authenticated account and without a second publisher credential.
  page.on("dialog",dialog=>dialog.accept());
  const match={gameName:"Kronshagen gegen Gegner",gameDate:"2026-11-14",
    home:{name:"TSV Kronshagen"},away:{name:"Gegner"},events:[]};
  const existing={format:"handball-spielanalyse-season",version:1,
    name:"B-Jugend 2027/28",
    games:[{id:"sg-existing",fileName:"spiel.json",selected:true,data:match}]};
  await page.locator("#seasonImportInput").setInputFiles({
    name:"bestehende-saison.json",mimeType:"application/json",
    buffer:Buffer.from(JSON.stringify(existing))
  });
  await page.locator('[data-tab="home"]').click();
  await page.locator("#homeChooseTeamSpace").click();
  await page.locator("#homeOpen").click();
  await page.locator("#homeLibraryList .home-list-row")
    .getByRole("button",{name:"Laden"}).click();
  await expect(page.locator("#teamSpaceTrainerTools")).toBeVisible();
  await page.locator("#teamSpaceTrainerTools > summary").click();
  await page.locator("#teamSpacePublish summary").click();
  await page.locator("#teamSpacePublishSeasonTarget").selectOption(SEASON);
  await page.locator("#teamSpacePublishSeasonBtn").click();
  await expect.poll(()=>cloud.lastPublish).not.toBeNull();
  expect(cloud.lastPublish.seasonId).toBe(SEASON);
  expect(cloud.lastPublish.archive.games).toHaveLength(1);
  expect(cloud.seasons).toHaveLength(1);
  await expect(page.locator("#teamSpacePublish")).toBeVisible();
  await expect(page.locator("#teamSpacePublishStatus"))
    .toContainText("Im Cloud-Katalog bestätigt: Saison");
  await expect(page.locator("#teamSpacePublishStatus"))
    .toContainText("Cloud-Version 2");
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
    if(path==="/trainer-auth/admin/spaces/"+SPACE+"/publisher-key"&&request.method()==="POST")
      return route.fulfill(success({spaceId:SPACE,trainerToken:"trainer_"+("p".repeat(43))}));
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
  await page.locator("#trainerAccountPublisherSpace").fill(SPACE);
  await page.locator("#trainerAccountIssuePublisher").click();
  await expect(page.locator("#trainerAccountPublisherCredentials")).toBeVisible();
  await expect(page.locator("#trainerAccountPublisherToken")).toHaveValue("trainer_"+("p".repeat(43)));
});


test("approved trainer on fresh iPad sees own spaces and writes without a copied reader key",async({page})=>{
  const viewed=[];
  await page.route("https://identitytoolkit.googleapis.com/**",route=>
    route.fulfill(success({idToken:ID_TOKEN,refreshToken:"tablet-session",expiresIn:"3600"})));
  await page.route(API+"/trainer-auth/**",route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==="/trainer-auth/config")return route.fulfill(success(firebase));
    if(route.request().headers().authorization!=="Bearer "+ID_TOKEN)
      return route.fulfill(success({error:{message:"Unauthenticated"}},401));
    if(path==="/trainer-auth/me")return route.fulfill(success({
      uid:"trainer-1",email:"trainer@example.org",status:"approved",isAdmin:false
    }));
    if(path==="/trainer-auth/spaces")return route.fulfill(success({
      spaces:[{spaceId:SPACE,name:"TSV Kronshagen",revision:2,seasonCount:1}]
    }));
    return route.fulfill(success({error:{message:"Unknown endpoint"}},404));
  });
  await page.route(API+"/spaces/"+SPACE+"/catalog",route=>{
    viewed.push(route.request().headers().authorization);
    return route.fulfill(route.request().headers().authorization==="Bearer "+ID_TOKEN
      ?success(catalog([{id:SEASON,name:"B-Jugend",revision:1,
          gameCount:0,gameIds:[],preferredTeam:"TSV Kronshagen"}]))
      :success({error:{message:"No access"}},401));
  });
  await openTrainerAccount(page);
  await page.locator("#trainerAccountEmail").fill("trainer@example.org");
  await page.locator("#trainerAccountPassword").fill("tablet-password");
  await page.locator("#trainerAccountSignIn").click();
  await expect(page.locator("#homeLibraryList")).toContainText("TSV Kronshagen");
  await page.locator("#homeLibraryList").getByRole("button",{name:"Laden"}).click();
  await expect(page.locator("#teamSpaceSeasons")).toContainText("B-Jugend");
  await expect(page.locator("#teamSpacePlayerStatus")).toContainText("Keine neueren Cloud-Versionen");
  await expect(page.locator("#teamSpaceTrainerTools")).toBeVisible();
  await page.locator("#teamSpaceTrainerTools > summary").click();
  await expect(page.locator("#teamSpacePublish")).toBeVisible();
  expect(await page.locator("#teamSpaceInviteLink").inputValue()).toBe("");
  expect(await page.locator("#teamSpaceCopyInvite").isDisabled()).toBe(true);
  expect(viewed.length).toBeGreaterThan(0);
  expect(viewed.every(authorization=>authorization==="Bearer "+ID_TOKEN)).toBe(true);
  const stored=await page.evaluate(()=>JSON.stringify([Object.values(localStorage),
    Object.values(sessionStorage)]));
  expect(stored).not.toContain(ID_TOKEN);
  expect(stored).not.toContain("tablet-password");
  expect(stored).not.toContain(KEY);
});

test("trainer can link a previous Team Space once and then find it in the library",async({page})=>{
  const oldKey="trainer_"+("L".repeat(44)),links=[];
  let linked=false;
  await page.route("https://identitytoolkit.googleapis.com/**",route=>
    route.fulfill(success({idToken:ID_TOKEN,refreshToken:"link-session",expiresIn:"3600"})));
  await page.route(API+"/trainer-auth/**",route=>{
    const request=route.request(),path=new URL(request.url()).pathname;
    if(path==="/trainer-auth/config")return route.fulfill(success(firebase));
    if(request.headers().authorization!=="Bearer "+ID_TOKEN)
      return route.fulfill(success({error:{message:"Unauthorized"}},401));
    if(path==="/trainer-auth/me")return route.fulfill(success({
      uid:"trainer-1",email:"trainer@example.org",status:"approved",isAdmin:false
    }));
    if(path==="/trainer-auth/spaces"&&request.method()==="GET")
      return route.fulfill(success({spaces:linked?
        [{spaceId:SPACE,name:"Alter Team Space",revision:1,seasonCount:0}]:[]}));
    if(path==="/trainer-auth/spaces/"+SPACE+"/link"&&request.method()==="POST"){
      links.push(request.postDataJSON());
      linked=true;
      return route.fulfill(success({spaceId:SPACE,name:"Alter Team Space",linked:true}));
    }
    return route.fulfill(success({error:{message:"Unknown"}},404));
  });
  await page.route(API+"/spaces/"+SPACE+"/catalog",route=>
    route.fulfill(success({...catalog(),name:"Alter Team Space"})));
  await openTrainerAccount(page);
  await page.locator("#trainerAccountEmail").fill("trainer@example.org");
  await page.locator("#trainerAccountPassword").fill("secret");
  await page.locator("#trainerAccountSignIn").click();
  await expect(page.locator("#trainerAccountCreator")).toBeVisible();
  await page.locator("#trainerAccountLinkSpaceId").fill(SPACE);
  await page.locator("#trainerAccountLinkToken").fill(oldKey);
  await page.locator("#trainerAccountLinkSpace").click();
  await expect(page.locator("#trainerAccountLinkStatus")).toContainText("zugeordnet");
  await expect(page.locator("#trainerAccountLinkToken")).toHaveValue("");
  expect(links).toEqual([{trainerToken:oldKey}]);
  const stored=await page.evaluate(()=>JSON.stringify([Object.values(localStorage),
    Object.values(sessionStorage)]));
  expect(stored).not.toContain(oldKey);
  expect(stored).not.toContain(ID_TOKEN);
  await page.locator("#homeBack").click();
  await page.locator("#homeOpen").click();
  await expect(page.locator("#homeLibraryList")).toContainText("Alter Team Space");
});
