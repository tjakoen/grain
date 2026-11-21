---
title: Add native PWA standards to GRAIN
date: 2026-11-21
status: partial
lane: gated
branch: codex/grain-pwa-standards
skills: [native-pwa-design-system]
scope: [GRAIN package instructions, GRAIN usage guide, PWA skill and references, plan and run evidence]
scopeGrowth: none
touched: [packages/grain/CLAUDE.md, packages/grain/README.md, packages/grain/skills/native-pwa-design-system, plans/native-pwa-standards.md, artifacts/runs/2026-11-21-native-pwa-standards.md]
dirty: []
plans: ["native-pwa-standards | ../../plans/native-pwa-standards.md"]
gates: ["node --input-type=module --check | pass", "git diff --check | pass", "Chromium integration smoke | pass", "gates-grain | unavailable"]
diffstat: local patch against GRAIN documentation snapshot
unpushed: "1 patch | GitHub denied branch creation"
doctor: checkout and Docker gate unavailable
verifiedBy: nobody yet
---

# Native PWA standards

The reference uses GRAIN’s semantic theme roles and shell regions. The existing
workspace breakpoints and the open-view tab bar retain their own contracts.
Installation, service-worker registration and offline storage belong to the host.

## Gate output

JavaScript syntax and diff checks exited zero with empty output. Chromium smoke
output against the upstream shell and base token files follows.

```text
320 600 PASS 320
599 600 PASS 599
600 600 PASS 600
839 600 PASS 839
840 600 PASS 840
840 300 PASS 840
Touch-emulated swipe PASS
```

The smoke exercised layout, native modal behavior, focus restoration, and gesture
dismissal in desktop Chromium. The upstream workspace gate, installed PWA flows,
other themes, Safari, physical devices, and screen readers were not exercised.
The workspace gate requires access to the Docker daemon and the sibling bread checkout.

GitHub returned:

```text
403 Resource not accessible by integration
```

A maintainer can apply the patch once repository write access is available. Review
on physical devices before relying on keyboard, safe-area, or foldable behavior.
