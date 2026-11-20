// What differs from one kind of machine to another: its status light, its
// laser, galvo or gantry, its crop areas, and its xTool style.

// A light: [color, pattern], or null for a phase in which it is off
export type Light = [string, string] | null;
export type LightTable = Record<string, Light>;

// The machine's status light (its power button, knob, logo, ring or frame
// light), shown as a thin ring around the state picture: [color, pattern]
// for each phase, from each machine's user guide on support.xtool.com.
// Patterns: solid, slow (blinks slowly), fast (blinks fast), breathe. A
// phase set to null: the light is off. A phase a guide does not list keeps
// the machine's idle light. "Connected to the software" is idle: Home
// Assistant is connected. Machines whose guide gives no light table have no ring.
const WHITE = "#ffffff", BLUE = "#2196f3", GREEN = "#4caf50", PURPLE = "#9c27b0", RED = "#f44336", YELLOW = "#ffc107";
// The F2 Ultra's white power button and logo light: on, blinking slowly
// while it works, fast while it sets up the network or updates its
// firmware, off while it sleeps (guides 1961, 2397). The F1 Ultra's guide
// shows its logo light only in pictures: the same light (guide 3036).
const ULTRA_LIGHT: LightTable = { idle: [WHITE, "solid"], processing: [WHITE, "slow"], setup: [WHITE, "fast"], firmware: [WHITE, "fast"], sleeping: null };

export interface Crop { width: number; height: number; center_x: number; center_y: number }

// The crop area each camera's Crop key returns to, by camera (mm): the F2
// Ultra's main camera, its calibrated area, centered; the P2's overview
// camera, its work area, measured from the back left corner; the P2's close
// camera, its view, centered
const F2_CROP: Record<string, Crop> = { camera_main: { width: 200, height: 200, center_x: 0, center_y: 0 } };
const P2_CROP: Record<string, Crop> = {
  camera_overview: { width: 610, height: 305, center_x: 305, center_y: 152.5 },
  camera_closeup: { width: 140, height: 100, center_x: 0, center_y: 0 },
};

/**
 * A model's profile:
 * - laser: "uv", "co2" or "diode", for the working color (a model name with
 *   UV in it is UV, with CO2 in it CO2, unless the entry says otherwise),
 * - galvo: true for a galvo (the F-series: random strokes in the state
 *   picture), false for a machine that moves a gantry (a raster),
 * - light: its status light table (none: no ring),
 * - cropReset: the area each camera's Crop key returns to, by camera key
 *   (a camera without one has no Crop key),
 * - style: the xTool style a new card gets (see MODEL_STYLES).
 */
export interface Profile {
  name: string;
  galvo: boolean;
  laser: string;
  light?: LightTable;
  cropReset: Record<string, Crop>;
  style: string;
}

interface ModelEntry {
  name: string;
  match: RegExp;
  galvo?: boolean;
  laser?: string;
  light?: LightTable;
  cropReset?: Record<string, Crop>;
}

