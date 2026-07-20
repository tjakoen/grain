---
id: welcome
mode: demo
title: "CRUMB in 3 steps"
route: /
---
A tiny demo tour — the schema in practice. The lamp lights each surface, the popover explains it,
and Next routes to where the next surface lives.

## screen
This is a whole app screen. A step whose surface is present on every page needs no `at` — the tour
lights it in place.

## nav:/notes
- at: /
The app dock. Each entry is an addressable `nav:` surface, so a tour can point at navigation the
same way it points at content.

## note:hello
- at: /notes
- status: new
A content surface only exists on its own page, so this step carries `at: /notes` and CRUMB
navigates there for real before lighting it.
