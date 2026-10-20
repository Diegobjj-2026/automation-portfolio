// Code node "Parse invoice fields" (mode: run once for all items).
// Input: one item per PDF from "Extract text", with the text in json.text.
// Output: one spreadsheet row per invoice, with readable column names, a Status and a plain
// "What to check" so a person reviews anything incomplete. Nothing is guessed.
// build-workflow.js inlines this file into workflow.json; test.js runs it with a fake $input.

const files = $('Read invoices').all();

const FIELDS = [
  ['supplier', 'Supplier'],
  ['invoice_number', 'Invoice no.'],
  ['invoice_date', 'Invoice date'],
  ['net', 'Net (EUR)'],
  ['vat_rate', 'VAT %'],
  ['vat', 'VAT (EUR)'],
  ['total', 'Total (EUR)'],
];
const CHECK = {
  supplier: 'supplier name', invoice_number: 'invoice number', invoice_date: 'invoice date',
  net: 'net amount', vat_rate: 'VAT rate', vat: 'VAT amount', total: 'total',
};

function find(text, re) {
  const m = text.match(re);
  return m ? m[1].trim() : null;
}

function amount(text, re) {
  const raw = find(text, re);
  return raw === null ? null : Number(raw.replace(/,/g, ''));
}

return $input.all().map((item, i) => {
  const text = item.json.text || '';
  const v = {
    supplier: (text.split('\n').map(l => l.trim()).find(Boolean)) || null,
    invoice_number: find(text, /Invoice number:\s*(\S+)/i),
    invoice_date: find(text, /Invoice date:\s*(\d{4}-\d{2}-\d{2})/i),
    net: amount(text, /Net amount:\s*([\d,]+\.\d{2})/i),
    vat_rate: amount(text, /VAT\s*(\d+(?:\.\d+)?)%/i),
    vat: amount(text, /VAT\s*\d+(?:\.\d+)?%:\s*([\d,]+\.\d{2})/i),
    total: amount(text, /Total:\s*([\d,]+\.\d{2})/i),
  };
  const missing = Object.keys(CHECK).filter(k => v[k] === null).map(k => `missing ${CHECK[k]}`);
  if (missing.length === 0 && Math.abs(v.net + v.vat - v.total) > 0.01) {
    missing.push('net + VAT does not equal total');
  }
  const row = { File: files[i]?.binary?.data?.fileName ?? `invoice-${i + 1}.pdf` };
  for (const [key, label] of FIELDS) row[label] = v[key] ?? '';
  row.Status = missing.length ? 'NEEDS REVIEW' : 'OK';
  row['What to check'] = missing.join('; ');
  return { json: row };
});
