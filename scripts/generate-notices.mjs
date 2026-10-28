import { createHash } from 'node:crypto';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCHEMA_VERSION = 1;
export const SITE_URL = 'https://aaroncsic-bit.github.io/xiaki-ge-mirror/';
export const FEED_URL = new URL('data/notices.json', SITE_URL).href;

const CATEGORY_CONFIG = {
  kr_update: {
    label: '韓版更新與活動',
    serverScope: 'KR',
    seaReleaseStatus: 'unconfirmed'
  },
  sea_event: {
    label: 'SEA 活動',
    serverScope: 'SEA',
    seaReleaseStatus: 'confirmed'
  },
  sea_maintenance: {
    label: 'SEA 維修',
    serverScope: 'SEA',
    seaReleaseStatus: 'confirmed'
  },
  xiaki_general: {
    label: '夏希漢化一般公告',
    serverScope: 'XIAXI',
    seaReleaseStatus: 'not_applicable'
  },
  xiaki_release: {
    label: '夏希漢化正式發布公告',
    serverScope: 'XIAXI',
    seaReleaseStatus: 'not_applicable'
  }
};

function decodeHtml(value = '') {
  const named = {
    amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"',
    hellip: '…', middot: '·', ndash: '–', mdash: '—', times: '×'
  };
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&([a-z]+);/gi, (entity, name) => named[name.toLowerCase()] ?? entity);
}

