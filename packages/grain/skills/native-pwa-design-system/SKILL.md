---
name: native-pwa-design-system
description: Build and review GRAIN's dependency-free PWA interfaces, mobile primitives, app shell, and design tokens. Sync browser and design standards on request or when stale.
---

# GRAIN native PWA design system

Activate for PWA UI builds and reviews, component creation, token changes, and work on mobile layout, navigation, installation, or offline behavior. Activate explicitly when asked for `/sync-standards`. That phrase is an agent trigger and can also be mapped by a host that supports slash commands.

## Execution workflow

1. Read [STANDARDS_BASELINE.md](STANDARDS_BASELINE.md) and the relevant files in `references/`. Check freshness before using a platform claim.
2. Identify routes, entry points, scroll owners, and supported browser/install contexts. Preserve deep links, reload, browser Back and Forward, and in-app Back with a deterministic parent route for direct entry.
3. Use semantic HTML, CSS, and vanilla JS. Reject framework, utility-CSS, component-library, and runtime package dependencies. Start with `dialog`, `popover="auto"`, native date inputs and selects, and feature-detected sharing. Use custom elements only for missing primitives such as sheets, refresh gestures, or toast stacks.
4. Use the shared tokens and one adaptive navigation tree. Verify safe areas, keyboard visibility, reflow, text enlargement, and preserved route/selection across resize, rotation, and folding. Use Visual Viewport measurements only where tested and needed.
5. Verify pointer, touch, keyboard, and screen-reader operation. Check focus order, visible focus, modal dismissal and restoration, hit areas, color contrast, reduced motion, and alternatives to gestures. Keep user content selectable.
6. If applicable, verify manifest and icons, installed and browser navigation, update and offline paths, cache eviction recovery, and capability fallbacks with permission denied or installation unavailable.
7. Before presenting or committing HTML/CSS/JS, run available static and browser checks. Cover iOS tab and Home Screen, Android tab and installed, and desktop where available. Exercise widths 320, 599, 600, 839, and 840 CSS px, a short landscape window, and both foldable displays. Record actual passes and untested device cases separately.

## Built-in standards sync

On activation, parse `last_verified` as a UTC date. Sync if explicitly invoked, the timestamp is missing, invalid, future-dated, or more than 60 calendar days old. This runs during agent use. A host scheduler may invoke the same trigger if configured separately.

1. Search official, live sources for the latest shipped Apple Safari/WebKit release notes and iOS Home Screen behavior, Chrome/Android stable releases and PWA capability changes, Apple HIG layout/accessibility/materials and foldable guidance, Material Design 3 adaptive navigation and Android window size classes, and the DTCG format publication. Open primary sources and record URL, relevant release or revision, and affected platform. Check region-specific claims against Apple and the applicable regulator.
2. Compare against the last baseline. Record shipped additions, deprecations, regressions, and fallback implications. Classify stable, rollout, preview, and unverified evidence separately. Keep minimum support distinct from the latest release. Where documentation describes only part of an API, test the specific feature before relaxing its fallback.
3. Verify proposed changes against the existing token consumers and reference behavior. Preserve public names unless the change is intentional and every affected reference is updated. Check contrast in both themes, reduced motion, and the layout, gesture, or browser paths affected by the update.
4. Rewrite `STANDARDS_BASELINE.md` and `references/tokens.css` together. Update `last_verified` and the CSS header to the current UTC date. Change token values only when justified and record the source-backed changes or that no changes were required. Update affected references in the same change. Inspect the diff and verify matching dates.
5. If any mandatory source family cannot be verified, keep the previous verification date and baseline in place. Report the missing evidence and proceed with its conservative fallbacks. Do not replace verified rules with guesses or preview-only support.

## Reference integration

Read the [GRAIN package rules](../../CLAUDE.md), the [usage guide](../../README.md),
and the [app-shell contract](../../components/organisms/app-shell/app-shell.md).
Keep manifests, service workers, and offline data policies in the host app.
Use GRAIN's native browser runtime and existing semantic tokens. Preserve the shared
interaction contract for operable product actions. Opening or dismissing a presentation
surface is local UI state. Applying a product action uses the host's existing action path.

For the three-region PWA composition, load GRAIN's variables and app-shell styles,
then the reference token and shell styles. Put the `data-pwa-page` attribute on
the document element and `data-pwa-layout` on the app shell. The direct children
are `.app-shell__topbar`, a labelled `nav.app-shell__rail` containing linked
`.nav-item` elements, and `main.app-shell__main`. Keep labels visible at all
widths. The existing workspace layouts keep their own breakpoints. Open-view tabs
can still use the tab bar inside the top bar.

Use `viewport-fit=cover` and keep zoom enabled. When the virtual keyboard occludes
the shell, the host may set `--pwa-visual-height` from a verified Visual Viewport
measurement and remove it when the keyboard closes.

Load the sheet reference as a module only where a bottom sheet is needed. Keep an
inline fallback and move its contents into the sheet after checking
`HTMLDialogElement.prototype.showModal`. Give the sheet a meaningful `heading`
and localize `close-label`. Open it with `sheet.show(event.currentTarget)`, use
`sheet.close("apply")` after the host action succeeds, and read the dismissal
reason from the bubbling `sheet-close` event. For nonce-based CSP, import the
module before creating instances and assign `UiSheet.styleNonce`.
