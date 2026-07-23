// grain/scripts/made-with — the system byline as a string, for server-side template-literal
// shells (pantry, greenroom, proof, mill, …). One source of truth for the CONTENT of the
// made-with molecule (components/molecules/made-with/) so the line can never drift per app.
// Plain ESM, no DOM: importable from Bun servers and browsers alike.

const GRAIN_URL = "https://tjakoen.github.io/grain";
const AUTHOR_URL = "https://tjakoen.github.io";

const LINE =
  `made with <a href="${GRAIN_URL}">GRAIN</a> by <a href="${AUTHOR_URL}">tjakoen</a>`;

/**
 * The byline markup. Block form (default) is a standalone page footer; inline form is a
 * span for the right side of a status-bar row (after the __spacer).
 * @param {{ inline?: boolean }} [opts]
 * @returns {string}
 */
export function madeWith({ inline = false } = {}) {
  return inline
    ? `<span class="made-with" data-inline>${LINE}</span>`
    : `<footer class="made-with">${LINE}</footer>`;
}
