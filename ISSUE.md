# Draft Chromium bug report (not filed)

File at https://issues.chromium.org (component suggestion: Blink>Layout or Blink>Paint>Print; the reporter should choose).

**Title:** Page.printToPDF prints an entirely blank page when a descendant uses `cqh` inside `container-type: size` (absolutely positioned, flex chain)

**What steps will reproduce the problem?**

1. Save `repro.html` and `repro-control.html` from this repository.
2. Run `chrome --headless --no-pdf-header-footer --print-to-pdf=out.pdf file:///path/to/repro.html`.
3. Run `pdftotext out.pdf -`, and render the page (for example `pdftoppm -r 50 out.pdf out`).
4. Repeat with `repro-control.html`.

**What is the expected result?**

`out.pdf` contains `10.3.0` at 22.88px (as on screen), the unrelated paragraph, the red box, and the second unrelated paragraph.

**What happens instead?**

`repro.html` produces a PDF of about 970 bytes. It has no extractable text and no non-white pixels: the unrelated text and the red box are missing too, not only the `cqh` text. `repro-control.html` differs only by `font-size: 22.88px` in place of `font-size: 13cqh`. It produces a PDF of about 17 KB with everything present. On screen both pages are identical.

**Additional information**

- Same result in Google Chrome 155.0.8059.84 (CLI `--print-to-pdf` and Playwright `page.pdf`) and Chromium headless shell 156.0.8078.4, macOS arm64. Chromium 153.0.8010.12 also blanked an earlier, smaller version of the page.
- Every `Page.printToPDF` variant tried is blank: default Letter, A4 landscape, custom size, `scale`, `printBackground: false`, `preferCSSPageSize` with `@page`, tagged PDF, and `transferMode: ReturnAsStream`.
- Screenshots are correct: `Page.captureScreenshot`, full page, and with `Emulation.setEmulatedMedia` set to print. The print-media screenshot is identical to the screen screenshot, so print CSS alone does not cause it.
- Changing `cqh` to `cqb` or `cqmin` also blanks the PDF. Changing it to `cqw` does not.
- Removing the `position: relative` ancestor, or removing `position: absolute` from the box, makes the content print.
- Not tested: Firefox, Safari, printing from the browser UI, other Chrome versions or operating systems.
- Real-world impact: a dashboard KPI tile using `font-size: clamp(18px, min(11cqw, 13cqh), 92px)` inside `container-type: size` made every PDF export of that dashboard blank, including the other tiles.
- This is a report of the behavior. I do not know the cause.
