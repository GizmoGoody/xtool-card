// Every control a feature can show, and how each works.
import { DAYLIGHT } from "../const";
import { domainOf, type Config, type HomeAssistant } from "../ha";
import type { Device } from "./device";
import type { Profile } from "./models";

/** What the controls' rules look at: hass, the laser, its phase, Access control and the feature's configuration. */
export interface Moment {
  hass: HomeAssistant;
  device: Device;
  phase: string;
  controlled: boolean;
  config: Config;
  // Names that tell an accessory's controls from the laser's (see accessoryNames)
  names?: Map<string, string>;
}

type ByMoment<T> = T | ((moment: Moment) => T);

/**
 * A control. Unless role names another, its id is the role of the entity it
 * acts on. It declares:
 * - domains: for a control whose entity can be in more than one domain,
 *   what changes with each ({ domain: { kind, ... } }, see resolved),
 * - kind: how it works (see features/keys.ts): toggle (a switch, fan or
 *   lock: on and off), light (on and off, and its brightness as an input),
 *   press (a button entity), number and select (Home Assistant's own feature
 *   as an input; as a key, the state and Home Assistant's dialog to change
 *   it), display (a state that is only shown, as a read-out; a tap opens
 *   it), fan_mode (one mode of a fan: off, auto or speed), or field (the
 *   numbers of its roles, in a field to type in and slide on),
 * - name: the one word on its key, or a function of the moment for a key
 *   that follows the state. A key shows its entity's own icon. Its title
 *   and its choice in the editor are its entity's name; option names a
 *   choice that has no entity of its own, title(moment) gives the title
 *   when the entity's name does not fit the moment, and detail(moment) adds
 *   to the title,
 * - color: its key's color,
 * - input: what changes in Home Assistant's feature that shows it as an input,
 * - confirm: what Home Assistant's confirmation dialog asks first. For a
 *   switch: { off, on, while }, the text for turning it off or on, asked only
 *   in the phases in while (always without it). For a button: the dialog's
 *   { title, text, confirm_text }, and confirmOption, the feature option
 *   that turns the question off,
 * - busy: unavailable in BUSY_PHASES; access: unavailable while Access
 *   control is on; allowed(moment): any other rule for when it is available,
 * - fan: its icon turns while it is on (the feature's animate_fan option),
 * - cycle: a select whose key steps to the next option on a tap,
 * - brief: a select whose key shows the option chosen in brief beside its
 *   icon when its name does not show (High and Low: H and L),
 * - check: a safety check, green while it is safe and filled red while it
 *   is not: { problem: the state that is the problem, "on" or "off" (none:
 *   neither is), words: the words for on and off in its title },
 * - direction: where the part sits (left, right, front or back). Its key
 *   shows a chevron for it only when another item in the same row has the
 *   same icon,
 * - key: its key's id, when it is not the control's id,
 * - feature: the feature it always belongs to (its type), whatever its
 *   entity's category; no other feature offers it,
 * - pick(moment), picks: a key that stands for one of other controls,
 * - roles, decimals and drag (a field): the number entities it shows, the
 *   decimals it shows them with (the step's, unless given), and the way a
 *   press and slide on the field changes each ("x": right raises it, "y":
 *   down raises it, "xy": right or up raises it). The numbers are set when
 *   the slide ends.
 */
export interface ControlSpec {
  kind?: string;
  role?: string;
  domains?: Record<string, Partial<ControlSpec>>;
  name?: ByMoment<string | undefined>;
  option?: string;
  title?: ByMoment<string | undefined>;
  detail?: ByMoment<string | undefined>;
  icon?: string;
  color?: string;
  onColor?: string;
  input?: Config;
  confirm?: Config;
  confirmOption?: string;
  busy?: boolean;
  access?: boolean;
  allowed?: (moment: Moment) => boolean;
  fan?: boolean;
  mode?: string;
  alwaysText?: boolean;
  cycle?: boolean;
  brief?: boolean;
  check?: { problem?: string; words?: [string, string] };
  direction?: string;
  key?: string;
  feature?: string;
  picks?: string[];
  pick?: (moment: Moment) => string;
  roles?: string[];
  decimals?: number;
  drag?: string[];
}

export interface Control extends ControlSpec {
  id: string;
  role: string;
}

// The phases in which the laser takes no command that moves it (Autofocus,
// Move, Measure), as in Studio
export const BUSY_PHASES = ["processing", "paused", "framing", "focusing", "off", "firmware"];
export const running = (phase: string): boolean => phase === "processing" || phase === "framing";

/** The last thickness or distance measured, with its unit, or undefined. */
export function lastReading({ hass, device }: Pick<Moment, "hass" | "device">): string | undefined {
  const measured = hass.states[device.roles.measured];
  return measured && !["unknown", "unavailable"].includes(measured.state)
    ? `${measured.state} ${measured.attributes.unit_of_measurement ?? ""}`.trim() : undefined;
}

