// Builds workflow.json from parse-books.js and build-dashboard.js, so Code nodes are never edited inside the JSON.
// Usage (repo root): node demo-02-web-data-dashboard/build-workflow.js
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const read = f => fs.readFileSync(path.join(dir, f), 'utf8');
const PAGES = 5;

const node = (id, name, type, typeVersion, position, parameters) => ({ id, name, type, typeVersion, position, parameters });
const link = to => ({ main: [[{ node: to, type: 'main', index: 0 }]] });

const workflow = {
  id: 'Demo02WebDataDashboard',
  name: 'Demo 02 · Web data to a clean table and a dashboard (public practice site)',
  settings: { executionOrder: 'v1', saveManualExecutions: true, executionTimeout: 180 },
  pinData: {},
  nodes: [
    node('start', 'Start', 'n8n-nodes-base.manualTrigger', 1, [0, 0], {}),
    node('urls', 'Page URLs', 'n8n-nodes-base.code', 2, [220, 0], {
      mode: 'runOnceForAllItems', language: 'javaScript',
      jsCode: `// One item per catalogue page. Change PAGES to collect more.\nconst PAGES = ${PAGES};\n` +
        `return Array.from({ length: PAGES }, (_, i) => ({ json: { page: i + 1, url: \`http://books.toscrape.com/catalogue/page-\${i + 1}.html\` } }));\n`,
    }),
    node('fetch', 'Fetch pages', 'n8n-nodes-base.httpRequest', 4.2, [440, 0], {
      url: '={{ $json.url }}',
      options: { response: { response: { responseFormat: 'text' } }, batching: { batch: { batchSize: 1, batchInterval: 1000 } } },
    }),
    node('parse', 'Parse and clean books', 'n8n-nodes-base.code', 2, [660, 0],
      { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: read('parse-books.js') }),
    node('to-csv', 'Rows to CSV', 'n8n-nodes-base.convertToFile', 1.1, [880, -120],
      { operation: 'csv', options: { fileName: 'books.csv', headerRow: true } }),
    node('save-csv', 'Save table', 'n8n-nodes-base.readWriteFile', 1, [1100, -120],
      { operation: 'write', fileName: '/demo/output/books.csv', options: {} }),
    node('dash', 'Build dashboard', 'n8n-nodes-base.code', 2, [880, 120],
      { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: read('build-dashboard.js') }),
    node('to-html', 'Dashboard to file', 'n8n-nodes-base.convertToFile', 1.1, [1100, 120],
      { operation: 'toText', sourceProperty: 'html', options: { fileName: 'dashboard.html' } }),
    node('save-html', 'Save dashboard', 'n8n-nodes-base.readWriteFile', 1, [1320, 120],
      { operation: 'write', fileName: '/demo/output/dashboard.html', options: {} }),
  ],
  connections: {
    'Start': link('Page URLs'),
    'Page URLs': link('Fetch pages'),
    'Fetch pages': link('Parse and clean books'),
    'Parse and clean books': { main: [[
      { node: 'Rows to CSV', type: 'main', index: 0 },
      { node: 'Build dashboard', type: 'main', index: 0 },
    ]] },
    'Rows to CSV': link('Save table'),
    'Build dashboard': link('Dashboard to file'),
    'Dashboard to file': link('Save dashboard'),
  },
};

fs.writeFileSync(path.join(dir, 'workflow.json'), JSON.stringify(workflow, null, 2) + '\n');
console.log('workflow.json written');