// The models, most specific first: the first whose pattern matches the
// device's model name gives its profile
const MODELS: ModelEntry[] = [
  // F2 Ultra, F2 Ultra (Single), F2 Ultra UV
  { name: "F2 Ultra", match: /\bF2 Ultra\b/i, galvo: true, light: ULTRA_LIGHT, cropReset: F2_CROP },
  { name: "F1 Ultra", match: /\bF1 Ultra\b/i, galvo: true, light: ULTRA_LIGHT },
  // F1, F1 Lite and F2: the knob light (guides 1955, 2013)
  {
    name: "F1, F2", match: /\bF[12]\b/i, galvo: true,
    light: {
      idle: [BLUE, "solid"], processing: [BLUE, "solid"], finished: [GREEN, "solid"], firmware: [PURPLE, "solid"],
      setup: [YELLOW, "solid"], error: [RED, "solid"], fire: [RED, "solid"], overheat: [RED, "solid"], sleeping: [WHITE, "slow"],
    },
  },
  // P2 and P2S: the ring light (guide 222)
  {
    name: "P2", match: /\bP2S?\b/i, laser: "co2",
    light: {
      idle: [WHITE, "solid"], processing: [BLUE, "solid"], paused: [BLUE, "solid"], framing: [BLUE, "breathe"],
      focusing: [BLUE, "breathe"], finished: [GREEN, "solid"], sleeping: [GREEN, "breathe"], firmware: [PURPLE, "solid"],
      setup: [YELLOW, "solid"], error: [RED, "solid"], fire: [RED, "solid"],
    },
    cropReset: P2_CROP,
  },
  // P3: the ring light (guide 2004)
  {
    name: "P3", match: /\bP3\b/i, laser: "co2",
    light: {
      idle: [BLUE, "solid"], ready: [BLUE, "slow"], finished: [GREEN, "solid"], firmware: [PURPLE, "solid"],
      setup: [YELLOW, "solid"], error: [RED, "solid"], fire: [RED, "solid"],
    },
  },
  // The other P-series machines (P1, P3S): no light table
  { name: "P-series", match: /\bP[123]S?\b/i, laser: "co2" },
  // M1 Ultra: the light on the carriage (guide 1396)
  {
    name: "M1 Ultra", match: /\bM1 Ultra\b/i,
    light: {
      idle: [PURPLE, "solid"], processing: [GREEN, "solid"], framing: [GREEN, "solid"], paused: [BLUE, "solid"], ready: [BLUE, "slow"],
      sleeping: [PURPLE, "breathe"], firmware: [PURPLE, "slow"], error: [YELLOW, "fast"], fire: [RED, "fast"],
    },
  },
  // M1: the frame light (guide 979)
  {
    name: "M1", match: /\bM1\b/i,
    light: {
      starting: [WHITE, "fast"], idle: [BLUE, "solid"], setup: [GREEN, "fast"], processing: [BLUE, "fast"], ready: [BLUE, "breathe"],
      finished: [GREEN, "breathe"], sleeping: [WHITE, "breathe"], firmware: [PURPLE, "fast"], error: [RED, "solid"], fire: [RED, "solid"],
    },
  },
  // M2: the indicator (guide 2778)
  {
    name: "M2", match: /\bM2\b/i,
    light: {
      starting: [WHITE, "slow"], idle: [WHITE, "solid"], sleeping: [WHITE, "breathe"], setup: [BLUE, "fast"],
      framing: [YELLOW, "slow"], focusing: [YELLOW, "solid"], processing: [GREEN, "slow"], paused: [GREEN, "solid"], ready: [GREEN, "solid"],
      firmware: [PURPLE, "solid"], fire: [RED, "fast"],
    },
  },
  // S1: the knob light (guide 1106)
  {
    name: "S1", match: /\bS1\b/i,
    light: {
      idle: [PURPLE, "solid"], processing: [GREEN, "slow"], paused: [BLUE, "slow"], firmware: [PURPLE, "slow"],
      error: [YELLOW, "fast"], fire: [RED, "fast"],
    },
  },
  // D1, D1 Pro and D1 Pro 2.0: the light beside the Start button (guide 976)
  { name: "D1", match: /\bD1\b/i, light: { idle: [GREEN, "solid"], processing: [BLUE, "fast"], framing: [BLUE, "fast"], error: [RED, "fast"] } },
  // MetalFab: the X light of the laser welder (guide 2353)
  {
    name: "MetalFab", match: /\bMetalFab\b/i,
    light: { idle: [WHITE, "solid"], ready: [GREEN, "slow"], processing: [GREEN, "solid"], error: [RED, "solid"], fire: [RED, "solid"] },
  },
  // Apparel Printer: the status light (guide 1782)
  {
    name: "Apparel Printer", match: /\bApparel\b/i,
    light: { idle: [WHITE, "solid"], processing: [GREEN, "solid"], paused: [GREEN, "solid"], firmware: [PURPLE, "slow"], error: [RED, "fast"] },
  },
  // Laserbox, O1 Omni Printer and Retail Marker: no light table, no ring
];