export const CONTROLS: Record<string, ControlSpec> = {
  // The job
  start_pause: {
    option: "Start / Pause", picks: ["pause", "start"],
    pick: ({ phase }) => (running(phase) ? "pause" : "start"),
  },
  start: {
    kind: "press", role: "resume", key: "resume", color: "success",
    name: ({ phase }) => (phase === "paused" ? "Resume" : "Start"),
    // Its entity resumes a paused job; otherwise the key starts one
    title: ({ phase }) => (phase === "paused" ? undefined : "Start the job"),
    // With Access control on, Studio offers no start from the machine
    allowed: ({ phase, controlled }) => !running(phase) && !["off", "sleeping", "firmware"].includes(phase) && (!controlled || phase === "paused"),
  },
  pause: {
    kind: "press", name: "Pause", color: "warning", access: true,
    allowed: ({ phase }) => phase === "processing",
  },
  cancel: {
    kind: "press", name: "Cancel", color: "error",
    allowed: ({ phase }) => running(phase) || phase === "paused",
    confirm: { title: "Cancel the job?", text: "The job stops and cannot be resumed.", confirm_text: "Cancel the job" },
    confirmOption: "ask_before_cancelling",
  },

  // Parts
  power: {
    kind: "toggle", name: "Power",
    // Asked only while a job runs: cutting the power stops it at once
    confirm: { off: "A job is running. Turning the power off stops it at once and it cannot be resumed.", while: ["processing", "paused"] },
  },
  // The F2's fan, or the P2's setting that runs it after a job
  exhaust_fan: { kind: "toggle", name: "Exhaust", fan: true },
  // The IF2 2.0's fan, as three keys for its modes: the one in use blue and
  // turning while it spins, faster at each of its four speeds
  fan_off: { kind: "fan_mode", role: "if2_fan_entity", mode: "off", option: "Off", title: "Off", name: "Off", icon: "mdi:fan-off" },
  fan_auto: {
    kind: "fan_mode", role: "if2_fan_entity", mode: "auto", option: "Auto", title: "Auto", name: "A", alwaysText: true,
    icon: "mdi:fan", fan: true,
  },
  fan_speed: {
    kind: "fan_mode", role: "if2_fan_entity", mode: "speed", option: "Speed", title: "Speed", name: "Speed",
    icon: "mdi:fan", fan: true,
  },
  cooling_fan: { kind: "toggle", name: "Cooling", fan: true },
  fill_light: { kind: "light", name: "Light", color: DAYLIGHT },
  fill_light_close: { kind: "light", name: "Light", color: DAYLIGHT },
  fill_light_front: { kind: "light", name: "Light", color: DAYLIGHT, direction: "front" },
  fill_light_back: { kind: "light", name: "Light", color: DAYLIGHT, direction: "back" },
  fill_light_left: { kind: "light", name: "Light", color: DAYLIGHT, direction: "left" },
  fill_light_right: { kind: "light", name: "Light", color: DAYLIGHT, direction: "right" },
  red_dot: { kind: "toggle", name: "Dot" },
  red_dot_close: { kind: "toggle", name: "Aimed" },
  red_dot_quick: { kind: "toggle", name: "Quick" },
  safety_lock: { kind: "toggle", name: "Lock" },

  // Moving the laser, measuring and focusing
  // Where the laser goes: X,Y in whole millimeters; a drag on the field
  // slides X left and right, Y up and down
  laser_position: {
    kind: "field", role: "laser_x", roles: ["laser_x", "laser_y"], decimals: 0, drag: ["x", "y"],
  },
  // A move works while the laser sleeps, but not while it works or is off
  move_laser: { kind: "press", name: "Move", busy: true },
  home_laser: { kind: "press", name: "Home", busy: true },
  // The P2's Wake: it takes a photo, which wakes the laser while it sleeps
  wake: { kind: "press", name: "Wake" },
  // The P2's (its overview camera's): the material's thickness or the
  // distance to it, sliding right or up raises it; and measuring it, the
  // key's title with the last reading
  thickness_or_distance: { kind: "field", roles: ["thickness_or_distance"], drag: ["xy"] },
  measure_thickness_or_distance: {
    kind: "press", name: "Measure", busy: true,
    detail: (moment) => (lastReading(moment) ? `Last reading: ${lastReading(moment)}` : undefined),
  },
  // As in Studio: no Autofocus while the laser works, frames, focuses or is
  // off, or while Access control is on
  autofocus: { kind: "press", name: "Autofocus", busy: true, access: true },
  // The thickness the laser focuses on, 0.1 mm a step, as in Studio:
  // sliding right or up raises it, and the head moves once the slide ends
  focus_height: { kind: "field", roles: ["focus_height"], decimals: 1, drag: ["xy"] },

  // Safety: the checks (turning one off asks first), and the states that can only be shown
  // A switch (a check), or the P2's select of its level, a setting that
  // belongs with the checks: a tap steps to the next
  flame_alarm: {
    name: "Flame", feature: "xtool-safety",
    domains: {
      switch: {
        kind: "toggle", check: { problem: "off" },
        confirm: { off: "No flame alarm will be triggered while it is off. Fires may cause serious injuries and property damage." },
      },
      select: { kind: "select", cycle: true, brief: true },
    },
  },
  stops_when_enclosure_opened: {
    kind: "toggle", name: "Enclosure", check: { problem: "off" },
    confirm: { off: "The laser keeps working when the enclosure is opened. Laser light can injure eyes and skin." },
  },
  stops_when_moved: {
    kind: "toggle", name: "Motion", check: { problem: "off" },
    confirm: { off: "The laser keeps working if the machine is moved or tilted during a job." },
  },
  safety_key: { kind: "display", name: "Key", check: { problem: "off", words: ["in", "removed"] } },
  // The P2's lid (on: open, a problem) and baseplate (on: in place)
  lid: { kind: "display", name: "Lid", check: { problem: "on", words: ["open", "closed"] } },
  baseplate: { kind: "display", name: "Baseplate", check: { problem: "off", words: ["in", "out"] } },
  // Optional: off is not a problem
  access_control: {
    kind: "toggle", name: "Access", check: {},
    confirm: {
      off: "Jobs no longer need the access control check before they start.",
      on: "Each job then needs the access control check before it starts, and autofocus, framing and starting from the machine are turned off.",
    },
  },

  // Configuration: the settings in the Configuration section of the laser's and its accessories' device pages
  buzzer: { kind: "toggle", name: "Buzzer" },
  if2_buzzer: { kind: "toggle", name: "IF2" },
  device_sleep: { kind: "toggle", name: "Sleep" },

  // A camera's settings
  // A camera with crop presets (the P2's): the key shows the preset, and a
  // tap opens Home Assistant's own dialog for the select to choose another
  crop: { kind: "select", name: "Crop" },
  // The deep camera's perspective: as the camera sees it (skewed), turned
  // square to the work area, and straightened flat; a tap steps to the next
  perspective: { kind: "select", cycle: true, name: "Perspective" },
  exposure: { kind: "number", name: "Exposure", input: { style: "slider" } },
  // The P2's processing mode, which its crop presets follow
  mode: { kind: "select", name: "Mode" },
};

