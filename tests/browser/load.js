// Loads the card under test: the page's ?bundle= (a path from this folder),
// or the built card. The prototype and the built card take the same checks.
const bundle = new URLSearchParams(location.search).get("bundle") || "../../dist/xtool-card.js";
document.write(`<script src="${bundle}"><\/script>`);
