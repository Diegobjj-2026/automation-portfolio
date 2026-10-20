// Tests for parse-books.js and build-dashboard.js without n8n, using a saved page (fixtures/page-1.html).
// Then it checks the last real n8n run (output/books.csv) if it exists.
// Usage (repo root): node demo-02-web-data-dashboard/test.js
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const dir = __dirname;
const codeNode = (file, items, refs = {}) => {
  const fn = new Function('$input', '$', 'console', fs.readFileSync(path.join(dir, file), 'utf8'));
  const quiet = { log: () => {} };
  return fn({ all: () => items.map(json => ({ json })) }, name => ({ all: () => (refs[name] || []).map(json => ({ json })) }), quiet)
    .map(r => r.json);
};
const page1 = fs.readFileSync(path.join(dir, 'fixtures', 'page-1.html'), 'utf8');
const parse = htmls => codeNode('parse-books.js', htmls.map(data => ({ data })), { 'Page URLs': htmls.map((_, i) => ({ page: i + 1 })) });

let ok = 0;
const t = (name, f) => { f(); ok++; console.log(`OK  ${name}`); };

t('a real catalogue page gives 20 books', () => assert.strictEqual(parse([page1]).length, 20));
t('first book is read correctly', () => {
  const [b] = parse([page1]);
  assert.deepStrictEqual(b, { title: 'A Light in the Attic', price_gbp: 51.77, rating: 3, in_stock: true, page: 1,
    url: 'http://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html' });
});
t('the same page twice is deduplicated', () => assert.strictEqual(parse([page1, page1]).length, 20));
t('a block without price is dropped, not invented', () => {
  const broken = page1.replace(/class="price_color">[^<]*</, 'class="price_color"><');
  assert.strictEqual(parse([broken]).length, 19);
});
t('every rating is between 1 and 5 and every price is positive', () => {
  for (const b of parse([page1])) { assert.ok(b.rating >= 1 && b.rating <= 5); assert.ok(b.price_gbp > 0); }
});
t('dashboard numbers and best-value filter', () => {
  const rows = [
    { title: 'A', price_gbp: 10, rating: 5, in_stock: true, url: 'u1' },
    { title: 'B', price_gbp: 5, rating: 3, in_stock: true, url: 'u2' },
    { title: 'C', price_gbp: 8, rating: 4, in_stock: false, url: 'u3' },
    { title: 'D', price_gbp: 20, rating: 4, in_stock: true, url: 'u4' },
  ];
  const [d] = codeNode('build-dashboard.js', rows);
  assert.strictEqual(d.books, 4);
  assert.strictEqual(d.in_stock, 3);
  assert.deepStrictEqual(d.best_value, ['A', 'D']); // B is 3 stars, C is out of stock
  assert.ok(d.html.includes('£10.75'));             // average price
});
t('titles are escaped in the dashboard HTML', () => {
  const [d] = codeNode('build-dashboard.js', [{ title: '<script>x</script>', price_gbp: 1, rating: 5, in_stock: true, url: 'u' }]);
  assert.ok(!d.html.includes('<script>x'));
  assert.ok(d.html.includes('&lt;script&gt;x'));
});

const csv = path.join(dir, 'output', 'books.csv');
if (fs.existsSync(csv)) {
  t('last n8n run: 100 unique books from pages 1-5', () => {
    const lines = fs.readFileSync(csv, 'utf8').trim().split(/\r?\n/).slice(1);
    const urls = lines.map(l => l.split(',').pop());
    assert.strictEqual(lines.length, 100);
    assert.strictEqual(new Set(urls).size, 100);
  });
} else {
  console.log('SKIP last n8n run: output/books.csv not found (run run-local.sh first)');
}
console.log(`${ok} OK / 0 KO`);