// Each model, in the editor's order: [id, model, color (for a model sold
// in more than one), body, window] (see card/looks.ts and COLORWAYS.md). A
// new card gets its laser's model's style, in the first color listed.
export const MODEL_STYLES: [string, string, string, string, string][] = [
  ["d1", "D1", "", "blue_grey", "theme"],
  ["d1_pro_grey", "D1 Pro", "Grey", "blue_grey", "theme"],
  ["d1_pro_red", "D1 Pro", "Red", "red", "theme"],
  ["d1_pro_2_grey", "D1 Pro 2.0", "Grey", "blue_grey", "theme"],
  ["d1_pro_2_red", "D1 Pro 2.0", "Red", "red", "theme"],
  ["f1", "F1", "", "silver", "green"],
  ["f1_lite", "F1 Lite", "", "silver", "green"],
  ["f1_ultra", "F1 Ultra", "", "grey", "green"],
  ["f1_ultra_v2", "F1 Ultra V2", "", "grey", "green"],
  ["f2", "F2", "", "champagne", "orange"],
  ["f2_ultra", "F2 Ultra", "", "grey", "smoke"],
  ["f2_ultra_single", "F2 Ultra (Single)", "", "grey", "smoke"],
  ["f2_ultra_uv", "F2 Ultra UV", "", "champagne", "orange"],
  ["laserbox_white", "Laserbox", "White", "white", "smoke"],
  ["laserbox_black", "Laserbox", "Black", "charcoal", "smoke"],
  ["m1", "M1", "", "white", "orange"],
  ["m1_ultra", "M1 Ultra", "", "white", "orange"],
  ["m2", "M2", "", "white", "orange"],
  ["metalfab", "MetalFab", "", "silver", "smoke"],
  ["o1_omni_printer", "O1 Omni Printer", "", "white", "smoke"],
  ["p2_grey", "P2", "Grey", "graphite", "smoke_amber"],
  ["p2_white", "P2", "White", "white", "smoke_amber"],
  ["p2s_grey", "P2S", "Grey", "graphite", "smoke_amber"],
  ["p2s_white", "P2S", "White", "white", "smoke_amber"],
  ["p3", "P3", "", "white", "smoke"],
  ["retail_marker", "Retail Marker", "", "grey", "green"],
  ["s1_black", "S1", "Black", "charcoal", "green"],
  ["s1_white", "S1", "White", "white", "orange"],
  ["apparel_printer", "Apparel Printer", "", "white", "smoke"],
];

/**
 * The style a card gets unless one is chosen, from its laser's model (its
 * name in Home Assistant): the first style of the model whose words are
 * all in the name, the one with the most words winning, else none. So the
 * F2 Ultra UV (Class 1) is drawn as the F2 Ultra UV, "Omni Printer O1" as
 * the O1 Omni Printer, and a model without a style as its base model's.
 */
const wordsOf = (text?: string | null): string[] => `${text ?? ""}`.toLowerCase().split(/[^a-z0-9.]+/).filter(Boolean);
export function modelStyle(model?: string | null): string {
  const words = new Set(wordsOf(model));
  let best: { id: string; length: number } | undefined;
  for (const [id, name] of MODEL_STYLES) {
    const own = wordsOf(name);
    if (own.every((word) => words.has(word)) && own.length > (best?.length ?? 0)) best = { id, length: own.length };
  }
  return best?.id ?? "none";
}

/** The profile for a device's model name. */
export function profileOf(model?: string | null): Profile {
  const name = `${model ?? ""}`;
  const entry = MODELS.find((m) => m.match.test(name));
  const laser = /\bUV\b/i.test(name) ? "uv" : entry?.laser ?? (/\bCO2\b/i.test(name) ? "co2" : "diode");
  return {
    name: entry?.name ?? "", galvo: entry?.galvo ?? false, light: entry?.light, cropReset: entry?.cropReset ?? {},
    laser, style: modelStyle(name),
  };
}

// The status sensor's states, grouped into what the card shows
const PHASES: Record<string, string[]> = {
  processing: ["processing", "working_api", "working_button"],
  paused: ["paused"],
  framing: ["framing", "measuring", "measure_area"],
  focusing: ["focusing"],
  warming: ["warming_up"],
  finished: ["finished"],
  sleeping: ["sleeping"],
  fire: ["error_fire_warning"],
  overheat: ["laser_overheat"],
  error: ["error_limit", "error_laser_control", "error_laser_module", "error_tilt", "error_moving"],
  firmware: ["firmware_update"],
  off: ["off", "unavailable", "unknown"],
};

/** The phase a status sensor's state belongs to (idle for any other state). */
export function phaseOf(state?: string): string {
  if (state === undefined) return "off";
  for (const [phase, states] of Object.entries(PHASES)) if (states.includes(state)) return phase;
  return "idle";
}

// Status sensor states the lights show apart from the card's phases
const LIGHT_PHASES: Record<string, string> = { wifi_setup: "setup", initializing: "starting", processing_ready: "ready", frame_ready: "ready" };

/** The machine's light now: [color, pattern], or undefined while it is off or has no light table. */
export function lightOf(profile: Profile, state?: string): [string, string] | undefined {
  const light = profile.light;
  const phase = (state !== undefined && LIGHT_PHASES[state]) || phaseOf(state);
  if (!light || phase === "off") return undefined;
  return Object.hasOwn(light, phase) ? light[phase] ?? undefined : light.idle ?? undefined;
}
