import {createServer} from "node:http";
import {createSeasonSyncHandler} from "./api.js";
import {createGcsSeasonStore} from "./storage.js";
import {createTrainerAccountRegistry} from "./trainer-accounts.js";
import {initializeApp,applicationDefault} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
const port=Number(process.env.PORT||8080);
const origins=(process.env.ALLOWED_ORIGINS||"").split(",").map(x=>x.trim()).filter(Boolean);
const store=createGcsSeasonStore({bucketName:process.env.SEASON_SYNC_BUCKET});
const projectId=String(process.env.FIREBASE_PROJECT_ID||"").trim();
const apiKey=String(process.env.FIREBASE_WEB_API_KEY||"").trim();
const admins=String(process.env.TRAINER_ADMIN_UIDS||"").split(",").map(x=>x.trim()).filter(Boolean);
// Firebase remains disabled until BOTH Firebase settings are configured.
const authApp=projectId&&apiKey?initializeApp({credential:applicationDefault(),projectId}):null;
const trainerAccounts=createTrainerAccountRegistry({
  store,projectId,webApiKey:apiKey,adminUids:admins,
  // The account registry enforces immediate suspension; offline JWT verification
  // avoids requiring Firebase Auth user-read IAM on the Cloud Run service account.
  verifyIdToken:authApp?token=>getAuth(authApp).verifyIdToken(token):null
});
const handler=createSeasonSyncHandler({
  store,adminToken:process.env.TRAINER_PUBLISH_TOKEN,
  allowedOrigins:origins,trainerAccounts
});
createServer(handler).listen(port,"0.0.0.0",()=>console.log("Season-sync listening on",port));
