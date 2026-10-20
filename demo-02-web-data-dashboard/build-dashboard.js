// Code node "Build dashboard" (mode: run once for all items).
// Input: the clean book rows. Output: one item with a self-contained HTML dashboard in json.html.

const rows = $input.all().map(i => i.json);
const n = rows.length;
const avg = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const gbp = x => `£${x.toFixed(2)}`;

const inStock = rows.filter(r => r.in_stock).length;
const byRating = [5, 4, 3, 2, 1].map(stars => {
  const group = rows.filter(r => r.rating === stars);
  return { stars, count: group.length, avg_price: avg(group.map(r => r.price_gbp)) };
});
const bestValue = rows.filter(r => r.rating >= 4 && r.in_stock)
  .sort((a, b) => a.price_gbp - b.price_gbp).slice(0, 5);
const maxCount = Math.max(1, ...byRating.map(g => g.count));

const kpi = (label, value) => `<div class="kpi"><div class="v">${value}</div><div class="l">${label}</div></div>`;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Book catalogue dashboard</title><style>
body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;margin:0;background:#f6f5f2;color:#1d1d1b}
main{max-width:960px;margin:0 auto;padding:32px 16px}h1{font-size:22px;margin:0 0 4px}p.sub{color:#666;margin:0 0 24px;font-size:14px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:24px}
.kpi{background:#fff;border-radius:10px;padding:16px;border:1px solid #e6e3dc}.kpi .v{font-size:26px;font-weight:650}.kpi .l{color:#666;font-size:13px}
section{background:#fff;border:1px solid #e6e3dc;border-radius:10px;padding:16px;margin-bottom:16px}h2{font-size:15px;margin:0 0 12px}
.bar{display:flex;align-items:center;gap:8px;font-size:13px;margin:6px 0}.bar span:first-child{width:56px}.bar .b{height:14px;background:#3b6e8f;border-radius:3px}
table{width:100%;border-collapse:collapse;font-size:13px}td,th{padding:6px 8px;border-bottom:1px solid #eee;text-align:left}th{color:#666;font-weight:600}
</style></head><body><main>
<h1>Book catalogue · price and rating overview</h1>
<p class="sub">Source: books.toscrape.com (a public practice site), ${n} books from the first catalogue pages. Built automatically by n8n.</p>
<div class="kpis">${kpi('books', n)}${kpi('average price', gbp(avg(rows.map(r => r.price_gbp))))}${kpi('in stock', `${n ? Math.round(100 * inStock / n) : 0}%`)}${kpi('average rating', `${avg(rows.map(r => r.rating)).toFixed(1)} ★`)}</div>
<section><h2>Books by rating</h2>${byRating.map(g =>
  `<div class="bar"><span>${'★'.repeat(g.stars)}</span><div class="b" style="width:${Math.round(320 * g.count / maxCount)}px"></div><span>${g.count} · avg ${gbp(g.avg_price)}</span></div>`).join('')}</section>
<section><h2>Best value: cheapest books rated 4★ or more, in stock</h2><table><tr><th>Title</th><th>Rating</th><th>Price</th></tr>
${bestValue.map(r => `<tr><td><a href="${esc(r.url)}">${esc(r.title)}</a></td><td>${'★'.repeat(r.rating)}</td><td>${gbp(r.price_gbp)}</td></tr>`).join('')}</table></section>
</main></body></html>`;

return [{ json: { html, books: n, in_stock: inStock, best_value: bestValue.map(r => r.title) } }];
