// Bisect the "headless Page.printToPDF is blank" regression by Chromium main-branch position, using Chromium
// snapshot builds (https://storage.googleapis.com/chromium-browser-snapshots).
//
// Usage (from this directory, after `npm install`):
//   GOOD_POS=1047731 BAD_POS=1058933 node position-bisect.cjs
//
// Environment:
//   GOOD_POS, BAD_POS   Chromium main-branch positions. A build at GOOD_POS must print repro.html; a build at BAD_POS must not.
//   SNAPSHOT_PLATFORM   Bucket directory: Linux_x64 (default), Mac_Arm, Mac, Win_x64.
//   ENDPOINTS_ONLY=1    Only check that the nearest builds to GOOD_POS and BAD_POS behave as expected, then stop.
//   MAX_TRIES           Neighbouring snapshots to try when one does not run (default 8).
//
// How a build is classified (the same harness as the "pw-107" and "pw-108" CI targets: Playwright 1.27.1, page.pdf):
//   good  : repro.html prints >= 3,000 bytes, the control prints >= 3,000, an empty page prints < 3,000.
//   bad   : repro.html prints < 3,000 bytes, the control prints >= 3,000, an empty page prints < 3,000.
//   skip  : anything else (the build did not start, hung, or the control or empty check is wrong).
// Snapshots are sparse and some do not run, so each probe walks outward from the middle until a build is usable.
// Each build is deleted after it is tested.
const { chromium } = require('playwright');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const PLATFORM = process.env.SNAPSHOT_PLATFORM || 'Linux_x64';
const MAX_TRIES = Number(process.env.MAX_TRIES || 8);
const BLANK_UNDER = 3000;
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), 'bisect-'));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const probes = []; // every probe, for the summary

let good = Number(process.env.GOOD_POS);
let bad = Number(process.env.BAD_POS);
if (!good || !bad || good >= bad) {
  console.error('Set GOOD_POS and BAD_POS (GOOD_POS < BAD_POS).');
  process.exit(2);
}

const html = {
  repro: fs.readFileSync(path.join(ROOT, 'repro.html'), 'utf8'),
  control: fs.readFileSync(path.join(ROOT, 'repro-control.html'), 'utf8'),
  empty: '<!doctype html><title>empty</title>',
};

/** Snapshot positions in [from, to] from the bucket listing (one request per 100 positions). */
function listSnapshots(from, to) {
  const found = new Set();
  const seen = new Set();
  for (let p = from; p <= to; p += 100) {
    const prefix = `${PLATFORM}/${String(p).slice(0, -2)}`;
    if (seen.has(prefix)) continue;
    seen.add(prefix);
    const r = spawnSync('curl', ['-s', `https://storage.googleapis.com/storage/v1/b/chromium-browser-snapshots/o?prefix=${prefix}&delimiter=/&maxResults=1000`], { encoding: 'utf8' });
    try {
      for (const x of JSON.parse(r.stdout).prefixes || []) {
        const n = Number(x.split('/')[1]);
        if (n >= from && n <= to) found.add(n);
      }
    } catch { /* ignore a bad page */ }
  }
  return [...found].sort((a, b) => a - b);
}

const withTimeout = (promise, ms, what) =>
  Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error(`${what} timed out after ${ms} ms`)), ms))]);

async function measure(bin) {
  const browser = await withTimeout(chromium.launch({ executablePath: bin, args: ['--no-sandbox'], timeout: 30000 }), 40000, 'launch');
  try {
    const out = {};
    for (const [name, content] of Object.entries(html)) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await page.setContent(content);
      out[name] = (await withTimeout(page.pdf({ printBackground: true, width: '583px', height: '350px' }), 40000, 'pdf')).length;
      await page.close();
    }
    return { ...out, version: browser.version() };
  } finally {
    await browser.close().catch(() => {});
  }
}

