// The xTool styles: each model's colors (see COLORWAYS.md), made of a body
// (the frame or case) and a window (the plexi or lid, behind the title).
// Models that look alike share a body and a window.
import { MODEL_STYLES } from "../machine/models";
import { seeded } from "./picture";

export interface Look {
  body: string;
  glass: string;
  edge: string;
  text: string;
  ink: string;
  glare: number;
  plain: boolean;
  tone: "light" | "dark";
  flat: string;
}

// A body: its color from light to dark (the middle one is its base color,
// for Flat), and whether it is metal (a fine grain)
const BODIES: Record<string, { stops: string[]; metal?: boolean }> = {
  champagne: { stops: ["#dcc1aa", "#cdae94", "#b8977c"], metal: true },
  graphite: { stops: ["#3a3f45", "#2d3136", "#24272b"] },
  white: { stops: ["#f4f4f3", "#e6e6e6", "#d3d3d3"] },
  silver: { stops: ["#c8cac9", "#b4b6b5", "#9d9f9e"], metal: true },
  grey: { stops: ["#97989b", "#808184", "#6b6c6f"], metal: true },
  charcoal: { stops: ["#3a3b3e", "#2d2e30", "#232426"] },
  blue_grey: { stops: ["#93a8c1", "#7d93ad", "#667a92"], metal: true },
  red: { stops: ["#c23c43", "#a92a31", "#8c1d22"], metal: true },
};

// A window: its glass, the title's text on it (and a number field's: ink),
// and how strongly it reflects (see glassReflections). Every orange plexi is
// the same orange.
const LIGHT_TEXT = "--primary-text-color: rgba(255, 255, 255, .95); --secondary-text-color: rgba(235, 235, 240, .72)";
const DARK_EDGE = "inset 0 1px 0 rgba(255, 255, 255, .18), inset 0 0 0 1px rgba(255, 255, 255, .06), inset 0 3px 8px rgba(0, 0, 0, .6)";
const WINDOWS: Record<string, { glass: string; edge: string; text: string; ink: string; glare: number }> = {
  orange: {
    glass: `radial-gradient(90% 120% at 50% 110%, rgba(245, 162, 26, .55) 0%, rgba(245, 162, 26, 0) 70%),
      linear-gradient(170deg, #f5a21a 0%, #e8891c 45%, #c2620f 100%)`,
    edge: "inset 0 1px 0 rgba(255, 255, 255, .45), inset 0 0 0 1px rgba(90, 30, 0, .35), inset 0 3px 8px rgba(90, 30, 0, .3)",
    text: "--primary-text-color: rgba(255, 248, 240, .97); --secondary-text-color: rgba(255, 236, 220, .86); text-shadow: 0 1px 2px rgba(90, 30, 0, .55)",
    ink: "rgba(255, 248, 240, .97)", glare: 1,
  },
  green: {
    glass: `radial-gradient(90% 120% at 50% 110%, rgba(120, 210, 80, .5) 0%, rgba(120, 210, 80, 0) 70%),
      linear-gradient(170deg, #6cc84a 0%, #4fa634 45%, #2f7a1d 100%)`,
    edge: "inset 0 1px 0 rgba(255, 255, 255, .45), inset 0 0 0 1px rgba(10, 50, 0, .35), inset 0 3px 8px rgba(10, 50, 0, .3)",
    text: "--primary-text-color: rgba(245, 255, 240, .97); --secondary-text-color: rgba(230, 248, 222, .86); text-shadow: 0 1px 2px rgba(10, 50, 0, .6)",
    ink: "rgba(245, 255, 240, .97)", glare: 1,
  },
  // A dark lid with the amber inside glowing through (the P2 and P2S)
  smoke_amber: {
    glass: `radial-gradient(120% 90% at 50% 120%, rgba(214, 140, 60, .28) 0%, rgba(214, 140, 60, 0) 60%),
      linear-gradient(175deg, #1d2024 0%, #141619 60%, #0f1113 100%)`,
    edge: DARK_EDGE, text: `${LIGHT_TEXT}; text-shadow: 0 1px 2px rgba(0, 0, 0, .8)`, ink: "rgba(255, 255, 255, .95)", glare: .5,
  },
  smoke: {
    glass: "linear-gradient(175deg, #2b2d31 0%, #1c1e21 60%, #141518 100%)",
    edge: DARK_EDGE, text: `${LIGHT_TEXT}; text-shadow: 0 1px 2px rgba(0, 0, 0, .8)`, ink: "rgba(255, 255, 255, .95)", glare: .5,
  },
  // No window (the open D1 series): the title sits on the theme's own card,
  // as with no style, its text in the theme's colors (see .frame)
  theme: {
    glass: "var(--ha-card-background, var(--card-background-color, white))", edge: "none",
    text: `--primary-text-color: var(--xtool-theme-primary-text); --secondary-text-color: var(--xtool-theme-secondary-text);
      --disabled-text-color: var(--xtool-theme-disabled-text); text-shadow: none`,
    ink: "var(--xtool-theme-primary-text)", glare: 0,
  },
};

