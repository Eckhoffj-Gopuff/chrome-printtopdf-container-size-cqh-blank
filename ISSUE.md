# Draft Chromium bug report (not filed)

File at https://issues.chromium.org. Component suggestion: Blink>Layout or Blink>Paint, with Headless or
Printing if the form offers it. The reporter should choose. Do not file until `COVERAGE.md` has no open row
that the text below depends on.

**Title:** Headless: Page.printToPDF prints an entirely blank page when a descendant uses `cqh` inside `container-type: size` under an absolutely positioned box

## Steps to reproduce

1. Download `repro.html` and `repro-control.html` from https://github.com/Eckhoffj-Gopuff/chrome-printtopdf-container-size-cqh-blank
2. `chrome --headless --no-pdf-header-footer --print-to-pdf=out.pdf file:///path/to/repro.html`
3. `pdftotext out.pdf -` (or open `out.pdf`).
4. Repeat with `repro-control.html`. It differs only by `font-size: 22.88px` in place of `font-size: 13cqh`.

## Expected

`out.pdf` contains `10.3.0`, `UNRELATED-INFLOW-TEXT`, a red box, and `UNRELATED-ABS-TEXT`, as the page shows on screen.

## Actual

`repro.html` produces a PDF of about 970 bytes with no extractable text and no non-white pixels. The unrelated text and
the red box are missing too, not only the `cqh` text. `repro-control.html` produces about 17 KB with everything present.
On screen both pages are identical, and the `cqh` text is 22.88px (13% of the 176px container).

## Is it a regression? Does it work in other cases?

- **Regression in old headless and chrome-headless-shell.** `--headless=old` prints correctly on 113.0.5672.63, 116.0.5845.96,
  124.0.6367.207, and 127.0.6533.119. It is blank on 128.0.6613.8 and 128.0.6613.84. chrome-headless-shell (Chrome for Testing)
  prints correctly on 127.0.6533.119 and is blank on 128.0.6613.84. Every later build I ran is blank (129, 130, 133, 153, 156).
  **Position bisect** (old headless, Chromium snapshot builds, macOS 26 arm64): last good is position 1316017
  (`57d31eae8e4eca52fc106402dec56d772755221c`), first bad is 1318290 (`e32ab6f1f764b726a16f7220e9fd6c0be9996491`).
  Changelog: https://chromium.googlesource.com/chromium/src/+log/57d31eae8e4eca52fc106402dec56d772755221c..e32ab6f1f764b726a16f7220e9fd6c0be9996491
  This is a range of about 2,300 positions, not one commit: snapshot builds in the middle (around 1317170 to 1317188)
  did not print anything on my machine, even for the control.
- **New headless is blank** on 124.0.6367.207, 127.0.6533.119, 155.0.8059.84, and on Linux Chromium 133. Builds 113, 116,
  120, and 128 did not run on my machine (they hang or crash, also for the control), so I do not know where new headless
  started.
- **Headed Chrome is NOT affected.** The same Chrome 155.0.8059.84 build, file, and Playwright script, with a DevTools
  `Page.printToPDF`: 16,886 bytes with all text headed, 974 bytes headless. Headed Chrome for Testing 127.0.6533.119 and
  128.0.6613.84 also print correctly.
- **Firefox 138.0.1** (macOS, WebDriver `printPage`) is not affected: all text printed.
- **Other Chrome capture paths are correct:** `Page.captureScreenshot` (viewport and full page) and a screenshot with
  `Emulation.setEmulatedMedia` set to print. The print-media screenshot is identical to the screen screenshot, so print CSS
  alone does not cause it.

## What triggers it (changing one thing at a time)

- `cqh` inside `container-type: size` is blank. A fixed font size with the same `container-type: size` prints.
  `cqw` prints. `cqb` and `cqmin` are blank. `container-type: inline-size` and `contain: size` print.
- Removing the `position: relative` ancestor, or removing `position: absolute` from the box, makes the content print.
- The box height does not matter (100px and 400px are still blank).

## Environment

| Browser | OS | repro.html | repro-control.html |
|---|---|---|---|
| Google Chrome 155.0.8059.84, new headless, CLI | macOS 26, arm64 | 968 bytes | 16,891 bytes |
| Chromium headless shell 156.0.8078.4 | macOS 26, arm64 | 839 bytes | 15,533 bytes |
| Chromium 133.0.6943.16 (headless shell and new headless) | Ubuntu 24.04, arm64 | 856 and 961 bytes | about 9 KB |

Every `Page.printToPDF` variant I tried is blank: default Letter, A4 landscape, custom size, `scale`, `printBackground:false`,
`preferCSSPageSize` with `@page`, tagged PDF with outline, and `transferMode: ReturnAsStream`. `--disable-gpu` makes no difference.

## Not tested

Windows, Linux x86_64, macOS Intel, Chrome beta/dev/canary, Edge, Safari, and printing from the browser UI (Ctrl+P).
The position bisect was run for old headless on macOS only. I did not bisect new headless.

## Real-world impact

A dashboard KPI tile using `font-size: clamp(18px, min(11cqw, 13cqh), 92px)` inside `container-type: size` made every
PDF export from a headless Chrome blank, including the other tiles on the page. PNG screenshots of the same page were
correct. This is a report of the behavior. I do not know the cause.

## Attachments

`repro.html`, `repro-control.html`, `results/repro.chrome-155-new-headless.pdf` (blank),
`results/repro-control.chrome-155-new-headless.pdf` (correct), `results/repro.screen-chrome-155.png`
(how Chrome renders it on screen).
