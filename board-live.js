// proof/board-live.js — the board's live client (piece 3). RECEIVE-ONLY: the v1 board is
// read-only (no write door yet — that's piece 6), so this is deliberately much lighter than
// grain/scripts/ai-dispatch.js — no intent posting, no client door, no watchdog/offline timers.
// Native EventSource auto-reconnects on its own; nothing here needs to handle a drop. The initial
// board is server-rendered on load, so there's no replay to worry about either: a dropped op
// during a reconnect blip just means the next edit still lands (fs.watch keeps firing on the
// server side; this client doesn't need to catch up on what it missed).
const session = Math.random().toString(36).slice(2);
const es = new EventSource(`/stream?session=${encodeURIComponent(session)}`);

es.addEventListener("op", (e) => {
  let op;
  try {
    op = JSON.parse(e.data);
  } catch (err) {
    console.error("[board-live] bad op", err);
    return;
  }
  if (op.op !== "replace") return;   // only op kind PROOF ever sends today
  const el = document.querySelector(`[data-surface="${op.target}"]`);
  if (el) el.innerHTML = op.html;
});
