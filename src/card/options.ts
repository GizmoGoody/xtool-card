// The card's options: their defaults, the tile card's configuration made
// from them, and the configuration as the editor saves it.
import { DOMAIN } from "../const";
import { domainOf, same, type Config, type HassEntity, type HomeAssistant } from "../ha";
import { SAFETY_CHECKS } from "../machine/controls";
import { deviceOf } from "../machine/device";
import { ownStyles } from "../machine/overlays";
import { ROLES } from "../machine/roles";
import { DEFAULT_FEATURES_STYLE, DEFAULT_PATTERN, FEATURES_STYLES, STYLES } from "./looks";

// The parts the card reports as attributes for the tile card's State
// content: [attribute, role, text when on, text when off, the role read
// when the device does not have the first]
export const PART_ATTRIBUTES: [string, string, string, string, string?][] = [
  ["exhaust", "exhaust_running", "Exhaust running", "Exhaust off", "exhaust_fan"],
  ["red_dot", "red_dot", "Red dot on", "Red dot off"],
  ["power", "power", "Power on", "Power off"],
  ["buzzer_reminders", "buzzer", "Buzzer on", "Buzzer off"],
  ["device_sleep", "device_sleep", "Sleep on", "Sleep off"],
  ["access_control", "access_control", "Access control on", "Access control off"],
  ["safety_key", "safety_key", "Safety key in", "Safety key out"],
  ["if2_buzzer", "if2_buzzer", "IF2 buzzer on", "IF2 buzzer off"],
];

// The attributes the card adds for the tile card's State content, with
// examples the editor shows so they can be chosen at any time
export const JOB_ATTRIBUTES: Record<string, string> = {
  progress: "42 %", elapsed: "12:08", job_time: "18:52",
  ...Object.fromEntries(PART_ATTRIBUTES.map(([name, , on]) => [name, on])),
};

// The diagnostic entities State content offers, besides the laser's sensors
const DIAGNOSTIC_STATE_CONTENT = ["wifi_signal", "working_time", "last_job_time", "firmware", "cpu_temp"];

/**
 * The laser's own sensors and binary sensors, and the diagnostic entities
 * above, as attributes for the tile card's State content: {translation key:
 * the state as Home Assistant shows it}. The card's own entity and the parts
 * PART_ATTRIBUTES reports are left out. Unknown and unavailable states are
 * left out unless all is true (the editor offers every one).
 */
export function sensorAttributes(hass: HomeAssistant, entityId: string, all = false): Record<string, string> {
  const device = deviceOf(hass, entityId);
  if (!device.id) return {};
  const own = hass.entities![entityId].translation_key;
  const parts = PART_ATTRIBUTES.flatMap(([, role]) => ROLES[role]?.keys ?? []);
  const out: Record<string, string> = {};
  for (const e of device.entities) {
    const key = e.translation_key, domain = domainOf(e.entity_id);
    if (!key || key === own || parts.includes(key) || key in out) continue;
    const category = (e as Config).entity_category;
    const wanted = domain === "update"
      ? DIAGNOSTIC_STATE_CONTENT.includes(key)
      : ["sensor", "binary_sensor"].includes(domain) && (!category || DIAGNOSTIC_STATE_CONTENT.includes(key));
    const stateObj = wanted ? hass.states[e.entity_id] : undefined;
    if (!stateObj) continue;
    const known = !["unknown", "unavailable"].includes(stateObj.state);
    if (!known && !all) continue;
    // A firmware update entity shows its installed version
    const version = domain === "update" ? stateObj.attributes.installed_version : undefined;
    if (domain === "update" && !version && !all) continue;
    out[key] = version ?? hass.formatEntityState(stateObj);
  }
  return out;
}

// Each status the status badge can show: [id, label, whether a laser has
// what it shows (its roles)]. Alarm reads the Status entity too, so every
// laser has it. Unavailable is the connection badge's
const STATUS_BADGES: [string, string, (roles: Record<string, string>) => boolean][] = [
  ["alarm", "Alarm or fire warning", () => true],
  ["safety_key", "Safety key removed", (roles) => !!roles.safety_key],
  ["lid", "Lid open", (roles) => !!roles.lid],
  ["safety_checks", "A safety check is off", (roles) => SAFETY_CHECKS.some((role) => roles[role] && domainOf(roles[role]) === "switch")],
  ["firmware", "Firmware update available", (roles) => !!roles.firmware],
];
const DEFAULT_STATUS_BADGES = ["alarm", "safety_key", "lid", "safety_checks"];

