// grain-mcp/harvest.test.ts — the static-HTML → DomDoc adapter, exercised against a REAL snippet
// lifted verbatim from tjakoen.github.io/dist/mail/index.html (2026-07-25 export) so the comment-vs-
// template gotcha is tested against the actual bytes that motivated it, not a stylized stand-in.
import { test, expect } from "bun:test";
import { parsePage } from "./harvest.ts";
import { domManifest, harvestReadable } from "@tjakoen/grain/ai/manifest-dom.ts";

// Verbatim from dist/mail/index.html lines 460-476 + 357-370: one real mail-row comment+item (the
// comment's PROSE literally contains `data-surface="item:mail-<id>"`, the unresolved placeholder
// documented in the row's own authoring note) plus the notepad's `data-read` surface.
const MAIL_SNIPPET = `
<!DOCTYPE html>
<html lang="en">
<head><title>Mail · TJ's Desk</title></head>
<body data-ai-transport="client" data-ai-door="/modules/portfolio/ai/desk-door.js" data-screen="mail" class="app-window-backdrop">
  <div class="app-shell app-window" data-section="mail" data-surface="screen">
    <section class="notepad" data-mode="rendered" data-surface="notepad">
      <header class="notepad__head">
        <span class="notepad__title">Your notes</span>
      </header>
      <!-- data-read: the notepad's live text is STATE a reasoner should read, so it opts into the
           manifest's inView.readable (the MCP-resources analog). The framework harvests it; we only
           flag it here (grain/ai/manifest-dom.ts). -->
      <div class="notepad__body" data-surface="notepad-body" data-read>Call the bank</div>
      <textarea class="notepad__source" data-surface="notepad-src" aria-label="Notepad source (markdown)"
                placeholder="Write markdown, then Commit…"></textarea>
    </section>
    <div class="mailbox__rows">
      <!-- molecules/mail-row — one message row in the /mail list, data-bound via each="mailMessages"
     (server.ts). The status-dot col stays empty until the island marks the row .is-unread (that
     read/unread state lives only in the browser's localStorage, so the server renders zero dots).
     The when-span is server-rendered ABSOLUTE (export-safe) and carries data-relativize so the
     island can rewrite it to "N days ago", keeping the absolute date in title. Undated rows (Sent,
     Drafts) carry a literal label and no data-date, so they're never relativized. The row also
     carries its AI target address (data-surface="item:mail-<id>", AI-INTERFACE §4): data-kind="item"
     and data-accepts="item.archive" mirror loop-card's operable markup, so the archive verb can
     target this row the same way the on-page Archive button does. See mail-row.md. -->
<a class="mailbox__item" data-kind="item" data-accepts="item.archive" data-bind-href="href" data-bind-data-folder="folder" data-bind-data-surface="surface" href="#msg-welcome" data-folder="inbox" data-surface="item:mail-welcome">
  <span class="mailbox__item-dot" aria-hidden="true"></span>
  <span class="mailbox__item-from" data-field="from">The Desk</span>
  <span class="mailbox__item-subject" data-field="subject">About this mailbox</span>
  <span class="mailbox__item-when" data-relativize data-bind-data-date="whenDate" data-bind-title="whenTitle" data-field="whenText" data-date="2026-07-14" title="Jul 14, 2026">Jul 14</span>
  <span class="mailbox__item-snippet" data-field="snippet">What's real here, what isn't, and where the one live control is.</span>
</a>
    </div>
  </div>
</body>
</html>
`;

test("parsePage: title harvested and decoded", () => {
  const { title } = parsePage(MAIL_SNIPPET);
  expect(title).toBe("Mail · TJ's Desk");
});

test("parsePage: body data-screen readable via getAttribute (domManifest's own entry point)", () => {
  const { doc } = parsePage(MAIL_SNIPPET);
  expect(doc.body?.getAttribute("data-screen")).toBe("mail");
});

