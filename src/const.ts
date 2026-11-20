declare const __VERSION__: string;

export const VERSION = __VERSION__;
export const DOMAIN = "xtool";
export const CARD_TYPE = "xtool-card";
export const EDITOR_TYPE = "xtool-card-editor";
export const TILE_EDITOR_TYPE = "xtool-tile-card-editor";
export const FEATURE_EDITOR_TYPE = "xtool-feature-editor";

// Home Assistant's named colors (the tile card's color picker)
const HA_COLORS = [
  "primary", "accent", "red", "pink", "purple", "deep-purple", "indigo", "blue", "light-blue", "cyan",
  "teal", "green", "light-green", "lime", "yellow", "amber", "orange", "deep-orange", "brown",
  "light-grey", "grey", "dark-grey", "blue-grey", "black", "white", "disabled",
  "error", "warning", "success", "info",
];
// The theme's state colors, which Home Assistant's color picker offers
// (ui_color's extra_options) before its own colors, each with the named
// color it falls back to when a theme leaves it out
const STATE_FALLBACKS: Record<string, string> = { error: "red", warning: "amber", success: "green", info: "blue" };

/** A color as CSS: one of Home Assistant's named colors, or the color as given. */
export const cssColor = (color: string): string => (STATE_FALLBACKS[color] ? `var(--${color}-color, var(--${STATE_FALLBACKS[color]}-color))`
  : HA_COLORS.includes(color) ? `var(--${color}-color)` : color);

export const STATE_COLORS = [["error", "Error"], ["warning", "Warning"], ["success", "Success"], ["info", "Info"]]
  .map(([value, label]) => ({ value, label, display_color: cssColor(value) }));

// One color for every key that is on and every slider, across the card
// (the card's Enabled color; the theme's Info color by default). Keys of
// their own color are the job's (Start, Pause, Cancel) and Safety's
// problems, in the theme's state colors.
export const ENABLED_COLOR = "info";
export const ENABLED = `var(--xtool-enabled-color, ${cssColor(ENABLED_COLOR)})`;

// The working color by laser, and the color of every other state
export const LASER_COLORS: Record<string, string> = { uv: "#9b7bff", co2: "#ff7043", diode: "#42a5f5" };
export const PHASE_COLORS: Record<string, string> = {
  idle: "#9aa0a6", framing: "#29a3e0", paused: "#f5a623", finished: "#3fbf6a", sleeping: "#90a4ae",
  error: "#ef5350", fire: "#ff3d00", off: "#8a8a8a", firmware: "#4fc3f7",
  focusing: "#26c6da", warming: "#ffb74d", overheat: "#ff5722",
};
export const phaseColor = (phase: string, laser?: string): string | undefined =>
  (phase === "processing" ? LASER_COLORS[laser ?? ""] : PHASE_COLORS[phase]);

// The fill lights are daylight white, not the yellow Home Assistant gives a
// light without a color of its own
export const DAYLIGHT = "rgb(214, 228, 255)";

// The tile card's Time format choices (its time_format option)
export const TIME_FORMATS = ["relative", "total", "date", "time", "datetime"];

/** Seconds as 1:02:03 or 12:08. */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
}
