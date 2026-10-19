# Coverage: what was tested, and how to test the rest

This file is the process for deciding whether the bug report covers enough cases before it is filed.
Every row says what was run, the exact command, and the result. A row marked **open** has no result yet.
Do not file claims about an open row.

Pass criteria for one run: `repro.html` prints less than 3,000 bytes with no text and no non-white pixels
(**BLANK**), and `repro-control.html` prints more than 3,000 bytes with all text. If the control is also
blank, the run is **invalid** (a browser or OS problem, not this bug).

### Controls: why a blank result can be trusted

A blank result only counts if the setup is shown to work. Each CI run has three controls:

| Control | What it rules out | Where |
|---|---|---|
| `repro-control.html` in the same browser | the browser or OS cannot print at all | every run (the `control` column) |
| An empty page in the same browser | the 3,000-byte threshold is wrong for this runner (an empty page prints about 750 to 1,000 bytes, about the same as the blank repro) | every run (the `empty` column); a run is INVALID if the empty page is over the threshold |
| A **known-good build**: Chromium 107.0.5304.18 (Playwright 1.27.1), the last build that printed `repro.html` in a Linux container | the setup, the runner, or the file loading breaks `repro.html` for any Chrome | the `pw-107` target on every OS |
| The **first-bad build**: Chromium 108.0.5359.29 (Playwright 1.28.1) | brackets the Linux window on each runner | the `pw-108` target on every OS |

The `pw-107` row must say `prints` with `repro` and `control` about equal. If it says `BLANK` on a runner, treat every
row for that OS as no data.

**The first known-good choice failed.** Chrome for Testing 127.0.6533.119 headless shell printed `repro.html` on a
physical Mac (`repro=15559 control=15559 empty=751`) but was BLANK on all four GitHub-hosted runners (run
actions/runs/38981978247: `repro=847` against controls of 8,991 to 20,653 bytes). A fresh clone and the same install steps
printed correctly on the Mac, so the difference is the machine and not the repo, the Playwright version, or the
install. The same build blanks in a Linux container. It is now the `cft-127` target: a data point, not a control.

That result is why a control must be a build that is shown to print **on the same kind of machine**. On the Mac,
Chromium 107 and 108 both print. In a Linux container, 107 prints and 108 is blank.

**Result of the corrected controls** (run 39264032665, all 28 jobs succeeded):

- `pw-107` (Chromium 107.0.5304.18) **prints on all four runners**, with `repro` and `control` within 20 bytes
  (Linux 10,604 / 10,619, Windows 21,681 / 21,701, macOS Intel and arm64 16,891 / 16,910). The harness works on every OS.
- `pw-108` (Chromium 108.0.5359.29) is **BLANK on all four** (671 bytes, equal to the empty page).
- The empty-page check passed on every row (under 3,000 bytes: 671 to 887).
- `cft-127` is BLANK on all four again, consistent with the window being 107 to 108 on runners.

## 1. Matrix

