const { chromium } = require('playwright');
const fs = require('fs');
const html = fs.readFileSync('/repro/repro.html', 'utf8');
const sets = [
  [],
  ['--enable-blink-features=LayoutNGPrinting'],
  ['--enable-blink-features=LayoutNGPrinting,LayoutNG'],
  ['--enable-blink-features=LayoutNGPrinting,LayoutNGBlockFragmentation'],
  ['--enable-blink-features=LayoutNGPrinting,LayoutNG,LayoutNGBlockFragmentation,LayoutNGView'],
  ['--enable-blink-features=LayoutNGBlockFragmentation'],
];
(async () => {
  for (const args of sets) {
    const b = await chromium.launch({ args });
    const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
    await p.setContent(html);
    const cdp = await p.context().newCDPSession(p);
    const r = await cdp.send('Page.printToPDF', { printBackground: true, paperWidth: 583/96, paperHeight: 350/96, marginTop:0, marginBottom:0, marginLeft:0, marginRight:0 });
    const n = Buffer.from(r.data, 'base64').length;
    console.log(b.version().padEnd(18), (args.join(' ') || '(none)').padEnd(110), String(n).padStart(6), n < 3000 ? 'BLANK' : 'prints');
    await b.close();
  }
})().catch(e => console.log('ERR', e.message.split('\n')[0]));
