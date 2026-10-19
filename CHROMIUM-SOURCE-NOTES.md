# What the Chromium source says (read-only review, 2026-10-19)

Facts come from the commit diffs linked below. Items marked **hypothesis** are not tested.

## Facts

1. `06876550989f` (2022-09-30, position #1053686) changes `runtime_enabled_features.json5` only:
   `LayoutNGPrinting` goes from `status: "test"` (on in web tests, off in the shipping browser) to `status: "stable"`,
   with a `base_feature` kill switch. It has no code change. The layout and paint code already existed behind the flag.
2. Before that commit, **Chromium disabled container queries while printing**. In `Element.cc`
   `ComputeContainerQueryEvaluator` (removed by `64f41cde3a3b`):
   `if (!LayoutNGPrintingEnabled() && document.Printing()) return nullptr;`
   Legacy layout also printed this console warning: "Using container queries or units with printing, or in combination
   with tables inside multicol will not work correctly." So on Chromium 107 (flag off) the container never evaluated in
   print, and `cqh` fell back to a default. This fits the larger-than-screen `10.3.0` seen in the 107 print dialog.
   **So "107 prints" does not mean container queries worked in print. They were switched off.**
3. From 108 the container evaluator runs during print, inside the new NG fragmentation (paged) layout.
4. The flag was deleted on 2023-03-24 by `64f41cde3a3b` "[RemoveLegacy] Remove LayoutNGPrinting flag" (Chrome 113 or 114).
   That matches the kill switch working on 108 to 113 and not from 114.
5. Related commits: `5202af86bdeb` (first NG print prototype, `NGPageLayoutAlgorithm`), `f77685296dc5` (merge the
   `LayoutNGView` flag into `LayoutNGPrinting`), `126b931b0dc0` (the feature depends on `LayoutNG`,
   `LayoutNGBlockFragmentation`, `LayoutNGView`).

## Consequences for the report

- The defect is not in a regression of working code. It is in a code path that was never used for container queries
  in print before 108, so it was probably never exercised in the field. Frame the issue as "container query units in
  NG print layout", not "something broke in 108".
- `--enable-blink-features=LayoutNGPrinting` alone on 107 did not reproduce it because the feature depends on `LayoutNG`,
  `LayoutNGBlockFragmentation`, and `LayoutNGView`. **Tested 2026-10-19: with all four names, Chromium 107.0.5304.18 is
  blank (887 bytes; the control prints 11,779), and with any three it prints.** So the defect is in the LayoutNG print
  path and was already in 107 behind the flags. See `tools/flags-107.cjs`.

## Hypotheses to test (in order)

1. The abspos requirement: out-of-flow boxes are laid out late in a fragmentation context. The container query
   style recalc that `cqh` triggers may run at a point where it is not allowed, or may leave the layout tree
   needing layout, so painting skips the whole page. Check `NGOutOfFlowLayoutPart` and where
   `UpdateStyleAndLayoutTreeForContainer` is called for OOF descendants. A DCHECK build of `headless_shell` would
   report it directly.
2. Why `cqh` but not `cqw`, and why `@container (min-height)` is fine: units are resolved through
   `CSSToLengthConversionData` container sizes, queries through the evaluator. They may take different paths.
3. Windows dialog prints while macOS and Linux do not, and headless is blank on all: look for platform
   differences in the print preview code (`PrintRenderFrameHelper`) versus headless `Page.printToPDF`.

## Next step if a checkout is wanted

Build `headless_shell` with `is_debug = true` (DCHECKs on) and run `repro.html`. A DCHECK message names the failing
invariant. A debug build is slow (several hours the first time), so try `dcheck_always_on = true` with a release
build first.
