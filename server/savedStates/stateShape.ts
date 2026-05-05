// Validation / normalization for the multi-catalog, multi-year saved state
// blob. Shape:
//   {
//     version: 2,
//     catalogs: {
//       [catalogId: string]: {
//         [year: string]: {
//           selected: string[],
//           passed:   string[],
//           excluded: string[],
//           hiddenLevels: string[]
//         }
//       }
//     }
//   }

/** @typedef {"private" | "link" | "public"} SavedStateVisibility */

const ID_RE = /^[A-Za-z0-9._-]{1,40}$/;
const CATALOG_ID_RE = /^[a-z0-9-]{1,60}$/i;
const YEAR_RE = /^\d{4}-\d{2}$/;
const VISIBILITY_VALUES = new Set(["private", "link", "public"]);

function normalizeVisibility(value) {
  return VISIBILITY_VALUES.has(value) ? value : "private";
}

function sanitizeIdArray(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of list) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed || !ID_RE.test(trimmed)) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
    if (out.length >= 500) break;
  }
  return out;
}

function sanitizeYearSlice(slice) {
  if (!slice || typeof slice !== "object") return null;
  const out = {
    selected: sanitizeIdArray(slice.selected),
    passed: sanitizeIdArray(slice.passed),
    excluded: sanitizeIdArray(slice.excluded),
    hiddenLevels: sanitizeIdArray(slice.hiddenLevels),
  };
  if (
    !out.selected.length &&
    !out.passed.length &&
    !out.excluded.length &&
    !out.hiddenLevels.length
  ) {
    return null;
  }
  return out;
}

export function normalizeSavedState(state) {
  const result = {
    version: 2,
    visibility: "private" as "private" | "link" | "public",
    catalogs: {},
  };
  if (!state || typeof state !== "object") return result;

  result.visibility = normalizeVisibility(state.visibility) as
    | "private"
    | "link"
    | "public";

  // v2 shape
  if (state.catalogs && typeof state.catalogs === "object") {
    for (const [catalogId, years] of Object.entries(state.catalogs)) {
      if (!CATALOG_ID_RE.test(catalogId) || !years || typeof years !== "object")
        continue;
      const yearMap = {};
      for (const [year, slice] of Object.entries(years)) {
        if (!YEAR_RE.test(year)) continue;
        const cleaned = sanitizeYearSlice(slice);
        if (cleaned) yearMap[year] = cleaned;
      }
      if (Object.keys(yearMap).length) {
        result.catalogs[catalogId] = yearMap;
      }
    }
    return result;
  }

  // v1 shape (single-catalog/year) — upgrade in place
  if (state.catalogId && CATALOG_ID_RE.test(state.catalogId)) {
    const year =
      typeof state.year === "string" && YEAR_RE.test(state.year)
        ? state.year
        : null;
    const slice = sanitizeYearSlice(state);
    if (slice && year) {
      result.catalogs[state.catalogId] = { [year]: slice };
    }
  }
  return result;
}

// Merge a new single-catalog+year slice into the existing saved blob.
// Empty slices (no selections at all) remove that year entry.
export function mergeSlice(existing, { catalogId, year, slice }) {
  const base = normalizeSavedState(existing);
  if (!CATALOG_ID_RE.test(catalogId || "") || !YEAR_RE.test(year || "")) {
    return base;
  }

  const cleanedSlice = sanitizeYearSlice(slice);
  const years = { ...(base.catalogs[catalogId] || {}) };
  if (cleanedSlice) {
    years[year] = cleanedSlice;
  } else {
    delete years[year];
  }

  const next = { ...base, catalogs: { ...base.catalogs } };
  if (Object.keys(years).length) {
    next.catalogs[catalogId] = years;
  } else {
    delete next.catalogs[catalogId];
  }
  return next;
}

export function countSelectionsIn(state) {
  const parsed = normalizeSavedState(state);
  let selected = 0;
  let excluded = 0;
  let catalogs = 0;
  for (const years of Object.values(parsed.catalogs)) {
    catalogs += 1;
    for (const slice of Object.values(years)) {
      selected += slice.selected.length;
      excluded += slice.excluded.length;
    }
  }
  return { selected, excluded, catalogs };
}