| Dimension | Value | Status | Result |
|---|---|---|---|
| OS | macOS 26 (Darwin 25.6), arm64 | done | BLANK |
| OS | Linux Ubuntu 24.04, arm64 (Docker) | done | BLANK (Chromium 133, both headless modes) |
| OS | Linux x86_64 (GitHub `ubuntu-latest`, kernel 6.17 azure) | done, CI | BLANK: Chrome 155.0.8059.84, Chrome beta 157.0.8103.6, Chromium 156.0.8078.4 (944, 944, 839 bytes; controls 9,072, 9,072, 8,967) |
| OS | Windows (GitHub `windows-latest`, 10.0.26100) x64 | done, CI | BLANK: Chrome 155.0.8059.85, Chrome beta 157.0.8103.6, Chromium 156.0.8078.4 (954, 954, 839 bytes; controls 20,741, 20,743, 20,626) |
| OS | macOS Intel (GitHub `macos-15-intel`, Darwin 24.6) x64 | done, CI | BLANK: Chrome 155.0.8059.85, Chrome beta 157.0.8103.6, Chromium 156.0.8078.4 (960, 960, 839 bytes; controls 15,654, 15,656, 15,533) |
| OS | macOS Apple silicon (GitHub `macos-latest`, Darwin 25.6) arm64 | done, CI | BLANK on the same three browsers, same sizes as macOS Intel |
| Platform dependence | Chrome for Testing 127.0.6533.119 headless shell on 4 GitHub runners, a Linux container, and a physical Mac | done | BLANK on the 4 runners and in the container; prints on the physical Mac. Cause unknown. |
| CI version bracket, with control | Chromium 107.0.5304.18 (`pw-107`) and 108.0.5359.29 (`pw-108`) on ubuntu-latest, windows-latest, macos-latest, macos-15-intel | done, CI | 107 prints on all four; 108 BLANK on all four. This is the regression window on every runner. |
| Factors that did **not** change the result | Linux container, Chromium 127: wait 1.5 s, two animation frames, `fonts.ready`, screenshot first, pdf twice, print media, viewport 800x600 / default / 390x844 mobile, device scale factor 2, `file://` URL instead of `setContent`, `LANG`, 1 CPU (`--cpus=1`). Mac, Chrome for Testing 127 shell: `--disable-gpu`, `--disable-software-rasterizer`, SwiftShader, `--enable-unsafe-swiftshader`, and 8 font families. | done | Linux stays BLANK; Mac stays correct |
| Linux version scan (Docker Desktop, Ubuntu 22.04 arm64, Playwright's Chromium) | 107.0.5304.18 prints; 108.0.5359.29, 109, 110, 114, 117, 120, 123, 125, 127.0.6533.17, 128.0.6613.18 blank | done | the Linux regression is between 107 and 108 |
| Regression range by position (old headless, Chromium snapshots, macOS arm64) | 1316017 good, 1318290 bad | done, partial | a range of about 2,300 positions. Builds near 1317170 to 1317188 printed nothing here, so it is not one commit. Finish it with `bisect-builds.py` on a machine where they run. |
| Chrome version, old headless (`--headless=old`) | 113.0.5672.63, 116.0.5845.96, 124.0.6367.207, 127.0.6533.119 | done | prints correctly |
| Chrome version, old headless (`--headless=old`) | 128.0.6613.8, 128.0.6613.84 | done | BLANK |
| Chrome version, chrome-headless-shell (Chrome for Testing) | 127.0.6533.119 | done | prints correctly (29,542 bytes, same as the control) |
| Chrome version, chrome-headless-shell (Chrome for Testing) | 128.0.6613.84 | done | BLANK (855 bytes; the control prints 29,542) |
| Chrome version, Playwright's bundled Chromium | 125.0.6422.26, 127.0.6533.17 | done | prints correctly |
| Chrome version, Playwright's bundled Chromium | 128.0.6613.18, 129.0.6668.29, 130.0.6723.31, 133.0.6943.16 (Linux), 153.0.8010.12, 156.0.8078.4 | done | BLANK |
| Chrome version, new headless | 124.0.6367.207, 127.0.6533.119, 155.0.8059.84, Linux 133 | done | BLANK |
| Chrome version, new headless | 113, 116, 120, 128 | no data | the builds hang or crash on this macOS, even for the control |
| Headless mode | old (`--headless=old`, chrome-headless-shell) and new | done | see the version rows |
| Headed Chrome (a visible window), **raw DevTools `Page.printToPDF`** | 127.0.6533.119, 128.0.6613.84, 155.0.8059.84 | done | prints correctly: 17,480 / 17,480 / 16,886 bytes, all text present. The same Chrome 155 build, file and script blank when headless. **This does not mean headed Chrome is safe**: the print dialog is blank (next row). |
| GPU | `--disable-gpu` and without it (Chrome 155, new headless) | done | BLANK both ways |
| Chrome channel | stable (155) | done | BLANK on Linux, Windows, and both Macs |
| Chrome channel | beta (157.0.8103.6) | done, CI | BLANK on Linux, Windows, and both Macs |
| Chrome channel | dev | no data | `npx playwright install chrome-dev` did not give a usable binary on any of the four runners (launch error: distribution not found). Not a pass. |
| Chrome channel | canary | **open** | not in the workflow |
| Microsoft Edge | stable | **open**, CI | |
| `Page.printToPDF` options | Letter, A4 landscape, custom size, `scale`, `printBackground:false`, `preferCSSPageSize`, tagged + outline, `ReturnAsStream` | done | all 8 BLANK |
| Other capture paths | `captureScreenshot` (viewport, full page), print-media emulation + screenshot | done | correct, identical to the control |
| **Print dialog** (Ctrl/Cmd+P, Save as PDF), headed Chrome, macOS | Letter, portrait, margins None, scale Default, background graphics off; page served from `http://localhost:63342` | done once, by hand | **BLANK preview for `repro.html`; the control's preview shows all the text.** Chrome version, the saved PDF, and a `file://` URL are **not recorded yet**. |
| Print dialog on Windows and Linux | | **open**, manual | |
| Print dialog: which Chrome versions | | **open**, manual | the dialog's window is unknown; the 107 to 108 window is for headless `page.pdf` only |
| Firefox | 138.0.1, macOS, WebDriver `printPage` | done | NOT affected: all text printed |
| Safari / WebKit | **open**, manual (section 3) | | |
| `Page.captureSnapshot` (MHTML) | not applicable | skipped | it saves markup and does not render |

## 2. Commands for the rows that are done

Local, one browser (needs `npm install` and `npx playwright install chromium`):

```sh
npm run repro        # repro.html: expect BLANK
npm run control      # repro-control.html: expect "has content"
npm run probe        # every PDF option and the screenshots (needs pdftotext and pdftoppm from poppler)
```

Chrome CLI, a chosen build, a chosen headless mode (`new`, `old`, or `--headless` for chrome-headless-shell):

```sh
"$CHROME" --headless=old --no-pdf-header-footer --print-to-pdf="$PWD/out.pdf" "file://$PWD/repro.html"
pdftotext out.pdf -        # nothing printed means blank
```

Chrome for Testing builds by exact version (the version table above used these):

```sh
npx @puppeteer/browsers install chrome@127.0.6533.119 --path ./cft
npx @puppeteer/browsers install chrome-headless-shell@128.0.6613.84 --path ./cft
```

Linux in a container (arm64 on Apple silicon, x86_64 elsewhere):

```sh
docker run --rm -v "$PWD:/repro:ro" -w /work mcr.microsoft.com/playwright:v1.50.0-noble \
  sh -c "cp /repro/*.html /repro/ci-run.cjs /work/ && npm init -y >/dev/null && npm i playwright@1.50.0 >/dev/null 2>&1 && node ci-run.cjs chromium chromium"
```

Firefox, through the W3C WebDriver "Print Page" command (Selenium downloads Firefox by itself):

```js
const { Builder } = require('selenium-webdriver');
const firefox = require('selenium-webdriver/firefox');
const driver = await new Builder().forBrowser('firefox').setFirefoxOptions(new firefox.Options().addArguments('-headless')).build();
await driver.get('file:///path/to/repro.html');
const pdfBase64 = await driver.printPage({ background: true, shrinkToFit: false, width: 15.4, height: 9.3, top: 0, bottom: 0, left: 0, right: 0 });
```

## 3. How to cover the open rows

### Windows, Linux x86_64, macOS Intel, and the Chrome channels (CI)

`.github/workflows/matrix.yml` runs `ci-run.cjs` on `ubuntu-latest`, `windows-latest`, `macos-latest` (arm64), and
`macos-15-intel`, for `chromium` (the headless shell) and the `chrome`, `chrome-beta`, and `chrome-dev` channels.
It is `workflow_dispatch` only. Steps:

1. Push the repo (the workflow file is already in it).
2. Actions tab, "print-to-pdf matrix", "Run workflow".
3. Open the run summary. Each job appends one row: OS, target, version, repro bytes, control bytes, result.
4. Copy the rows into the results table in `README.md`. Any row that says `ERROR` or `INVALID` is a missing
   data point, not a pass.

To add Edge, add `msedge` to the `target` list. To test an exact Chrome build on CI, use
`browser-actions/setup-chrome` with `chrome-version: <full version>` and run the CLI command from section 2.

### Print from the Chrome UI (Ctrl/Cmd+P)

**Result so far (macOS, by hand):** the preview is **blank for `repro.html`** and shows all the text for
`repro-control.html`, so the bug is not headless-only. A DevTools `Page.printToPDF` in a headed window printed correctly,
so the dialog path and that call differ. What is still missing, to make the report complete:

- The Chrome version (`chrome://version`) and macOS version.
- The saved PDF from the dialog, opened and run through `pdftotext`: is it blank too, or only the preview?
- The same test opened with a `file://` URL (the first test used `http://localhost:63342`).
- The same test on an older Chrome. The headless window is 107 to 108; the dialog's window may differ.
- Save the two dialog screenshots as `results/print-dialog-repro.png` and `results/print-dialog-control.png`.

The steps, for repeating it on another system:

1. Open `repro.html` in Chrome. Confirm "10.3.0" and the two UNRELATED lines show on screen.
2. Press Ctrl+P (Cmd+P on macOS). Set **Destination** to **Save as PDF**. Turn on **Background graphics**.
   Record whether the preview pane is blank.
3. Save the file. Run `pdftotext file.pdf -`. Record whether text is present.
4. Repeat with `repro-control.html`.
5. Record the Chrome version from `chrome://version`, the OS, and the paper size you chose.

### Safari (macOS) and other WebKit

Safari WebDriver needs `sudo safaridriver --enable`, so the steps are manual.

1. Open `repro.html` in Safari. Choose **File, Print...** (Cmd+P), then **PDF, Save as PDF** at the bottom left.
2. Run `pdftotext` on the saved file. Record whether text is present.
3. Repeat with `repro-control.html`. Record the Safari version (Safari menu, About Safari).

### Firefox on other operating systems

Run the Firefox snippet above on Windows and Linux, or use **File, Print, Save to PDF** by hand. It is only
needed if the report should say "Firefox is not affected" for those systems.

## 4. When the report is ready

- Every row in the matrix is `done`, `no data` with a reason, or `skipped` with a reason.
- The results table in `README.md` and the "Additional information" in `ISSUE.md` use only these rows.
- The regression window in `ISSUE.md` is the narrowest one in the version rows.
- Attachments for the tracker: `repro.html`, `repro-control.html`, and the PDFs in `results/`.

## 5. Finishing the position bisect

The old-headless regression is narrowed to Chromium main positions 1316017 (last good) to 1318290 (first bad):
https://chromium.googlesource.com/chromium/src/+log/57d31eae8e4eca52fc106402dec56d772755221c..e32ab6f1f764b726a16f7220e9fd6c0be9996491

My search stopped there because snapshot builds around 1317170 to 1317188 printed nothing on macOS 26 arm64
(even for the control). To finish:

1. Use a machine where those builds run, or another OS. Chromium's `tools/bisect-builds.py` (in the Chromium
   source tree) downloads snapshot builds for a position range and asks whether each one is good or bad.
2. The test for each build is: run it with `--headless=old --no-pdf-header-footer --print-to-pdf=out.pdf file:///path/to/repro.html`
   and run `pdftotext out.pdf -`. Empty output is bad. Text present is good. Check `repro-control.html` first, so
   a build that cannot print at all is not counted as bad.
3. Replace the range in `README.md` and `ISSUE.md` with the commit that the tool reports.

The script I used, which tries neighbouring snapshots when one does not run, is the logic described in step 2
applied to the snapshot bucket listing. It was run from outside this repo and is not included.
