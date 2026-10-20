// Renders the README images that are not screenshots of the demos' own output:
//   - <demo>/example-output/workflow.png : diagram drawn from the demo's workflow.json (node names, positions, links)
//   - demo-01 .../sheet-preview.png      : the rows of example-output/invoices.xlsx's CSV twin, laid out like a sheet
// It writes HTML to a temp folder and shoots it with headless Chrome (separate temp profile).
// Usage (repo root): node tools/render-visuals.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-visuals-'));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function shoot(html, outFile, width, height) {
  const page = path.join(TMP, path.basename(outFile, '.png') + '.html');
  fs.writeFileSync(page, html);
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', `--user-data-dir=${path.join(TMP, 'profile')}`,
    '--hide-scrollbars', `--window-size=${width},${height}`, `--screenshot=${outFile}`, 'file:///' + page.replace(/\\/g, '/')],
  { stdio: 'ignore' });
  console.log('written', path.relative(ROOT, outFile));
}

const KIND = {
  'n8n-nodes-base.manualTrigger': ['#e8743b', 'trigger'],
  'n8n-nodes-base.readWriteFile': ['#3b6e8f', 'files'],
  'n8n-nodes-base.extractFromFile': ['#3b6e8f', 'extract'],
  'n8n-nodes-base.httpRequest': ['#2f8f83', 'HTTP'],
  'n8n-nodes-base.code': ['#5f5d58', 'code'],
  'n8n-nodes-base.convertToFile': ['#2f7d4f', 'convert'],
  'n8n-nodes-base.if': ['#7a4fa0', 'if'],
};

