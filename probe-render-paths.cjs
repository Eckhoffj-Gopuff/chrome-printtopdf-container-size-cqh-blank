// Which Chrome render paths show the blank? Runs repro.html and repro-control.html through
// page.pdf() with several options, raw CDP Page.printToPDF, and screenshots.
// Needs poppler (pdftotext, pdftoppm) on PATH to look inside the PDFs.
// Markers: T = in-flow text, A = absolutely positioned text, R = red box, H = the 10.3.0 text.
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'probe-'));

function countPixels(rgb /* Buffer of R,G,B triples */) {
  let nonWhite = 0, red = 0;
  for (let i = 0; i + 2 < rgb.length; i += 3) {
    const r = rgb[i], g = rgb[i + 1], b = rgb[i + 2];
    if (r < 240 || g < 240 || b < 240) nonWhite++;
    if (r > 150 && g < 80 && b < 80) red++;
  }
  return { nonWhite, red };
}
function ppmPixels(buf) { // binary P6: "P6\nW H\n255\n" then RGB
  let off = 0, fields = 0;
  while (fields < 4) {
    while (buf[off] === 0x0a || buf[off] === 0x20) off++;
    while (buf[off] !== 0x0a && buf[off] !== 0x20) off++;
    fields++;
  }
  return countPixels(buf.subarray(off + 1));
}
function analyzePdf(pdf) {
  const f = path.join(tmp, 'x.pdf');
  fs.writeFileSync(f, pdf);
  const text = execFileSync('pdftotext', [f, '-']).toString();
  const px = ppmPixels(execFileSync('pdftoppm', ['-r', '50', '-f', '1', '-l', '1', f], { maxBuffer: 1 << 28 }));
  return { bytes: pdf.length, T: text.includes('UNRELATED-INFLOW-TEXT'), A: text.includes('UNRELATED-ABS-TEXT'), H: text.includes('10.3.0'), R: px.red > 20, nonWhitePx: px.nonWhite };
}
async function analyzePng(browser, png) {
  const p = await browser.newPage();
  const r = await p.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let nonWhite = 0, red = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] < 240 || d[i + 1] < 240 || d[i + 2] < 240) nonWhite++;
      if (d[i] > 150 && d[i + 1] < 80 && d[i + 2] < 80) red++;
    }
    return { nonWhite, red };
  }, png.toString('base64'));
  await p.close();
  return { bytes: png.length, R: r.red > 100, nonWhitePx: r.nonWhite };
}
const fmt = (o) => Object.entries(o).map(([k, v]) => `${k}=${typeof v === 'boolean' ? (v ? 'Y' : 'n') : v}`).join(' ');

(async () => {
  for (const [label, opts] of [['Playwright Chromium', {}], ['Google Chrome', { channel: 'chrome' }]]) {
    const browser = await chromium.launch(opts);
    console.log(`\n==== ${label} ${browser.version()}`);
    for (const [docName, html] of [['repro.html', read('repro.html')], ['repro-control.html', read('repro-control.html')]]) {
      console.log(`\n-- ${docName}`);
      const open = async () => { const p = await browser.newPage({ viewport: { width: 1280, height: 800 } }); await p.setContent(html); return p; };
      const variants = {
        'page.pdf 583x350': { width: '583px', height: '350px' },
        'page.pdf default Letter': {},
        'page.pdf A4 landscape': { format: 'A4', landscape: true },
        'page.pdf scale 0.5': { width: '583px', height: '350px', scale: 0.5 },
        'page.pdf printBackground:false': { width: '583px', height: '350px', printBackground: false },
        'page.pdf preferCSSPageSize + @page': { preferCSSPageSize: true, __page: '@page{size:583px 350px;margin:0}' },
        'page.pdf tagged + outline': { width: '583px', height: '350px', tagged: true, outline: true },
      };
      for (const [name, o] of Object.entries(variants)) {
        const p = await open();
        const { __page, ...rest } = o;
        if (__page) await p.addStyleTag({ content: __page });
        console.log(name.padEnd(36), fmt(analyzePdf(await p.pdf({ printBackground: true, ...rest }))));
        await p.close();
      }
      let p = await open();
      const cdp = await p.context().newCDPSession(p);
      const r = await cdp.send('Page.printToPDF', { printBackground: true, paperWidth: 583 / 96, paperHeight: 350 / 96, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0, transferMode: 'ReturnAsStream' });
      const chunks = [];
      for (;;) {
        const c = await cdp.send('IO.read', { handle: r.stream });
        chunks.push(Buffer.from(c.data, c.base64Encoded ? 'base64' : 'utf8'));
        if (c.eof) break;
      }
      await cdp.send('IO.close', { handle: r.stream });
      console.log('CDP Page.printToPDF (stream)'.padEnd(36), fmt(analyzePdf(Buffer.concat(chunks))));
      await p.close();

      p = await open();
      console.log('page.screenshot'.padEnd(36), fmt(await analyzePng(browser, await p.screenshot())));
      console.log('page.screenshot fullPage'.padEnd(36), fmt(await analyzePng(browser, await p.screenshot({ fullPage: true }))));
      await p.emulateMedia({ media: 'print' });
      console.log('emulateMedia print + screenshot'.padEnd(36), fmt(await analyzePng(browser, await p.screenshot())));
      await p.close();
    }
    await browser.close();
  }
  fs.rmSync(tmp, { recursive: true, force: true });
})();