/** The safety checks that are switches (a badge shows when one is off). */
export const SAFETY_CHECKS = Object.keys(CONTROLS).filter((id) => {
  const toggle = CONTROLS[id].domains?.switch ?? CONTROLS[id];
  return toggle.kind === "toggle" && toggle.check?.problem === "off";
});

/** A control from the registry, with its id and its role. */
export function controlOf(id: string, _profile?: Profile): Control | undefined {
  const control = Object.hasOwn(CONTROLS, id) ? CONTROLS[id] : undefined;
  if (!control) return undefined;
  return { id, ...control, role: control.role ?? id };
}

/** A control as it works for its entity: with what its entity's domain changes. */
export function resolved<T extends ControlSpec>(control: T, entityId?: string): T {
  const variant = control?.domains && entityId ? control.domains[domainOf(entityId)] : undefined;
  return variant ? { ...control, ...variant } : control;
}

/** A control's value: as given, or worked out for the moment. */
export const valueOf = <T>(value: ByMoment<T> | undefined, moment: Moment): T | undefined =>
  (typeof value === "function" ? (value as (m: Moment) => T)(moment) : value);

/**
 * Where an entity belongs: "config" for a setting (the integration gives it
 * the config entity category; Configuration shows it), "control" for
 * everything else (Controls shows it).
 */
export const categoryOf = (hass: HomeAssistant | undefined, entityId?: string): string =>
  (entityId && (hass?.entities?.[entityId] as Config | undefined)?.entity_category === "config" ? "config" : "control");

/** Whether the device has what a control acts on (for a key that stands for others, any of them). */
export function present(control: Control | undefined, device: Device): boolean {
  if (!control) return false;
  if (control.picks) return control.picks.some((id) => present(controlOf(id), device));
  return !!device.roles[control.role];
}

/** Whether a control's rules make it unavailable now (its entity aside). */
export function blocked(control: ControlSpec, moment: Moment): boolean {
  return (!!control.busy && BUSY_PHASES.includes(moment.phase)) || (!!control.access && moment.controlled)
    || (!!control.allowed && !control.allowed(moment));
}