function diagram(demoDir, caption) {
  const wf = JSON.parse(fs.readFileSync(path.join(ROOT, demoDir, 'workflow.json'), 'utf8'));
  const xs = wf.nodes.map(n => n.position[0]), ys = wf.nodes.map(n => n.position[1]);
  const S = 0.82, PAD = 70, BOX = 64;
  const W = Math.round((Math.max(...xs) - Math.min(...xs)) * S + PAD * 2 + 120);
  const H = Math.round((Math.max(...ys) - Math.min(...ys)) * S + PAD * 2 + 120);
  const at = n => [(n.position[0] - Math.min(...xs)) * S + PAD + 60, (n.position[1] - Math.min(...ys)) * S + PAD + 30];
  const byName = Object.fromEntries(wf.nodes.map(n => [n.name, n]));
  let edges = '';
  for (const [from, out] of Object.entries(wf.connections)) {
    out.main.forEach((targets, branch) => targets.forEach(t => {
      const [x1, y1] = at(byName[from]), [x2, y2] = at(byName[t.node]);
      const a = [x1 + BOX / 2, y1], b = [x2 - BOX / 2, y2], mx = (a[0] + b[0]) / 2;
      edges += `<path d="M${a[0]},${a[1]} C${mx},${a[1]} ${mx},${b[1]} ${b[0]},${b[1]}" />`;
      if (byName[from].type === 'n8n-nodes-base.if') {
        edges += `<text x="${a[0] + 8}" y="${a[1] - 8}" class="lbl">${branch === 0 ? 'true' : 'false'}</text>`;
      }
    }));
  }
  const nodes = wf.nodes.map(n => {
    const isModel = n.type === 'n8n-nodes-base.httpRequest' && /openai\.com/.test(n.parameters.url || '');
    const [x, y] = at(n), [color, tag] = isModel ? ['#b5651d', 'AI'] : KIND[n.type] || ['#5f5d58', 'node'];
    return `<div class="n" style="left:${x - BOX / 2}px;top:${y - BOX / 2}px;border-color:${color}">
      <div class="tag" style="background:${color}">${tag}</div></div>
      <div class="name" style="left:${x - 70}px;top:${y + BOX / 2 + 8}px">${esc(n.name)}</div>`;
  }).join('');
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;background:#f6f5f2;font-family:system-ui,"Segoe UI",sans-serif;width:${W}px;height:${H + 40}px;position:relative}
    svg{position:absolute;inset:0}path{fill:none;stroke:#9a978f;stroke-width:2}.lbl{font-size:12px;fill:#7a4fa0}
    .n{position:absolute;width:${BOX}px;height:${BOX}px;background:#fff;border:2px solid;border-radius:12px;display:flex;align-items:center;justify-content:center}
    .tag{color:#fff;font-size:11px;font-weight:650;padding:3px 6px;border-radius:5px;text-transform:uppercase;letter-spacing:.03em}
    .name{position:absolute;width:140px;text-align:center;font-size:13px;color:#1d1d1b;font-weight:600}
    .cap{position:absolute;left:16px;bottom:12px;font-size:12px;color:#5f5d58}</style>
    <svg width="${W}" height="${H}">${edges}</svg>${nodes}<div class="cap">${esc(caption)}</div>`;
  shoot(html, path.join(ROOT, demoDir, 'example-output', 'workflow.png'), W, H + 40);
}

function sheetPreview() {
  const dir = path.join(ROOT, 'demo-01-invoice-to-sheet', 'example-output');
  const run = fs.readFileSync(path.join(ROOT, 'demo-01-invoice-to-sheet', 'output', 'last-run.json'), 'utf8');
  // Rows exactly as the last n8n run produced them (the items that reached "Rows to spreadsheet").
  const rows = [...run.matchAll(/\{\s*"File":[^{}]*\}/g)].map(m => JSON.parse(m[0]));
  const unique = [...new Map(rows.map(r => [r.File, r])).values()];
  const cols = Object.keys(unique[0]);
  const num = v => typeof v === 'number';
  const fmt = (k, v) => (num(v) && k !== 'VAT %' ? v.toFixed(2) : v);
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;background:#fff;font-family:Calibri,"Segoe UI",sans-serif;font-size:14px}
    .bar{background:#1f6e43;color:#fff;padding:8px 12px;font-size:13px}.bar b{font-weight:650}
    table{border-collapse:collapse;margin:0}td,th{border:1px solid #d4d4d4;padding:5px 9px;white-space:nowrap}
    th{background:#f3f3f3;font-weight:650;text-align:left}td.c{color:#888;background:#f3f3f3;text-align:center;width:24px}
    td.r{text-align:right}tr.rev td{background:#fff4e5}tr.rev td.c{background:#f3f3f3}
    .tab{display:inline-block;margin:8px 12px;padding:4px 14px;border-bottom:3px solid #1f6e43;font-size:13px}</style>
    <div class="bar"><b>invoices.xlsx</b> · written by n8n · synthetic data</div>
    <table><tr><td class="c">1</td>${cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr>
    ${unique.map((r, i) => `<tr class="${r.Status === 'OK' ? '' : 'rev'}"><td class="c">${i + 2}</td>${cols.map(c =>
      `<td class="${num(r[c]) ? 'r' : ''}">${esc(fmt(c, r[c]))}</td>`).join('')}</tr>`).join('')}</table>
    <div class="tab">Invoices</div>`;
  shoot(html, path.join(dir, 'sheet-preview.png'), 1240, 260);
}

function triagePreview() {
  const dir = path.join(ROOT, 'demo-03-email-triage-agent', 'example-output');
  const run = fs.readFileSync(path.join(ROOT, 'demo-03-email-triage-agent', 'output', 'last-run.json'), 'utf8');
  // Rows exactly as the last n8n run produced them (the items that left "Check model answer").
  const found = [...run.matchAll(/\{\s*"ID":[^{}]*\}/g)].map(m => JSON.parse(m[0]));
  const body = [...new Map(found.map(r => [r.ID, r])).values()];
  const show = ['Subject', 'Category', 'Urgency', 'Needs a person', 'Summary'];
  const tag = v => ({ high: '#b23b3b', low: '#7a7770', yes: '#b5651d' }[v] || '#1d1d1b');
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;background:#fff;font-family:"Segoe UI",system-ui,sans-serif;font-size:13px;width:1240px}
    .bar{background:#1d1d1b;color:#fff;padding:9px 12px}.bar b{font-weight:650}
    table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #e3dfd6;padding:7px 10px;text-align:left;vertical-align:top}
    th{background:#f6f5f2;color:#5f5d58;font-weight:650}td.s{color:#5f5d58;max-width:520px}td.k{font-weight:650;white-space:nowrap}</style>
    <div class="bar"><b>triage.csv</b> · written by n8n · 8 synthetic emails · every reply is a draft waiting for approval</div>
    <table><tr>${show.map(h => `<th>${esc(h)}</th>`).join('')}</tr>
    ${body.map(r => `<tr>${show.map(h => {
      const v = r[h];
      return h === 'Summary' ? `<td class="s">${esc(v)}</td>` : `<td class="k" style="color:${tag(v)}">${esc(v)}</td>`;
    }).join('')}</tr>`).join('')}</table>`;
  shoot(html, path.join(dir, 'triage-preview.png'), 1240, 390);
}

diagram('demo-01-invoice-to-sheet', 'Diagram generated from workflow.json (n8n 2.32.6)');
diagram('demo-02-web-data-dashboard', 'Diagram generated from workflow.json (n8n 2.32.6)');
diagram('demo-03-email-triage-agent', 'Diagram generated from workflow.json (n8n 2.32.6, gpt-4.1-mini-2025-04-14)');
sheetPreview();
triagePreview();
fs.rmSync(TMP, { recursive: true, force: true });
