import generatedCatalog from '../data/catalogs/mathematics.json' with { type: 'json' };
import { describeExpression, parseRelationshipText } from './relationship-parser.js';
import { mathematicsStaticCatalog } from './mathematics-static.js';

const STATIC_NODE_NAMES = {
  MT1003: 'Math in Context',
  MT2504: 'Combinatorics & Prob.',
  MT2507: 'Math. Modelling',
  MT3507: 'Math. Statistics',
  MT3510: 'Math. Computing',
  MT4004: 'Real & Abstract Analysis',
  MT4112: 'Computational Numerical',
  MT4553: 'Electric & Magnetic Fields',
  MT4561: 'History & Future of Data',
  MT4571: 'Applied Bayesian Stats',
  MT4606: 'Classical Stat. Inference',
};

const STATIC_ONLY_NODES = [
  { id: 'CS3052', name: 'CS module', level: 'ext', credits: null, semesters: [], years: [], availability: {}, frequency: 'external' },
];

function mergeNodes() {
  const generatedNodes = generatedCatalog.nodes.map((module) => ({
    id: module.id,
    name: STATIC_NODE_NAMES[module.id] || module.name,
    level: module.level,
    credits: module.credits,
    summary: module.summary,
    description: module.description,
    semesters: module.semesters,
    years: module.years,
    availability: module.availability,
    frequency: module.frequency,
    prerequisitesText: module.prerequisitesText,
    antiRequisitesText: module.antiRequisitesText,
    prerequisiteExpression: module.prerequisiteExpression || parseRelationshipText(module.prerequisitesText),
    antiRequisiteExpression: module.antiRequisiteExpression || parseRelationshipText(module.antiRequisitesText),
    availabilityRestrictions: module.availabilityRestrictions,
  }));

  return [...generatedNodes, ...STATIC_ONLY_NODES];
}

export const mathematicsCatalog = {
  id: 'mathematics',
  name: 'Mathematics',
  years: generatedCatalog.years,
  nodes: mergeNodes(),
  prereqRules: mathematicsStaticCatalog.prereqRules,
  antiRequirements: mathematicsStaticCatalog.antiRequirements,
};
