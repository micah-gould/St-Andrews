export function getNextPath(search: string | URLSearchParams) {
  const params =
    typeof search === "string" ? new URLSearchParams(search) : search;
  const next = params.get("next");

  if (!next || !next.startsWith("/")) {
    return "/";
  }

  if (next.startsWith("//")) {
    return "/";
  }

  return next;
}
