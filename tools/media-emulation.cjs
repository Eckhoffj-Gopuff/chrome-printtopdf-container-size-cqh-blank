// Does an @media print rule still apply in printToPDF when the page has emulated media "screen"? (Snowboard's exporter does that.)
const { chromium } = require('playwright');
const fs = require('fs');
const base = fs.readFileSync('/repro/repro.html', 'utf8');
const withPrint = base.replace('</style>', '@media print { .container { container-type: normal } .text { font-size: 22.88px } } </style>');
(async () => {
  const browser = await chromium.launch();
  console.log(`Chromium ${browser.version()}`);
  const cases = {
    'no @media print rule, default media (the bug)': { html: base, media: null },
    '@media print rule, default media': { html: withPrint, media: null },
    '@media print rule, emulated media "screen"': { html: withPrint, media: 'screen' },
    '@media print rule, emulated media "print"': { html: withPrint, media: 'print' },
    '@media print rule, "screen" + prefers-color-scheme (like the exporter)': { html: withPrint, media: 'screen', features: [{ name: 'prefers-color-scheme', value: 'light' }] },
  };
  for (const [name, c] of Object.entries(cases)) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.setContent(c.html);
    const cdp = await page.context().newCDPSession(page);
    if (c.media) await cdp.send('Emulation.setEmulatedMedia', { media: c.media, features: c.features || [] });
    const r = await cdp.send('Page.printToPDF', { printBackground: true, paperWidth: 583 / 96, paperHeight: 350 / 96, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0 });
    const n = Buffer.from(r.data, 'base64').length;
    console.log('  ' + name.padEnd(72), String(n).padStart(6), n < 3000 ? 'BLANK' : 'prints');
    await page.close();
  }
  await browser.close();
})().catch((e) => console.log('ERROR', e.message.split('\n')[0]));
