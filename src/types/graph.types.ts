export type RequirementKind = "required" | "optional";

export type RelationshipExpression = {
  type: "module" | "and" | "or";
  code?: string;
  children?: RelationshipExpression[];
};

export type PrereqRule = {
  type: "all" | "one" | "parsed";
  sources: string[];
};

export type GraphNode = {
  id: string;
  name: string;
  level: number | "ext";
  credits?: number | null;
  summary?: string;
  description?: string;
  semesters?: string[];
  years?: string[];
  frequency?: string | null;
  extrapolatedAvailability?: Record<string, boolean>;
  isExternal?: boolean;
  isInSelectedCatalog?: boolean;
  primaryCatalogName?: string | null;
  availableInSelectedYear?: boolean;
  extrapolatedInSelectedYear?: boolean;
  semesterAvailability?: Record<string, boolean>;
  prerequisiteSummary?: string;
  coRequisiteSummary?: string;
  antiRequisiteSummary?: string;
  plannedTimetable?: string;
  assessmentPattern?: string;
  reassessment?: string;
  prerequisiteExpression?: RelationshipExpression | null;
  coRequisiteExpression?: RelationshipExpression | null;
  antiRequisiteExpression?: RelationshipExpression | null;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
};

export type GraphEdge = {
  source: string | GraphNode;
  target: string | GraphNode;
  etype: "prereq" | "coreq" | "anti";
  requirementKind?: RequirementKind;
  ruleType?: string;
  ruleGroup?: string[];
};

export type CatalogSummary = {
  id: string;
  name: string;
  years: string[];
};

export type ModuleSearchResult = {
  moduleId: string;
  moduleName: string;
  catalogId: string;
  catalogName: string;
  availableInSelectedYear: boolean;
};

export type GraphDataResponse = {
  catalog: CatalogSummary;
  selectedYear: string | null;
  nodes: GraphNode[];
  prereqRules: Record<string, PrereqRule[]>;
  edges: GraphEdge[];
};
