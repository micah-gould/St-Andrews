import {
  describeExpression,
  extractModuleCodes,
} from "./catalogs/relationship-parser";
import { catalogs } from "./catalogs/index";
import type {
  GraphEdge,
  GraphNode,
  PrereqRule,
  RelationshipExpression,
} from "../src/types/graph.types";

type CatalogNode = GraphNode & {
  availability?: Record<string, boolean>;
  catalogs?: string[];
  primaryCatalogId?: string | null;
  prerequisitesText?: string;
  coRequisitesText?: string;
  antiRequisitesText?: string;
  prereqRules?: PrereqRule[];
  antiRequirements?: Array<{ source: string; target: string }>;
  prerequisiteExpression?: RelationshipExpression | null;
  coRequisiteExpression?: RelationshipExpression | null;
  antiRequisiteExpression?: RelationshipExpression | null;
  selectedYear?: string | null;
  isInSelectedCatalog?: boolean;
  availableInSelectedYear?: boolean;
  semesterAvailability?: Record<string, boolean>;
  prerequisiteSummary?: string;
  coRequisiteSummary?: string;
  antiRequisiteSummary?: string;
};

type CatalogData = {
  id: string;
  name: string;
  years: string[];
  nodes: CatalogNode[];
  prereqRules?: Record<string, PrereqRule[]>;
  antiRequirements?: Array<{ source: string; target: string }>;
};

type ModuleSearchResult = {
  moduleId: string;
  moduleName: string;
  catalogId: string;
  catalogName: string;
  availableInSelectedYear: boolean;
};

const typedCatalogs = catalogs as CatalogData[];
const catalogById = new Map(
  typedCatalogs.map((catalog) => [catalog.id, catalog]),
);
const nodeIndex = buildNodeIndex(typedCatalogs);

export function listCatalogs() {
  return typedCatalogs.map((catalog) => ({
    id: catalog.id,
    name: catalog.name,
    years: catalog.years || [],
  }));
}

export function getCatalog(id) {
  return catalogById.get(id) || typedCatalogs[0];
}

export function getGraphData(catalog, year) {
  const selectedYear =
    year && (catalog.years || []).includes(year)
      ? year
      : (catalog.years || [])[0] || null;
  const graph = buildCatalogGraph(catalog, selectedYear);

  return {
    selectedYear,
    nodes: graph.nodes,
    edges: graph.edges,
    prereqRules: graph.prereqRules,
  };
}

export function searchModules(query: string, year: string | null) {
  const normalized = String(query || "")
    .trim()
    .toLowerCase();
  if (!normalized) return [];

  const seen = new Set<string>();
  const results: ModuleSearchResult[] = [];

  typedCatalogs.forEach((catalog) => {
    (catalog.nodes || []).forEach((node) => {
      if (!node?.id) return;
      const id = node.id;
      const name = node.name || id;
      const idText = id.toLowerCase();
      const nameText = name.toLowerCase();
      const combined = `${idText} ${nameText}`;
      if (!combined.includes(normalized)) return;

      const key = `${id}::${catalog.id}`;
      if (seen.has(key)) return;
      seen.add(key);

      const availableInSelectedYear = year
        ? node.availability?.[year] !== false
        : true;

      results.push({
        moduleId: id,
        moduleName: name,
        catalogId: catalog.id,
        catalogName: catalog.name,
        availableInSelectedYear,
      });
    });
  });

  const rank = (value: ModuleSearchResult) => {
    const id = value.moduleId.toLowerCase();
    const name = value.moduleName.toLowerCase();
    if (id === normalized) return 0;
    if (id.startsWith(normalized)) return 1;
    if (name.startsWith(normalized)) return 2;
    const idIndex = id.indexOf(normalized);
    if (idIndex >= 0) return 3 + idIndex;
    const nameIndex = name.indexOf(normalized);
    if (nameIndex >= 0) return 25 + nameIndex;
    return 1000;
  };

  return results
    .sort((left, right) => {
      const rankDiff = rank(left) - rank(right);
      if (rankDiff !== 0) return rankDiff;
      const idDiff = left.moduleId.localeCompare(right.moduleId);
      if (idDiff !== 0) return idDiff;
      return left.catalogName.localeCompare(right.catalogName);
    })
    .slice(0, 200);
}

