// Load a page, report how it looks on screen, then print it with Page.printToPDF (page.pdf).
// Usage: node print.cjs [file.html]
const { chromium } = require('playwright');
const fs = require('fs');
const file = process.argv[2] || __dirname + '/repro.html';

(async () => {
  for (const [label, opts] of [['Playwright Chromium', {}], ['Google Chrome', { channel: 'chrome' }]]) {
    const browser = await chromium.launch(opts);
    const sizes = [];
    let screen;
    for (let run = 0; run < 3; run++) {
      const p = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await p.setContent(fs.readFileSync(file, 'utf8'));
      screen = await p.evaluate(() => {
        const t = document.querySelector('.text');
        const r = t.getBoundingClientRect();
        return `font-size ${getComputedStyle(t).fontSize}, box ${Math.round(r.width)}x${Math.round(r.height)}`;
      });
      sizes.push((await p.pdf({ printBackground: true, width: '583px', height: '350px' })).length);
      await p.close();
    }
    console.log(`${label.padEnd(20)} ${browser.version().padEnd(16)} screen: ${screen} | pdf bytes x3: ${sizes.join(', ')} ${Math.max(...sizes) < 3000 ? 'BLANK' : 'has content'}`);
    await browser.close();
  }
})();
