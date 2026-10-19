# Draft Chromium bug report (not filed)

File at https://issues.chromium.org. Component suggestion: Blink>Layout or Blink>Paint, with Headless or
Printing if the form offers it. The reporter should choose. Do not file until `COVERAGE.md` has no open row
that the text below depends on.

**Title:** Printing (print dialog and headless Page.printToPDF) produces an entirely blank page when a descendant uses `cqh` inside `container-type: size` under an absolutely positioned box

## Steps to reproduce

1. Download `repro.html` and `repro-control.html` from https://github.com/Eckhoffj-Gopuff/chrome-printtopdf-container-size-cqh-blank
2. Print dialog: open `repro.html` in Chrome, press Ctrl/Cmd+P, destination "Save as PDF". The preview is blank.
3. Headless: `chrome --headless --no-pdf-header-footer --print-to-pdf=out.pdf file:///path/to/repro.html`, then
   `pdftotext out.pdf -` (or open `out.pdf`).
4. Repeat with `repro-control.html`. It differs only by `font-size: 22.88px` in place of `font-size: 13cqh`.

## Expected

`out.pdf` contains `10.3.0`, `UNRELATED-INFLOW-TEXT`, a red box, and `UNRELATED-ABS-TEXT`, as the page shows on screen.

## Actual

`repro.html` produces a PDF of about 970 bytes with no extractable text and no non-white pixels. The unrelated text and
the red box are missing too, not only the `cqh` text. `repro-control.html` produces about 17 KB with everything present.
On screen both pages are identical, and the `cqh` text is 22.88px (13% of the 176px container).

## Is it a regression? Does it work in other cases?

- **Regression between Chromium 107 and 108, on Linux, Windows, and macOS.** Playwright's bundled Chromium, `page.pdf`,
  on GitHub-hosted runners (Ubuntu x64, Windows 10.0.26100 x64, macOS 15 Intel, macOS arm64), public run
  https://github.com/Eckhoffj-Gopuff/chrome-printtopdf-container-size-cqh-blank/actions/runs/39264032665 :
  Chromium **107.0.5304.18 prints correctly** on all four (repro and control within 20 bytes of each other), and Chromium
  **108.0.5359.29 is blank** on all four (671 bytes, the same as an empty page; the controls print 10,606 to 21,688 bytes).
  The same holds in a Linux container (Ubuntu 22.04, arm64): 107 prints, 108 and every later build I ran are blank
  (109, 110, 114, 117, 120, 123, 125, 127.0.6533.17, 128.0.6613.18, 133.0.6943.16). Chromium 107 on every runner is the
  control that shows the test setup works. The commit range inside 107 to 108 is not narrowed yet.
- **My physical Mac is the exception.** There, old headless prints correctly until Chrome 128 (below). Chrome for Testing
  127.0.6533.119 headless shell prints on that Mac and is blank on the four runners and in the container. I do not know
  why. These did not change the result: CPU count, timing, viewport, device scale factor, locale, fonts, and GPU-related
  flags. The Mac boundary below applies to one physical machine and may not apply elsewhere.
- **macOS 26 arm64, physical machine: regression in old headless and chrome-headless-shell between 127 and 128.**
  `--headless=old` prints correctly on 113.0.5672.63, 116.0.5845.96, 124.0.6367.207, and 127.0.6533.119. It is blank on
  128.0.6613.8 and 128.0.6613.84. chrome-headless-shell (Chrome for Testing) prints correctly on 127.0.6533.119 and is blank on
  128.0.6613.84. Every later build I ran is blank (129, 130, 133, 153, 156). Chromium 107 and 108 (Playwright) also print there.
  **Position bisect** (old headless, Chromium snapshot builds, macOS 26 arm64): last good is position 1316017
  (`57d31eae8e4eca52fc106402dec56d772755221c`), first bad is 1318290 (`e32ab6f1f764b726a16f7220e9fd6c0be9996491`).
  Changelog: https://chromium.googlesource.com/chromium/src/+log/57d31eae8e4eca52fc106402dec56d772755221c..e32ab6f1f764b726a16f7220e9fd6c0be9996491
  This is a range of about 2,300 positions, not one commit: snapshot builds in the middle (around 1317170 to 1317188)
  did not print anything on my machine, even for the control.