function buildCatalogGraph(catalog: CatalogData, selectedYear: string | null) {
  const catalogNodeIds = new Set<string>(
    (catalog.nodes || []).map((node) => node.id),
  );
  const selectedCatalogNodeMap = new Map<string, CatalogNode>(
    (catalog.nodes || []).map((node) => [node.id, node]),
  );
  const graphNodeIds = new Set<string>(catalogNodeIds);
  const queue = [...catalogNodeIds];

  while (queue.length) {
    const nodeId = queue.shift();
    if (!nodeId) continue;
    const node = nodeIndex.get(nodeId);
    if (!node) continue;

    getReferencedCodes(node).forEach((refId) => {
      if (graphNodeIds.has(refId)) return;
      if (!nodeIndex.has(refId)) return;
      graphNodeIds.add(refId);
      queue.push(refId);
    });
  }

  const nodeIds = [...graphNodeIds];
  const nodes = nodeIds
    .map((id) =>
      buildNodeForYear(
        nodeIndex.get(id),
        selectedYear,
        catalogNodeIds.has(id),
        selectedCatalogNodeMap.get(id) || null,
      ),
    )
    .filter(Boolean)
    .sort(compareNodes);

  const edgeMap = new Map<string, GraphEdge>();
  const edges: GraphEdge[] = [];
  const prereqRules: Record<string, PrereqRule[]> = {};

  nodeIds.forEach((id) => {
    const node = nodeIndex.get(id);
    if (!node) return;

    if (node.prereqRules?.length) {
      prereqRules[id] = node.prereqRules;
      node.prereqRules.forEach((rule) => {
        rule.sources.forEach((source) => {
          if (!graphNodeIds.has(source)) return;
          pushEdge(edgeMap, edges, {
            source,
            target: id,
            ruleType: rule.type,
            ruleGroup: rule.sources,
            requirementKind: rule.type === "all" ? "required" : "optional",
            etype: "prereq",
          });
        });
      });
    }

    extractExpressionEdges(node.prerequisiteExpression).forEach(
      ({ source, requirementKind }) => {
        if (!graphNodeIds.has(source)) return;
        pushEdge(edgeMap, edges, {
          source,
          target: id,
          ruleType: "parsed",
          ruleGroup: [source],
          requirementKind,
          etype: "prereq",
        });
      },
    );

    extractExpressionEdges(node.coRequisiteExpression).forEach(
      ({ source, requirementKind }) => {
        if (!graphNodeIds.has(source)) return;
        pushEdge(edgeMap, edges, {
          source,
          target: id,
          ruleType: "parsed",
          ruleGroup: [source],
          requirementKind,
          etype: "coreq",
        });
      },
    );

    extractModuleCodes(node.antiRequisiteExpression).forEach((source) => {
      if (!graphNodeIds.has(source)) return;
      pushEdge(edgeMap, edges, { source, target: id, etype: "anti" });
    });

    (node.antiRequirements || []).forEach((edge) => {
      if (!graphNodeIds.has(edge.source) || !graphNodeIds.has(edge.target))
        return;
      pushEdge(edgeMap, edges, { ...edge, etype: "anti" });
    });
  });

  return { nodes, edges, prereqRules };
}

function buildNodeIndex(allCatalogs: CatalogData[]) {
  const index = new Map<string, CatalogNode>();

  allCatalogs.forEach((catalog) => {
    (catalog.nodes || []).forEach((node) => {
      const existing = index.get(node.id);
      const merged = mergeNode(existing, node, catalog);
      index.set(node.id, merged);
    });

    Object.entries(catalog.prereqRules || {}).forEach(([target, rules]) => {
      const existing = index.get(target) || createPlaceholderNode(target);
      existing.prereqRules = dedupeRules([
        ...(existing.prereqRules || []),
        ...((rules || []) as PrereqRule[]),
      ]);
      index.set(target, existing);

      ((rules || []) as PrereqRule[]).forEach((rule) => {
        rule.sources.forEach((source) => {
          if (index.has(source)) return;
          index.set(source, createPlaceholderNode(source));
        });
      });
    });

    (catalog.antiRequirements || []).forEach((edge) => {
      const source =
        index.get(edge.source) || createPlaceholderNode(edge.source);
      source.antiRequirements = [...(source.antiRequirements || []), edge];
      index.set(edge.source, source);
      if (!index.has(edge.target))
        index.set(edge.target, createPlaceholderNode(edge.target));
    });
  });

  return index;
}

