import { test } from "node:test";
import assert from "node:assert/strict";
import { extractClientToken, fetchClientToken } from "./client-token.js";

test("reads client-token from meta regardless of attribute order or quotes", () => {
  assert.equal(extractClientToken('<meta name="client-token" content="abc-123.DEF">'), "abc-123.DEF");
  assert.equal(extractClientToken("<meta content='other_789' name='client-token' />"), "other_789");
  assert.equal(extractClientToken('<meta property="client-token" content="xyz">'), "xyz");
});

test("reads client-token from embedded JSON and escaped JSON", () => {
  assert.equal(extractClientToken('<script>{"client-token":"json.456"}</script>'), "json.456");
  assert.equal(extractClientToken('<script>\\"client-token\\":\\"escaped.456\\"</script>'), "escaped.456");
});

test("does not accept missing or malformed token", () => {
  assert.equal(extractClientToken("<h1>No token</h1>"), null);
  assert.equal(extractClientToken('<meta name="client-token" content="bad token">'), null);
});

test("loads page before API request; extracts header/meta token", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({url, options});
    return new Response('<html><meta name="client-token" content="token-1"></html>', {
      status:200, headers:{"Content-Type":"text/html"}
    });
  };
  const token = await fetchClientToken("https://www.handball.net/match/378112", { fetchImpl });
  assert.equal(token, "token-1");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://www.handball.net/match/378112");
  assert.equal(calls[0].options.redirect, "manual");
  const headerToken = await fetchClientToken("https://www.handball.net/team/85814", {
    fetchImpl: async () => new Response("", {status:200,headers:{"client-token":"response-header-token"}}),
  });
  assert.equal(headerToken, "response-header-token");
});

test("reports upstream 403 and absent token explicitly", async () => {
  await assert.rejects(
    fetchClientToken("https://www.handball.net/match/378112", {
      fetchImpl: async () => new Response("Forbidden", {status:403}),
    }),
    { code: "CLIENT_TOKEN_PAGE_HTTP_ERROR", upstreamStatus: 403 },
  );
  await assert.rejects(
    fetchClientToken("https://www.handball.net/match/378112", {
      fetchImpl: async () => new Response("<h1>No token</h1>", {status:200}),
    }),
    { code: "CLIENT_TOKEN_MISSING" },
  );
});

test("rejects oversized HTML without returning a token", async () => {
  await assert.rejects(
    fetchClientToken("https://www.handball.net/match/378112", {
      fetchImpl: async () => new Response("x", {status:200,headers:{"content-length":String(3*1024*1024)}}),
    }),
    { code: "CLIENT_TOKEN_PAGE_TOO_LARGE" },
  );
});
