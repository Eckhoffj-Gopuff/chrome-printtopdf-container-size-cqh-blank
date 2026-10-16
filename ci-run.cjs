// CI runner: print repro.html and repro-control.html through Page.printToPDF for one browser
// configuration, then print a one-line result and append a Markdown row to $GITHUB_STEP_SUMMARY.
//
// Usage: node ci-run.cjs <channel> <label>
//   channel: "chromium" (Playwright's headless shell, the old headless implementation), or one of
//            "chrome", "chrome-beta", "chrome-dev", "chrome-canary", "msedge" (new headless).
// A PDF under 3,000 bytes with nothing drawn is reported as BLANK. The control must be above 3,000 bytes.
const { chromium } = require('playwright');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const channel = process.argv[2] || 'chromium';
const label = process.argv[3] || channel;
const BLANK_UNDER = 3000;

async function sizeOf(browser, file) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.setContent(fs.readFileSync(path.join(__dirname, file), 'utf8'));
  const bytes = (await page.pdf({ printBackground: true, width: '583px', height: '350px' })).length;
  await page.close();
  return bytes;
}

(async () => {
  const browser = await chromium.launch(channel === 'chromium' ? {} : { channel });
  const repro = await sizeOf(browser, 'repro.html');
  const control = await sizeOf(browser, 'repro-control.html');
  const version = browser.version();
  await browser.close();
  const verdict = control < BLANK_UNDER ? 'INVALID (control is blank)' : repro < BLANK_UNDER ? 'BLANK' : 'prints';
  const line = `${os.type()} ${os.release()} ${os.arch()} | ${label} | Chrome ${version} | repro=${repro} control=${control} | ${verdict}`;
  console.log(line);
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `| ${os.type()} ${os.arch()} | ${label} | ${version} | ${repro} | ${control} | ${verdict} |\n`);
  }
})().catch((e) => {
  console.log(`${os.type()} ${os.arch()} | ${label} | ERROR | ${String(e.message).split('\n')[0]}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `| ${os.type()} ${os.arch()} | ${label} | - | - | - | ERROR: ${String(e.message).split('\n')[0]} |\n`);
  }
  process.exitCode = 0; // a launch failure is a data point, not a CI failure
});
