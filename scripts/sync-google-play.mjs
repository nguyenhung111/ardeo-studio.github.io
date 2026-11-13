import { readFile, writeFile } from 'node:fs/promises';
import googlePlay from 'google-play-scraper';

const developerId = '5648326289880756592';
const countries = ['us', 'vn'];
const catalogs = await Promise.all(countries.map(country =>
  googlePlay.developer({ devId: developerId, lang: 'en', country, num: 250 })
));

const appsById = new Map();
for (const [index, catalog] of catalogs.entries()) {
  for (const { appId, title, summary, icon } of catalog) {
    if (!/^[a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+$/.test(appId) ||
        typeof title !== 'string' || !title.trim() ||
        typeof icon !== 'string' || !icon.startsWith('https://')) {
      throw new Error('Google Play returned incomplete app metadata');
    }
    if (!appsById.has(appId)) {
      appsById.set(appId, { appId, title, summary: summary || '', icon, country: countries[index] });
    }
  }
}

if (!appsById.size) {
  throw new Error('Google Play returned an empty catalog');
}

const catalogPath = new URL('../apps.json', import.meta.url);
const previous = await readFile(catalogPath, 'utf8').catch(error => {
  if (error.code !== 'ENOENT') throw error;
  return '[]';
});
const missing = JSON.parse(previous).filter(app => !appsById.has(app.appId));
if (missing.length) {
  throw new Error('Previously synced apps missing: ' + missing.map(app => app.appId).join(', '));
}

const apps = [];
for (const { country, ...app } of appsById.values()) {
  const { minInstalls } = await googlePlay.app({ appId: app.appId, lang: 'en', country });
  if (!Number.isSafeInteger(minInstalls) || minInstalls < 0) {
    throw new Error('Google Play download count unavailable for ' + app.appId);
  }
  apps.push({ ...app, minInstalls });
}
apps.sort((a, b) => b.minInstalls - a.minInstalls ||
  a.title.localeCompare(b.title, 'en') || a.appId.localeCompare(b.appId, 'en'));

await writeFile(catalogPath, JSON.stringify(apps, null, 2) + '\n');
console.log('Synced ' + apps.length + ' Google Play apps');
