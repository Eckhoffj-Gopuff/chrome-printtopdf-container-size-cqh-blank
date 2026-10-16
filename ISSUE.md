# Draft Chromium bug report (not filed)

File at https://issues.chromium.org (component suggestion: Blink>Layout or Blink>Paint>Print; the reporter should choose).

**Title:** Page.printToPDF prints a blank page when a descendant uses `cqh` inside `container-type: size` (absolutely positioned, flex chain)

**What steps will reproduce the problem?**

1. Save `repro.html` and `repro-control.html` from this repository.
2. Run `chrome --headless --no-pdf-header-footer --print-to-pdf=out.pdf file:///path/to/repro.html`.
3. Run `pdftotext out.pdf -`.
4. Repeat with `repro-control.html`.

**What is the expected result?**

`out.pdf` contains the text `10.3.0` at 22.88px, as the page shows on screen.

**What happens instead?**

`repro.html` produces a PDF of about 970 bytes with no extractable text. `repro-control.html` differs only by `font-size: 22.88px` in place of `font-size: 13cqh`. It produces a PDF of about 7 KB with the text. On screen both pages show the text at 22.88px.

**Additional information**

- Same result in Google Chrome 155.0.8059.84 and Chromium headless shell 153.0.8010.12 and 156.0.8078.4, macOS arm64, 3 runs each.
- Changing `cqh` to `cqb` or `cqmin` also blanks the PDF. Changing it to `cqw` does not.
- Removing the `position: relative` ancestor, or removing `position: absolute` from the box, makes the text print.
- Only `Page.printToPDF` was tested. Firefox, Safari, and printing from the browser UI were not tested.
- Real-world impact: a dashboard KPI tile using `font-size: clamp(18px, min(11cqw, 13cqh), 92px)` inside `container-type: size` made every PDF export of that dashboard blank.
- This is a report of the behavior. I do not know the cause.