function mergeNode(
  existing: CatalogNode | undefined,
  node: CatalogNode,
  catalog: CatalogData,
): CatalogNode {
  if (!existing) {
    return {
      ...node,
      semesters: [...(node.semesters || [])],
      years: [...(node.years || [])],
      availability: { ...(node.availability || {}) },
      catalogs: [catalog.id],
      primaryCatalogId: catalog.id,
      primaryCatalogName: catalog.name,
      isExternal: node.level === "ext",
      prereqRules: [],
      antiRequirements: [],
    };
  }

  return {
    ...existing,
    ...node,
    name: chooseName(existing.name, node.name, node.id),
    level: chooseLevel(existing.level, node.level),
    credits: node.credits ?? existing.credits ?? null,
    summary: node.summary || existing.summary || "",
    description: node.description || existing.description || "",
    semesters: dedupeStrings([
      ...(existing.semesters || []),
      ...(node.semesters || []),
    ]),
    years: dedupeStrings([
      ...(existing.years || []),
      ...(node.years || []),
    ]).sort(),
    availability: {
      ...(existing.availability || {}),
      ...(node.availability || {}),
    },
    prerequisiteExpression:
      existing.prerequisiteExpression || node.prerequisiteExpression || null,
    coRequisiteExpression:
      existing.coRequisiteExpression || node.coRequisiteExpression || null,
    antiRequisiteExpression:
      existing.antiRequisiteExpression || node.antiRequisiteExpression || null,
    prerequisitesText:
      existing.prerequisitesText || node.prerequisitesText || "",
    coRequisitesText: existing.coRequisitesText || node.coRequisitesText || "",
    antiRequisitesText:
      existing.antiRequisitesText || node.antiRequisitesText || "",
    catalogs: dedupeStrings([...(existing.catalogs || []), catalog.id]),
    primaryCatalogId: existing.primaryCatalogId || catalog.id,
    primaryCatalogName: existing.primaryCatalogName || catalog.name,
    isExternal: existing.isExternal && node.level === "ext",
    prereqRules: existing.prereqRules || [],
    antiRequirements: existing.antiRequirements || [],
  };
}

function createPlaceholderNode(id: string): CatalogNode {
  return {
    id,
    name: id,
    level: "ext",
    credits: null,
    summary: "",
    description: "",
    semesters: [],
    years: [],
    availability: {},
    frequency: "external",
    prerequisitesText: "",
    coRequisitesText: "",
    antiRequisitesText: "",
    prerequisiteExpression: null,
    coRequisiteExpression: null,
    antiRequisiteExpression: null,
    catalogs: [],
    primaryCatalogId: null,
    primaryCatalogName: "External prerequisite",
    isExternal: true,
    prereqRules: [],
    antiRequirements: [],
  };
}

function buildNodeForYear(
  node: CatalogNode | undefined,
  selectedYear: string | null,
  isInSelectedCatalog: boolean,
  selectedCatalogNode: CatalogNode | null = null,
) {
  if (!node) return null;
  const years = [...(node.years || [])].sort();
  const semesters = [...(node.semesters || [])];
  const availability = node.availability || {};
  const availableInSelectedYear = selectedYear
    ? availability[selectedYear] !== false
    : true;
  const semesterAvailability = Object.fromEntries(
    semesters.map((semester) => [
      semester,
      selectedYear ? availability[selectedYear] !== false : true,
    ]),
  );

  const selectedLevel =
    !isInSelectedCatalog ||
    selectedCatalogNode?.level === "ext" ||
    selectedCatalogNode?.frequency === "external"
      ? "ext"
      : node.level;

  return {
    ...node,
    level: selectedLevel,
    isExternal: !isInSelectedCatalog || node.isExternal,
    years,
    semesters,
    availableInSelectedYear,
    semesterAvailability,
    selectedYear,
    isInSelectedCatalog,
    prerequisiteSummary: node.prerequisiteExpression
      ? describeExpression(node.prerequisiteExpression)
      : node.prerequisitesText,
    coRequisiteSummary: node.coRequisiteExpression
      ? describeExpression(node.coRequisiteExpression)
      : node.coRequisitesText,
    antiRequisiteSummary: node.antiRequisiteExpression
      ? describeExpression(node.antiRequisiteExpression)
      : node.antiRequisitesText,
  };
}

