type LevelColor = "1000" | "2000" | "3000" | "4000" | "5000" | "ext";

type GraphColors = {
  lvl: Record<LevelColor, string>;
  sel: string;
  passed: string;
  excl: string;
  hoverPreRequired: string;
  hoverPreOptional: string;
  hoverCoreqRequired: string;
  hoverCoreqOptional: string;
  hoverFwd: string;
  selPreRequired: string;
  selPreOptional: string;
  selCoreqRequired: string;
  selCoreqOptional: string;
  selFwd: string;
  anti: string;
  edge: string;
  edgeOptional: string;
  edgeCoreq: string;
  edgeCoreqOptional: string;
};

export type LegendColorKey =
  | "lvl1000"
  | "lvl2000"
  | "lvl3000"
  | "lvl4000"
  | "lvl5000"
  | "lvlext"
  | "sel"
  | "passed"
  | "excl"
  | "hoverPreRequired"
  | "hoverPreOptional"
  | "hoverFwd"
  | "selFwd";

const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;
const LEGEND_COLORS_STORAGE_KEY = "moduleGraphLegendColors";

export const DEFAULT_COLORS: GraphColors = {
  lvl: {
    1000: "#1E88E5",
    2000: "#D81B60",
    3000: "#43A047",
    4000: "#FB8C00",
    5000: "#8E24AA",
    ext: "#546E7A",
  },
  sel: "#C0CA33",
  passed: "#00897B",
  excl: "#E53935",
  hoverPreRequired: "#FDD835",
  hoverPreOptional: "#6D4C41",
  hoverCoreqRequired: "#00ACC1",
  hoverCoreqOptional: "#3949AB",
  hoverFwd: "#5E35B1",
  selPreRequired: "#FFB300",
  selPreOptional: "#8D6E63",
  selCoreqRequired: "#039BE5",
  selCoreqOptional: "#283593",
  selFwd: "#7B1FA2",
  anti: "#F4511E",
  edge: "#455A64",
  edgeOptional: "#90A4AE",
  edgeCoreq: "#26A69A",
  edgeCoreqOptional: "#80CBC4",
};

export const COLORS: GraphColors = {
  lvl: { ...DEFAULT_COLORS.lvl },
  sel: DEFAULT_COLORS.sel,
  passed: DEFAULT_COLORS.passed,
  excl: DEFAULT_COLORS.excl,
  hoverPreRequired: DEFAULT_COLORS.hoverPreRequired,
  hoverPreOptional: DEFAULT_COLORS.hoverPreOptional,
  hoverCoreqRequired: DEFAULT_COLORS.hoverCoreqRequired,
  hoverCoreqOptional: DEFAULT_COLORS.hoverCoreqOptional,
  hoverFwd: DEFAULT_COLORS.hoverFwd,
  selPreRequired: DEFAULT_COLORS.selPreRequired,
  selPreOptional: DEFAULT_COLORS.selPreOptional,
  selCoreqRequired: DEFAULT_COLORS.selCoreqRequired,
  selCoreqOptional: DEFAULT_COLORS.selCoreqOptional,
  selFwd: DEFAULT_COLORS.selFwd,
  anti: DEFAULT_COLORS.anti,
  edge: DEFAULT_COLORS.edge,
  edgeOptional: DEFAULT_COLORS.edgeOptional,
  edgeCoreq: DEFAULT_COLORS.edgeCoreq,
  edgeCoreqOptional: DEFAULT_COLORS.edgeCoreqOptional,
};

const LEGEND_COLOR_GETTERS: Record<LegendColorKey, () => string> = {
  lvl1000: () => COLORS.lvl["1000"],
  lvl2000: () => COLORS.lvl["2000"],
  lvl3000: () => COLORS.lvl["3000"],
  lvl4000: () => COLORS.lvl["4000"],
  lvl5000: () => COLORS.lvl["5000"],
  lvlext: () => COLORS.lvl.ext,
  sel: () => COLORS.sel,
  passed: () => COLORS.passed,
  excl: () => COLORS.excl,
  hoverPreRequired: () => COLORS.hoverPreRequired,
  hoverPreOptional: () => COLORS.hoverPreOptional,
  hoverFwd: () => COLORS.hoverFwd,
  selFwd: () => COLORS.selFwd,
};

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_COLOR_RE.test(value);
}

