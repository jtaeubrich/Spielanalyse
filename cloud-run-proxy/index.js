import express from "express";
import { createHash, timingSafeEqual } from "node:crypto";

const BASE_URL = "https://www.handball.net";
const TIMEOUT_MS = 30_000;
const PORT = Number(process.env.PORT || 8080);

class ApiError extends Error {
  constructor(status, code, message, details = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function jsonResponse(res, data, status = 200, extraHeaders = {}) {
  res.status(status);
  res.set({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...extraHeaders,
  });
  return res.send(JSON.stringify(data));
}

function configuredOrigins() {
  const configuration = process.env.ALLOWED_ORIGINS || "";
  const origins = configuration.split(",").map((value) => value.trim()).filter(Boolean);

  for (const allowedOrigin of origins) {
    let url;
    try {
      url = new URL(allowedOrigin);
    } catch {
      throw new ApiError(
        500,
        "CONFIGURATION_ERROR",
        "ALLOWED_ORIGINS enthaelt eine ungueltige Origin.",
      );
    }

    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.origin !== allowedOrigin
    ) {
      throw new ApiError(
        500,
        "CONFIGURATION_ERROR",
        "ALLOWED_ORIGINS darf nur exakte HTTP(S)-Origins ohne Pfad enthalten; * und null sind nicht erlaubt.",
      );
    }
  }

  return origins;
}

function corsHeaders(req) {
  const headers = {
    Vary: req.method === "OPTIONS"
      ? "Origin, Access-Control-Request-Method, Access-Control-Request-Headers"
      : "Origin",
  };

  const origin = req.get("Origin");
  if (!origin) return headers;

  if (!configuredOrigins().includes(origin)) {
    throw new ApiError(
      403,
      "CORS_ORIGIN_DENIED",
      "Die Frontend-Origin ist nicht in ALLOWED_ORIGINS freigegeben.",
    );
  }

  return { ...headers, "Access-Control-Allow-Origin": origin };
}

function normalizeMatchId(value) {
  const candidate = String(value ?? "").trim();
  if (!/^[0-9]+$/.test(candidate)) {
    throw new ApiError(
      400,
      "INVALID_MATCH_REFERENCE",
      "Erwartet wird ausschliesslich eine numerische Match-ID.",
    );
  }
  return candidate;
}

function getMatchId(req) {
  if (req.path === "/") {
    const values = Array.isArray(req.query.match) ? req.query.match : [req.query.match];
    const references = values.filter((value) => value !== undefined);
    if (references.length !== 1 || !String(references[0]).trim()) {
      throw new ApiError(
        400,
        "INVALID_MATCH_REFERENCE",
        "Genau einen Parameter match mit einer numerischen Match-ID angeben.",
      );
    }
    return normalizeMatchId(references[0]);
  }

  const route = /^\/match\/([^/]+)\/?$/.exec(req.path);
  if (!route) {
    throw new ApiError(
      404,
      "NOT_FOUND",
      "Verfuegbar sind /match/<ID> und /?match=<ID> mit numerischer Match-ID.",
    );
  }

  let reference;
  try {
    reference = decodeURIComponent(route[1]);
  } catch {
    throw new ApiError(400, "INVALID_MATCH_REFERENCE", "Ungueltige URL-Kodierung.");
  }
  return normalizeMatchId(reference);
}

function tokensMatch(provided, expected) {
  const left = createHash("sha256").update(provided).digest();
  const right = createHash("sha256").update(expected).digest();
  return timingSafeEqual(left, right);
}

function requireAuthorization(req) {
  const expected = process.env.API_TOKEN;
  if (typeof expected !== "string" || !expected.trim()) {
    throw new ApiError(
      500,
      "CONFIGURATION_ERROR",
      "API_TOKEN ist nicht konfiguriert.",
    );
  }

  const authorization = req.get("Authorization") || "";
  const bearer = /^Bearer +(\S+)$/i.exec(authorization);
  if (!bearer || !tokensMatch(bearer[1], expected)) {
    throw new ApiError(
      401,
      "UNAUTHORIZED",
      "Gueltiger Bearer-Token erforderlich.",
    );
  }
}

async function getJson(path, headers, signal, optional = false) {
  const details = { endpoint: path };

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      headers,
      signal,
      redirect: "manual",
    });

    if (optional && response.status === 404) {
      await response.body?.cancel();
      return { data: [] };
    }

    if (!response.ok) {
      await response.body?.cancel();
      throw new ApiError(
        502,
        "UPSTREAM_HTTP_ERROR",
        `handball.net meldet HTTP ${response.status}.`,
        { ...details, upstream_status: response.status },
      );
    }

    let document;
    try {
      document = await response.json();
    } catch (error) {
      if (signal.aborted) throw error;
      if (!(error instanceof SyntaxError)) throw error;
      throw new ApiError(
        502,
        "UPSTREAM_INVALID_JSON",
        "Die Antwort von handball.net ist kein gueltiges JSON.",
        details,
      );
    }

    if (document === null || typeof document !== "object" || Array.isArray(document)) {
      throw new ApiError(
        502,
        "UPSTREAM_INVALID_JSON",
        "Die Antwort von handball.net ist kein JSON-Objekt.",
        details,
      );
    }

    return document;
  } catch (error) {
    if (error instanceof ApiError) throw error;

    if (signal.aborted) {
      throw new ApiError(
        504,
        "UPSTREAM_TIMEOUT",
        "Der Abruf von handball.net hat das Zeitlimit von 30 Sekunden ueberschritten.",
        details,
      );
    }

    console.error({
      message: "Handball360 Proxy: Upstream-Abruf fehlgeschlagen.",
      endpoint: path,
      error_name: error instanceof Error ? error.name : typeof error,
      error_message: error instanceof Error ? error.message : String(error),
      error_stack: error instanceof Error ? error.stack : undefined,
    });

    throw new ApiError(
      502,
      "UPSTREAM_NETWORK_ERROR",
      "Die Verbindung zu handball.net ist fehlgeschlagen.",
      details,
    );
  }
}

