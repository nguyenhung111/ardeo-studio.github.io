import { readFile, writeFile } from 'node:fs/promises';
import googlePlay from 'google-play-scraper';

const developerId = '5648326289880756592';
const countries = ['us', 'vn'];
const catalogs = await Promise.all(countries.map(country =>
  googlePlay.developer({ devId: developerId, lang: 'en', country, num: 250 })
));

const appsById = new Map();
for (const catalog of catalogs) {
  for (const { appId, title, summary, icon } of catalog) {
    if (!/^[a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+$/.test(appId) ||
        typeof title !== 'string' || !title.trim() ||
        typeof icon !== 'string' || !icon.startsWith('https://')) {
      throw new Error('Google Play returned incomplete app metadata');
    }
    if (!appsById.has(appId)) {
      appsById.set(appId, { appId, title, summary: summary || '', icon });
    }
  }
}

if (!appsById.size) {
  throw new Error('Google Play returned an empty catalog');
}

const catalogPath = new URL('../apps.json', import.meta.url);
const apps = [...appsById.values()].sort((a, b) => a.title.localeCompare(b.title, 'en'));
const previous = await readFile(catalogPath, 'utf8').catch(error => {
  if (error.code !== 'ENOENT') throw error;
  return '[]';
});
const missing = JSON.parse(previous).filter(app => !appsById.has(app.appId));
if (missing.length) {
  throw new Error('Previously synced apps missing: ' + missing.map(app => app.appId).join(', '));
}

await writeFile(catalogPath, JSON.stringify(apps, null, 2) + '\n');
console.log('Synced ' + apps.length + ' Google Play apps');
