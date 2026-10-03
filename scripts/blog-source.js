import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { getSurveyCharts, formatNumber, formatPercent, formatMoney, formatRoundedMoney } from '../content/state-of-devs-charts.js';
import survey from '../content/state-of-devs-2026.json' with { type: 'json' };
import { preparedPost } from '../api/utils/blog.js';

export const sourceRoot = fileURLToPath(new URL('../content/posts/', import.meta.url));
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const formats = { formatNumber, formatPercent, formatMoney, formatRoundedMoney };
// Only literal snapshot lookups are supported: never evaluate MDX or database code.
function snapshotValue(expression) {
  if (!/^survey(?:\.[a-zA-Z][a-zA-Z0-9]*|\[\d+\])+$/.test(expression)) throw new Error('Unsupported snapshot expression');
  const keys = expression.slice(7).replace(/\[(\d+)\]/g, '.$1').split('.');
  let value = survey;
  for (const key of keys) value = value?.[key];
  if (typeof value !== 'number') throw new Error('Unknown snapshot value');
  return value;
}
function chartHtml(chart, lang, compact = false) {
  const number = value => formatNumber(value, lang);
  const percent = value => formatPercent(value, lang);
  const titleId = `survey-${chart.id}-title`;
  const answers = lang === 'es' ? 'respuestas' : 'answers';
  const rows = chart.rows.map(row => `<li class="chart-row" tabindex="0" aria-label="${escape(`${row.label}: ${percent(row.percent)}, ${number(row.count)} / ${number(chart.n)}`)}"><div class="row-heading"><span>${escape(row.label)}</span><strong>${percent(row.percent)}</strong></div><div class="bar-track" aria-hidden="true"><span class="bar-fill" style="width: ${row.percent}%"></span></div>${row.details ? `<dl class="row-details">${row.details.map(detail => `<div><dt>${escape(detail.label)}</dt><dd>${escape(detail.value)}</dd></div>`).join('')}</dl>` : ''}<span class="chart-tooltip" aria-hidden="true">${number(row.count)} / ${number(chart.n)} ${answers}</span></li>`).join('');
  return `<figure class="survey-chart not-prose${compact ? ' compact' : ''}" aria-labelledby="${titleId}" data-chart="${chart.id}"><figcaption><h3 id="${titleId}">${escape(chart.title)}</h3><span class="sample">${number(chart.n)} ${answers}</span></figcaption><div class="axis" aria-hidden="true"><span>0%</span><span>50%</span><span>100%</span></div><ul class="chart-rows">${rows}</ul><p class="chart-note">${escape(chart.note)} <a href="${escape(chart.source)}">${lang === 'es' ? 'Datos' : 'Source data'}</a></p></figure>`;
}
export function portableContent(source) {
  const body = source.replace(/^import\s[\s\S]*?;\s*\n/gm, '')
    .replace(/\{([^{}]+)\}/g, (match, expression) => {
      const formatted = /^(formatNumber|formatPercent|formatMoney|formatRoundedMoney)\((survey[^,]+)(?:,\s*'([a-z]+)')?\)$/.exec(expression);
      return formatted ? formats[formatted[1]](snapshotValue(formatted[2]), formatted[3] || 'en') : String(snapshotValue(expression));
    })
    .replace(/<SurveyChart kind="(code|work|risks|workplace|remote)"(?: lang="(en|es)")?\s*\/>/g, (match, kind, language = 'en') => {
      const charts = getSurveyCharts(language);
      const rendered = kind === 'workplace' ? `<div class="workplace-charts not-prose" data-survey-visual="workplace">${chartHtml(charts.problems, language)}${chartHtml(charts.burnout, language, true)}</div>` : `<div data-survey-visual="${kind}">${chartHtml(charts[kind], language)}</div>`;
      return `\n${rendered}\n`;
    });
  if (/SurveyChart|^import\s/m.test(body)) throw new Error('Unconverted MDX');
  return body;
}
export async function readBlogSources(root = sourceRoot) {
  const posts = [];
  for (const language of ['en', 'es']) {
    const names = (await readdir(path.join(root, language))).filter(name => /\.mdx?$/.test(name)).sort();
    for (const name of names) {
      const raw = await readFile(path.join(root, language, name), 'utf8');
      const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(raw);
      if (!match) throw new Error('Missing frontmatter');
      const meta = yaml.load(match[1], { schema: yaml.JSON_SCHEMA });
      const [day, month, year] = meta.date.split('/');
      const slug = `${language}/${name.replace(/\.mdx?$/, '')}`;
      const image = meta.image.replace(/^\.\.\/images\//, '/blog-assets/images/');
      posts.push(preparedPost({ slug, language, title: meta.title, author: meta.author,
        anonymous: meta.anonymous || false, categories: meta.categories || [],
        status: meta.draft ? 'draft' : 'published', publishedAt: `${year}-${month}-${day}T00:00:00.000Z`,
        displayDate: meta.date, coverImage: image, ...(meta.description ? { excerpt: meta.description } : {}),
        content: name.endsWith('.mdx') ? portableContent(match[2]) : match[2] }));
    }
  }
  return posts;
}
