// Obtain the public website's client token before requesting its internal JSON endpoints.
const MAX_HTML_BYTES = 2 * 1024 * 1024;

export class ClientTokenError extends Error {
  constructor(code, message, upstreamStatus = null) {
    super(message);
    this.name = "ClientTokenError";
    this.code = code;
    this.upstreamStatus = upstreamStatus;
  }
}

function validToken(value) {
  const candidate = String(value ?? "").trim();
  return /^[\x21-\x7e]{1,1024}$/.test(candidate) ? candidate : null;
}

function htmlAttribute(tag, name) {
  const pattern = new RegExp("(?:^|\\s)" + name + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s>]+))", "i");
  const match = pattern.exec(tag);
  return match ? (match[1] ?? match[2] ?? match[3] ?? "") : null;
}

export function extractClientToken(html) {
  const source = String(html ?? "");
  for (const tag of source.match(/<meta\b[^>]*>/gi) ?? []) {
    const name = htmlAttribute(tag, "name") ?? htmlAttribute(tag, "property");
    if (name?.toLowerCase() !== "client-token") continue;
    const token = validToken(htmlAttribute(tag, "content"));
    if (token) return token;
  }

  // Some frameworks embed server metadata as JSON or escaped JSON in the page.
  const jsonPatterns = [
    /["']client-token["']\s*:\s*["']([^"'\\\s<>]+)["']/i,
    /\\"client-token\\"\s*:\s*\\"([^"\\\s<>]+)\\"/i,
    /\bdata-client-token\s*=\s*["']([^"'<>]+)["']/i,
  ];
  for (const pattern of jsonPatterns) {
    const token = validToken(pattern.exec(source)?.[1]);
    if (token) return token;
  }
  return null;
}

export async function fetchClientToken(pageUrl, { signal, fetchImpl = fetch } = {}) {
  const response = await fetchImpl(pageUrl, {
    headers: { Accept: "text/html", "User-Agent": "Spielanalyse/1.0" },
    signal,
    redirect: "manual",
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new ClientTokenError(
      "CLIENT_TOKEN_PAGE_HTTP_ERROR",
      "handball.net Match-/Team-Seite meldet HTTP " + response.status + ".",
      response.status,
    );
  }

  const headerToken = validToken(response.headers.get("client-token"));
  if (headerToken) {
    await response.body?.cancel();
    return headerToken;
  }

  const contentLength = Number(response.headers.get("content-length"));
  if (contentLength > MAX_HTML_BYTES) {
    await response.body?.cancel();
    throw new ClientTokenError("CLIENT_TOKEN_PAGE_TOO_LARGE", "Die handball.net-Seite ist zu gross.");
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new ClientTokenError("CLIENT_TOKEN_MISSING", "Die handball.net-Seite enthaelt keinen client-token.");
  }
  const decoder = new TextDecoder();
  let html = "", byteCount = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteCount += value.byteLength;
      if (byteCount > MAX_HTML_BYTES) {
        await reader.cancel();
        throw new ClientTokenError("CLIENT_TOKEN_PAGE_TOO_LARGE", "Die handball.net-Seite ist zu gross.");
      }
      html += decoder.decode(value, { stream: true });
    }
    html += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  const token = extractClientToken(html);
  if (!token) {
    throw new ClientTokenError("CLIENT_TOKEN_MISSING", "Die handball.net-Seite enthaelt keinen client-token.");
  }
  return token;
}