/** The statuses this laser has for its status badge, in the editor's order. */
export const statusBadgesOf = (hass: HomeAssistant | undefined, entityId?: string): [string, string][] => {
  const { roles } = deviceOf(hass, entityId);
  return STATUS_BADGES.filter(([, , has]) => has(roles)).map(([id, label]) => [id, label]);
};

/** The status badge's default statuses, of those this laser has. */
export const defaultStatusBadges = (hass: HomeAssistant | undefined, entityId?: string): string[] =>
  DEFAULT_STATUS_BADGES.filter((id) => statusBadgesOf(hass, entityId).some(([badge]) => badge === id));

export const EDGES: [string, string][] = [["none", "None"], ["top", "Top"], ["bottom", "Bottom"], ["left", "Left"], ["right", "Right"], ["around", "Around the card"]];
export const DIRECTIONS: [string, string][] = [["clockwise", "Clockwise"], ["counterclockwise", "Counterclockwise"]];
export const SHOW_WHILE: [string, string][] = [["processing", "Processing"], ["paused", "Paused"], ["framing", "Framing"], ["finished", "Finished"], ["error", "Error"]];
export const PROGRESS_DEFAULTS: Config = {
  edge: "top", thickness: 4, starts_at: 0, ends_at: 100, direction: "clockwise", color: "state",
  show_percentage: false, show_while: ["processing", "paused"],
};
// Which way a bar fills, by edge and direction: clockwise runs around the card
export const BAR_DIRECTION: Record<string, Record<string, string>> = {
  top: { clockwise: "to right", counterclockwise: "to left" },
  bottom: { clockwise: "to left", counterclockwise: "to right" },
  left: { clockwise: "to top", counterclockwise: "to bottom" },
  right: { clockwise: "to bottom", counterclockwise: "to top" },
};
export const TRACK = "var(--disabled-color, rgba(127, 127, 127, .35))";

// Where the badges sit, as a share of the picture's radius (the same spacing as the SVS card's)
export const BADGE_RING = 16.7 / 20;

export const progressOptions = (config?: Config): Config => ({ ...PROGRESS_DEFAULTS, ...(config?.progress_edge ?? {}) });

/** The card's style: the one chosen, else its laser model's (none until Home Assistant is known). */
export const styleOf = (config: Config | undefined, hass?: HomeAssistant): string =>
  config?.style ?? (hass ? deviceOf(hass, config?.entity).profile.style : "none");

// Options this card adds to the tile card's
export const OWN_KEYS = ["style", "features_style", "enabled_color", "pattern", "status_badge", "connection_badge", "status_light", "progress_edge",
  "collapsible", "expanded_at_load", "collapse_when_powered_off", "expand_when_powered_on", "last_feature_full_width", "overlay_styles"];

// The card's defaults for the tile card's options it sets otherwise
export const DEFAULT_FEATURES_POSITION = "inline";
// The laser's name (its device's), not the Status sensor's
const DEFAULT_NAME = { type: "device" };

/**
 * The State content shown unless one is chosen: the state, the engraving
 * lens (for a laser that has one) and the time the job has run.
 */
function defaultStateContent(hass: HomeAssistant | undefined, entity?: string): string[] {
  return ["state", ...(deviceOf(hass, entity).roles.engraving_lens ? ["engraving_lens"] : []), "elapsed"];
}

/** The tile card's own options (as its editor shows them), with the card's defaults. */
export function tileConfig(config: Config, hass?: HomeAssistant): Config {
  const tile: Config = { ...config, type: "tile", show_entity_picture: true };
  for (const key of OWN_KEYS) delete tile[key];
  tile.features_position ??= DEFAULT_FEATURES_POSITION;
  tile.name ??= DEFAULT_NAME;
  tile.state_content ??= defaultStateContent(hass, config.entity);
  return tile;
}

/**
 * The tile card inside the card: with Collapsible, a tap on the card shows
 * or hides the features instead of its Tap behavior, and the features below
 * the title are left out while they are hidden.
 */
export function innerTileConfig(config: Config, open: boolean, hass?: HomeAssistant): Config {
  const tile = tileConfig(config, hass);
  if (config.collapsible !== false) {
    tile.tap_action = { action: "fire-dom-event", xtool_card: "toggle" };
    // Collapsed, the card keeps what a tile card shows in its title row:
    // with features position "inline", the first feature, beside the title
    if (!open) tile.features = tile.features_position === "inline" ? (config.features ?? []).slice(0, 1) : [];
  }
  return tile;
}

