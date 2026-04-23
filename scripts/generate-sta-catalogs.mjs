import fs from 'node:fs/promises';
import { parseRelationshipText } from '../server/catalogs/relationship-parser.js';

const YEARS = ['2025/26', '2026/27', '2027/28'];
const SCHOOL_CATALOGS = [
  { id: 'art-history', name: 'Art History', funnelbackDept: 'school of art history' },
  { id: 'biology', name: 'Biology', funnelbackDept: 'school of biology' },
  { id: 'business', name: 'Business', funnelbackDept: 'business school' },
  { id: 'chemistry', name: 'Chemistry', funnelbackDept: 'school of chemistry' },
  { id: 'classics', name: 'Classics', funnelbackDept: 'school of classics' },
  { id: 'computer-science', name: 'Computer Science', funnelbackDept: 'school of computer science' },
  { id: 'divinity', name: 'Divinity', funnelbackDept: 'school of divinity' },
  { id: 'earth-sciences', name: 'Earth and Environmental Sciences', funnelbackDept: 'school of earth & environmental sciences' },
  { id: 'english', name: 'English', funnelbackDept: 'school of english' },
  { id: 'geography-sustainable-development', name: 'Geography and Sustainable Development', funnelbackDept: 'school of geography and sustainable devt' },
  { id: 'history', name: 'History', funnelbackDept: 'school of history' },
  { id: 'international-education', name: 'International Education and Lifelong Learning Institute (IELLI)', funnelbackDept: 'int education & lifelong learning inst' },
  { id: 'international-relations', name: 'International Relations', funnelbackDept: 'school of international relations' },
  { id: 'mathematics', name: 'Mathematics', funnelbackDept: 'school of mathematics and statistics' },
  { id: 'medicine', name: 'Medicine', funnelbackDept: 'school of medicine' },
  { id: 'modern-languages', name: 'Modern Languages', funnelbackDept: 'school of modern languages' },
  { id: 'music', name: 'Music', funnelbackDept: 'music centre' },
  { id: 'pafs', name: 'Philosophical, Anthropological and Film Studies', funnelbackDept: 'school of philos anthro and film studies' },
  { id: 'physics-astronomy', name: 'Physics and Astronomy', funnelbackDept: 'school of physics and astronomy' },
  { id: 'psychology-neuroscience', name: 'Psychology and Neuroscience', funnelbackDept: 'school of psychology and neuroscience' },
];

const SEARCH_BASE = 'https://standrews-search.funnelback.squiz.cloud/s/search.html?query=!null*&sort=metamodulecode&collection=standrews~sp-module-catalogue&profile=_default&form=simple_js_loader&wildcard=*';

