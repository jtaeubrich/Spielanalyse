// Optional Firebase email/password login for the Team Space trainer registry.
// No Firebase password or Firebase ID token is written into season/game exports.
import {seasonCloudEndpoint,validSeasonCloudId} from "./season-sync-client.js";

const AUTH_API="https://identitytoolkit.googleapis.com/v1/accounts:";
const REFRESH_API="https://securetoken.googleapis.com/v1/token";
const SESSION_KEY="handballSpielanalyse.trainerAuthRefresh";
const ERRORS={
  EMAIL_EXISTS:"Diese E-Mail-Adresse ist bereits registriert.",
  EMAIL_NOT_FOUND:"E-Mail-Adresse oder Passwort ist nicht korrekt.",
  INVALID_PASSWORD:"E-Mail-Adresse oder Passwort ist nicht korrekt.",
  INVALID_LOGIN_CREDENTIALS:"E-Mail-Adresse oder Passwort ist nicht korrekt.",
  INVALID_EMAIL:"Bitte eine gültige E-Mail-Adresse eingeben.",
  WEAK_PASSWORD:"Das Passwort ist zu schwach. Mindestens sechs Zeichen verwenden.",
  TOO_MANY_ATTEMPTS_TRY_LATER:"Zu viele Anmeldeversuche. Bitte später erneut versuchen.",
  USER_DISABLED:"Dieses Konto wurde deaktiviert.",
  EMAIL_NOT_VERIFIED:"Bitte die E-Mail-Bestätigung öffnen und anschließend erneut prüfen.",
  INVALID_REFRESH_TOKEN:"Die Anmeldung ist abgelaufen. Bitte erneut anmelden."
};
export function trainerAuthError(code){
  const key=String(code||"").split(" : ")[0].trim();
  return ERRORS[key]||"Anmeldung fehlgeschlagen: "+key;
}
export function createTrainerAuthClient(api,{fetcher=fetch,session=sessionStorage}={}){
  const endpoint=seasonCloudEndpoint(api),sessionKey=SESSION_KEY+":"+endpoint;
  let config=null,idToken="",refreshToken=session.getItem(sessionKey)||"",expiry=0;
  async function jsonFetch(url,body,{bearer}={}){
    const result=await fetcher(url,{method:"POST",cache:"no-store",redirect:"error",
      headers:{"Content-Type":"application/json",Accept:"application/json",
        ...(bearer?{Authorization:"Bearer "+bearer}:{})},
      body:JSON.stringify(body)});
    const data=await result.json().catch(()=>({}));
    if(!result.ok){
      const code=data.error?.message||data.error?.code||"HTTP "+result.status;
      const error=new Error(url.startsWith(AUTH_API)||url.startsWith(REFRESH_API)
        ?trainerAuthError(code):(data.error?.message||"HTTP "+result.status));
      error.code=data.error?.code||code;error.status=result.status;
      throw error;
    }
    return data;
  }
  async function getConfig(){
    if(config)return config;
    const result=await fetcher(endpoint+"/trainer-auth/config",{
      method:"GET",cache:"no-store",redirect:"error"});
    if(!result.ok)throw Error("Der Cloud-Dienst unterstützt die Trainerregistrierung noch nicht.");
    const data=await result.json();
    if(!data?.enabled){config={enabled:false};return config;}
    if(!/^[A-Za-z0-9_-]{10,200}$/.test(String(data.apiKey||""))||
      !/^[a-z0-9-]{4,100}$/.test(String(data.projectId||"")))
      throw Error("Die Firebase-Konfiguration des Dienstes ist ungültig.");
    config={enabled:true,apiKey:data.apiKey,projectId:data.projectId};
    return config;
  }
  async function requireConfig(){
    const c=await getConfig();
    if(!c.enabled)throw Error("Die Traineranmeldung ist noch nicht konfiguriert.");
    return c;
  }
  async function firebaseAction(operation,data){
    const c=await requireConfig();
    return jsonFetch(AUTH_API+operation+"?key="+encodeURIComponent(c.apiKey),data);
  }
  function storeSession(data){
    if(!data.idToken||!data.refreshToken)throw Error("Firebase-Anmeldung unvollständig.");
    idToken=data.idToken;refreshToken=data.refreshToken;
    expiry=Date.now()+Math.max(30,Number(data.expiresIn||3600))*1000;
    session.setItem(sessionKey,refreshToken);
  }
  async function refresh(force=false){
    const c=await requireConfig();
    if(!force&&idToken&&Date.now()<expiry-60000)return idToken;
    if(!refreshToken)throw Error("Bitte anmelden.");
    const result=await fetcher(REFRESH_API+"?key="+encodeURIComponent(c.apiKey),{
      method:"POST",cache:"no-store",redirect:"error",
      headers:{"Content-Type":"application/x-www-form-urlencoded"},
      body:new URLSearchParams({grant_type:"refresh_token",refresh_token:refreshToken}).toString()});
    const data=await result.json().catch(()=>({}));
    if(!result.ok){
      idToken="";refreshToken="";expiry=0;session.removeItem(sessionKey);
      throw Error(trainerAuthError(data?.error?.message||"INVALID_REFRESH_TOKEN"));
    }
    storeSession({idToken:data.id_token,refreshToken:data.refresh_token,
      expiresIn:data.expires_in});
    return idToken;
  }
  async function signup(email,password){
    const data=await firebaseAction("signUp",{email,password,returnSecureToken:true});
    storeSession(data);
    await requestVerification();
    return data;
  }
  async function login(email,password){
    const data=await firebaseAction("signInWithPassword",{email,password,returnSecureToken:true});
    storeSession(data);
    return data;
  }
  function logout(){idToken="";refreshToken="";expiry=0;session.removeItem(sessionKey)}
  async function requestVerification(){
    return firebaseAction("sendOobCode",{requestType:"VERIFY_EMAIL",idToken:await refresh()});
  }
  async function resetPassword(email){
    return firebaseAction("sendOobCode",{requestType:"PASSWORD_RESET",email});
  }
  async function call(path,{method="GET",data,retry=true}={}){
    const jwt=await refresh();
    const response=await fetcher(endpoint+"/trainer-auth"+path,{
      method,cache:"no-store",redirect:"error",
      headers:{Authorization:"Bearer "+jwt,Accept:"application/json",
        ...(data!==undefined?{"Content-Type":"application/json"}:{})},
      ...(data!==undefined?{body:JSON.stringify(data)}:{})});
    if(response.status===401&&retry){
      await refresh(true);
      return call(path,{method,data,retry:false});
    }
    const json=await response.json().catch(()=>({}));
    if(!response.ok){
      const error=new Error(json.error?.message||"Trainer-API HTTP "+response.status);
      error.status=response.status;error.code=json.error?.code;throw error;
    }
    return json;
  }
  async function me(){return call("/me")}
  async function register(){return call("/register",{method:"POST",data:{}})}
  async function listSpaces(){return call("/spaces")}
  async function createSpace(name){return call("/spaces",{method:"POST",data:{name}})}
  async function createSeason(spaceId,name,expectedRevision){
    if(!validSeasonCloudId(spaceId))throw Error("Team-Space-ID ungültig.");
    return call("/spaces/"+spaceId+"/seasons",{
      method:"POST",data:{name,expectedRevision}});
  }
  async function catalog(spaceId){
    if(!validSeasonCloudId(spaceId))throw Error("Team-Space-ID ungültig.");
    return call("/spaces/"+spaceId+"/catalog");
  }
  async function listUsers(){return call("/admin/users")}
  async function setApproval(uid,status){
    if(!/^[A-Za-z0-9_-]{1,128}$/.test(String(uid||"")))
      throw Error("Ungültige Benutzerkennung.");
    if(!["approved","suspended"].includes(status))
      throw Error("Ungültiger Freigabestatus.");
    return call("/admin/users/"+uid,{method:"POST",data:{status}});
  }
  return {getConfig,signup,login,logout,requestVerification,resetPassword,
    refresh,me,register,listSpaces,createSpace,createSeason,catalog,
    listUsers,setApproval,hasSession:()=>Boolean(refreshToken),api:endpoint};
}