async function classify(rev) {
  const dir = path.join(WORK, String(rev));
  const install = spawnSync('npx', ['--yes', '@puppeteer/browsers', 'install', `chromium@${rev}`, '--path', dir], { encoding: 'utf8' });
  const line = (install.stdout || '').trim().split('\n').pop() || '';
  const bin = line.split(/\s(?=\/)/).pop();
  if (!bin || !fs.existsSync(bin)) {
    log(`  r${rev}: install failed`);
    probes.push({ rev, verdict: 'skip', note: 'install failed' });
    return 'skip';
  }
  let verdict = 'skip';
  let note = '';
  try {
    const m = await measure(bin);
    if (m.control < BLANK_UNDER || m.empty >= BLANK_UNDER) { verdict = 'skip'; note = 'control or empty check is wrong'; }
    else verdict = m.repro < BLANK_UNDER ? 'bad' : 'good';
    probes.push({ rev, verdict, version: m.version, repro: m.repro, control: m.control, empty: m.empty, note });
    log(`  r${rev} (${m.version}): repro=${m.repro} control=${m.control} empty=${m.empty} -> ${verdict}${note ? ` (${note})` : ''}`);
  } catch (e) {
    note = String(e.message).split('\n')[0].slice(0, 80);
    probes.push({ rev, verdict: 'skip', note });
    log(`  r${rev}: ${note}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  return verdict;
}

/** First usable build at or after `start` (for an endpoint), or null. */
async function firstUsable(snaps, start, expected) {
  for (const rev of snaps.filter((n) => n >= start).slice(0, MAX_TRIES)) {
    const v = await classify(rev);
    if (v === expected) return rev;
    if (v !== 'skip') return { wrong: rev, verdict: v };
  }
  return null;
}

function crrev(pos) {
  const r = spawnSync('curl', ['-s', `https://cr-rev.appspot.com/_ah/api/crrev/v1/redirect/${pos}`], { encoding: 'utf8' });
  try { return JSON.parse(r.stdout).git_sha || ''; } catch { return ''; }
}

function summarize(lines) {
  const text = lines.join('\n') + '\n';
  console.log('\n' + text);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
}

(async () => {
  log(`platform ${PLATFORM}, good=${good}, bad=${bad}`);
  // List a little past BAD_POS: the exact position may have no snapshot, and the nearest build after it is a valid "bad" end.
  const snaps = listSnapshots(good, bad + 300);
  log(`${snaps.length} snapshots in range`);

  // Endpoints. If they do not behave as expected, the setup is wrong and the bisect would be meaningless.
  const g = await firstUsable(snaps, good, 'good');
  if (typeof g !== 'number') {
    summarize(['## Position bisect: FAILED', '', `The build nearest GOOD_POS ${good} did not print repro.html (${g ? `r${g.wrong} was ${g.verdict}` : 'no build ran'}). Fix the setup or the range.`]);
    process.exit(1);
  }
  const b = await firstUsable(snaps, bad, 'bad');
  if (typeof b !== 'number') {
    summarize(['## Position bisect: FAILED', '', `The build nearest BAD_POS ${bad} was not blank (${b ? `r${b.wrong} was ${b.verdict}` : 'no build ran'}). Fix the setup or the range.`]);
    process.exit(1);
  }
  good = g;
  bad = b;
  log(`endpoints ok: good r${good}, bad r${bad}`);
  if (process.env.ENDPOINTS_ONLY) { summarize(['## Position bisect: endpoints OK', '', `good r${good}, bad r${bad}`]); return; }

  for (let step = 0; step < 40; step++) {
    const inRange = snaps.filter((n) => n > good && n < bad);
    if (inRange.length === 0) break;
    const mid = inRange[Math.floor(inRange.length / 2)];
    log(`step ${step}: range r${good}..r${bad} (${inRange.length} snapshots), probing from r${mid}`);
    const order = inRange.slice().sort((x, y) => Math.abs(x - mid) - Math.abs(y - mid));
    let decided = false;
    for (const rev of order.slice(0, MAX_TRIES)) {
      const v = await classify(rev);
      if (v === 'good') { good = rev; decided = true; break; }
      if (v === 'bad') { bad = rev; decided = true; break; }
    }
    if (!decided) { log('no usable build near the middle; stopping'); break; }
  }

  const goodSha = crrev(good);
  const badSha = crrev(bad);
  const lines = [
    '## Position bisect result',
    '',
    `Platform: ${PLATFORM}. Last good: **r${good}** \`${goodSha}\`. First bad: **r${bad}** \`${badSha}\`.`,
    '',
    goodSha && badSha ? `Changelog: https://chromium.googlesource.com/chromium/src/+log/${goodSha}..${badSha}` : 'Could not resolve the commit hashes.',
    '',
    `The range is ${bad - good} positions. ${bad - good > 1 ? 'Snapshots are sparse or some did not run, so it is a range and not one commit.' : 'Adjacent positions: the first bad commit is r' + bad + '.'}`,
    '',
    '| position | version | repro | control | empty | verdict | note |',
    '|---|---|---|---|---|---|---|',
    ...probes.map((p) => `| ${p.rev} | ${p.version || ''} | ${p.repro ?? ''} | ${p.control ?? ''} | ${p.empty ?? ''} | ${p.verdict} | ${p.note || ''} |`),
  ];
  summarize(lines);
  fs.rmSync(WORK, { recursive: true, force: true });
})().catch((e) => { console.error(e); process.exit(1); });