/** Whether a color reads as light (dark text on it). */
const isLight = (hex: string): boolean => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return .2126 * r + .7152 * g + .0722 * b > .45;
};

/**
 * Each style's look: its body and window as CSS, the tone of the text on
 * its body (light or dark), its base color (for Flat), and its window's
 * title text and glare.
 */
export const LOOKS: Record<string, Look> = Object.fromEntries(MODEL_STYLES.map(([id, , , bodyId, windowId]) => {
  const body = BODIES[bodyId], window = WINDOWS[windowId];
  const [light, base, dark] = body.stops;
  const grain = body.metal ? "radial-gradient(rgba(255, 255, 255, .07) .6px, transparent .7px) 0 0 / 3px 3px, " : "";
  const look: Look = {
    body: `${grain}linear-gradient(160deg, ${light} 0%, ${base} 45%, ${dark} 100%)`,
    glass: window.glass, edge: window.edge, text: window.text, ink: window.ink, glare: window.glare, plain: windowId === "theme",
    tone: isLight(base) ? "light" : "dark", flat: base,
  };
  return [id, look];
}));
export const STYLES: [string, string][] = [["none", "None (theme)"], ...MODEL_STYLES.map(([id, model, color]): [string, string] => [id, color ? `${model} (${color})` : model])];
export const TONE: Record<string, string> = Object.fromEntries(Object.entries(LOOKS).map(([id, look]) => [id, look.tone]));
export const FLAT: Record<string, string> = Object.fromEntries(Object.entries(LOOKS).map(([id, look]) => [id, look.flat]));
export const DEFAULT_PATTERN = 4242;

/**
 * The window's glass: a sheen along the top and two to four reflections
 * falling across it at an angle, their places from the pattern (Randomize
 * reflections in the editor picks a new pattern), as strong as the
 * window's glare (bright plexi reflects more than a dark lid).
 */
export function glassReflections(glare: number, pattern: number): string {
  const r = seeded(pattern);
  const k = glare;
  const white = (a: number) => `rgba(255, 255, 255, ${(a * k).toFixed(3)})`;
  const angle = Math.round((r() < .5 ? 100 : 30) + r() * 50);
  const layers = [`linear-gradient(to bottom, ${white(.3)} 0%, ${white(.1)} 14%, transparent 42%)`];
  const count = 2 + Math.floor(r() * 3);
  for (let i = 0; i < count; i++) {
    const at = 4 + r() * 84, width = 3 + r() * 16, peak = .14 + r() * .26;
    const mid = (at + width / 2).toFixed(1), end = (at + width).toFixed(1), start = at.toFixed(1);
    // The first reflection has a sharp leading edge, like light off a pane's edge
    layers.push(i === 0
      ? `linear-gradient(${angle}deg, transparent ${start}%, ${white(peak)} ${start}%, ${white(peak * .25)} ${end}%, transparent ${end}%)`
      : `linear-gradient(${angle}deg, transparent ${start}%, ${white(peak)} ${mid}%, transparent ${end}%)`);
  }
  return layers.join(", ");
}

// The same keys and values as the SVS and Lampster cards
export const FEATURES_STYLES: [string, string][] = [["match", "Match style"], ["flat", "Flat"], ["console", "Console"]];
// How far a features style's patch or channel reaches around each control (px)
export const CHANNEL_PAD: Record<string, number> = { match: 0, flat: 2, console: 3 };
// The window's edge inside the title row (px)
export const WINDOW_MARGIN = 4;
export const DEFAULT_FEATURES_STYLE = "console";