test("parsePage + querySelectorAll('[data-surface]'): the comment's placeholder text never surfaces", () => {
  const { doc } = parsePage(MAIL_SNIPPET);
  const surfaces = [...doc.querySelectorAll("[data-surface]")].map((el) => el.getAttribute("data-surface"));
  // no "item:mail-<id>" anywhere — the comment housing it was stripped before tag scanning began
  expect(surfaces.some((s) => s?.includes("<"))).toBe(false);
  expect(surfaces).not.toContain("item:mail-<id>");
});

test("parsePage + querySelectorAll: the REAL resolved mail item survives, data-bind-* and all", () => {
  const { doc } = parsePage(MAIL_SNIPPET);
  const surfaces = [...doc.querySelectorAll("[data-surface]")].map((el) => el.getAttribute("data-surface"));
  expect(surfaces).toContain("item:mail-welcome");
});

test("parsePage: data-read surface's textContent is harvested (the notepad's live text)", () => {
  const { doc } = parsePage(MAIL_SNIPPET);
  const readable = harvestReadable(doc);
  // the real markup sets no data-kind on notepad-body (dist/mail/index.html:367), so the kind is
  // derived from the bare surface id itself — "notepad-body" isn't a registered SurfaceKind, so it
  // resolves push-only, same as the wrapping "notepad" surface does when addressed by note.append.
  expect(readable).toContainEqual({ id: "notepad-body", kind: "notepad-body", text: "Call the bank" });
});

test("parsePage output feeds domManifest end to end: real targets, no placeholder ghosts", () => {
  const { doc } = parsePage(MAIL_SNIPPET);
  const m = domManifest(doc);
  expect(m.screen).toBe("mail");
  const ids = m.targets.map((t) => t.id);
  expect(ids).toContain("item:mail-welcome");
  expect(ids).toContain("notepad");
  expect(ids.some((id) => id.includes("<"))).toBe(false);
  const item = m.targets.find((t) => t.id === "item:mail-welcome")!;
  expect(item.accepts).toContain("item.archive");
});

// ── smaller, synthetic edge cases: void elements, entities, comment stripping in general ───────────

test("parsePage: a void element carrying data-surface has empty textContent, doesn't swallow siblings", () => {
  const html = `<html><body data-screen="x"><input data-surface="chat-input"><div data-surface="after">tail</div></body></html>`;
  const { doc } = parsePage(html);
  const els = [...doc.querySelectorAll("[data-surface]")];
  expect(els.map((e) => e.getAttribute("data-surface"))).toEqual(["chat-input", "after"]);
  expect(els[0]!.textContent).toBe("");
  expect(els[1]!.textContent).toBe("tail");
});

test("parsePage: entity decoding in text content and attribute values", () => {
  const html = `<html><body><div data-surface="reflection" data-read>Buy milk &amp; eggs &mdash;wait, &lt;joke&gt;</div></body></html>`;
  const { doc } = parsePage(html);
  const el = [...doc.querySelectorAll("[data-surface]")][0]!;
  // &mdash; isn't in the small named table this adapter supports — left verbatim, not crashed on
  expect(el.textContent).toBe("Buy milk & eggs &mdash;wait, <joke>");
});

test("parsePage: script/style content never confuses the tag scanner (raw '<'/'>' inside)", () => {
  const html = `<html><head><style>.a{content:"<x>"}</style><script>if (1 < 2) { console.log(">"); }</script></head>` +
    `<body><div data-surface="chat-log">hi</div></body></html>`;
  const { doc } = parsePage(html);
  const els = [...doc.querySelectorAll("[data-surface]")];
  expect(els.map((e) => e.getAttribute("data-surface"))).toEqual(["chat-log"]);
});

test("parsePage: a page with no <body> yields doc.body === null, not a throw", () => {
  const { doc } = parsePage("<html><head><title>Bare</title></head></html>");
  expect(doc.body).toBeNull();
});

test("querySelectorAll: throws loudly on any selector besides '[data-surface]'", () => {
  const { doc } = parsePage("<html><body></body></html>");
  expect(() => [...doc.querySelectorAll(".foo")]).toThrow(/unsupported selector/);
});
