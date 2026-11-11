import {createServer} from "node:http";
import {createSeasonSyncHandler} from "./api.js";
import {createGcsSeasonStore} from "./storage.js";
const port=Number(process.env.PORT||8080);
const origins=(process.env.ALLOWED_ORIGINS||"").split(",").map(x=>x.trim()).filter(Boolean);
const handler=createSeasonSyncHandler({
  store:createGcsSeasonStore({bucketName:process.env.SEASON_SYNC_BUCKET}),
  adminToken:process.env.TRAINER_PUBLISH_TOKEN,
  allowedOrigins:origins
});
createServer(handler).listen(port,"0.0.0.0",()=>console.log("Season-sync listening on",port));
