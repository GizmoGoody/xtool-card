// The state picture shown in place of the tile card's icon: a drawing of what
// the laser is doing, built in memory (no files are written).

// Animations inside the picture. They stop for anyone who has reduced motion
// turned on (the card also draws a still picture for them).
const PICTURE_CSS = `
.h{stroke-dasharray:2.5 300;animation:r3 3.2s linear infinite}
.m{stroke-dasharray:10 300;animation:r10 3.2s linear infinite}
.t{stroke-dasharray:26 300;animation:r26 3.2s linear infinite}
.s{animation-duration:7s}
@keyframes r3{from{stroke-dashoffset:2.5}to{stroke-dashoffset:-97.5}}
@keyframes r10{from{stroke-dashoffset:10}to{stroke-dashoffset:-90}}
@keyframes r26{from{stroke-dashoffset:26}to{stroke-dashoffset:-74}}
.f{stroke-dasharray:6 300;animation:fr 2.4s linear infinite}
@keyframes fr{from{stroke-dashoffset:6}to{stroke-dashoffset:-94}}
.u{stroke-dasharray:100 100;animation:bu 4s ease-out infinite}
@keyframes bu{0%{stroke-dashoffset:100}30%{stroke-dashoffset:0}100%{stroke-dashoffset:0}}
.e{animation:em 4s linear infinite}
@keyframes em{0%,28%{opacity:0}31%{opacity:1}45%{opacity:.6}60%,100%{opacity:0}}
.z{transform-box:fill-box;transform-origin:center;animation:zz 3.6s ease-in infinite;opacity:0}
.z2{animation-delay:1.2s}.z3{animation-delay:2.4s}
@keyframes zz{0%{opacity:0;transform:translate(0,3px) scale(.7)}20%{opacity:1}80%{opacity:.8}100%{opacity:0;transform:translate(2px,-5px) scale(1.1)}}
.b{transform-box:fill-box;transform-origin:center;animation:br 3.2s ease-in-out infinite}
@keyframes br{0%,100%{opacity:.25;transform:scale(.8)}50%{opacity:.9;transform:scale(1.12)}}
.k{transform-box:fill-box;transform-origin:50% 100%;animation:fl 1.1s ease-in-out infinite}
@keyframes fl{0%,100%{transform:scaleY(1) skewX(0)}30%{transform:scaleY(1.06) skewX(-3deg)}60%{transform:scaleY(.95) skewX(2deg)}}
.fd{animation:fd 1.6s ease-in-out infinite}.fu{animation:fu 1.6s ease-in-out infinite}
@keyframes fd{0%,100%{transform:translateY(-1.5px)}50%{transform:translateY(1px)}}
@keyframes fu{0%,100%{transform:translateY(1.5px)}50%{transform:translateY(-1px)}}
.w{animation:fw 2s ease-in-out infinite}.w2{animation-delay:.6s}.w3{animation-delay:1.2s}
@keyframes fw{0%{transform:translateY(-2px);opacity:0}30%{opacity:1}70%{opacity:1}100%{transform:translateY(2px);opacity:0}}
@media (prefers-reduced-motion: reduce){*{animation:none!important}.z{opacity:1}.u{stroke-dashoffset:0}}`;

// A small seeded random generator: the same job draws the same path, and
// the same pattern the same reflections
export function seeded(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let r = Math.imul(s ^ (s >>> 15), 1 | s);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A galvo's engraving path: short strokes that turn at random, inside the
 * circle, never crossing or touching an earlier stroke.
 */
export function galvoPath(seed: number): string {
  const rand = seeded(seed);
  type P = number[];
  const side = (a: P, b: P, c: P) => (c[0] - a[0]) * (b[1] - a[1]) - (b[0] - a[0]) * (c[1] - a[1]);
  const crosses = (p1: P, p2: P, p3: P, p4: P) =>
    (side(p3, p4, p1) > 0) !== (side(p3, p4, p2) > 0) && (side(p1, p2, p3) > 0) !== (side(p1, p2, p4) > 0);
  const distance = (p: P, a: P, b: P) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const k = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(p[0] - a[0] - k * dx, p[1] - a[1] - k * dy);
  };
  // One walk: from near the edge, heading for the middle at first
  const walk = () => {
    const start = rand() * Math.PI * 2;
    const points = [[12 + Math.cos(start) * 6, 12 + Math.sin(start) * 6]];
    let angle = start + Math.PI + (rand() - 0.5);
    for (let i = 0; i < 22; i++) {
      const last = points[points.length - 1];
      let placed = false;
      for (let tries = 0; tries < 40 && !placed; tries++) {
        const turn = angle + (rand() - 0.5) * 2.8;
        const length = 2.4 + rand() * 3.4;
        const next = [last[0] + Math.cos(turn) * length, last[1] + Math.sin(turn) * length];
        if (Math.hypot(next[0] - 12, next[1] - 12) > 9.2) continue;
        const mid = [(last[0] + next[0]) / 2, (last[1] + next[1]) / 2];
        let clear = true;
        for (let j = 0; j < points.length - 2 && clear; j++) {
          const a = points[j], b = points[j + 1];
          if (crosses(last, next, a, b) || distance(next, a, b) < 1.6 || distance(mid, a, b) < 1.6) clear = false;
        }
        if (clear) {
          points.push(next);
          angle = turn;
          placed = true;
        }
      }
      if (!placed) break;
    }
    return points;
  };
  // A walk can box itself in early: walk again (the same job always draws
  // the same path) and keep the longest
  let points: P[] = [];
  for (let attempt = 0; attempt < 30 && points.length < 16; attempt++) {
    const next = walk();
    if (next.length > points.length) points = next;
  }
  return `M${points.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(" L")}`;
}