function parseAttributes(source = '') {
  const attributes = {};
  const pattern = /([:\w-]+)\s*=\s*(["'])([\s\S]*?)\2/g;
  for (const match of source.matchAll(pattern)) {
    attributes[match[1]] = decodeHtml(match[3]);
  }
  return attributes;
}

function normalizeLineEndings(value = '') {
  return value.replace(/\r\n?/g, '\n');
}

function normalizePlainText(value = '') {
  return normalizeLineEndings(value)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripHtml(source = '') {
  return normalizePlainText(decodeHtml(normalizeLineEndings(source)
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|svg|dialog)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<button\b[\s\S]*?<\/button>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<\/t[dh]>/gi, '\t')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/(?:address|article|aside|blockquote|div|dl|dt|dd|figcaption|figure|footer|h[1-6]|header|main|nav|ol|p|section|table|ul)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')));
}

function firstElementText(source, tagName) {
  const match = source.match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
  return match ? stripHtml(match[1]) : '';
}

function firstAttribute(source, tagName, attributeName) {
  const match = source.match(new RegExp(`<${tagName}\\b([^>]*)>`, 'i'));
  if (!match) return null;
  return parseAttributes(match[1])[attributeName] ?? null;
}

function extractMaintenanceWindows(source) {
  const container = source.match(/<div\b[^>]*\bclass=["'][^"']*\bmaintenance-times\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  if (!container) return [];

  const windows = [];
  const rowPattern = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  for (const row of container[1].matchAll(rowPattern)) {
    const labelText = firstElementText(row[1], 'strong');
    const displayText = firstElementText(row[1], 'time');
    const labelMatch = labelText.match(/^([^／]+)／(.+)$/);
    const timeMatch = displayText.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日\s+(\d{2}:\d{2})～(\d{2}:\d{2})$/);
    if (!labelMatch || !timeMatch) {
      throw new Error(`無法解析維修時間：${labelText} ${displayText}`.trim());
    }

    const [, year, month, day, startTime, endTime] = timeMatch;
    windows.push({
      timezone_code: labelMatch[1].trim(),
      timezone_label: labelMatch[2].trim(),
      date: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`,
      start_time: startTime,
      end_time: endTime,
      display_text: displayText
    });
  }
  return windows;
}

function extractMainText(html) {
  const match = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  return stripHtml(match?.[1] ?? html);
}

function toPublicUrl(reference) {
  if (!reference) return null;
  return new URL(reference, SITE_URL).href;
}

function localDetailPath(rootDir, href) {
  if (!href || /^(?:[a-z]+:|#|\/\/)/i.test(href)) return null;
  const clean = href.split(/[?#]/, 1)[0].replace(/^\.\//, '');
  if (!clean) return null;
  const candidate = clean.endsWith('/') ? path.join(rootDir, clean, 'index.html') : path.join(rootDir, clean);
  return existsSync(candidate) ? candidate : null;
}

function normalizeMaterial(notice) {
  const {
    revision: _revision,
    updated_at: _updatedAt,
    withdrawn_at: _withdrawnAt,
    content_hash: _contentHash,
    ...material
  } = notice;
  return material;
}

function noticeHash(notice) {
  return `sha256:${createHash('sha256').update(JSON.stringify(normalizeMaterial(notice))).digest('hex')}`;
}

function extractCurrentNotices(rootDir, indexHtml) {
  const notices = [];
  const articlePattern = /<article\b([^>]*\bdata-notice-id="[^"]+"[^>]*)>([\s\S]*?)<\/article>/gi;

  for (const match of indexHtml.matchAll(articlePattern)) {
    const attributes = parseAttributes(match[1]);
    const body = match[2];
    const id = attributes['data-notice-id'];
    const category = attributes['data-notice-category'];
    const categoryConfig = CATEGORY_CONFIG[category];
    if (!categoryConfig) throw new Error(`公告 ${id} 使用未知分類：${category}`);

    const href = firstAttribute(body, 'a', 'href');
    const detailPath = category === 'sea_maintenance' ? null : localDetailPath(rootDir, href);
    const detailText = detailPath ? extractMainText(readFileSync(detailPath, 'utf8')) : null;
    const status = attributes['data-notice-status'] || 'published';
    const title = attributes['data-notice-title'] || firstElementText(body, 'h3');
    const summary = attributes['data-notice-summary'] || firstElementText(body, 'p');
    const publishedAt = attributes['data-notice-published-at'] || null;
    const publishedDate = attributes['data-notice-published-date'] || publishedAt?.slice(0, 10) || firstAttribute(body, 'time', 'datetime')?.slice(0, 10) || null;
    const sourceUrl = attributes['data-notice-source-url'] || null;
    const imageSrc = firstAttribute(body, 'img', 'src');
    const maintenanceWindows = category === 'sea_maintenance' ? extractMaintenanceWindows(body) : null;

    if (!id || !title || !summary || !publishedDate) {
      throw new Error(`公告資料不完整：${id || '(缺少 ID)'}`);
    }

    notices.push({
      id,
      revision: 0,
      status,
      category,
      category_label: categoryConfig.label,
      server_scope: categoryConfig.serverScope,
      sea_release_status: categoryConfig.seaReleaseStatus,
      title,
      summary,
      content_text: detailText || stripHtml(body),
      published_at: publishedAt,
      published_date: publishedDate,
      published_precision: publishedAt ? 'datetime' : 'date',
      updated_at: null,
      url: category === 'sea_maintenance' ? new URL('#maintenance', SITE_URL).href : toPublicUrl(href) || SITE_URL,
      source_url: sourceUrl,
      image_url: toPublicUrl(imageSrc),
      important: attributes['data-notice-important'] === 'true',
      expires_at: attributes['data-notice-expires-at'] || null,
      withdrawn_at: null,
      ...(maintenanceWindows ? { maintenance_windows: maintenanceWindows } : {}),
      content_hash: null
    });
  }

  return notices;
}

function normalizeNow(now) {
  const date = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(date.getTime())) throw new Error(`無效時間：${now}`);
  return date.toISOString();
}

export function buildFeed({ rootDir, indexHtml, previousFeed = null, now = new Date() }) {
  const timestamp = normalizeNow(now);
  const previousNotices = new Map((previousFeed?.notices || []).map(notice => [notice.id, notice]));
  const activeIds = new Set();
  const notices = [];
  let changed = !previousFeed;

  for (const extracted of extractCurrentNotices(rootDir, indexHtml)) {
    if (activeIds.has(extracted.id)) throw new Error(`公告 ID 重複：${extracted.id}`);
    activeIds.add(extracted.id);

    const previous = previousNotices.get(extracted.id);
    const hash = noticeHash(extracted);
    const previousHash = previous
      ? noticeHash({ ...previous, content_text: normalizePlainText(previous.content_text) })
      : null;
    const isChanged = !previous || previousHash !== hash;

    notices.push({
      ...extracted,
      revision: isChanged ? (previous?.revision || 0) + 1 : previous.revision,
      updated_at: isChanged ? timestamp : previous.updated_at,
      withdrawn_at: extracted.status === 'withdrawn'
        ? (previous?.withdrawn_at || timestamp)
        : null,
      content_hash: hash
    });
    changed ||= isChanged;
  }

  for (const previous of previousNotices.values()) {
    if (activeIds.has(previous.id)) continue;
    if (previous.status === 'withdrawn') {
      notices.push(previous);
      continue;
    }

    const withdrawn = {
      ...previous,
      status: 'withdrawn',
      revision: previous.revision + 1,
      updated_at: timestamp,
      withdrawn_at: timestamp,
      content_hash: null
    };
    withdrawn.content_hash = noticeHash(withdrawn);
    notices.push(withdrawn);
    changed = true;
  }

  const feed = {
    schema_version: SCHEMA_VERSION,
    feed_revision: changed ? (previousFeed?.feed_revision || 0) + 1 : previousFeed.feed_revision,
    generated_at: changed ? timestamp : previousFeed.generated_at,
    source: {
      name: '夏希漢化 GitHub 鏡像站',
      site_url: SITE_URL,
      feed_url: FEED_URL
    },
    notices
  };

  validateFeed(feed);
  return feed;
}

export function validateFeed(feed) {
  if (feed?.schema_version !== SCHEMA_VERSION) throw new Error('schema_version 必須為 1。');
  if (!Number.isInteger(feed.feed_revision) || feed.feed_revision < 1) throw new Error('feed_revision 必須是正整數。');
  if (!Array.isArray(feed.notices)) throw new Error('notices 必須是陣列。');

  const ids = new Set();
  for (const notice of feed.notices) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(notice.id || '')) throw new Error(`公告 ID 格式錯誤：${notice.id}`);
    if (ids.has(notice.id)) throw new Error(`公告 ID 重複：${notice.id}`);
    ids.add(notice.id);
    if (!CATEGORY_CONFIG[notice.category]) throw new Error(`未知公告分類：${notice.category}`);
    if (!['published', 'withdrawn'].includes(notice.status)) throw new Error(`未知公告狀態：${notice.status}`);
    if (!Number.isInteger(notice.revision) || notice.revision < 1) throw new Error(`公告 ${notice.id} 修訂版號錯誤。`);
    if (!notice.title || !notice.summary || !notice.content_text) throw new Error(`公告 ${notice.id} 缺少文字內容。`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(notice.published_date || '')) throw new Error(`公告 ${notice.id} 的 published_date 錯誤。`);
    if (notice.published_at === null && notice.published_precision !== 'date') {
      throw new Error(`公告 ${notice.id} 沒有精確時間時，日期精度必須為 date。`);
    }
    if (notice.published_at !== null) {
      if (Number.isNaN(Date.parse(notice.published_at)) || notice.published_precision !== 'datetime') {
        throw new Error(`公告 ${notice.id} 的精確發布時間或日期精度標記錯誤。`);
      }
      if (!notice.published_at.startsWith(notice.published_date)) {
        throw new Error(`公告 ${notice.id} 的 published_at 與 published_date 不一致。`);
      }
    }
    if (notice.status === 'withdrawn' && !notice.withdrawn_at) throw new Error(`撤回公告 ${notice.id} 缺少 withdrawn_at。`);
    if (notice.server_scope === 'KR' && notice.sea_release_status !== 'unconfirmed') {
      throw new Error(`韓版公告 ${notice.id} 不得標記為 SEA 已確認內容。`);
    }
    if (notice.server_scope === 'SEA' && notice.sea_release_status !== 'confirmed') {
      throw new Error(`SEA 公告 ${notice.id} 必須標記為 confirmed。`);
    }
    if (notice.category === 'sea_maintenance') {
      const expectedCodes = ['SGT', 'EST', 'CET'];
      if (!Array.isArray(notice.maintenance_windows) || notice.maintenance_windows.length !== expectedCodes.length) {
        throw new Error(`SEA 維修公告 ${notice.id} 必須包含 SGT、EST、CET 三組維修時間。`);
      }
      const actualCodes = notice.maintenance_windows.map(window => window.timezone_code);
      if (new Set(actualCodes).size !== actualCodes.length || expectedCodes.some(code => !actualCodes.includes(code))) {
        throw new Error(`SEA 維修公告 ${notice.id} 的時區代碼必須是 SGT、EST、CET 且不得重複。`);
      }
      for (const window of notice.maintenance_windows) {
        if (!window.timezone_label || !window.display_text) throw new Error(`SEA 維修公告 ${notice.id} 的時區說明不完整。`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(window.date || '')) throw new Error(`SEA 維修公告 ${notice.id} 的維修日期格式錯誤。`);
        if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(window.start_time || '') || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(window.end_time || '')) {
          throw new Error(`SEA 維修公告 ${notice.id} 的維修時間格式錯誤。`);
        }
      }
    } else if ('maintenance_windows' in notice) {
      throw new Error(`非 SEA 維修公告 ${notice.id} 不應包含 maintenance_windows。`);
    }
    if (!/^sha256:[a-f0-9]{64}$/.test(notice.content_hash || '')) throw new Error(`公告 ${notice.id} 的內容雜湊錯誤。`);
  }
  return true;
}

function parseCliArguments(argv) {
  const argumentsMap = { check: false, now: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--check') argumentsMap.check = true;
    else if (argument === '--now') argumentsMap.now = argv[++index];
    else throw new Error(`未知參數：${argument}`);
  }
  return argumentsMap;
}

function main() {
  const scriptPath = fileURLToPath(import.meta.url);
  const rootDir = path.resolve(path.dirname(scriptPath), '..');
  const outputPath = path.join(rootDir, 'data', 'notices.json');
  const indexHtml = readFileSync(path.join(rootDir, 'index.html'), 'utf8');
  const previousFeed = existsSync(outputPath) ? JSON.parse(readFileSync(outputPath, 'utf8')) : null;
  const cli = parseCliArguments(process.argv.slice(2));
  const feed = buildFeed({ rootDir, indexHtml, previousFeed, now: cli.now || new Date() });
  const serialized = `${JSON.stringify(feed, null, 2)}\n`;

  if (cli.check) {
    const existingFeed = existsSync(outputPath) ? JSON.parse(readFileSync(outputPath, 'utf8')) : null;
    if (!existingFeed || JSON.stringify(existingFeed) !== JSON.stringify(feed)) {
      throw new Error('data/notices.json 尚未與目前 HTML 同步。');
    }
    console.log(`公告 JSON 驗證成功：${feed.notices.length} 篇，feed revision ${feed.feed_revision}`);
    return;
  }

  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, serialized, 'utf8');
  console.log(`已產生 ${outputPath}`);
  console.log(`公告數量：${feed.notices.length}；feed revision：${feed.feed_revision}`);
}

const executedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (executedDirectly) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
