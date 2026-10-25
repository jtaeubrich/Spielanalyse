import {test} from "node:test";
import assert from "node:assert/strict";
import {validateNuLigaUrl,fetchNuLigaHtml} from "./nuliga-fetch.js";

const base="https://hvnb-handball.liga.nu/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/";
test("accepts only exact public HVNB nuLiga HTML endpoints",()=>{
  const good=base+"teamPortrait?teamtable=2220643&championship=HVNB+26%2F27&group=489136";
  assert.equal(validateNuLigaUrl(good),good);
  for(const x of [
    "http://hvnb-handball.liga.nu"+new URL(good).pathname,
    "https://evil.example/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/groupPage",
    "https://hvnb-handball.liga.nu.evil.example"+new URL(good).pathname,
    "https://user:password@hvnb-handball.liga.nu"+new URL(good).pathname,
    base+"../nuLigaAdmin",base+"admin",base+"groupPage#x"
  ])assert.throws(()=>validateNuLigaUrl(x));
});
test("retrieves exactly one upstream HTML document without following redirects",async()=>{
  const url=base+"groupPage?group=489136";
  const html="<html><body>HC Bremen</body></html>";
  let calls=0;
  const result=await fetchNuLigaHtml(url,{fetchImpl:async (given,options)=>{
    calls++;assert.equal(given,url);assert.equal(options.redirect,"error");
    assert.equal(options.headers.Accept,"text/html,application/xhtml+xml");
    return new Response(html,{headers:{"Content-Type":"text/html; charset=utf-8"}});
  }});
  assert.equal(calls,1);
  assert.equal(result.html,html);
  assert.equal(result.url,url);
});
test("decodes Windows-1252 nuLiga HTML and enforces response limits",async()=>{
  const url=base+"groupMeetingReport?meeting=8279246";
  const raw=Buffer.from([0x3c,0x70,0x3e,0x4d,0xe4,0x6e,0x6e,0x65,0x72,0x3c,0x2f,0x70,0x3e]);
  const result=await fetchNuLigaHtml(url,{fetchImpl:async()=>new Response(raw,{
    headers:{"Content-Type":"text/html; charset=windows-1252"}
  })});
  assert.match(result.html,/Männer/);
  await assert.rejects(
    fetchNuLigaHtml(url,{fetchImpl:async()=>new Response("hello",{headers:{"Content-Type":"application/json"}})}),
    /keine HTML-Seite/
  );
  await assert.rejects(fetchNuLigaHtml(url,{maxBytes:5,fetchImpl:async()=>new Response(raw)}),/Limit/);
});