// Whether each laser's card is expanded in the editor's preview, while the
// editor is open: Home Assistant can make the preview card anew for a
// change, which keeps what was shown. A new editor starts expanded.
export const PREVIEW_OPEN = new Map<string, boolean>();

/**
 * Home Assistant's states with one state object in place of the entity's,
 * without copying the others: every other entity reads through to them.
 */
export function statesWith(states: Record<string, HassEntity>, entityId: string, stateObj: HassEntity): Record<string, HassEntity> {
  return new Proxy(states, {
    get: (target, key, receiver) => (key === entityId ? stateObj : Reflect.get(target, key, receiver)),
    getOwnPropertyDescriptor: (target, key) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
      return key === entityId && descriptor ? { ...descriptor, value: stateObj } : descriptor;
    },
  });
}

/** A laser device's Status sensor. */
export function laserStatus(hass: HomeAssistant | undefined, device?: string): string | undefined {
  return Object.values(hass?.entities ?? {})
    .find((e) => e.device_id === device && e.platform === DOMAIN && e.translation_key === "status")?.entity_id;
}

/** Every xTool laser's status sensor. */
export function xtoolStatusSensors(hass: HomeAssistant | undefined): string[] {
  return Object.values(hass?.entities ?? {})
    .filter((e) => e.platform === DOMAIN && e.translation_key === "status")
    .map((e) => e.entity_id)
    .sort();
}

/**
 * The configuration as the editor saves it: every option at its default left
 * out (the card applies the default), and the options that matter only for
 * a style or for a collapsible card left out without one.
 */
export function minimal(config: Config, hass?: HomeAssistant): Config {
  const c: Config = { ...config };
  if (!STYLES.some(([id]) => id === c.style)) delete c.style;
  // Without Home Assistant, the model's style is not known: its options are kept
  const styled = c.style || hass ? styleOf(c, hass) !== "none" : true;
  // The style is left out when it is the laser model's (the card's default);
  // None is kept for a model that has a style
  if (hass && c.style === styleOf({ entity: c.entity }, hass)) delete c.style;
  if (!styled || c.features_style === DEFAULT_FEATURES_STYLE || !FEATURES_STYLES.some(([id]) => id === c.features_style)) delete c.features_style;
  if (!styled || !Number.isFinite(c.pattern) || c.pattern === DEFAULT_PATTERN) delete c.pattern;
  if (!Array.isArray(c.status_badge) || (hass && same(c.status_badge, defaultStatusBadges(hass, c.entity)))) delete c.status_badge;
  if (c.connection_badge !== false) delete c.connection_badge;
  if (c.status_light !== false) delete c.status_light;
  if (c.progress_edge && typeof c.progress_edge === "object") {
    const edge = Object.fromEntries(Object.entries(c.progress_edge).filter(([key, value]) => !same(value, PROGRESS_DEFAULTS[key])));
    if (Object.keys(edge).length) c.progress_edge = edge;
    else delete c.progress_edge;
  }
  // Expanded at load, Collapse when powered off and Expand when powered on
  // matter only for a collapsible card
  if (c.collapsible !== false) delete c.collapsible;
  if (c.collapsible === false || c.expanded_at_load !== true) delete c.expanded_at_load;
  for (const key of ["collapse_when_powered_off", "expand_when_powered_on"]) if (c.collapsible === false || c[key] !== false) delete c[key];
  // Last feature full width matters only with the features beside the title
  if (c.last_feature_full_width !== false || (c.features_position ?? DEFAULT_FEATURES_POSITION) !== "inline") delete c.last_feature_full_width;
  if (c.features_position === DEFAULT_FEATURES_POSITION) delete c.features_position;
  if (same(c.name, DEFAULT_NAME)) delete c.name;
  // The tile card's own default, which its editor writes out
  if (c.vertical === false) delete c.vertical;
  if (hass && same(c.state_content, defaultStateContent(hass, c.entity))) delete c.state_content;
  if (Array.isArray(c.features) && !c.features.length) delete c.features;
  const styles = ownStyles(c.overlay_styles);
  if (styles) c.overlay_styles = styles;
  else delete c.overlay_styles;
  return c;
}

/** hass with the card's entity carrying example job attributes and its sensors, so State content can offer them. */
export function withJobAttributes(hass: HomeAssistant, entityId?: string): HomeAssistant {
  const stateObj = entityId ? hass?.states[entityId] : undefined;
  if (!stateObj) return hass;
  const attributes = { ...JOB_ATTRIBUTES, ...sensorAttributes(hass, entityId!, true), ...stateObj.attributes };
  return { ...hass, states: { ...hass.states, [entityId!]: { ...stateObj, attributes } } };
}