export function getLegendColor(key: LegendColorKey): string {
  return LEGEND_COLOR_GETTERS[key]();
}

export function setLegendColor(key: LegendColorKey, nextColor: string) {
  if (!isHexColor(nextColor)) return;
  const color = nextColor.toUpperCase();
  if (key === "lvl1000") COLORS.lvl["1000"] = color;
  else if (key === "lvl2000") COLORS.lvl["2000"] = color;
  else if (key === "lvl3000") COLORS.lvl["3000"] = color;
  else if (key === "lvl4000") COLORS.lvl["4000"] = color;
  else if (key === "lvl5000") COLORS.lvl["5000"] = color;
  else if (key === "lvlext") COLORS.lvl.ext = color;
  else if (key === "sel") COLORS.sel = color;
  else if (key === "passed") COLORS.passed = color;
  else if (key === "excl") COLORS.excl = color;
  else if (key === "hoverPreRequired") COLORS.hoverPreRequired = color;
  else if (key === "hoverPreOptional") COLORS.hoverPreOptional = color;
  else if (key === "hoverFwd") COLORS.hoverFwd = color;
  else if (key === "selFwd") COLORS.selFwd = color;
}

export function resetLegendColorsToDefaults() {
  COLORS.lvl = { ...DEFAULT_COLORS.lvl };
  COLORS.sel = DEFAULT_COLORS.sel;
  COLORS.passed = DEFAULT_COLORS.passed;
  COLORS.excl = DEFAULT_COLORS.excl;
  COLORS.hoverPreRequired = DEFAULT_COLORS.hoverPreRequired;
  COLORS.hoverPreOptional = DEFAULT_COLORS.hoverPreOptional;
  COLORS.hoverFwd = DEFAULT_COLORS.hoverFwd;
  COLORS.selFwd = DEFAULT_COLORS.selFwd;
}

export function getLegendColorSnapshot(): Record<LegendColorKey, string> {
  return {
    lvl1000: COLORS.lvl["1000"],
    lvl2000: COLORS.lvl["2000"],
    lvl3000: COLORS.lvl["3000"],
    lvl4000: COLORS.lvl["4000"],
    lvl5000: COLORS.lvl["5000"],
    lvlext: COLORS.lvl.ext,
    sel: COLORS.sel,
    passed: COLORS.passed,
    excl: COLORS.excl,
    hoverPreRequired: COLORS.hoverPreRequired,
    hoverPreOptional: COLORS.hoverPreOptional,
    hoverFwd: COLORS.hoverFwd,
    selFwd: COLORS.selFwd,
  };
}

export function saveLegendColorsToStorage() {
  localStorage.setItem(
    LEGEND_COLORS_STORAGE_KEY,
    JSON.stringify(getLegendColorSnapshot()),
  );
}

export function loadLegendColorsFromStorage() {
  const raw = localStorage.getItem(LEGEND_COLORS_STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as Partial<Record<LegendColorKey, string>>;
    (
      [
        "lvl1000",
        "lvl2000",
        "lvl3000",
        "lvl4000",
        "lvl5000",
        "lvlext",
        "sel",
        "passed",
        "excl",
        "hoverPreRequired",
        "hoverPreOptional",
        "hoverFwd",
        "selFwd",
      ] as LegendColorKey[]
    ).forEach((key) => {
      const value = parsed[key];
      if (isHexColor(value)) {
        setLegendColor(key, value);
      }
    });
  } catch {
    localStorage.removeItem(LEGEND_COLORS_STORAGE_KEY);
  }
}
