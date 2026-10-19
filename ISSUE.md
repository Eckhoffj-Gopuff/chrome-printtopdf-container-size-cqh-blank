# Chromium bug report text (not filed)

For https://issues.chromium.org. Component suggestion: Blink>Layout (the reporter should choose). Paste the text below
the line. Every version, byte count, and run behind it is in `DETAILS.md` in the repro repository; the test matrix is in `COVERAGE.md`.

---

**Title:** Blank printed page when `cqh` is used inside `container-type: size` under an absolutely positioned box (LayoutNG print layout)

**Chrome version:** 155.0.8059.84 (also Chromium 108 to 156; Chrome beta 157)
**OS:** macOS 26 arm64, Ubuntu x64, Windows 10.0.26100 x64 (headless); macOS and Linux (print dialog)

### Steps to reproduce

1. Download `repro.html` and `repro-control.html` from the repro repository (all files named in this report are in it):
   https://github.com/Eckhoffj-Gopuff/chrome-printtopdf-container-size-cqh-blank
2. Run `chrome --headless --no-pdf-header-footer --print-to-pdf=out.pdf file:///path/to/repro.html`, then `pdftotext out.pdf -`.
   Or open `repro.html` in Chrome on macOS or Linux, press Ctrl/Cmd+P, and choose "Save as PDF".
3. Repeat with `repro-control.html`. It differs only by `font-size: 22.88px` in place of `font-size: 13cqh`.

### Expected

The PDF shows `10.3.0`, `UNRELATED-INFLOW-TEXT`, a red box, and `UNRELATED-ABS-TEXT`, as the page does on screen.

### Actual

The page is blank: about 970 bytes, no text, no non-white pixels. The unrelated text and the red box are missing too, not
only the `cqh` text. `repro-control.html` prints everything. On screen both pages are identical.

### Trigger

The page is blank when all three are present:
- a block-axis container unit (`cqh`, `cqb`, or `cqmin`) in any property, inside a `container-type: size` element;
- an absolutely positioned box in a `position: relative` ancestor;
- print layout (not screen, not screenshots).

These do not trigger it: `cqw`, `container-type: inline-size`, `@container (min-height: …)` queries, and a fixed font size.
Overriding the container or the font size in `@media print` also avoids it (but not under emulated `screen` media).

### Is it a regression? Does it work in other browsers?

- Last good: Chromium 107.0.5304.18. First bad: 108.0.5359.29. This holds on Linux, Windows, and macOS CI runners
  (headless `page.pdf`).
- A position bisect on Linux gives 12 commits (r1053680 to r1053692). The only printing commit is `06876550989f`
  "Set the LayoutNGPrinting feature to 'stable'." (Bug: 1121942).
- `--disable-features=LayoutNGPrinting` makes 108 to 113 print. It has no effect from 114 (the flag was removed in
  `64f41cde3a3b`).
- On Chromium 107, `--enable-blink-features=LayoutNGPrinting,LayoutNG,LayoutNGBlockFragmentation,LayoutNGView` makes the
  repro blank. Any three of the four print. So the defect is in the LayoutNG print path and was present before 108.
- Before `64f41cde3a3b`, `Element::ComputeContainerQueryEvaluator` returned null for a printing document when the flag was
  off. I think container queries were never evaluated in print before 108, so this may be a first-use failure and not
  a change in working code. I read this in the diffs and did not run a debug build.
- Firefox 138 and Safari 26.6 print the repro correctly.

### Where it differs (not explained)

- The print dialog shows the text on Windows (Chrome 155 and Edge 155), while headless Chrome 155 on the same PC is blank.
- On macOS, headed Chrome 155: a DevTools `Page.printToPDF` prints correctly, but the print dialog is blank.
- On one physical Mac, old headless prints correctly until Chrome 128. CI runners and a Linux container are blank from 108.

### Not tested

Chrome dev and canary, Edge headless, older Chrome in the macOS print dialog. I did not find the root cause. Hypotheses
and the commits I read are in the repro repository: https://github.com/Eckhoffj-Gopuff/chrome-printtopdf-container-size-cqh-blank/blob/main/CHROMIUM-SOURCE-NOTES.md

### Impact

A dashboard KPI tile with `font-size: clamp(18px, min(11cqw, 13cqh), 92px)` inside `container-type: size` made every
headless PDF export blank, including the other tiles. PNG screenshots were correct.

### Attachments

`repro.html` and `repro-control.html`, plus the blank and correct PDFs and print dialog screenshots in `results/`, are in the repro repository. All versions, byte counts, and runs behind this report are in https://github.com/Eckhoffj-Gopuff/chrome-printtopdf-container-size-cqh-blank/blob/main/DETAILS.md , and the test matrix is in https://github.com/Eckhoffj-Gopuff/chrome-printtopdf-container-size-cqh-blank/blob/main/COVERAGE.md .