- **New headless is blank** on 124.0.6367.207, 127.0.6533.119, 155.0.8059.84, and on Linux Chromium 133. Builds 113, 116,
  120, and 128 did not run on my machine (they hang or crash, also for the control), so I do not know where new headless
  started.
- **The headed print dialog IS affected.** In headed Chrome 155.0.8059.84 on macOS 26.6.1 (25G76), the print preview
  (Ctrl/Cmd+P, destination Save as PDF, Letter, portrait, 1 page) is **blank for `repro.html`** and shows all the text for
  `repro-control.html`. It is the same when the page is opened from a `file://` URL and from `http://localhost:63342`.
  **The saved PDF is blank too**: 960 bytes, one Letter page, producer Skia/PDF m155, no extractable text, 0 non-white
  pixels. So this is not headless-only. Screenshots and the saved PDF are attached.
- **A DevTools `Page.printToPDF` in a headed window printed correctly.** The same Chrome 155.0.8059.84 build, file, and
  Playwright script: 16,886 bytes with all text headed, 974 bytes headless. Headed Chrome for Testing 127.0.6533.119 and
  128.0.6613.84 also printed correctly that way. So in a headed window the dialog and the DevTools call differ, and I do
  not know why.
- **Firefox 138.0.1** (macOS, WebDriver `printPage`) is not affected: all text printed.
- **Safari 26.6** (macOS 26, File, Print) is not affected: the print preview shows all the text for `repro.html`.
  I checked the preview only, not a saved PDF.
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
| Google Chrome 155.0.8059.84/85, Chrome beta 157.0.8103.6, Chromium 156.0.8078.4 (GitHub Actions, headless) | Ubuntu x64 | 944 / 944 / 839 bytes | 9,072 / 9,072 / 8,967 bytes |
| same three builds (GitHub Actions, headless) | Windows 10.0.26100 x64 | 954 / 954 / 839 bytes | 20,741 / 20,743 / 20,626 bytes |
| same three builds (GitHub Actions, headless) | macOS 15 x64 (Intel) and macOS arm64 | 960 / 960 / 839 bytes | 15,654 / 15,656 / 15,533 bytes |

The GitHub Actions run, with the job table, is public:
https://github.com/Eckhoffj-Gopuff/chrome-printtopdf-container-size-cqh-blank/actions/runs/38961106399

Every `Page.printToPDF` variant I tried is blank: default Letter, A4 landscape, custom size, `scale`, `printBackground:false`,
`preferCSSPageSize` with `@page`, tagged PDF with outline, and `transferMode: ReturnAsStream`. `--disable-gpu` makes no difference.

## Not tested

Chrome dev and canary and Edge. The print dialog was tested by hand on one system (Chrome 155.0.8059.84, macOS
26.6.1); Windows and Linux dialogs are untested. The Windows, Linux, and macOS CI runs above were headless only. Which
older Chrome versions the print dialog is blank in is not known, so the 107 to 108 window above is for headless
`page.pdf` only.
The commit range inside the 107 to 108 change is not narrowed (the position bisect I ran was on my physical Mac, for
the Chrome 128 boundary there). I did not bisect new headless.

## Real-world impact

A dashboard KPI tile using `font-size: clamp(18px, min(11cqw, 13cqh), 92px)` inside `container-type: size` made every
PDF export from a headless Chrome blank, including the other tiles on the page. PNG screenshots of the same page were
correct. This is a report of the behavior. I do not know the cause.

## Attachments

`repro.html`, `repro-control.html`, `results/repro.chrome-155-new-headless.pdf` (blank),
`results/repro-control.chrome-155-new-headless.pdf` (correct), `results/repro.screen-chrome-155.png`
(how Chrome renders it on screen), and the print-dialog evidence from Chrome 155.0.8059.84 on macOS:
`results/print-dialog-repro.png` (blank preview, page served from localhost),
`results/print-dialog-repro-file-url.png` (blank preview, `file://` URL),
`results/print-dialog-control.png` (preview with text), and `results/print-dialog-repro.saved.chrome-155.pdf`
(the PDF saved from the dialog, blank).
