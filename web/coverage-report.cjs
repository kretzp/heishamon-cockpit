const fs = require('node:fs');
const path = require('node:path');
const { createCoverageMap } = require('istanbul-lib-coverage');
const { createSourceMapStore } = require('istanbul-lib-source-maps');
const libReport = require('istanbul-lib-report');
const reports = require('istanbul-reports');

(async () => {
  const root = path.resolve(__dirname, '../.cache/coverage/frontend');
  const map = createCoverageMap({});
  for (const file of fs.readdirSync(path.join(root, 'raw'))) {
    if (file.endsWith('.json')) map.merge(JSON.parse(fs.readFileSync(path.join(root, 'raw', file), 'utf8')));
  }
  if (!map.files().length) throw Error('No frontend coverage collected');
  const store = createSourceMapStore();
  const transformed = await store.transformCoverage(map);
  const context = libReport.createContext({ dir: path.join(root, 'report'), coverageMap: transformed, sourceFinder: store.sourceFinder.bind(store) });
  for (const kind of ['json', 'json-summary', 'html', 'text']) reports.create(kind).execute(context);
})().catch(e => { console.error(e); process.exitCode = 1; });
