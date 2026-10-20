// Screenshots of the real n8n canvas for each demo, from a local n8n UI (see local/, not in Git).
// Logs in with the local test account in local/n8n-local-account.json, opens each workflow in a
// headless Chrome driven over the DevTools protocol, and saves <demo>/example-output/n8n-canvas.png.
// Usage (repo root, local n8n running on the url in that file): node tools/n8n-canvas-shots.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9333;
const account = JSON.parse(fs.readFileSync(path.join(ROOT, 'local', 'n8n-local-account.json'), 'utf8'));
const SHOTS = [
  ['Demo01InvoiceToSheet', 'demo-01-invoice-to-sheet'],
  ['Demo02WebDataDashboard', 'demo-02-web-data-dashboard'],
  ['Demo03EmailTriageAgent', 'demo-03-email-triage-agent'],
];
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function login() {
  for (const body of [{ emailOrLdapLoginId: account.email, password: account.password }, { email: account.email, password: account.password }]) {
    const r = await fetch(`${account.url}/rest/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const cookie = (r.headers.getSetCookie?.() || []).find(c => c.startsWith('n8n-auth='));
    if (r.ok && cookie) return cookie.split(';')[0].slice('n8n-auth='.length);
  }
  throw new Error('login to local n8n failed');
}

function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { const { ok, ko } = pending.get(m.id); pending.delete(m.id); m.error ? ko(new Error(m.error.message)) : ok(m.result); }
  };
  const ready = new Promise((ok, ko) => { ws.onopen = ok; ws.onerror = ko; });
  const send = (method, params = {}, sessionId) => new Promise((ok, ko) => {
    const msg = { id: ++id, method, params };
    if (sessionId) msg.sessionId = sessionId;
    pending.set(msg.id, { ok, ko });
    ws.send(JSON.stringify(msg));
  });
  return { ready, send, close: () => ws.close() };
}

(async () => {
  const token = await login();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'n8n-shots-'));
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    '--hide-scrollbars', '--window-size=1600,900', 'about:blank'], { stdio: 'ignore' });
  try {
    let version;
    for (let i = 0; i < 40 && !version; i++) { try { version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); } catch { await sleep(250); } }
    const c = cdp(version.webSocketDebuggerUrl);
    await c.ready;
    const { targetId } = await c.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await c.send('Target.attachToTarget', { targetId, flatten: true });
    await c.send('Network.enable', {}, sessionId);
    await c.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
    await c.send('Network.setCookie', { name: 'n8n-auth', value: token, url: account.url, path: '/' }, sessionId);
    const only = process.argv.slice(2);
    for (const [id, demo] of SHOTS.filter(([i]) => !only.length || only.includes(i))) {
      await c.send('Page.navigate', { url: `${account.url}/workflow/${id}` }, sessionId);
      await sleep(only.length ? 15000 : 7000);
      const { data } = await c.send('Page.captureScreenshot', { format: 'png' }, sessionId);
      const out = path.join(ROOT, demo, 'example-output', 'n8n-canvas.png');
      fs.writeFileSync(out, Buffer.from(data, 'base64'));
      console.log('written', path.relative(ROOT, out));
    }
    c.close();
  } finally {
    chrome.kill();
    await sleep(500);
    fs.rmSync(profile, { recursive: true, force: true });
  }
})().catch(e => { console.error(e.message); process.exit(1); });
