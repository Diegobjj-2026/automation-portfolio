// Code node "Parse and clean books" (mode: run once for all items).
// Input: one item per catalogue page from "Fetch pages" (HTML in json.data), in the same order as "Page URLs".
// Output: one clean row per book, deduplicated by URL. Blocks that cannot be read are dropped and logged.

const pages = $('Page URLs').all();
const RATING = { One: 1, Two: 2, Three: 3, Four: 4, Five: 5 };
const BASE = 'http://books.toscrape.com/catalogue/';

const seen = new Set();
const rows = [];
let unreadable = 0;

$input.all().forEach((item, i) => {
  const html = String(item.json.data || '');
  const page = pages[i]?.json?.page ?? i + 1;
  for (const block of html.split('<article class="product_pod">').slice(1)) {
    const href = block.match(/<h3><a href="([^"]+)"/);
    const title = block.match(/<h3><a [^>]*title="([^"]+)"/);
    const price = block.match(/class="price_color">[^\d<]*([\d.]+)</);
    const rating = block.match(/class="star-rating (\w+)"/);
    if (!href || !title || !price || !rating || !RATING[rating[1]]) { unreadable++; continue; }
    const url = BASE + href[1].replace(/^(\.\.\/)+(catalogue\/)?/, '');
    if (seen.has(url)) continue;
    seen.add(url);
    rows.push({
      title: title[1].replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"'),
      price_gbp: Number(price[1]),
      rating: RATING[rating[1]],
      in_stock: /In stock/.test(block),
      page,
      url,
    });
  }
});

if (unreadable > 0) console.log(`Parse and clean books: ${unreadable} unreadable blocks dropped`);
return rows.map(r => ({ json: r }));
