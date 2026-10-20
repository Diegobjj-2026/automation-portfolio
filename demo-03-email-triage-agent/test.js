// Tests for demo 03.
// Part 1, no model and no key: the Code nodes run with fake inputs, to check the safety rules in code.
// Part 2, if output/ exists: grades the last real run against the expected answers in samples/emails.json.
// Usage (repo root): node demo-03-email-triage-agent/test.js
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const dir = __dirname;
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
async function codeNode(file, items, refs = {}, helpers = {}) {
  const fn = new AsyncFunction('$input', '$', fs.readFileSync(path.join(dir, file), 'utf8'));
  const out = await fn.call({ helpers }, { all: () => items.map(json => ({ json })) },
    name => ({ all: () => (refs[name] || []).map(json => ({ json })) }));
  return out.map(r => r.json);
}
const samples = JSON.parse(fs.readFileSync(path.join(dir, 'samples', 'emails.json'), 'utf8'));
const answer = (a, extra = {}) => ({ choices: [{ message: { content: typeof a === 'string' ? a : JSON.stringify(a) } }], ...extra });
const good = { category: 'quote_request', urgency: 'normal', summary: 's', needs_human: false, reply_draft: 'Hello' };
const email = { id: 'm1', from: 'a@example.com', subject: 'S' };

const tests = [];
const t = (name, f) => tests.push([name, f]);

t('the expected answers never reach the model', async () => {
  const buf = Buffer.from(JSON.stringify(samples));
  const split = await codeNode('split-emails.js', [{}], {}, { getBinaryDataBuffer: async () => buf });
  assert.strictEqual(split.length, 8);
  assert.ok(split.every(e => !('expected' in e)));
  const built = await codeNode('build-request.js', split);
  assert.ok(!JSON.stringify(built.map(b => b.request)).includes('expected'));
  assert.ok(built.every(b => b.request.temperature === 0 && b.request.response_format.json_schema.strict === true));
});
t('a valid answer becomes a row with a draft waiting for approval', async () => {
  const [r] = await codeNode('validate.js', [answer(good)], { 'Build model request': [email] });
  assert.strictEqual(r.Category, 'quote_request');
  assert.strictEqual(r['Reply status'], 'DRAFT, waiting for approval');
  assert.strictEqual(r.Checks, '');
});
t('a complaint always goes to a person, even if the model says no', async () => {
  const [r] = await codeNode('validate.js', [answer({ ...good, category: 'complaint_or_incident' })], { 'Build model request': [email] });
  assert.strictEqual(r['Needs a person'], 'yes');
  assert.match(r.Checks, /by rule/);
});
t('high urgency always goes to a person', async () => {
  const [r] = await codeNode('validate.js', [answer({ ...good, urgency: 'high' })], { 'Build model request': [email] });
  assert.strictEqual(r['Needs a person'], 'yes');
});
t('broken or off-format answers become "other" for a person, never a draft', async () => {
  const bad = [answer('not json'), answer({ ...good, category: 'refund' }), answer({ ...good, needs_human: 'no' }), {}];
  const rows = await codeNode('validate.js', bad, { 'Build model request': bad.map(() => email) });
  for (const r of rows) {
    assert.deepStrictEqual([r.Category, r['Needs a person'], r['Reply draft']], ['other', 'yes', '']);
    assert.match(r.Checks, /did not fit/);
  }
});
t('the approval list puts urgent emails first and says nothing was sent', async () => {
  const rows = [
    { Subject: 'B', Urgency: 'normal', 'Needs a person': 'no', 'Reply draft': 'x', From: 'f', Category: 'c', Summary: 's', Checks: '' },
    { Subject: 'A', Urgency: 'high', 'Needs a person': 'yes', 'Reply draft': 'y', From: 'f', Category: 'c', Summary: 's', Checks: '' },
  ];
  const [{ markdown }] = await codeNode('build-drafts.js', rows);
  assert.ok(markdown.indexOf('## 🔴 A') < markdown.indexOf('## B'));
  assert.match(markdown, /Nothing has been sent/);
});

const csvFile = path.join(dir, 'output', 'triage.csv');
if (fs.existsSync(csvFile)) {
  const parseCsv = text => {
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    const [head, ...body] = rows;
    return body.filter(r => r.length > 1).map(r => Object.fromEntries(head.map((h, i) => [h.replace(/^﻿/, ''), r[i]])));
  };
  const rows = parseCsv(fs.readFileSync(csvFile, 'utf8'));
  const byId = Object.fromEntries(rows.map(r => [r.ID, r]));
  t('last run: every email graded, category right in 8 of 8', () => {
    assert.strictEqual(rows.length, 8);
    const wrong = samples.filter(s => byId[s.id]?.Category !== s.expected.category).map(s => `${s.id}=${byId[s.id]?.Category}`);
    assert.deepStrictEqual(wrong, []);
  });
  t('last run: urgency right where it is unambiguous (leak high, spam low)', () => {
    for (const s of samples.filter(x => x.expected.urgency)) assert.strictEqual(byId[s.id].Urgency, s.expected.urgency, s.id);
  });
  t('last run: complaints and urgent emails go to a person; spam gets no reply', () => {
    for (const r of rows) {
      if (r.Category === 'complaint_or_incident' || r.Urgency === 'high') assert.strictEqual(r['Needs a person'], 'yes', r.ID);
      if (r.Category === 'spam_or_marketing') assert.strictEqual(r['Reply draft'], '', r.ID);
    }
  });
  t('last run: drafts promise no prices and guess no gender', () => {
    for (const r of rows) {
      assert.ok(!/(€|\$|EUR|USD)\s?\d|\d\s?(€|EUR|USD)/.test(r['Reply draft']), `price in ${r.ID}`);
      assert.ok(!/\b(Mr|Mrs|Ms|Sir|Madam)\b/.test(r['Reply draft']), `title in ${r.ID}`);
    }
  });
  t('last run: no secret in any output file', () => {
    for (const f of fs.readdirSync(path.join(dir, 'output'))) {
      assert.ok(!/sk-[A-Za-z0-9_-]{20,}/.test(fs.readFileSync(path.join(dir, 'output', f), 'utf8')), f);
    }
  });
} else {
  console.log('SKIP last run: output/ not found (run run-local.sh with OPENAI_API_KEY first)');
}

(async () => {
  let ok = 0, ko = 0;
  for (const [name, f] of tests) {
    try { await f(); ok++; console.log(`OK  ${name}`); } catch (e) { ko++; console.log(`KO  ${name}: ${e.message}`); }
  }
  console.log(`${ok} OK / ${ko} KO`);
  process.exit(ko ? 1 : 0);
})();
