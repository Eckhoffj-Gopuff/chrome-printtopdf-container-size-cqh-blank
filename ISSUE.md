# Draft Chromium bug report (not filed)

File at https://issues.chromium.org. Component suggestion: Blink>Layout or Blink>Paint, with Headless or
Printing if the form offers it. The reporter should choose. Do not file until `COVERAGE.md` has no open row
that the text below depends on.

**Title:** Container query unit `cqh` inside `container-type: size` under an absolutely positioned box makes LayoutNG print layout produce an entirely blank page (headless `Page.printToPDF`; print dialog on macOS and Linux)

## Summary

- **Symptom:** the whole printed page is blank, not only the `cqh` text. The page is correct on screen and in screenshots.
- **Trigger:** a `cqh` unit (also `cqb`, `cqmin`) used in any property inside a `container-type: size` element, with an
  absolutely positioned box inside a `position: relative` ancestor. `cqw`, `container-type: inline-size`, and `@container`
  queries do not trigger it.
- **Cause area:** the LayoutNG print path (`LayoutNGPrinting`). Before it, Chromium did not evaluate container queries
  while printing. `Element::ComputeContainerQueryEvaluator` returned null for a printing document (removed in
  `64f41cde3a3b`). So this is probably not a regression of working code. The new print path is the first to evaluate
  container query units in paged layout, and it fails on this case.
- **Evidence for that:**
  - On Chromium 107, `--enable-blink-features=LayoutNGPrinting,LayoutNG,LayoutNGBlockFragmentation,LayoutNGView` makes
    the repro blank (887 bytes). With any three of the four it prints.
  - The feature became the default in 108 (`06876550989f`, found by a 12-commit position bisect). On 108 to 113,
    `--disable-features=LayoutNGPrinting` makes the repro print. It has no effect from 114, because the flag was removed
    on 2023-03-24 (`64f41cde3a3b`).
- **Affected:** headless `Page.printToPDF` (Chromium 108 to 156; Linux, Windows, and macOS CI runners; one Windows PC), and
  the print dialog on macOS (Chrome 155) and Linux (Chromium 108, 127, 156).
- **Not affected:** the print dialog on Windows (Chrome 155 and Edge 155 show all the text, on the same PC where headless
  is blank), Firefox 138, Safari 26.6 (preview only).
- **Exception:** on one physical Mac (macOS 26 arm64), old headless prints correctly until Chrome 128. I do not know why.
- **Not found:** the defect itself. This report gives the trigger, the code path, and the version range, not the root cause.

## Steps to reproduce

1. Download `repro.html` and `repro-control.html` from https://github.com/Eckhoffj-Gopuff/chrome-printtopdf-container-size-cqh-blank
2. Headless: `chrome --headless --no-pdf-header-footer --print-to-pdf=out.pdf file:///path/to/repro.html`, then
   `pdftotext out.pdf -` (or open `out.pdf`).
3. Print dialog (macOS and Linux; on Windows it shows the text): open `repro.html` in Chrome, press Ctrl/Cmd+P,
   destination "Save as PDF". The preview is blank.
4. Repeat with `repro-control.html`. It differs only by `font-size: 22.88px` in place of `font-size: 13cqh`.
5. To see that the cause is in the LayoutNG print path, run Chromium 107 (Playwright 1.27.1) with
   `--enable-blink-features=LayoutNGPrinting,LayoutNG,LayoutNGBlockFragmentation,LayoutNGView`. `tools/flags-107.cjs`
   runs the six flag combinations.

## Expected

`out.pdf` contains `10.3.0`, `UNRELATED-INFLOW-TEXT`, a red box, and `UNRELATED-ABS-TEXT`, as the page shows on screen.

## Actual

`repro.html` produces a PDF of about 970 bytes with no extractable text and no non-white pixels. The unrelated text and
the red box are missing too, not only the `cqh` text. `repro-control.html` produces about 17 KB with everything present.
On screen both pages are identical, and the `cqh` text is 22.88px (13% of the 176px container). With the header and footer
on, a blank body still shows the date, title, URL, and page number (a Windows run gave 27,483 bytes for these alone).

## Is it a regression? Does it work in other cases?

### Version range

