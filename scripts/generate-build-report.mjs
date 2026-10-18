/**
 * scripts/generate-build-report.mjs
 * ============================================================================
 * Scans docs/articles frontmatter and writes static/build-report.json,
 * which the dev-only dashboard at /dev-dashboard fetches in the browser.
 * Runs automatically before `npm start` via the prestart hook.
 */
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import dashboardConfig from '../dashboard.config.mjs';

const DOCS_DIR = path.join(process.cwd(), 'docs', 'articles');
const OUT_FILE = path.join(process.cwd(), 'static', 'build-report.json');

const isPresent = (value, isArray) => {
  if (value === undefined || value === null) {
    return false;
  }

  if (isArray) {
    return Array.isArray(value) && value.length > 0;
  }

  if (typeof value === 'object') {
    return Object.keys(value).length > 0;
  }

  return String(value).trim() !== '';
};

const files = fs
  .readdirSync(DOCS_DIR)
  .filter((file) => file.endsWith('.mdx') || file.endsWith('.md'));

const docs = files.map((file) => {
  const raw = fs.readFileSync(path.join(DOCS_DIR, file), 'utf8');
  const { data } = matter(raw);
  return { file, frontMatter: data };
});

const requiredFields = dashboardConfig.fields.filter((field) => field.required);

const fields = dashboardConfig.fields.map((field) => {
  const presentFiles = new Set();
  const valueCounts = new Map();

  docs.forEach(({ file, frontMatter }) => {
    const value = frontMatter[field.key];

    if (!isPresent(value, field.isArray)) {
      return;
    }

    presentFiles.add(file);

    if (field.chartType !== 'progress') {
      const values = field.isArray ? value : [value];
      values.forEach((entry) => {
        const label = String(entry);
        valueCounts.set(label, (valueCounts.get(label) || 0) + 1);
      });
    }
  });

  return {
    ...field,
    presentCount: presentFiles.size,
    percent: docs.length > 0 ? Math.round((presentFiles.size / docs.length) * 100) : 0,
    missing: docs.map(({ file }) => file).filter((file) => !presentFiles.has(file)),
    values: [...valueCounts.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count),
  };
});

const report = {
  generatedAt: new Date().toISOString(),
  totalDocs: docs.length,
  requiredComplete: docs.filter(({ frontMatter }) =>
    requiredFields.every((field) => isPresent(frontMatter[field.key], field.isArray)),
  ).length,
  fields,
};

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify(report, null, 2));
console.log(`[build-report] ${docs.length} docs scanned -> static/build-report.json`);