async function fetchMatchDocuments(matchId) {
  const matchUrl = `${BASE_URL}/match/${matchId}`;
  const headers = {
    Accept: "application/json",
    Referer: matchUrl,
    "User-Agent": "AutoNaming/2.0",
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const [match, events, lineups, additionalInfo] = await Promise.all([
      getJson(`/api/new/matches?match_id=${matchId}`, headers, controller.signal),
      getJson(`/api/new/matches/${matchId}/events`, headers, controller.signal),
      getJson(`/api/new/matches/${matchId}/lineups`, headers, controller.signal),
      getJson(
        `/api/new/matches/${matchId}/additional-info`,
        headers,
        controller.signal,
        true,
      ),
    ]);

    return {
      match_id: matchId,
      match_url: matchUrl,
      match,
      events,
      lineups,
      additional_info: additionalInfo,
    };
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
}

const app = express();
app.disable("x-powered-by");

app.use((req, res, next) => {
  try {
    const headers = corsHeaders(req);
    res.set(headers);

    if (req.method !== "OPTIONS") return next();

    if (!req.get("Origin") || !req.get("Access-Control-Request-Method")) {
      throw new ApiError(
        400,
        "INVALID_PREFLIGHT",
        "Ein Preflight benoetigt Origin und Access-Control-Request-Method.",
      );
    }

    if (req.get("Access-Control-Request-Method") !== "GET") {
      return jsonResponse(
        res,
        { error: { code: "METHOD_NOT_ALLOWED", message: "Nur GET wird unterstuetzt." } },
        405,
        { Allow: "GET, OPTIONS" },
      );
    }

    const requestedHeaders = req.get("Access-Control-Request-Headers");
    if (
      requestedHeaders &&
      requestedHeaders.split(",").some(
        (header) => header.trim().toLowerCase() !== "authorization",
      )
    ) {
      throw new ApiError(
        403,
        "CORS_HEADERS_DENIED",
        "Als zusaetzlicher Request-Header ist nur Authorization erlaubt.",
      );
    }

    getMatchId(req);

    return res
      .status(204)
      .set({
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization",
        "Access-Control-Max-Age": "86400",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      })
      .end();
  } catch (error) {
    return handleError(req, res, error);
  }
});

app.get(["/", "/match/:id"], async (req, res) => {
  try {
    requireAuthorization(req);
    const matchId = req.params.id
      ? normalizeMatchId(req.params.id)
      : getMatchId(req);

    return jsonResponse(res, await fetchMatchDocuments(matchId));
  } catch (error) {
    return handleError(req, res, error);
  }
});

app.use((req, res) => {
  try {
    const headers = corsHeaders(req);
    return jsonResponse(
      res,
      { error: { code: "METHOD_NOT_ALLOWED", message: "Nur GET wird unterstuetzt." } },
      405,
      { ...headers, Allow: "GET, OPTIONS" },
    );
  } catch (error) {
    return handleError(req, res, error);
  }
});

function handleError(req, res, error) {
  let headers = {};
  try {
    headers = corsHeaders(req);
  } catch {
    headers = { Vary: "Origin" };
  }

  if (error instanceof ApiError) {
    const body = {
      error: {
        code: error.code,
        message: error.message,
        ...error.details,
      },
    };

    if (error.status >= 500) {
      console.error("Handball360 Proxy:", body.error);
    }

    if (error.status === 401) {
      headers["WWW-Authenticate"] = "Bearer";
    }

    return jsonResponse(res, body, error.status, headers);
  }

  console.error("Handball360 Proxy: Unerwarteter interner Fehler.", error);
  return jsonResponse(
    res,
    { error: { code: "INTERNAL_ERROR", message: "Interner Proxy-Fehler." } },
    500,
    headers,
  );
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Handball360 Cloud Run proxy listening on port ${PORT}`);
});