- **Chromium 107 to 108, on Linux, Windows, and macOS.** Playwright's bundled Chromium, `page.pdf`, on GitHub-hosted
  runners (Ubuntu x64, Windows 10.0.26100 x64, macOS 15 Intel, macOS arm64), public run
  https://github.com/Eckhoffj-Gopuff/chrome-printtopdf-container-size-cqh-blank/actions/runs/39264032665 :
  Chromium **107.0.5304.18 prints correctly** on all four (repro and control within 20 bytes of each other), and Chromium
  **108.0.5359.29 is blank** on all four (671 bytes, the same as an empty page; the controls print 10,606 to 21,688 bytes).
  The same holds in a Linux container (Ubuntu 22.04, arm64): 107 prints, 108 and every later build I ran are blank
  (109, 110, 114, 117, 120, 123, 125, 127.0.6533.17, 128.0.6613.18, 133.0.6943.16). Chromium 107 on every runner is the
  control that shows the test setup works.
- **Position bisect on Linux x64: 12 commits.** Chromium snapshot builds on a GitHub Ubuntu runner (headless `page.pdf`,
  same harness as above; run https://github.com/Eckhoffj-Gopuff/chrome-printtopdf-container-size-cqh-blank/actions/runs/39272077921 ):
  last good **r1053680** (`54c0976669f28779ae1f9c0d7e66c7657c49469e`, 108.0.5333.0), first bad **r1053692**
  (`3af31e148c049854a63e6e831aca5862ac98fd09`). Changelog (12 commits):
  https://chromium.googlesource.com/chromium/src/+log/54c0976669f28779ae1f9c0d7e66c7657c49469e..3af31e148c049854a63e6e831aca5862ac98fd09
  One commit in that range is about printing: `06876550989f` **"Set the LayoutNGPrinting feature to 'stable'."**
  (2022-09-30, Bug: 1121942, Cr-Commit-Position #1053686). It only changes `runtime_enabled_features.json5` (from
  `status: "test"` to `"stable"`, plus a `base_feature` kill switch). The others are unrelated rolls and UI changes.

### The LayoutNG print path is the cause area

- **Kill switch** `--disable-features=LayoutNGPrinting` (Linux container, Playwright's Chromium, headless `page.pdf`):
  108.0.5359.29 **prints** (11,753 bytes; default 671 = blank), 109.0.5414.46 prints, 110.0.5481.38 prints,
  112.0.5615.29 prints (11,570), 113.0.5672.53 prints (11,570; default 671). It has **no effect** on 114.0.5735.35 (672),
  115.0.5790.75 (672), 117.0.5938.62 (666), 120.0.6099.28 (666), 123.0.6312.4 (847), 125.0.6422.26 (847),
  127.0.6533.17 (847), or 128.0.6613.18 (847): all still blank. So it works on 108 to 113 and not from 114 on (111 was
  not tested). The flag was removed on 2023-03-24 by `64f41cde3a3b` "[RemoveLegacy] Remove LayoutNGPrinting flag".
- **Chromium 107 with the path enabled is blank.** `--enable-blink-features=LayoutNGPrinting` alone on 107 prints
  (11,765 bytes), because the feature depends on `LayoutNG`, `LayoutNGBlockFragmentation`, and `LayoutNGView`. With all four,
  107.0.5304.18 gives 887 bytes (an empty page in that build). `repro-control.html` with the same flags prints (11,779).
  Any three of the four print. So the defect was already present in 107 behind the flags, and 108 only turned it on by
  default.
- **Why 107 "prints correctly" by default.** In the source before `64f41cde3a3b`, `ComputeContainerQueryEvaluator` returned
  null when `document.Printing()` and `LayoutNGPrinting` was off, and legacy layout logged "Using container queries or
  units with printing … will not work correctly." So on 107 the container never evaluated in print and `cqh` fell back to
  a default. This fits the `10.3.0` being much larger than on screen in the 107 print dialog. I read this in the commit
  diffs; I did not run a debug build. See `CHROMIUM-SOURCE-NOTES.md`.

### Where it prints and where it does not

- **My physical Mac is the exception.** There, old headless prints correctly until Chrome 128 (below). Chrome for Testing
  127.0.6533.119 headless shell prints on that Mac and is blank on the four runners and in the container. I do not know
  why. These did not change the result: CPU count, timing, viewport, device scale factor, locale, fonts, and GPU-related
  flags. Chromium 108 on that Mac prints under every `LayoutNGPrinting` setting I tried. The Mac boundary below applies to
  one physical machine and may not apply elsewhere.
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
- **Windows PC, Chrome 155.0.8059.84 and Edge 155.0.4283.62: dialog prints, headless is blank.** The print preview shows
  `10.3.0`, `UNRELATED-INFLOW-TEXT`, `UNRELATED-ABS-TEXT`, and the red box in Chrome (printer "Power PDF") and in Edge
  (Save as PDF), from a `file://` URL. On the same PC, headless Chrome 155 gives a blank body for `repro.html` (27,483
  bytes: only the date, title, URL, and "1/1") and all text for `repro-control.html` (48,710 bytes). Both PDFs are in
  `results/`. Changing the paper size and the scale in the Windows dialog made no difference. The Windows version was not
  recorded, and I did not save a PDF from the dialog. So on one machine and one build, the dialog and headless output
  differ. The Windows CI runner is blank too. (`LayoutNGPrinting` does not appear in `chrome://flags`; it is a base feature,
  not a listed flag, so that is expected and says nothing about its state.)
- **The headed print dialog IS affected on macOS.** In headed Chrome 155.0.8059.84 on macOS 26.6.1 (25G76), the print
  preview (Ctrl/Cmd+P, destination Save as PDF, Letter, portrait, 1 page) is **blank for `repro.html`** and shows all the
  text for `repro-control.html`. It is the same when the page is opened from a `file://` URL and from
  `http://localhost:63342`. **The saved PDF is blank too**: 960 bytes, one Letter page, producer Skia/PDF m155, no
  extractable text, 0 non-white pixels.
- **A DevTools `Page.printToPDF` in a headed macOS window printed correctly.** The same Chrome 155.0.8059.84 build, file,
  and Playwright script: 16,886 bytes with all text headed, 974 bytes headless. Headed Chrome for Testing 127.0.6533.119 and
  128.0.6613.84 also printed correctly that way. So in a headed window the dialog and the DevTools call differ, and I do
  not know why.
- **The print dialog has the same version boundary on Linux.** Headed Chromium on a virtual display in Docker (Ubuntu 22.04
  arm64, Ctrl+P, destination Save as PDF; `tools/dialog-linux.sh`; screenshots in `results/linux-dialog/`): for
  `repro.html`, Chromium **107.0.5304.18 shows the text** (the `10.3.0` is much larger than on screen, so `cqh` did not
  resolve against the 176px container there), **108.0.5359.29 is blank** (only the date, title and URL that Chrome adds),
  **127.0.6533.17 is blank**, and **156.0.8078.4 is blank**. `repro-control.html` shows all the text on 108. Chromium 108
  with `--disable-features=LayoutNGPrinting` shows the text again. So on Linux the dialog and `page.pdf` fail on the same
  builds and the same kill switch fixes both.
- **Firefox 138.0.1** (macOS, WebDriver `printPage`) is not affected: all text printed.
- **Safari 26.6** (macOS 26, File, Print) is not affected: the print preview shows all the text for `repro.html`.
  I checked the preview only, not a saved PDF.
- **Other Chrome capture paths are correct:** `Page.captureScreenshot` (viewport and full page) and a screenshot with
  `Emulation.setEmulatedMedia` set to print. The print-media screenshot is identical to the screen screenshot, so print CSS
  alone does not cause it.

## What triggers it (changing one thing at a time)

- `cqh` inside `container-type: size` is blank. A fixed font size with the same `container-type: size` prints.
  `cqw` prints. `cqb` and `cqmin` are blank. `container-type: inline-size` and `contain: size` print. (This bullet
  and the next two were measured on an earlier, smaller version of the page, by PDF size, Chrome 155 and
  Chromium 156. The table below uses the final `repro.html`.)
- Removing the `position: relative` ancestor, or removing `position: absolute` from the box, makes the content print.
- The box height does not matter (100px and 400px are still blank).

More experiments, one change at a time from `repro.html`. The result is the same on Chromium 108.0.5359.29 and
156.0.8078.4 (Linux, headless `page.pdf`):

| Change | Result |
|---|---|
| none (`13cqh` font size, `container-type: size`) | blank |
| one very tall page (583x6000 px), so nothing is split across pages | blank |
| fixed font size, but `height: 13cqh` on the text block | blank |
| fixed font size, but `width: 10cqh` on the text block | blank |
| fixed font size, plus `@container (min-height: 1px) { .text { color: red } }` | prints |
| fixed font size, plus an `@container (min-height: 9999px)` rule that does not match | prints |
| `@media print { .container { container-type: normal } .text { font-size: 22.88px } }` | prints |
| `@media print { .text { font-size: 22.88px } }`, `container-type: size` kept | prints |
| `@media print { .container { container-type: inline-size } }`, `cqh` kept | prints |
| `@media print { .container { container-type: normal } }`, `cqh` kept | prints |

So it is the block-axis container query **unit** (`cqh`), in any property, inside a `container-type: size` element. Container
**queries** (`@container (min-height: …)`) on the same container print correctly, and it is not about the page being split
across pages. A print-only CSS override avoids it (for example `@media print` with a fixed size, or `container-type:
inline-size`), which also shows `@media print` rules are applied. That holds only when the page uses print media. After
`Emulation.setEmulatedMedia({ media: 'screen' })` the same `@media print` override does not apply and the PDF is blank
(Chromium 108.0.5359.29 and 156.0.8078.4, Linux; with `media: 'print'` it prints; `tools/media-emulation.cjs`).

## Environment

| Browser | OS | repro.html | repro-control.html |
|---|---|---|---|
| Google Chrome 155.0.8059.84, new headless, CLI | macOS 26, arm64 | 968 bytes | 16,891 bytes |
| Chromium headless shell 156.0.8078.4 | macOS 26, arm64 | 839 bytes | 15,533 bytes |
| Chromium 133.0.6943.16 (headless shell and new headless) | Ubuntu 24.04, arm64 | 856 and 961 bytes | about 9 KB |
| Google Chrome 155.0.8059.84/85, Chrome beta 157.0.8103.6, Chromium 156.0.8078.4 (GitHub Actions, headless) | Ubuntu x64 | 944 / 944 / 839 bytes | 9,072 / 9,072 / 8,967 bytes |
| same three builds (GitHub Actions, headless) | Windows 10.0.26100 x64 | 954 / 954 / 839 bytes | 20,741 / 20,743 / 20,626 bytes |
| same three builds (GitHub Actions, headless) | macOS 15 x64 (Intel) and macOS arm64 | 960 / 960 / 839 bytes | 15,654 / 15,656 / 15,533 bytes |
| Google Chrome 155, headless CLI, header and footer on | Windows (version not recorded) | 27,483 bytes (header and footer only) | 48,710 bytes |

The GitHub Actions run, with the job table, is public:
https://github.com/Eckhoffj-Gopuff/chrome-printtopdf-container-size-cqh-blank/actions/runs/38961106399

Every `Page.printToPDF` variant I tried is blank: default Letter, A4 landscape, custom size, `scale`, `printBackground:false`,
`preferCSSPageSize` with `@page`, tagged PDF with outline, and `transferMode: ReturnAsStream`. `--disable-gpu` makes no difference.

## Not tested

- Chrome dev and canary, and Edge in headless mode (Edge was checked only in the Windows print dialog).
- The print dialog on older Chrome on macOS (the builds crash or do not render on macOS 26), and on Windows beyond Chrome
  and Edge 155. A saved PDF from the Windows dialog.
- The CI runs above were headless only. The dialog was tested by hand on macOS 26.6.1 (Chrome 155) and Windows (Chrome and
  Edge 155), and by script on Linux (Chromium 107, 108, 127, 156; arm64 container, virtual display).
- The position bisect covers old headless on Linux x64 (and, separately, my physical Mac, for its Chrome 128 boundary). I
  did not bisect new headless or the print dialog.
- Kill switch results for Chromium 111, 116, 118, 119, 121, 122, 124, and 126 were not collected.
- I did not read or debug the layout code. The notes in `CHROMIUM-SOURCE-NOTES.md` come from commit diffs, and the
  hypotheses there (out-of-flow layout in a fragmentation context; why `cqh` differs from `cqw` and from `@container`
  queries) are untested. A debug build with DCHECKs would test them.
- Why my physical Mac prints correctly on 108 through 127, and why the Windows dialog prints while headless on the same
  PC is blank.

## Real-world impact

A dashboard KPI tile using `font-size: clamp(18px, min(11cqw, 13cqh), 92px)` inside `container-type: size` made every
PDF export from a headless Chrome blank, including the other tiles on the page. PNG screenshots of the same page were
correct. The page needs the print path, so a screenshot-based export is not affected. I do not know the root cause.

## Attachments

`repro.html`, `repro-control.html`, `results/repro.chrome-155-new-headless.pdf` (blank),
`results/repro-control.chrome-155-new-headless.pdf` (correct), `results/repro.screen-chrome-155.png`
(how Chrome renders it on screen), and the print-dialog evidence from Chrome 155.0.8059.84 on macOS:
`results/print-dialog-repro.png` (blank preview, page served from localhost),
`results/print-dialog-repro-file-url.png` (blank preview, `file://` URL),
`results/print-dialog-control.png` (preview with text), and `results/print-dialog-repro.saved.chrome-155.pdf`
(the PDF saved from the dialog, blank).

Windows: `results/print-dialog-windows-chrome-155.png` and `results/print-dialog-windows-edge-155.webp` (previews, both show
the text), `results/repro.windows-chrome-155-headless.pdf` (blank body) and
`results/repro-control.windows-chrome-155-headless.pdf` (all text).

Linux print dialog screenshots by Chromium version are in `results/linux-dialog/` (107 text, 108 blank, 108 with the kill
switch text, 108 control text, 127 blank, 156 blank).