function getReferencedCodes(node: CatalogNode | undefined) {
  const refs = new Set<string>();

  extractModuleCodes(node?.prerequisiteExpression).forEach((code) =>
    refs.add(code),
  );
  extractModuleCodes(node?.coRequisiteExpression).forEach((code) =>
    refs.add(code),
  );
  extractModuleCodes(node?.antiRequisiteExpression).forEach((code) =>
    refs.add(code),
  );

  (node?.prereqRules || []).forEach((rule) => {
    rule.sources.forEach((source) => refs.add(source));
  });

  (node?.antiRequirements || []).forEach((edge) => {
    refs.add(edge.source);
    refs.add(edge.target);
  });

  return refs;
}

function extractExpressionEdges(
  expression: RelationshipExpression | null | undefined,
  requirementKind: "required" | "optional" = "required",
  seen = new Map<
    string,
    { source: string; requirementKind: "required" | "optional" }
  >(),
) {
  if (!expression) return [...seen.values()];

  if (expression.type === "module") {
    if (!expression.code) return [...seen.values()];
    const existing = seen.get(expression.code);
    const nextKind = mergeRequirementKind(
      existing?.requirementKind,
      requirementKind,
    );
    seen.set(expression.code, {
      source: expression.code,
      requirementKind: nextKind,
    });
    return [...seen.values()];
  }

  if (expression.type === "and") {
    (expression.children || []).forEach((child) =>
      extractExpressionEdges(child, requirementKind, seen),
    );
    return [...seen.values()];
  }

  if (expression.type === "or") {
    (expression.children || []).forEach((child) =>
      extractExpressionEdges(child, "optional", seen),
    );
  }

  return [...seen.values()];
}

function pushEdge(
  edgeMap: Map<string, GraphEdge>,
  edges: GraphEdge[],
  edge: GraphEdge,
) {
  const key = `${edge.etype}:${edge.source}->${edge.target}`;
  const existing = edgeMap.get(key);
  if (existing) {
    if (existing.etype === "prereq" && edge.etype === "prereq") {
      existing.requirementKind = mergeRequirementKind(
        existing.requirementKind,
        edge.requirementKind,
      );
      if (existing.ruleType === "parsed" && edge.ruleType !== "parsed") {
        existing.ruleType = edge.ruleType;
        existing.ruleGroup = edge.ruleGroup;
      }
    }
    return;
  }

  edgeMap.set(key, edge);
  edges.push(edge);
}

function mergeRequirementKind(
  left: "required" | "optional" = "optional",
  right: "required" | "optional" = "optional",
) {
  return left === "required" || right === "required" ? "required" : "optional";
}

function dedupeRules(rules: PrereqRule[]) {
  const seen = new Set();
  return rules.filter((rule) => {
    const key = `${rule.type}:${[...rule.sources].sort().join(",")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.filter(Boolean))];
}

function chooseName(
  existingName: string | undefined,
  incomingName: string | undefined,
  id: string,
) {
  if (existingName && existingName !== id) return existingName;
  return incomingName || existingName || id;
}

function chooseLevel(
  existingLevel: number | "ext" | undefined,
  incomingLevel: number | "ext" | undefined,
) {
  if (incomingLevel && incomingLevel !== "ext") return incomingLevel;
  return existingLevel || incomingLevel || "ext";
}

function compareNodes(a: GraphNode, b: GraphNode) {
  const rankA = getLevelRank(a.level);
  const rankB = getLevelRank(b.level);
  if (rankA !== rankB) return rankA - rankB;
  return a.id.localeCompare(b.id);
}

function getLevelRank(level: number | "ext") {
  if (level === "ext") return 9999;
  if (typeof level === "number") return level;
  return 9998;
}
