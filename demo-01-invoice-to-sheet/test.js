// Tests for parse-invoice.js without n8n: it runs the Code node source with a fake $input and $().
// Then it checks the last real n8n run (output/needs-review.csv and output/last-run.json) if they exist.
// Usage (repo root): node demo-01-invoice-to-sheet/test.js
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const src = fs.readFileSync(path.join(__dirname, 'parse-invoice.js'), 'utf8');
const runNode = (texts) => {
  const items = texts.map(text => ({ json: { text } }));
  const files = texts.map((_, i) => ({ binary: { data: { fileName: `f${i}.pdf` } } }));
  const fn = new Function('$input', '$', src);
  return fn({ all: () => items }, () => ({ all: () => files })).map(r => r.json);
};

const invoice = ({ vat = 'VAT 21%: 103.53 EUR', total = '596.53', net = '493.00' } = {}) =>
  `Northwind Building Supplies Ltd\nIndustrial Estate, Unit 4 · Sample City · VAT ID: XX-000000 (sample)\nINVOICE\n` +
  `Invoice number: NW-2026-0141\nInvoice date: 2026-10-02\nNet amount: ${net} EUR\n${vat}\nTotal: ${total} EUR`;

let ok = 0;
const t = (name, f) => { f(); ok++; console.log(`OK  ${name}`); };

t('complete invoice is OK, with readable columns in spreadsheet order', () => {
  const [r] = runNode([invoice()]);
  assert.deepStrictEqual(r, {
    'File': 'f0.pdf', 'Supplier': 'Northwind Building Supplies Ltd', 'Invoice no.': 'NW-2026-0141',
    'Invoice date': '2026-10-02', 'Net (EUR)': 493, 'VAT %': 21, 'VAT (EUR)': 103.53, 'Total (EUR)': 596.53,
    'Status': 'OK', 'What to check': '',
  });
  assert.deepStrictEqual(Object.keys(r), ['File', 'Supplier', 'Invoice no.', 'Invoice date', 'Net (EUR)',
    'VAT %', 'VAT (EUR)', 'Total (EUR)', 'Status', 'What to check']);
});
t('the "VAT ID" in the address is not read as a VAT rate', () => {
  const [r] = runNode([invoice({ vat: '', total: '493.00' })]);
  assert.strictEqual(r['VAT %'], '');
});
t('missing VAT line goes to review, in plain words', () => {
  const [r] = runNode([invoice({ vat: '', total: '493.00' })]);
  assert.strictEqual(r.Status, 'NEEDS REVIEW');
  assert.strictEqual(r['What to check'], 'missing VAT rate; missing VAT amount');
});
t('totals that do not add up go to review', () => {
  const [r] = runNode([invoice({ total: '600.00' })]);
  assert.strictEqual(r.Status, 'NEEDS REVIEW');
  assert.strictEqual(r['What to check'], 'net + VAT does not equal total');
});
t('thousands separator is parsed', () => {
  const [r] = runNode([invoice({ net: '1,234.50', vat: 'VAT 21%: 259.25 EUR', total: '1,493.75' })]);
  assert.strictEqual(r['Net (EUR)'], 1234.5);
  assert.strictEqual(r.Status, 'OK');
});
t('empty text never passes as OK', () => {
  const [r] = runNode(['']);
  assert.strictEqual(r.Status, 'NEEDS REVIEW');
});
t('file name comes from the matching input file', () => {
  const rows = runNode([invoice(), invoice()]);
  assert.deepStrictEqual(rows.map(r => r.File), ['f0.pdf', 'f1.pdf']);
});

const runFile = path.join(__dirname, 'output', 'last-run.json');
const reviewFile = path.join(__dirname, 'output', 'needs-review.csv');
if (fs.existsSync(runFile) && fs.existsSync(reviewFile)) {
  t('last n8n run: 3 OK and 1 NEEDS REVIEW (inv-2026-0144, no VAT)', () => {
    const raw = fs.readFileSync(runFile, 'utf8');
    const statuses = [...raw.matchAll(/"File":\s*"([^"]+)"[\s\S]*?"Status":\s*"(OK|NEEDS REVIEW)"/g)]
      .map(m => `${m[1]}=${m[2]}`);
    assert.deepStrictEqual([...new Set(statuses)].sort(), [
      'inv-2026-0141.pdf=OK', 'inv-2026-0142.pdf=OK', 'inv-2026-0143.pdf=OK', 'inv-2026-0144.pdf=NEEDS REVIEW']);
    const review = fs.readFileSync(reviewFile, 'utf8').trim().split(/\r?\n/);
    assert.strictEqual(review.length, 2);
    assert.ok(review[1].startsWith('inv-2026-0144.pdf,'));
  });
} else {
  console.log('SKIP last n8n run: output/ not found (run run-local.sh first)');
}
console.log(`${ok} OK / 0 KO`);
