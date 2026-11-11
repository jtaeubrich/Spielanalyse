// Private Cloud Storage adapter; only this Cloud Run service has bucket IAM.
// Objects are immutable per publication. Mutable metadata uses generation CAS.
import {Storage} from "@google-cloud/storage";
export function createGcsSeasonStore({bucketName,storage=new Storage()}={}){
  if(!bucketName||!/^[a-z0-9][a-z0-9_.-]{2,222}$/i.test(bucketName))
    throw Error("SEASON_SYNC_BUCKET fehlt oder ist ungültig.");
  const bucket=storage.bucket(bucketName);
  const filename=id=>"seasons/"+id+"/metadata.json";
  return {
    async create(id,metadata){
      const file=bucket.file(filename(id));
      await file.save(Buffer.from(JSON.stringify(metadata),"utf8"),{
        resumable:false,contentType:"application/json",preconditionOpts:{ifGenerationMatch:0},
        metadata:{cacheControl:"private,no-store"}
      });
    },
    async read(id){
      const file=bucket.file(filename(id));
      try{
        // Read one immutable GCS generation to avoid pairing old metadata
        // with a newer generation during a concurrent trainer publication.
        const [details]=await file.getMetadata();
        const fixed=bucket.file(filename(id),{generation:details.generation});
        const [buffer]=await fixed.download();
        return {metadata:JSON.parse(buffer.toString("utf8")),generation:details.generation};
      }catch(error){
        if(error?.code===404)return {metadata:null,generation:null};
        throw error;
      }
    },
    async update(id,metadata,generation){
      if(!generation)throw Error("Cloud generation precondition missing");
      await bucket.file(filename(id)).save(Buffer.from(JSON.stringify(metadata),"utf8"),{
        resumable:false,contentType:"application/json",
        preconditionOpts:{ifGenerationMatch:Number(generation)},
        metadata:{cacheControl:"private,no-store"}
      });
    },
    async writeArchive(name,bytes){
      if(!/^seasons\/[0-9a-f-]{36}\/versions\/[0-9]+-[0-9a-f-]{36}\.json$/i.test(name))
        throw Error("Invalid archive path");
      await bucket.file(name).save(bytes,{
        resumable:false,contentType:"application/json",
        preconditionOpts:{ifGenerationMatch:0},
        metadata:{cacheControl:"private,no-store"}
      });
    },
    async readArchive(name){
      if(!/^seasons\/[0-9a-f-]{36}\/versions\/[0-9]+-[0-9a-f-]{36}\.json$/i.test(name))
        throw Error("Invalid archive path");
      const [bytes]=await bucket.file(name).download();
      return bytes;
    }
  };
}
