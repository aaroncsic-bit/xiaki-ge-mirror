import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const page = readFileSync(path.join(root, 'blackout/index.html'), 'utf8');
const home = readFileSync(path.join(root, 'index.html'), 'utf8');
const videos = [...page.matchAll(/<video\b[^>]*>/g)].map(match => match[0]);
assert.equal(videos.length, 18);
assert.equal(new Set(videos.map(tag => /src="([^"]+)"/.exec(tag)[1])).size, 10);
assert.ok(videos.every(tag => /src="https:\/\/rs-kr\.hanbiton\.com\//.test(tag) && /data-poster="[^"]+"/.test(tag)));
assert.ok(videos.every(tag => /preload="none"/.test(tag)));
for (const id of ['story', 'field', 'item', 'mission', 'character', 'raid']) {
  assert.equal([...page.matchAll(new RegExp(`<section id="${id}"`, 'g'))].length, 1);
}
assert.ok(/<main>[\s\S]*id="story"[\s\S]*id="raid"[\s\S]*<\/main>/.test(page));
assert.ok(!/[가-힣]/.test(page), 'HTML 不得殘留未翻譯韓文');
assert.ok(!/Home\/Home.aspx|hide-today|assetBaseGE|__VIEWSTATE/.test(page), '不得帶入官方帳號或入口功能');
assert.ok(page.includes('琳恩') && page.includes('大衣'));
assert.ok(!page.includes('長外套') && !/琳[！：]/.test(page));
for (const match of page.matchAll(/(?:src|href|data-poster)="([^"]+)"/g)) {
  const url = match[1];
  if (/^(https?:|data:|#)/.test(url)) continue;
  const target = path.resolve(root, 'blackout', url.split(/[?#]/)[0]);
  assert.ok(existsSync(target), `本機素材不存在：${url}`);
}
const feed = JSON.parse(readFileSync(path.join(root, 'data/notices.json'), 'utf8'));
const notice = feed.notices.find(row => row.id === 'kr-2026-10-30-blackout');
assert.equal(notice.category, 'kr_update');
assert.equal(notice.server_scope, 'KR');
assert.equal(notice.sea_release_status, 'unconfirmed');
assert.equal(notice.revision, 2);
assert.equal(notice.published_at, null);
for (const text of ['琳恩', '大衣', '伊奈克斯模組', '確保機械化人偶', '塞爾維托爾']) assert.ok(notice.content_text.includes(text));
assert.ok(!notice.content_text.includes('ALL RIGHTS RESERVED'), '公告正文不得混入頁尾');
assert.ok(home.indexOf('kr-2026-10-30-blackout') < home.indexOf('kr-2026-10-16-daily-mission-reward-revision'));
assert.ok(home.includes('news-image--blackout'));
console.log('BLACKOUT 結構檢查成功：六區、10 支／18 個影片、海報、本機素材、核定用名與韓版公告入口。');