// A raster: all the way across, down a step, back the other way
const RASTER = (() => {
  let d = "M3.5 4";
  for (let row = 0, y = 4; y <= 20; row++, y += 1.6) {
    d += ` H${row % 2 ? 3.5 : 20.5}`;
    if (y + 1.6 <= 20) d += ` V${(y + 1.6).toFixed(1)}`;
  }
  return d;
})();

const FLAME = "M12 22.5c-4.6 0-7.6-3-7.6-7.1 0-3.7 2.6-5.9 4.1-8.4.8 1.8 1.8 2.8 3 3.3-.2-3.4 1-6.4 3.6-8.8.4 3.6 2 5.6 3.3 7.5.9 1.4 1.3 2.9 1.3 4.3 0 5.1-3.2 9.2-7.7 9.2z";

/**
 * The picture for a state, as an image address. It is drawn on a 24-unit
 * grid, scaled to fill most of the tile card's round icon.
 */
export function statePicture(phase: string, color: string, { galvo = false, seed = 1, backing = false, motion = true } = {}): string {
  const c = (name: string) => (motion ? ` class="${name}"` : "");
  const burn = (d: string, ember: number[]) =>
    `<path d="${d}" pathLength="100" stroke="#3b2a16" stroke-width="4.2" opacity=".45"${c("u")}/>` +
    `<path d="${d}" pathLength="100" stroke-width="2.3"${c("u")}/>` +
    (motion ? `<circle cx="${ember[0]}" cy="${ember[1]}" r="1.6" fill="#ffb74d" stroke="none" class="e"/>` : "");
  let body: string;
  switch (phase) {
    case "processing": {
      const d = galvo ? galvoPath(seed) : RASTER;
      const slow = galvo ? "" : " s";
      body = motion
        ? `<path d="${d}" pathLength="100" stroke-width="1.1" opacity=".2" class="t${slow}"/>` +
          `<path d="${d}" pathLength="100" stroke-width="1.4" opacity=".5" class="m${slow}"/>` +
          `<path d="${d}" pathLength="100" stroke-width="2.4" class="h${slow}"/>`
        : `<path d="${d}" stroke-width="1.3" opacity=".6"/>`;
      break;
    }
    case "paused":
      body = burn("M8.5 4.5v15M15.5 4.5v15", [15.5, 19.5]);
      break;
    case "finished":
      body = burn("M3.8 12.8 9.3 18.2 20.2 6.4", [20.2, 6.4]);
      break;
    case "framing":
      body = `<rect x="3" y="3" width="18" height="18" rx=".5" stroke-width="1" stroke-dasharray="1.6 1.9" opacity=".45"/>` +
        (motion ? `<path d="M3 3h18v18H3z" pathLength="100" stroke-width="2.2" class="f"/>` : "");
      break;
    case "focusing":
      // The head closes in on the surface from above and below
      body = `<path d="M4 12h16" stroke-width="1.6"/>` +
        `<path d="M12 3v5.5M9 6 12 9 15 6" stroke-width="1.8"${c("fd")}/>` +
        `<path d="M12 21v-5.5M9 18 12 15 15 18" stroke-width="1.8"${c("fu")}/>`;
      break;
    case "warming":
      // Heat rising
      body = `<path d="M3.5 21h17" stroke-width="1.6" opacity=".6"/>` +
        ["", " w2", " w3"].map((delay, i) => {
          const x = 7 + i * 5;
          return `<path d="M${x} 18c-1.6-2.2 1.6-3.8 0-6s1.6-3.8 0-6" stroke-width="1.7"${c(`w${delay}`)}/>`;
        }).join("");
      break;
    case "overheat":
      body = `<path d="M10 14.6V5a2 2 0 0 1 4 0v9.6a4 4 0 1 1-4 0z" stroke-width="1.7"/>` +
        `<path d="M12 8v7.5" stroke-width="2"/><circle cx="12" cy="17.8" r="1.8" fill="${color}" stroke="none"${c("b")}/>`;
      break;
    case "sleeping":
      body = `<path d="M2.5 15.5h6l-6 6h6" stroke-width="1.8"${c("z")}/>` +
        `<path d="M9.5 8.5h5l-5 5h5" stroke-width="1.7"${c("z z2")}/>` +
        `<path d="M16.5 2.5h4.5l-4.5 4.5h4.5" stroke-width="1.6"${c("z z3")}/>`;
      break;
    case "error":
      body = `<path d="M12 2.5 22.5 21H1.5z" stroke-width="1.7"/><path d="M12 9v5.6M12 17.6h.01" stroke-width="2.1"/>`;
      break;
    case "fire":
      body = `<path d="${FLAME}" stroke-width="1.6"${c("k")}/>`;
      break;
    case "off":
      body = `<path d="M12 2.5v9" stroke-width="1.9"/><path d="M6 5.8a9 9 0 1 0 12 0" stroke-width="1.9"/>`;
      break;
    case "firmware":
      body = `<path d="M3.5 21h17" stroke-width="1.9"/><g${c("w")}><path d="M12 3v13M6.5 10.5 12 16l5.5-5.5" stroke-width="1.9"/></g>`;
      break;
    default:
      body = `<circle cx="12" cy="12" r="8.5" stroke-width="1.1"${c("b")}/><circle cx="12" cy="12" r="2.6" fill="${color}" stroke="none"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="36" height="36">` +
    (motion ? `<style>${PICTURE_CSS}</style>` : "") +
    (backing ? `<circle cx="18" cy="18" r="18" fill="#000" fill-opacity=".38"/>` : "") +
    `<circle cx="18" cy="18" r="18" fill="${color}" fill-opacity=".22"/>` +
    `<g transform="translate(3 3) scale(1.25)" fill="none" stroke="${color}" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export const reducedMotion = (): boolean => !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
