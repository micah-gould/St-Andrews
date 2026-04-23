import fs from 'node:fs/promises';

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
const LIVE_REQUIREMENT_RE = /(Pre-requisites|Co-requisites|Anti-requisites)/i;

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

function normalizeYear(value) {
  return value.replace('/', '-').replace(/^(\d{4})-(\d{4})$/, (_, start, end) => `${start}-${end.slice(2)}`);
}

function parseSearchResults(html) {
  const blocks = [...html.matchAll(/<li id="\d+" class="search-result module"[\s\S]*?<\/li>/g)].map((match) => match[0]);
  return blocks.map((block) => {
    const attrs = Object.fromEntries([...block.matchAll(/data-([a-z-]+)\s*=\s*"([^"]*)"/g)].map((match) => [match[1], match[2]]));
    return {
      code: attrs.code,
      year: normalizeYear(attrs.ayrs),
      semester: decodeHtml(attrs.semester),
      url: decodeHtml((block.match(/<a href="([^"]+)" class="search-result__link">/) || [])[1] || ''),
    };
  }).filter((row) => row.code && row.url);
}

async function fetchYearRows(school, year) {
  const yearParam = year.replace('/26', '/6').replace('/27', '/7').replace('/28', '/8');
  const params = new URLSearchParams({
    'f.School|dept': school.funnelbackDept,
    'f.Year|ayrs': yearParam,
    start_rank: '1',
    num_ranks: '200',
  });

  const html = await fetch(`${SEARCH_BASE}&${params.toString()}`).then((response) => response.text());
  return parseSearchResults(html);
}

async function buildOfferingIndex() {
  const index = new Map();

  for (const school of SCHOOL_CATALOGS) {
    console.log(`[audit] fetching search results for ${school.name}`);
    for (const year of YEARS) {
      console.log(`[audit]   year ${year}`);
      const rows = await fetchYearRows(school, year);
      console.log(`[audit]   found ${rows.length} offerings`);
      rows.forEach((row) => {
        const existing = index.get(row.code) || [];
        existing.push(row);
        index.set(row.code, existing);
      });
    }
  }

  return index;
}

async function main() {
  console.log('[audit] loading generated catalogs');
  const catalogDir = new URL('../server/data/catalogs/', import.meta.url);
  const files = (await fs.readdir(catalogDir)).filter((file) => file.endsWith('.json'));
  const missing = [];

  for (const file of files) {
    console.log(`[audit] reading ${file}`);
    const raw = await fs.readFile(new URL(file, catalogDir), 'utf8');
    const catalog = JSON.parse(raw);
    for (const node of catalog.nodes || []) {
      if (!node.prerequisitesText && !node.coRequisitesText && !node.antiRequisitesText) {
        missing.push({ catalogId: catalog.id, id: node.id, name: node.name, years: node.years || [] });
      }
    }
  }

  console.log(`[audit] found ${missing.length} modules with no extracted requirement text`);

  const offeringIndex = await buildOfferingIndex();
  console.log(`[audit] built offering index for ${offeringIndex.size} module codes`);
  const findings = [];
  let checked = 0;

  for (const item of missing) {
    checked += 1;
    if (checked === 1 || checked % 25 === 0) {
      console.log(`[audit] scanning live pages ${checked}/${missing.length}`);
    }
    const offers = offeringIndex.get(item.id) || [];
    for (const offer of offers) {
      const html = await fetch(offer.url).then((response) => response.text()).catch(() => '');
      if (!html || !LIVE_REQUIREMENT_RE.test(html)) continue;

      findings.push({
        catalogId: item.catalogId,
        id: item.id,
        name: item.name,
        year: offer.year,
        semester: offer.semester,
        url: offer.url,
      });
      console.log(`[audit] found live requirement headings for ${item.id} (${item.catalogId})`);
      break;
    }
  }

  console.log(`[audit] completed with ${findings.length} findings`);
  console.log(JSON.stringify({
    missingCount: missing.length,
    findingsCount: findings.length,
    findings,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
