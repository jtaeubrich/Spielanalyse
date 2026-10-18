import test from 'node:test';
import assert from 'node:assert/strict';
import {endpoints,summarize,probe} from './probe.mjs';
test('rejects nonnumeric IDs',()=>assert.throws(()=>endpoints('../../credentials')));
test('builds documented 2014 endpoints',()=>{
 const urls=endpoints('8279189');
 assert.equal(urls.events,'https://hbde-portal.liga.nu/rs/2014/meetings/8279189/meetingEvents');
 assert.equal(urls.players,'https://hbde-portal.liga.nu/rs/2014/meetings/8279189/players');
});
test('reports JSON keys and array sizes without copying person records',()=>{
 assert.deepEqual(summarize({meetingEvents:[{personName:'Sensitive'}]}).arrayLengths,{meetingEvents:1});
});
test('does not label API discovery as a completed import',async()=>{
 const fake=async()=>({ok:true,status:200,headers:{get:()=> 'application/json'},json:async()=>({items:[]})});
 const data=await probe('8279189',{fetchImpl:fake});
 assert.equal(data.importReady,false);
 assert.equal(data.resources.events.schema.arrayLengths.items,0);
});
test('reports blocked access explicitly',async()=>{
 const fake=async()=>({ok:false,status:403,headers:{get:()=> 'text/html'}});
 const data=await probe('8279189',{fetchImpl:fake});
 assert.equal(data.resources.events.status,403);
 assert.equal(data.resources.events.ok,false);
});
