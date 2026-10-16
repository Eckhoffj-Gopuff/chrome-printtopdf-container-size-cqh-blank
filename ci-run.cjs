// CI runner: print repro.html and repro-control.html through Page.printToPDF for one browser
// configuration, then print a one-line result and append a Markdown row to $GITHUB_STEP_SUMMARY.
//
// Usage: node ci-run.cjs <channel> <label>
//   channel: "chromium" (Playwright's headless shell, the old headless implementation), one of
//            "chrome", "chrome-beta", "chrome-dev", "chrome-canary", "msedge" (new headless),
//            or "path" to launch the binary in $EXECUTABLE_PATH (used for the known-good build).
//
// Three measurements per run, so a blank result can be trusted:
//   repro   : repro.html, the page under test.
//   control : repro-control.html, the same page with a fixed font size. It must print content.
//   empty   : an empty page. It must print under the blank threshold. This checks the threshold itself.
// Verdicts:
//   BLANK    : repro is under 3,000 bytes while the control is over it.
//   prints   : repro is over 3,000 bytes.
//   INVALID  : the control is blank, or the empty page is not blank. The setup is wrong, so the row is no data.
const { chromium } = require('playwright');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const channel = process.argv[2] || 'chromium';
const label = process.argv[3] || channel;
const BLANK_UNDER = 3000;

async function sizeOf(browser, html) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.setContent(html);
  const bytes = (await page.pdf({ printBackground: true, width: '583px', height: '350px' })).length;
  await page.close();
  return bytes;
}
const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');

function launchOptions() {
  if (channel === 'path') {
    if (!process.env.EXECUTABLE_PATH) throw new Error('EXECUTABLE_PATH is not set');
    return { executablePath: process.env.EXECUTABLE_PATH };
  }
  return channel === 'chromium' ? {} : { channel };
}

(async () => {
  const browser = await chromium.launch(launchOptions());
  const repro = await sizeOf(browser, read('repro.html'));
  const control = await sizeOf(browser, read('repro-control.html'));
  const empty = await sizeOf(browser, '<!doctype html><title>empty</title>');
  const version = browser.version();
  await browser.close();
  let verdict;
  if (control < BLANK_UNDER) verdict = 'INVALID (control is blank)';
  else if (empty >= BLANK_UNDER) verdict = 'INVALID (empty page is not blank, threshold is wrong)';
  else verdict = repro < BLANK_UNDER ? 'BLANK' : 'prints';
  const line = `${os.type()} ${os.release()} ${os.arch()} | ${label} | Chrome ${version} | repro=${repro} control=${control} empty=${empty} | ${verdict}`;
  console.log(line);
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `| ${os.type()} ${os.arch()} | ${label} | ${version} | ${repro} | ${control} | ${empty} | ${verdict} |\n`);
  }
})().catch((e) => {
  console.log(`${os.type()} ${os.arch()} | ${label} | ERROR | ${String(e.message).split('\n')[0]}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `| ${os.type()} ${os.arch()} | ${label} | - | - | - | - | ERROR: ${String(e.message).split('\n')[0]} |\n`);
  }
  process.exitCode = 0; // a launch failure is a data point, not a CI failure
});
