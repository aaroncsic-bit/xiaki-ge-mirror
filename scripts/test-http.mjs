import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const expectedPaths = [
  '/',
  '/data/notices.json',
  '/data/notices.schema.json',
  '/world-kindness-day-event/',
  '/cafe-event/',
  '/risky-memory-test-event/',
  '/theia/',
  '/lisse-enhanced-bullet/',
  '/daily-mission-reward-update/',
  '/october-update/',
  '/pioneer-update/'
];
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp'
};

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    let filePath = path.join(rootDir, pathname);
    if (pathname.endsWith('/')) filePath = path.join(filePath, 'index.html');
    if ((await stat(filePath)).isDirectory()) filePath = path.join(filePath, 'index.html');
    const body = await readFile(filePath);
    response.writeHead(200, { 'Content-Type': contentTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
});

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});

try {
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  for (const pathname of expectedPaths) {
    const response = await fetch(`${baseUrl}${pathname}`);
    if (!response.ok) throw new Error(`${pathname} 回應 ${response.status}`);
  }

  const feedResponse = await fetch(`${baseUrl}/data/notices.json`);
  if (!feedResponse.headers.get('content-type')?.startsWith('application/json')) {
    throw new Error('notices.json 的 Content-Type 不是 application/json。');
  }
  const feed = await feedResponse.json();
  if (feed.schema_version !== 1 || feed.notices.length !== 14) {
    throw new Error('HTTP 取得的公告 JSON 結構或數量錯誤。');
  }

  const schema = await (await fetch(`${baseUrl}/data/notices.schema.json`)).json();
  if (schema.title !== '夏希漢化公告 Feed') throw new Error('公告 schema 無法正確讀取。');

  console.log('本機 HTTP 測試成功：首頁、3 個 SEA 活動頁、5 個韓版子頁、14 篇公告 JSON 與 schema 均可正常讀取。');
} finally {
  await new Promise(resolve => server.close(resolve));
}