function decodeHtml(value = '') {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTags(value = '') {
  return decodeHtml(value.replace(/<[^>]+>/g, ' '));
}

function normalizeYear(value) {
  return value.replace('/', '-').replace(/^(\d{4})-(\d{4})$/, (_, start, end) => `${start}-${end.slice(2)}`);
}

function parseSearchResults(html) {
  const totalMatch = html.match(/([0-9,]+) modules found/);
  const total = totalMatch ? Number(totalMatch[1].replace(/,/g, '')) : 0;
  const blocks = [...html.matchAll(/<li id="\d+" class="search-result module"[\s\S]*?<\/li>/g)].map((match) => match[0]);
  const rows = blocks.map((block) => {
    const attrs = Object.fromEntries([...block.matchAll(/data-([a-z-]+)\s*=\s*"([^"]*)"/g)].map((match) => [match[1], match[2]]));
    const read = (regex) => {
      const match = block.match(regex);
      return match ? stripTags(match[1]) : '';
    };

    return {
      code: attrs.code,
      name: decodeHtml(attrs.title),
      year: normalizeYear(attrs.ayrs),
      semester: decodeHtml(attrs.semester),
      credits: Number(read(/<dd class="metadata-list--full credits"[^>]*>([\s\S]*?)<\/dd>/)) || null,
      level: Number(read(/<dd class="metadata-list--full level"[^>]*>([\s\S]*?)<\/dd>/)) || null,
      summary: read(/<p class="search-result__summary">([\s\S]*?)<\/p>/),
      url: decodeHtml((block.match(/<a href="([^"]+)" class="search-result__link">/) || [])[1] || ''),
    };
  });

  return { total, rows };
}

function inferFrequency(years) {
  const pattern = YEARS.map(normalizeYear).map((year) => years.includes(year));
  if ((pattern[0] && pattern[1]) || (pattern[1] && pattern[2])) return 'every-year';
  if (pattern[0] && !pattern[1] && pattern[2]) return 'alternate-a';
  if (!pattern[0] && pattern[1] && !pattern[2]) return 'alternate-b';
  return 'irregular';
}

async function fetchYearRows(school, year) {
  const yearParam = year.replace('/26', '/6').replace('/27', '/7').replace('/28', '/8');
  let start = 1;
  let total = Infinity;
  const rows = [];

  while (start <= total) {
    const params = new URLSearchParams({
      'f.School|dept': school.funnelbackDept,
      'f.Year|ayrs': yearParam,
      start_rank: String(start),
      num_ranks: '50',
    });
    const html = await fetch(`${SEARCH_BASE}&${params.toString()}`).then((response) => response.text());
    const parsed = parseSearchResults(html);
    total = parsed.total;
    rows.push(...parsed.rows);
    if (!parsed.rows.length) break;
    start += parsed.rows.length;
  }

  return rows;
}

function buildCatalog(school, rows) {
  const moduleMap = new Map();
  for (const row of rows) {
    if (!row.code) continue;
    if (!moduleMap.has(row.code)) {
      moduleMap.set(row.code, {
        id: row.code,
        name: row.name,
        level: row.level,
        credits: row.credits,
        summary: row.summary,
        semesters: new Set(),
        years: new Set(),
        offerings: [],
      });
    }

    const module = moduleMap.get(row.code);
    if (row.name) module.name = row.name;
    if (row.level) module.level = row.level;
    if (row.credits) module.credits = row.credits;
    if (row.summary) module.summary = row.summary;
    if (row.semester) module.semesters.add(row.semester);
    if (row.year) module.years.add(row.year);
    if (row.url) {
      module.offerings.push({
        year: row.year,
        semester: row.semester,
        url: row.url,
      });
    }
  }

  return {
    id: school.id,
    name: school.name,
    years: YEARS.map(normalizeYear),
    nodes: [...moduleMap.values()].sort((a, b) => a.id.localeCompare(b.id)).map((module) => {
      const years = [...module.years].sort();
      return {
        id: module.id,
        name: module.name,
        level: module.level || inferLevelFromCode(module.id),
        credits: module.credits,
        summary: module.summary,
        semesters: [...module.semesters].sort((a, b) => a.localeCompare(b)),
        years,
        availability: Object.fromEntries(YEARS.map(normalizeYear).map((year) => [year, years.includes(year)])),
        frequency: inferFrequency(years),
        prerequisiteExpression: null,
        coRequisiteExpression: null,
        antiRequisiteExpression: null,
        offerings: module.offerings,
      };
    }),
  };
}

function inferLevelFromCode(code) {
  const match = code.match(/(\d)/);
  return match ? Number(match[1]) * 1000 : null;
}

function absoluteUrl(url) {
  if (!url) return '';
  return new URL(url, 'https://www.st-andrews.ac.uk').toString();
}

function extractRelationshipText(html, sectionTitle, id) {
  const byId = id
    ? stripTags((html.match(new RegExp(`<p[^>]*id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/p>`, 'i')) || [])[1] || '')
    : '';
  if (byId) return byId;

  const headingPattern = new RegExp(
    `<h3[^>]*>\\s*${sectionTitle}\\s*<\\/h3>\\s*<p[^>]*>([\\s\\S]*?)<\\/p>`,
    'i',
  );
  return stripTags((html.match(headingPattern) || [])[1] || '');
}

async function enrichNode(node) {
  const offerings = [...(node.offerings || [])].sort((a, b) => {
    const yearCompare = (a.year || '').localeCompare(b.year || '');
    if (yearCompare !== 0) return yearCompare;
    return (a.semester || '').localeCompare(b.semester || '');
  });

  let fallbackText = { prerequisitesText: '', coRequisitesText: '', antiRequisitesText: '' };

  for (const offering of offerings) {
    const html = await fetch(absoluteUrl(offering.url)).then((response) => response.text()).catch(() => '');
    if (!html) continue;

    const prerequisitesText = extractRelationshipText(html, 'Pre-requisites', 'prerequisites');
    const coRequisitesText = extractRelationshipText(html, 'Co-requisites', 'corequisites');
    const antiRequisitesText = extractRelationshipText(html, 'Anti-requisites', 'antirequisites');

    if (!fallbackText.prerequisitesText && prerequisitesText) {
      fallbackText.prerequisitesText = prerequisitesText;
    }
    if (!fallbackText.coRequisitesText && coRequisitesText) {
      fallbackText.coRequisitesText = coRequisitesText;
    }
    if (!fallbackText.antiRequisitesText && antiRequisitesText) {
      fallbackText.antiRequisitesText = antiRequisitesText;
    }

    if (prerequisitesText || coRequisitesText || antiRequisitesText) {
      node.prerequisitesText = prerequisitesText;
      node.coRequisitesText = coRequisitesText;
      node.antiRequisitesText = antiRequisitesText;
      node.prerequisiteExpression = parseRelationshipText(prerequisitesText);
      node.coRequisiteExpression = parseRelationshipText(coRequisitesText);
      node.antiRequisiteExpression = parseRelationshipText(antiRequisitesText);
      return;
    }
  }

  node.prerequisitesText = fallbackText.prerequisitesText;
  node.coRequisitesText = fallbackText.coRequisitesText;
  node.antiRequisitesText = fallbackText.antiRequisitesText;
  node.prerequisiteExpression = parseRelationshipText(node.prerequisitesText);
  node.coRequisiteExpression = parseRelationshipText(node.coRequisitesText);
  node.antiRequisiteExpression = parseRelationshipText(node.antiRequisitesText);
}

async function mapWithConcurrency(items, limit, iteratee) {
  const executing = new Set();

  for (const item of items) {
    const promise = Promise.resolve().then(() => iteratee(item));
    executing.add(promise);
    const cleanup = () => executing.delete(promise);
    promise.then(cleanup, cleanup);
    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
}

async function main() {
  await fs.mkdir(new URL('../server/data/catalogs/', import.meta.url), { recursive: true });

  for (const school of SCHOOL_CATALOGS) {
    const rows = [];
    for (const year of YEARS) {
      rows.push(...await fetchYearRows(school, year));
    }

    const catalog = buildCatalog(school, rows);
    await mapWithConcurrency(catalog.nodes, 10, async (node) => {
      await enrichNode(node);
      delete node.offerings;
    });
    await fs.writeFile(new URL(`../server/data/catalogs/${school.id}.json`, import.meta.url), `${JSON.stringify(catalog, null, 2)}\n`);
    console.log(`${school.name}: ${catalog.nodes.length} modules`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
