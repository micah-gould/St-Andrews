import type { VercelRequest, VercelResponse } from "@vercel/node";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
]);

function normalizeBaseUrl(value: string | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, "");
}

function joinPath(pathParam: string | string[] | undefined) {
  if (!pathParam) return "";
  const pathParts = Array.isArray(pathParam) ? pathParam : [pathParam];
  if (pathParts.length === 0) return "";
  return pathParts
    .map((part) => encodeURIComponent(part))
    .join("/")
    .replace(/%2F/g, "/");
}

function buildQueryString(query: VercelRequest["query"]) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (key === "path") continue;
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, item));
    } else if (typeof value === "string") {
      params.append(key, value);
    }
  }
  const out = params.toString();
  return out ? `?${out}` : "";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const apiBase = normalizeBaseUrl(process.env.API_ORIGIN);
  if (!apiBase) {
    res.status(500).json({
      error: "API proxy is not configured. Set API_ORIGIN in Vercel.",
    });
    return;
  }

  const pathPart = joinPath(req.query.path as string | string[] | undefined);
  const query = buildQueryString(req.query);
  const targetUrl = `${apiBase}/api/saved-states/${pathPart}${query}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (!value || HOP_BY_HOP_HEADERS.has(key.toLowerCase())) continue;
    if (Array.isArray(value)) {
      value.forEach((item) => headers.append(key, item));
    } else {
      headers.set(key, value);
    }
  }

  const method = req.method || "GET";
  const canHaveBody = !["GET", "HEAD"].includes(method.toUpperCase());
  const init: RequestInit = {
    method,
    headers,
    redirect: "manual",
  };

  if (canHaveBody && req.body !== undefined) {
    if (Buffer.isBuffer(req.body)) {
      init.body = req.body;
    } else if (typeof req.body === "string") {
      init.body = req.body;
    } else {
      const contentType = String(req.headers["content-type"] || "");
      if (contentType.includes("application/json")) {
        init.body = JSON.stringify(req.body);
      }
    }
  }

  const upstream = await fetch(targetUrl, init);

  upstream.headers.forEach((value, key) => {
    if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) return;
    if (key.toLowerCase() === "content-encoding") return;
    res.setHeader(key, value);
  });

  res.status(upstream.status);
  const buffer = Buffer.from(await upstream.arrayBuffer());
  res.send(buffer);
}
