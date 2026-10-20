// Builds workflow.json from parse-invoice.js, so the Code node is never edited by hand inside the JSON.
// Usage (repo root): node demo-01-invoice-to-sheet/build-workflow.js
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const parseCode = fs.readFileSync(path.join(dir, 'parse-invoice.js'), 'utf8');

const node = (id, name, type, typeVersion, position, parameters) => ({ id, name, type, typeVersion, position, parameters });
const link = to => ({ main: [[{ node: to, type: 'main', index: 0 }]] });

const workflow = {
  id: 'Demo01InvoiceToSheet',
  name: 'Demo 01 · Invoice PDFs to spreadsheet (synthetic data)',
  settings: { executionOrder: 'v1', saveManualExecutions: true, executionTimeout: 120 },
  pinData: {},
  nodes: [
    node('start', 'Start', 'n8n-nodes-base.manualTrigger', 1, [0, 0], {}),
    node('read', 'Read invoices', 'n8n-nodes-base.readWriteFile', 1, [220, 0],
      { operation: 'read', fileSelector: '/demo/samples/*.pdf', options: {} }),
    node('extract', 'Extract text', 'n8n-nodes-base.extractFromFile', 1, [440, 0],
      { operation: 'pdf', binaryPropertyName: 'data', options: {} }),
    node('parse', 'Parse invoice fields', 'n8n-nodes-base.code', 2, [660, 0],
      { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: parseCode }),
    node('to-xlsx', 'Rows to spreadsheet', 'n8n-nodes-base.convertToFile', 1.1, [880, -120],
      { operation: 'xlsx', options: { fileName: 'invoices.xlsx', headerRow: true, sheetName: 'Invoices' } }),
    node('save-xlsx', 'Save spreadsheet', 'n8n-nodes-base.readWriteFile', 1, [1100, -120],
      { operation: 'write', fileName: '/demo/output/invoices.xlsx', options: {} }),
    node('needs-review', 'Needs review?', 'n8n-nodes-base.if', 2.2, [880, 120], {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [{ id: 'review', leftValue: '={{ $json.Status }}', rightValue: 'NEEDS REVIEW',
          operator: { type: 'string', operation: 'equals' } }],
        combinator: 'and',
      },
      options: {},
    }),
    node('to-csv', 'Review list to CSV', 'n8n-nodes-base.convertToFile', 1.1, [1100, 120],
      { operation: 'csv', options: { fileName: 'needs-review.csv', headerRow: true } }),
    node('save-csv', 'Save review list', 'n8n-nodes-base.readWriteFile', 1, [1320, 120],
      { operation: 'write', fileName: '/demo/output/needs-review.csv', options: {} }),
  ],
  connections: {
    'Start': link('Read invoices'),
    'Read invoices': link('Extract text'),
    'Extract text': link('Parse invoice fields'),
    'Parse invoice fields': { main: [[
      { node: 'Rows to spreadsheet', type: 'main', index: 0 },
      { node: 'Needs review?', type: 'main', index: 0 },
    ]] },
    'Rows to spreadsheet': link('Save spreadsheet'),
    'Needs review?': { main: [[{ node: 'Review list to CSV', type: 'main', index: 0 }], []] },
    'Review list to CSV': link('Save review list'),
  },
};

fs.writeFileSync(path.join(dir, 'workflow.json'), JSON.stringify(workflow, null, 2) + '\n');
console.log('workflow.json written');
