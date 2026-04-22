import artHistoryCatalog from '../data/catalogs/art-history.json' with { type: 'json' };
import biologyCatalog from '../data/catalogs/biology.json' with { type: 'json' };
import businessCatalog from '../data/catalogs/business.json' with { type: 'json' };
import chemistryCatalog from '../data/catalogs/chemistry.json' with { type: 'json' };
import classicsCatalog from '../data/catalogs/classics.json' with { type: 'json' };
import computerScienceCatalog from '../data/catalogs/computer-science.json' with { type: 'json' };
import divinityCatalog from '../data/catalogs/divinity.json' with { type: 'json' };
import earthSciencesCatalog from '../data/catalogs/earth-sciences.json' with { type: 'json' };
import englishCatalog from '../data/catalogs/english.json' with { type: 'json' };
import geographyCatalog from '../data/catalogs/geography-sustainable-development.json' with { type: 'json' };
import historyCatalog from '../data/catalogs/history.json' with { type: 'json' };
import internationalEducationCatalog from '../data/catalogs/international-education.json' with { type: 'json' };
import internationalRelationsCatalog from '../data/catalogs/international-relations.json' with { type: 'json' };
import medicineCatalog from '../data/catalogs/medicine.json' with { type: 'json' };
import modernLanguagesCatalog from '../data/catalogs/modern-languages.json' with { type: 'json' };
import musicCatalog from '../data/catalogs/music.json' with { type: 'json' };
import pafsCatalog from '../data/catalogs/pafs.json' with { type: 'json' };
import physicsCatalog from '../data/catalogs/physics-astronomy.json' with { type: 'json' };
import psychologyCatalog from '../data/catalogs/psychology-neuroscience.json' with { type: 'json' };
import { mathematicsCatalog } from './mathematics.js';

const generatedCatalogs = [
  artHistoryCatalog,
  biologyCatalog,
  businessCatalog,
  chemistryCatalog,
  classicsCatalog,
  computerScienceCatalog,
  divinityCatalog,
  earthSciencesCatalog,
  englishCatalog,
  geographyCatalog,
  historyCatalog,
  internationalEducationCatalog,
  internationalRelationsCatalog,
  medicineCatalog,
  modernLanguagesCatalog,
  musicCatalog,
  pafsCatalog,
  physicsCatalog,
  psychologyCatalog,
].map((catalog) => ({ ...catalog, prereqRules: {}, antiRequirements: [] }));

export const catalogs = [mathematicsCatalog, ...generatedCatalogs.filter((catalog) => catalog.nodes?.length)];
