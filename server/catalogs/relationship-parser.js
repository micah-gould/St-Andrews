const MODULE_CODE_RE = /[A-Z]{2,4}\d{4}/g;

export function parseRelationshipText(text) {
  const cleaned = normalizeText(text);
  if (!cleaned) return null;

  const codeSet = new Set(cleaned.match(MODULE_CODE_RE) || []);
  if (!codeSet.size) return null;

  const body = cleaned
    .replace(/BEFORE TAKING THIS MODULE YOU MUST/gi, '')
    .replace(/IF NOT ALREADY PASSED YOU MUST TAKE/gi, '')
    .replace(/STUDENTS MUST HAVE/gi, '')
    .replace(/THE STUDENT REQUIRES A LETTER OF AGREEMENT/gi, '')
    .replace(/YOU MUST HAVE AT LEAST[\s\S]*$/gi, '')
    .trim();

  const groups = splitTopLevel(body, ' OR ').map((segment) => parseAndGroup(segment)).filter(Boolean);
  if (!groups.length) return null;
  if (groups.length === 1) return groups[0];
  return { type: 'or', children: groups };
}

export function extractModuleCodes(expression, seen = new Set()) {
  if (!expression) return seen;
  if (expression.type === 'module') {
    seen.add(expression.code);
    return seen;
  }

  (expression.children || []).forEach((child) => extractModuleCodes(child, seen));
  return seen;
}

export function evaluateBlocked(expression, excluded) {
  if (!expression) return false;
  if (expression.type === 'module') return excluded.has(expression.code);
  if (expression.type === 'and') return expression.children.some((child) => evaluateBlocked(child, excluded));
  if (expression.type === 'or') return expression.children.every((child) => evaluateBlocked(child, excluded));
  return false;
}

export function describeExpression(expression) {
  if (!expression) return 'None';
  if (expression.type === 'module') return expression.code;
  const joiner = expression.type === 'and' ? ' AND ' : ' OR ';
  return expression.children.map((child) => {
    const rendered = describeExpression(child);
    return child.type === 'module' ? rendered : `(${rendered})`;
  }).join(joiner);
}

function parseAndGroup(segment) {
  const cleaned = trimOuterParens(segment.trim());
  if (!cleaned) return null;
  const splitParts = splitTopLevel(cleaned, ' AND ');
  if (splitParts.length === 1) return parseSegment(cleaned);
  const andParts = splitParts.map((part) => parseSegment(part)).filter(Boolean);
  if (!andParts.length) return null;
  if (andParts.length === 1) return andParts[0];
  return { type: 'and', children: andParts };
}

function parseSegment(segment) {
  const cleaned = trimOuterParens(segment.trim());
  if (!cleaned) return null;
  const splitParts = splitTopLevel(cleaned, ' OR ');
  if (splitParts.length === 1) {
    const code = (cleaned.match(MODULE_CODE_RE) || [])[0];
    return code ? { type: 'module', code } : null;
  }

  const orParts = splitParts.map((part) => parseAndGroup(part)).filter(Boolean);
  if (orParts.length > 1) return { type: 'or', children: orParts };

  const code = (cleaned.match(MODULE_CODE_RE) || [])[0];
  if (!code) return null;
  return { type: 'module', code };
}

function normalizeText(text = '') {
  return text
    .replace(/\s+/g, ' ')
    .replace(/,\s*/g, ', ')
    .replace(/\bPASS\b/g, 'PASS')
    .trim();
}

function trimOuterParens(value) {
  let text = value.trim();
  while (text.startsWith('(') && text.endsWith(')') && enclosesWholeExpression(text)) {
    text = text.slice(1, -1).trim();
  }
  return text;
}

function enclosesWholeExpression(text) {
  let depth = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '(') depth += 1;
    if (text[i] === ')') depth -= 1;
    if (depth === 0 && i < text.length - 1) return false;
  }
  return true;
}

function splitTopLevel(text, delimiter) {
  const parts = [];
  let depth = 0;
  let start = 0;

  for (let i = 0; i <= text.length - delimiter.length; i += 1) {
    const char = text[i];
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (depth === 0 && text.slice(i, i + delimiter.length) === delimiter) {
      parts.push(text.slice(start, i));
      start = i + delimiter.length;
      i += delimiter.length - 1;
    }
  }

  parts.push(text.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
}
