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

function buildQueryString(
  query: Record<string, string | string[] | undefined>,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, item));
    } else if (typeof value === "string") {
      params.append(key, value);
    }
  }
  const out = params.toString();
  return out ? `?${out}` : "";
}

export default async function handler(req: any, res: any) {
  const apiBase = normalizeBaseUrl(process.env.API_ORIGIN);
  if (!apiBase) {
    res.status(500).json({
      error: "API proxy is not configured. Set API_ORIGIN in Vercel.",
    });
    return;
  }

  const query = buildQueryString(req.query);
  const targetUrl = `${apiBase}/api/catalogs${query}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (!value || HOP_BY_HOP_HEADERS.has(key.toLowerCase())) continue;
    if (Array.isArray(value)) {
      value.forEach((item) => headers.append(key, item));
    } else {
      headers.set(key, String(value));
    }
  }

  const upstream = await fetch(targetUrl, {
    method: req.method || "GET",
    headers,
    redirect: "manual",
  });

  upstream.headers.forEach((value, key) => {
    if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) return;
    if (key.toLowerCase() === "content-encoding") return;
    res.setHeader(key, value);
  });

  res.status(upstream.status);
  const buffer = Buffer.from(await upstream.arrayBuffer());
  res.send(buffer);
}
