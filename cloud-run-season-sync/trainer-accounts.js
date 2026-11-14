// Optional trainer account registry using Firebase ID token verification.
// Firebase accounts authenticate persons; the GCS registry grants trainer roles.
// This module has no firebase-admin dependency so backend tests can inject a verifier.
import {randomBytes,randomUUID,createHash,timingSafeEqual} from "node:crypto";

const validUid=uid=>/^[A-Za-z0-9_-]{1,128}$/.test(String(uid||""));
const validSpace=id=>/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id||""));
const hash=value=>createHash("sha256").update(value).digest("hex");
const clean=value=>String(value||"").trim();

export function createTrainerAccountRegistry({
  store,verifyIdToken=null,adminUids=[],adminToken="",projectId="",webApiKey="",
  now=()=>new Date(),idFactory=randomUUID,
  readTokenFactory=()=>randomBytes(32).toString("base64url"),
  trainerTokenFactory=()=>"trainer_"+randomBytes(32).toString("base64url")
}={}){
  const adminSet=new Set(adminUids.filter(validUid));
  const enabled=Boolean(projectId&&webApiKey&&typeof verifyIdToken==="function");
  function throwError(status,code,message){
    const error=new Error(message);error.status=status;error.code=code;throw error;
  }
  async function identity(req,{approved=false,administrator=false}={}){
    if(!enabled)throwError(503,"AUTH_NOT_CONFIGURED","Traineranmeldung ist noch nicht eingerichtet.");
    const token=/^Bearer ([A-Za-z0-9._-]{100,8192})$/.exec(req.headers.authorization||"")?.[1];
    if(!token)throwError(401,"AUTH_REQUIRED","Bitte als Trainer anmelden.");
    let decoded;
    try{decoded=await verifyIdToken(token)}catch{
      throwError(401,"INVALID_ID_TOKEN","Sitzung ungültig oder abgelaufen. Bitte erneut anmelden.");
    }
    const uid=decoded?.uid,email=clean(decoded?.email).toLowerCase();
    if(!validUid(uid)||!email||email.length>254||!email.includes("@"))
      throwError(401,"INVALID_ID_TOKEN","Die Anmeldung enthält keine gültige Benutzeridentität.");
    if(decoded.email_verified!==true)
      throwError(403,"EMAIL_NOT_VERIFIED","Bitte zuerst die E-Mail-Adresse bestätigen.");
    const record=await store.readTrainerUser(uid);
    const user=record.metadata?.email===email?record.metadata:null;
    // The first admin is claimed exactly once and persisted in the private
    // bucket. A changed verified email or a suspended account loses this role.
    const bootstrap=adminSet.size?null:(await store.readTrainerAdminBootstrap()).metadata;
    const isAdmin=adminSet.has(uid)||(bootstrap?.uid===uid&&
      bootstrap?.email===email&&user?.status!=="suspended");
    if(administrator&&!isAdmin)
      throwError(403,"ADMIN_REQUIRED","Nur Administratoren dürfen Trainer freigeben.");
    if(approved&&!isAdmin&&user?.status!=="approved")
      throwError(403,"TRAINER_NOT_APPROVED","Trainerkonto ist noch nicht freigegeben oder wurde gesperrt.");
    return {uid,email,isAdmin,user,record,bootstrap};
  }
  async function owner(req,spaceId){
    const user=await identity(req,{approved:true});
    if(!validSpace(spaceId))throwError(404,"NOT_FOUND","Team Space nicht gefunden.");
    const {metadata:space,generation}=await store.readSpace(spaceId);
    if(!space||space.authMode!=="firebase"||space.ownerUid!==user.uid)
      throwError(403,"SPACE_NOT_OWNED","Dieser Team Space gehört nicht zu deinem Trainerkonto.");
    return {...user,space,generation};
  }
  async function handle(req,res,url,{send,bodyJson}){
    if(!url.pathname.startsWith("/trainer-auth/"))return false;
    const path=url.pathname,method=req.method;
    if(path==="/trainer-auth/config"&&method==="GET"){
      // Firebase web API keys are public application identifiers, not secrets.
      send(res,200,enabled?{enabled:true,projectId,apiKey:webApiKey}:{enabled:false});
      return true;
    }
    if(path==="/trainer-auth/me"&&method==="GET"){
      const user=await identity(req);
      send(res,200,{uid:user.uid,email:user.email,isAdmin:user.isAdmin,
        status:user.isAdmin?"approved":user.user?.status||"not_registered",
        adminBootstrapAvailable:!adminSet.size&&!user.bootstrap&&!user.isAdmin&&
          user.user?.status==="pending"&&typeof adminToken==="string"&&adminToken.length>=32});
      return true;
    }
    if(path==="/trainer-auth/register"&&method==="POST"){
      const user=await identity(req);
      if(user.isAdmin){
        send(res,200,{status:"approved",isAdmin:true});return true;
      }
      const current=user.record.metadata,stamp=now().toISOString();
      if(current&&current.email===user.email){
        send(res,200,{status:current.status});return true;
      }
      const record={uid:user.uid,email:user.email,status:"pending",
        requestedAt:stamp,updatedAt:stamp,approvedAt:null,approvedBy:null};
      if(current)await store.updateTrainerUser(user.uid,record,user.record.generation);
      else await store.createTrainerUser(user.uid,record);
      send(res,201,{status:"pending"});return true;
    }
    // A verified trainer with a pending application can become the first
    // administrator by proving knowledge of the existing central registration
    // credential. The immutable GCS object makes this globally one-time,
    // even for simultaneous calls to separate Cloud Run instances.
    if(path==="/trainer-auth/admin/bootstrap"&&method==="POST"){
      const applicant=await identity(req);
      if(adminSet.size||applicant.bootstrap)
        throwError(409,"ADMIN_ALREADY_CONFIGURED","Ein Administrator ist bereits eingerichtet.");
      if(applicant.user?.status!=="pending")
        throwError(403,"TRAINER_APPLICATION_REQUIRED","Bitte zuerst die Trainerfreigabe beantragen.");
      const body=await bodyJson(req);
      const submitted=String(body?.registrationToken||"").trim();
      if(!/^[A-Za-z0-9_-]{32,256}$/.test(submitted)||
        typeof adminToken!=="string"||adminToken.length<32||
        !timingSafeEqual(Buffer.from(hash(submitted),"hex"),Buffer.from(hash(adminToken),"hex")))
        throwError(403,"INVALID_REGISTRATION_TOKEN","Der zentrale Registrierungsschlüssel ist ungültig.");
      const stamp=now().toISOString();
      await store.createTrainerAdminBootstrap({uid:applicant.uid,
        email:applicant.email,claimedAt:stamp});
      // Persist the approved status for an accurate trainer list. Even if this
      // update races, the immutable bootstrap document remains authoritative.
      await store.updateTrainerUser(applicant.uid,{...applicant.user,
        status:"approved",updatedAt:stamp,approvedAt:stamp,
        approvedBy:applicant.uid},applicant.record.generation);
      send(res,200,{uid:applicant.uid,isAdmin:true,status:"approved"});
      return true;
    }
    // Only administrators can issue a separate upload capability.
    // Ordinary Firebase-approved trainers never receive this secret and
    // therefore cannot publish games in their Team Spaces.
    const publisher=/^\/trainer-auth\/admin\/spaces\/([^/]+)\/publisher-key$/.exec(path);
    if(publisher&&method==="POST"){
      await identity(req,{administrator:true});
      const spaceId=publisher[1];
      if(!validSpace(spaceId))throwError(404,"NOT_FOUND","Team Space nicht gefunden.");
      const {metadata,generation}=await store.readSpace(spaceId);
      if(!metadata||metadata.authMode!=="firebase")
        throwError(404,"NOT_FOUND","Konto-Team-Space nicht gefunden.");
      const trainerToken=trainerTokenFactory();
      await store.updateSpace(spaceId,{...metadata,trainerHash:hash(trainerToken),
        publisherKeyIssuedAt:now().toISOString()},generation);
      send(res,200,{spaceId,trainerToken});return true;
    }
    if(path==="/trainer-auth/admin/users"&&method==="GET"){
      await identity(req,{administrator:true});
      const users=await store.listTrainerUsers();
      send(res,200,{users:users.map(u=>({uid:u.uid,email:u.email,
        status:u.status,requestedAt:u.requestedAt,approvedAt:u.approvedAt}))
        .sort((a,b)=>String(b.requestedAt).localeCompare(String(a.requestedAt)))});
      return true;
    }
    const manage=/^\/trainer-auth\/admin\/users\/([A-Za-z0-9_-]{1,128})$/.exec(path);
    if(manage&&method==="POST"){
      const admin=await identity(req,{administrator:true});
      const target=manage[1],body=await bodyJson(req);
      if(body?.status!=="approved"&&body?.status!=="suspended")
        throwError(400,"INVALID_STATUS","Nur Freigeben oder Sperren ist erlaubt.");
      if(target===admin.uid&&body.status==="suspended")
        throwError(409,"SELF_SUSPEND","Das eigene Administratorkonto kann nicht gesperrt werden.");
      const current=await store.readTrainerUser(target);
      if(!current.metadata)throwError(404,"NOT_FOUND","Trainerantrag nicht gefunden.");
      const stamp=now().toISOString();
      const next={...current.metadata,status:body.status,updatedAt:stamp,
        approvedAt:body.status==="approved"?stamp:null,
        approvedBy:body.status==="approved"?admin.uid:null};
      await store.updateTrainerUser(target,next,current.generation);
      send(res,200,{uid:target,status:next.status});return true;
    }
    if(path==="/trainer-auth/spaces"&&method==="GET"){
      const user=await identity(req,{approved:true});
      const ids=await store.listTrainerSpaceLinks(user.uid);
      const spaces=[];
      for(const id of ids.slice(0,20)){
        const {metadata}=await store.readSpace(id);
        if(metadata?.authMode==="firebase"&&metadata.ownerUid===user.uid)
          spaces.push({spaceId:id,name:metadata.name,revision:metadata.revision,
            seasonCount:Object.keys(metadata.seasons||{}).length});
      }
      send(res,200,{spaces});return true;
    }
    if(path==="/trainer-auth/spaces"&&method==="POST"){
      const user=await identity(req,{approved:true});
      const ids=await store.listTrainerSpaceLinks(user.uid);
      if(ids.length>=5)throwError(409,"SPACE_LIMIT","Pro Trainer sind höchstens fünf Team Spaces möglich.");
      const body=await bodyJson(req),name=clean(body?.name);
      if(!name||name.length>200)
        throwError(400,"INVALID_NAME","Teamname fehlt oder ist zu lang.");
      const spaceId=idFactory(),stamp=now().toISOString(),readToken=readTokenFactory();
      // No raw trainer key is issued to registered trainers. A deliberately
      // unreachable hash makes accidental legacy-admin write access impossible.
      const meta={id:spaceId,name,ownerUid:user.uid,authMode:"firebase",
        trainerHash:hash(trainerTokenFactory()),readerHash:hash(readToken),
        authVersion:3,createdAt:stamp,updatedAt:stamp,revision:0,seasons:{},games:{}};
      await store.createSpace(spaceId,meta);
      await store.createTrainerSpaceLink(user.uid,spaceId);
      send(res,201,{spaceId,name,readToken,revision:0});return true;
    }
    const createSeason=/^\/trainer-auth\/spaces\/([^/]+)\/seasons$/.exec(path);
    if(createSeason&&method==="POST"){
      const spaceId=createSeason[1];
      const {space,generation}=await owner(req,spaceId);
      const body=await bodyJson(req),name=clean(body?.name);
      if(!name||name.length>200)
        throwError(400,"INVALID_NAME","Saisonname fehlt oder ist zu lang.");
      if(Object.keys(space.seasons||{}).length>=20)
        throwError(409,"SEASON_LIMIT","Team Space enthält bereits 20 Saisons.");
      if(!Number.isInteger(body.expectedRevision)||body.expectedRevision!==space.revision)
        throwError(409,"REVISION_CONFLICT","Team Space wurde geändert. Bitte Stand aktualisieren.");
      const seasonId=idFactory(),stamp=now().toISOString();
      const next=structuredClone(space);
      next.seasons[seasonId]={id:seasonId,name,gameIds:[],revision:1,
        preferredTeam:clean(body.preferredTeam).slice(0,200),
        archiveTeam:clean(body.archiveTeam).slice(0,200),
        playerAliases:{},lastEditedGameId:"",createdAt:stamp,publishedAt:stamp};
      next.revision++;next.updatedAt=stamp;
      await store.updateSpace(spaceId,next,generation);
      send(res,201,{spaceId,seasonId,name,revision:next.revision,itemRevision:1,gameCount:0});
      return true;
    }
    const catalog=/^\/trainer-auth\/spaces\/([^/]+)\/catalog$/.exec(path);
    if(catalog&&method==="GET"){
      const {space}=await owner(req,catalog[1]);
      // Account-authenticated catalog is intentionally missing reader credentials.
      const {publicTeamCatalog}=await import("./team-space-api.js");
      send(res,200,publicTeamCatalog(space));return true;
    }
    if(path.startsWith("/trainer-auth/"))
      throwError(404,"NOT_FOUND","Trainer-Endpunkt nicht gefunden.");
    return false;
  }
  return {enabled,handle,identity,owner};
}
