import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFeed, validateFeed } from './generate-notices.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const originalHtml = readFileSync(path.join(rootDir, 'index.html'), 'utf8');

const initialFeed = buildFeed({
  rootDir,
  indexHtml: originalHtml,
  previousFeed: null,
  now: '2026-10-14T10:00:00.000Z'
});

assert.equal(initialFeed.notices.length, 7, '應轉換 7 篇既有公告');
assert.equal(initialFeed.notices.filter(notice => notice.category === 'sea_event').length, 3);
assert.equal(initialFeed.notices.filter(notice => notice.category === 'kr_update').length, 3);
assert.equal(initialFeed.notices.filter(notice => notice.category === 'sea_maintenance').length, 1);
assert.ok(initialFeed.notices.every(notice => notice.revision === 1));
assert.ok(initialFeed.notices.every(notice => notice.published_at === null));
assert.ok(initialFeed.notices.filter(notice => notice.server_scope === 'KR').every(notice => notice.sea_release_status === 'unconfirmed'));
validateFeed(initialFeed);

const unchangedFeed = buildFeed({
  rootDir,
  indexHtml: originalHtml,
  previousFeed: initialFeed,
  now: '2026-10-14T11:00:00.000Z'
});
assert.equal(unchangedFeed.feed_revision, 1, '未修改內容不得增加 feed_revision');
assert.equal(unchangedFeed.generated_at, initialFeed.generated_at, '未修改內容不得改寫 generated_at');
assert.ok(unchangedFeed.notices.every(notice => notice.revision === 1));

const crlfFeed = buildFeed({
  rootDir,
  indexHtml: originalHtml.replace(/\r?\n/g, '\r\n'),
  previousFeed: null,
  now: '2026-10-14T10:00:00.000Z'
});
const lfFeed = buildFeed({
  rootDir,
  indexHtml: originalHtml.replace(/\r?\n/g, '\n'),
  previousFeed: crlfFeed,
  now: '2026-10-14T11:00:00.000Z'
});
assert.equal(lfFeed.feed_revision, 1, '換行格式不同不得增加 feed_revision');
assert.ok(lfFeed.notices.every(notice => notice.revision === 1), '換行格式不同不得增加公告修訂版號');

const changedHtml = originalHtml.replace(
  '任務活動結束，目前剩下禮包內容。',
  '任務活動結束，測試修訂內容。'
);
assert.notEqual(changedHtml, originalHtml, '測試必須實際修改公告內容');

const revisedFeed = buildFeed({
  rootDir,
  indexHtml: changedHtml,
  previousFeed: initialFeed,
  now: '2026-10-14T12:00:00.000Z'
});
const revisedNotice = revisedFeed.notices.find(notice => notice.id === 'sea-event-2026-09-30-20th-anniversary-extension');
assert.equal(revisedFeed.feed_revision, 2);
assert.equal(revisedNotice.revision, 2, '修改後應保留 ID 並增加修訂版號');
assert.equal(revisedNotice.status, 'published');

const escapedId = 'sea-event-2026-09-30-20th-anniversary-extension';
const withdrawnHtml = changedHtml.replace(
  new RegExp(`<article\\b[^>]*data-notice-id="${escapedId}"[^>]*>[\\s\\S]*?<\\/article>`, 'i'),
  ''
);
const withdrawnFeed = buildFeed({
  rootDir,
  indexHtml: withdrawnHtml,
  previousFeed: revisedFeed,
  now: '2026-10-14T13:00:00.000Z'
});
const withdrawnNotice = withdrawnFeed.notices.find(notice => notice.id === escapedId);
assert.equal(withdrawnFeed.notices.length, 7, '撤回公告應保留墓碑紀錄');
assert.equal(withdrawnNotice.revision, 3, '撤回時應再次增加修訂版號');
assert.equal(withdrawnNotice.status, 'withdrawn');
assert.equal(withdrawnNotice.withdrawn_at, '2026-10-14T13:00:00.000Z');
validateFeed(withdrawnFeed);

const futureCategoryMarkup = `
  <article data-notice-id="xiaki-general-test" data-notice-category="xiaki_general" data-notice-published-date="2026-10-14" data-notice-published-at="2026-10-14T21:00:00+08:00" data-notice-important="true" data-notice-status="published">
    <a href="#feedback"><h3>夏希漢化一般公告測試</h3></a><p>一般公告分類測試內容。</p>
  </article>
  <article data-notice-id="xiaki-release-test" data-notice-category="xiaki_release" data-notice-published-date="2026-10-14" data-notice-published-at="2026-10-14T22:00:00+08:00" data-notice-important="true" data-notice-status="published">
    <a href="#top"><h3>夏希漢化正式發布測試</h3></a><p>正式發布分類測試內容。</p>
  </article>`;
const allCategoryHtml = originalHtml.replace('</main>', `${futureCategoryMarkup}\n</main>`);
const allCategoryFeed = buildFeed({
  rootDir,
  indexHtml: allCategoryHtml,
  previousFeed: initialFeed,
  now: '2026-10-14T14:00:00.000Z'
});
const generalNotice = allCategoryFeed.notices.find(notice => notice.id === 'xiaki-general-test');
const releaseNotice = allCategoryFeed.notices.find(notice => notice.id === 'xiaki-release-test');
assert.equal(generalNotice.category, 'xiaki_general');
assert.equal(releaseNotice.category, 'xiaki_release');
assert.equal(generalNotice.server_scope, 'XIAXI');
assert.equal(generalNotice.published_precision, 'datetime');
assert.equal(generalNotice.published_at, '2026-10-14T21:00:00+08:00');
validateFeed(allCategoryFeed);

console.log('公告接口測試成功：7 篇轉換、未變更、修改、撤回、五種分類與日期精度規則均通過。');
