// Builds workflow.json from the Code node sources, so they are never edited inside the JSON.
// The OpenAI credential is referenced by id only; the key itself is never in this file.
// Usage (repo root): node demo-03-email-triage-agent/build-workflow.js
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const read = f => fs.readFileSync(path.join(dir, f), 'utf8');
const node = (id, name, type, typeVersion, position, parameters, extra = {}) =>
  ({ id, name, type, typeVersion, position, parameters, ...extra });
const link = to => ({ main: [[{ node: to, type: 'main', index: 0 }]] });
const code = file => ({ mode: 'runOnceForAllItems', language: 'javaScript', jsCode: read(file) });

const workflow = {
  id: 'Demo03EmailTriageAgent',
  name: 'Demo 03 · Email triage agent with human approval (synthetic emails)',
  settings: { executionOrder: 'v1', saveManualExecutions: true, executionTimeout: 300 },
  pinData: {},
  nodes: [
    node('start', 'Start', 'n8n-nodes-base.manualTrigger', 1, [0, 0], {}),
    node('read', 'Read inbox', 'n8n-nodes-base.readWriteFile', 1, [220, 0],
      { operation: 'read', fileSelector: '/demo/samples/emails.json', options: {} }),
    node('split', 'Split emails', 'n8n-nodes-base.code', 2, [440, 0], code('split-emails.js')),
    node('build', 'Build model request', 'n8n-nodes-base.code', 2, [660, 0], code('build-request.js')),
    node('model', 'Ask the model', 'n8n-nodes-base.httpRequest', 4.2, [880, 0], {
      method: 'POST',
      url: 'https://api.openai.com/v1/chat/completions',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'openAiApi',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '={{ JSON.stringify($json.request) }}',
      options: { batching: { batch: { batchSize: 1, batchInterval: 500 } }, timeout: 60000 },
    }, { credentials: { openAiApi: { id: 'openaiDemo', name: 'OpenAI (demo)' } } }),
    node('check', 'Check model answer', 'n8n-nodes-base.code', 2, [1100, 0], code('validate.js')),
    node('to-csv', 'Rows to CSV', 'n8n-nodes-base.convertToFile', 1.1, [1320, -120],
      { operation: 'csv', options: { fileName: 'triage.csv', headerRow: true } }),
    node('save-csv', 'Save triage table', 'n8n-nodes-base.readWriteFile', 1, [1540, -120],
      { operation: 'write', fileName: '/demo/output/triage.csv', options: {} }),
    node('drafts', 'Build approval list', 'n8n-nodes-base.code', 2, [1320, 120], code('build-drafts.js')),
    node('to-md', 'Approval list to file', 'n8n-nodes-base.convertToFile', 1.1, [1540, 120],
      { operation: 'toText', sourceProperty: 'markdown', options: { fileName: 'drafts-for-approval.md' } }),
    node('save-md', 'Save approval list', 'n8n-nodes-base.readWriteFile', 1, [1760, 120],
      { operation: 'write', fileName: '/demo/output/drafts-for-approval.md', options: {} }),
  ],
  connections: {
    'Start': link('Read inbox'),
    'Read inbox': link('Split emails'),
    'Split emails': link('Build model request'),
    'Build model request': link('Ask the model'),
    'Ask the model': link('Check model answer'),
    'Check model answer': { main: [[
      { node: 'Rows to CSV', type: 'main', index: 0 },
      { node: 'Build approval list', type: 'main', index: 0 },
    ]] },
    'Rows to CSV': link('Save triage table'),
    'Build approval list': link('Approval list to file'),
    'Approval list to file': link('Save approval list'),
  },
};

fs.writeFileSync(path.join(dir, 'workflow.json'), JSON.stringify(workflow, null, 2) + '\n');
console.log('workflow.json written');
