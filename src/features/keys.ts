// How each kind of control becomes a key (or a field's item) in a feature's row.
import { domainOf, entityName, fire, isOn, performAction, type Config, type HomeAssistant } from "../ha";
import { blocked, categoryOf, valueOf, type Control, type Moment } from "../machine/controls";
import type { Device } from "../machine/device";

/** A key, a read-out or a field's item in a row. */
export interface Item {
  key: string;
  entity?: string;
  icon?: string;
  text?: string;
  label?: string;
  color?: string;
  direction?: string;
  pressed?: boolean;
  fill?: boolean;
  disabled?: boolean;
  readout?: boolean;
  alwaysText?: boolean;
  brief?: string;
  spin?: number;
  action?: () => unknown;
  // A field's item: its control and entities
  field?: string;
  entities?: string[];
  // The control it stands for (its id), for the order chosen
  control?: string;
}

/** What a feature gives the key builders. */
export interface KeyHost extends HTMLElement {
  _hass?: HomeAssistant;
  _config?: Config;
  _speed?: number;
  _moment(): Moment;
  _usable(entityId?: string): boolean;
}

/**
 * What every key made from a control has: its id, its entity (whose icon
 * it shows), its one-word name (text), its title (label: the entity's name
 * unless the control gives one), its color and its direction.
 */
function keyBase(control: Control, entityId: string, moment: Moment): Item {
  const name = valueOf(control.name, moment) ?? entityName(moment.hass, entityId);
  const title = valueOf(control.title, moment) ?? moment.names?.get(control.id) ?? entityName(moment.hass, entityId) ?? name;
  const detail = valueOf(control.detail, moment);
  return {
    key: control.key ?? control.id, entity: entityId, text: name, color: control.color,
    label: detail ? `${title}. ${detail}` : title, direction: control.direction,
  };
}

/**
 * Perform a switch's turn on or off, as Home Assistant's own toggle does,
 * asking first when the control says so.
 */
function toggle(feature: KeyHost, control: Control, entityId: string, on: boolean): void {
  // The phase now, not when the key was drawn
  const moment = feature._moment();
  const text = on ? control.confirm?.off : control.confirm?.on;
  const asks = !!text && (!control.confirm!.while || control.confirm!.while.includes(moment.phase));
  const name = (entityName(moment.hass, entityId) ?? valueOf(control.name, moment) ?? "").toLowerCase();
  const confirmation = !asks ? undefined : on
    ? { title: `Turn off ${name}?`, text, confirm_text: "Turn off", dismiss_text: "Keep on" }
    : { title: `Turn on ${name}?`, text, confirm_text: "Turn on", dismiss_text: "Keep off" };
  // A lock locks and unlocks; every other control turns on and off
  const domain = domainOf(entityId);
  const service = domain === "lock" ? `lock.${on ? "unlock" : "lock"}` : `${domain}.${on ? "turn_off" : "turn_on"}`;
  performAction(feature, service, entityId, confirmation);
}

// A fan's turn, in seconds: one speed, or each of four
const FAN_TURN = 1.2;
const FAN_TURNS = [2.4, 1.6, 1, 0.6];

/**
 * How a fan's key looks: while it turns, in its color, its icon turning
 * (with the feature's animate_fan option, on by default), at speed (1 to 4)
 * when it has one. Nothing while it stands still.
 */
function fanLook(control: Control, on: boolean, config?: Config, speed?: number): Partial<Item> {
  if (!control.fan || !on) return {};
  const spin = config?.animate_fan === false ? undefined : speed ? FAN_TURNS[Math.min(4, Math.max(1, speed)) - 1] : FAN_TURN;
  return { color: control.onColor ?? control.color, pressed: true, spin };
}

// The color of a safety check that is off (or in its problem state), unless the Safety feature's Disabled color says otherwise
const DISABLED_COLOR = "error";

/** A key for something on or off: a switch, light, fan or lock, or a state that is only shown (a read-out). */
function switchKey(feature: KeyHost, control: Control, entityId: string, moment: Moment): Item {
  const stateObj = moment.hass.states[entityId];
  const state = stateObj?.state;
  const on = isOn(stateObj);
  const base = keyBase(control, entityId, moment);
  const disabled = !feature._usable(entityId) || blocked(control, moment);
  const action = control.kind === "display"
    ? () => fire(feature, "hass-more-info", { entityId })
    : () => toggle(feature, control, entityId, on);
  if (control.check) {
    // A safety check: green while it is safe; red and filled while it is
    // not; dimmed, in no state's color, while it is neither on nor off
    // (unavailable or unknown)
    const { problem, words = control.kind === "display" ? ["in", "removed"] : ["on", "off"] } = control.check;
    const known = on || state === "off";
    const unsafe = problem === "on" ? on : problem === "off" ? state === "off" : false;
    return {
      ...base, label: `${base.label}: ${on ? words[0] : state === "off" ? words[1] : stateObj ? moment.hass.formatEntityState(stateObj) : "unknown"}`,
      color: !known ? undefined : unsafe ? moment.config?.disabled_color ?? DISABLED_COLOR : undefined, pressed: on, fill: unsafe,
      disabled: disabled || !known, action,
      readout: control.kind === "display",
    };
  }
  // A setting only runs the part at other times: it does not turn
  const setting = categoryOf(moment.hass, entityId) === "config";
  return { ...base, pressed: on, disabled, ...(setting ? {} : fanLook(control, on, moment.config)), action, readout: control.kind === "display" };
}

/**
 * A key for one of a fan's modes: pressed while the fan is in it. Off turns
 * the fan off; auto sets its first preset (none without one); speed shows
 * the speed it runs at, or the last one shown, and a tap steps to the next
 * (after the last, the first). While the fan's state is neither on nor off
 * (unavailable or unknown), the speed key shows no speed.
 */
function fanModeKey(feature: KeyHost, control: Control, entityId: string, moment: Moment): Item | undefined {
  const hass = moment.hass, stateObj = hass.states[entityId];
  const preset = (stateObj?.attributes.preset_modes ?? [])[0];
  if (!stateObj || (control.mode === "auto" && !preset)) return undefined;
  const step = stateObj.attributes.percentage_step ?? 25;
  const speeds = Math.max(1, Math.round(100 / step));
  const percentage = stateObj.attributes.percentage ?? 0;
  const mode = stateObj.attributes.preset_mode ? "auto" : stateObj.state === "off" ? "off" : stateObj.state === "on" ? "speed" : undefined;
  const base = keyBase(control, entityId, moment);
  const key: Item = {
    ...base, entity: undefined, icon: control.icon, alwaysText: control.alwaysText, pressed: mode === control.mode,
    disabled: !feature._usable(entityId),
    ...(mode === control.mode ? fanLook(control, stateObj.state === "on", moment.config, Math.round(percentage / step)) : {}),
  };
  if (control.mode === "off") return { ...key, action: () => mode !== "off" && hass.callService("fan", "turn_off", { entity_id: entityId }) };
  if (control.mode === "auto") {
    return { ...key, action: () => mode !== "auto" && hass.callService("fan", "set_preset_mode", { entity_id: entityId, preset_mode: preset }) };
  }
  if (mode === "speed") feature._speed = Math.min(speeds, Math.max(1, Math.round(percentage / step)));
  const speed = feature._speed ?? 1;
  const next = mode === "speed" ? (speed % speeds) + 1 : speed;
  const known = stateObj.state === "on" || stateObj.state === "off";
  return {
    ...key,
    ...(known ? { text: String(speed), alwaysText: true, label: mode === "speed" ? `${base.label} ${speed}. Tap for ${next}` : `${base.label} ${speed}` } : {}),
    action: () => {
      feature._speed = next;
      hass.callService("fan", "set_percentage", { entity_id: entityId, percentage: Math.min(100, next * step) });
    },
  };
}

/** A key for a button entity: a tap presses it, asking first when the control says so. */
function pressKey(feature: KeyHost, control: Control, entityId: string, moment: Moment): Item {
  return {
    ...keyBase(control, entityId, moment), pressed: false, disabled: !feature._usable(entityId) || blocked(control, moment),
    action: () => {
      if (!control.confirm) {
        feature._hass!.callService("button", "press", { entity_id: entityId });
        return;
      }
      const asks = feature._config![control.confirmOption!] !== false;
      performAction(feature, "button.press", entityId, asks ? control.confirm : undefined);
    },
  };
}

/** A key for a number: its name, and a tap opens Home Assistant's dialog to set it. */
function numberKey(feature: KeyHost, control: Control, entityId: string, moment: Moment): Item {
  const base = keyBase(control, entityId, moment);
  return {
    ...base, label: `${base.label}. Tap to choose`, pressed: false, disabled: !feature._usable(entityId),
    action: () => fire(feature, "hass-more-info", { entityId }),
  };
}

/**
 * The shortest start of an option's name, in capitals, that no other
 * option's name starts with (High and Low: H and L); the whole name when
 * every start is shared.
 */
export function briefOf(option: string, options: string[], words: (value: string) => string | undefined): string {
  const name = String(words(option) ?? option);
  const others = options.filter((o) => o !== option).map((o) => String(words(o) ?? o).toUpperCase());
  for (let n = 1; n <= name.length; n++) {
    const start = name.slice(0, n).toUpperCase();
    if (!others.some((o) => o.startsWith(start))) return start;
  }
  return name;
}

/**
 * A key for a select: its name is the option chosen, in Home Assistant's
 * words (its own name while no option is chosen: unavailable or unknown),
 * and a tap opens Home Assistant's dialog to choose another, or (cycle)
 * steps to the next option. A cycling key's action returns the call's
 * promise.
 */
function selectKey(feature: KeyHost, control: Control, entityId: string, moment: Moment): Item | undefined {
  const hass = moment.hass, stateObj = hass.states[entityId];
  if (!stateObj) return undefined;
  const base = keyBase(control, entityId, moment);
  const words = (value: string) => hass.formatEntityState(stateObj, value);
  const options: string[] = stateObj.attributes.options ?? [];
  const chosen = options.includes(stateObj.state);
  const text = chosen ? words(stateObj.state) : base.text;
  if (!control.cycle) {
    return {
      ...base, label: `${base.label}: ${words(stateObj.state)}. Tap to choose`, text,
      pressed: false, disabled: !feature._usable(entityId),
      action: () => fire(feature, "hass-more-info", { entityId }),
    };
  }
  const next = options[(options.indexOf(stateObj.state) + 1) % options.length];
  // No step from a state that is not an option (unavailable or unknown)
  const disabled = !chosen || !next;
  return {
    ...base, label: disabled ? `${base.label}: ${words(stateObj.state)}` : `${base.label}: ${words(stateObj.state)}. Tap for ${words(next)}`, text,
    // In brief only an option of the select; unavailable or unknown shows no letter
    ...(control.brief && chosen ? { brief: briefOf(stateObj.state, options, words) } : {}),
    disabled,
    action: () => Promise.resolve(feature._hass!.callService("select", "select_option", { entity_id: entityId, option: next })),
  };
}

/**
 * A field's name: its entity's name in the integration, or for several the
 * words their names start with (Laser position X and Laser position Y:
 * Laser position), or else all their names.
 */
export function fieldName(hass: HomeAssistant | undefined, control: Control, device: Device): string | undefined {
  const names = control.roles!.map((role) => entityName(hass, device.roles[role])).filter((n): n is string => !!n);
  if (names.length < 2) return names[0];
  const words = names.map((name) => name.split(" "));
  const shared: string[] = [];
  for (const [i, word] of words[0].entries()) {
    if (!words.every((w) => w[i] === word && w.length > i + 1)) break;
    shared.push(word);
  }
  return shared.length ? shared.join(" ") : names.join(", ");
}

/** A field's item in a feature's row: the field control and its entities, one for each of its roles. */
function fieldKey(_feature: KeyHost, control: Control, _entityId: string, moment: Moment): Item | undefined {
  const entities = control.roles!.map((role) => moment.device.roles[role]);
  if (entities.some((e) => !e)) return undefined;
  return { key: control.id, field: control.id, entities };
}

type KeyMaker = (feature: KeyHost, control: Control, entityId: string, moment: Moment) => Item | undefined;

/**
 * The kinds of control: key makes the control's key, or a field's item,
 * and input is the Home Assistant feature that shows it as an input.
 */
export const KINDS: Record<string, { key: KeyMaker; input?: Config }> = {
  toggle: { key: switchKey },
  light: { key: switchKey, input: { type: "light-brightness" } },
  press: { key: pressKey },
  number: { key: numberKey, input: { type: "numeric-input", style: "buttons" } },
  select: { key: selectKey, input: { type: "select-options" } },
  display: { key: switchKey },
  fan_mode: { key: fanModeKey },
  field: { key: fieldKey },
};

/** A control's key, or undefined when it has none now. */
export const keyOf = (feature: KeyHost, control: Control, entityId: string, moment: Moment): Item | undefined =>
  KINDS[control.kind ?? ""]?.key(feature, control, entityId, moment);

/**
 * The names that tell an accessory's controls from the laser's in one list
 * (items: [{ id, control, entityId }]): an accessory's entity whose name is
 * a laser control's name in the list, or the start of it or starts with it
 * (Buzzer and Buzzer reminders), is named with its key's one word, which
 * names the accessory, first (IF2 Buzzer). A Map of the control ids renamed.
 */
export function accessoryNames(hass: HomeAssistant, device: Device, items: { id: string; control: Control; entityId?: string }[]): Map<string, string> {
  const named = items.filter((i) => i.entityId).map((i) => ({ ...i, name: entityName(hass, i.entityId) })).filter((i) => i.name);
  const own = (i: { entityId?: string }) => hass.entities?.[i.entityId!]?.device_id === device.id;
  const collide = (a: string, b: string) => a === b || a.startsWith(`${b} `) || b.startsWith(`${a} `);
  const names = new Map<string, string>();
  for (const item of named) {
    if (own(item) || !named.some((other) => own(other) && collide(item.name!, other.name!))) continue;
    const word = typeof item.control.name === "string" ? item.control.name : undefined;
    if (word && !collide(item.name!, word)) names.set(item.id, `${word} ${item.name}`);
  }
  return names;
}

/** The decimals a number shows: the control's, or as many as its step has (0.1: 1, 1: 0). */
export function decimalsOf(control: Control, stateObj?: { attributes: Config }): number {
  if (control.decimals !== undefined) return control.decimals;
  const step = String(stateObj?.attributes.step ?? 1);
  return step.includes(".") ? step.split(".")[1].length : 0;
}

/** Whether Home Assistant's feature for an entity has a value to show (unavailable shows, disabled). */
export function shows(stateObj?: { state: string; attributes: Config }): boolean {
  if (!stateObj || stateObj.state === "unknown") return false;
  const options = stateObj.attributes.options;
  return stateObj.state === "unavailable" || !Array.isArray(options) || options.includes(stateObj.state);
}

// Each integration's entity icons (its icon translations), loaded once
// from Home Assistant as its frontend loads them: the icons, or the
// promise of them while they load
const PLATFORM_ICONS = new Map<string, Config | Promise<void>>();

/** An integration's entity icons, or undefined while they load (then runs once they have). */
function platformIcons(hass: HomeAssistant, platform: string, then: () => void): Config | undefined {
  if (!PLATFORM_ICONS.has(platform)) {
    const loaded = (icons?: Config) => void PLATFORM_ICONS.set(platform, icons ?? {});
    const call = (hass.callWS as ((msg: Config) => Promise<Config>) | undefined)?.({ type: "frontend/get_icons", category: "entity", integration: platform });
    PLATFORM_ICONS.set(platform, Promise.resolve(call).then((result) => loaded(result?.resources?.[platform]), () => loaded({})));
  }
  const icons = PLATFORM_ICONS.get(platform);
  if (!(icons instanceof Promise)) return icons;
  icons.then(then);
  return undefined;
}

/**
 * The icon Home Assistant shows for an entity, in the order its state icon
 * picks it: the icon set on the entity, the entity's own, its integration's
 * icon for it, or else its domain's (by device class). Undefined while the
 * integration's icons load (then runs once they have).
 */
export function iconOf(hass: HomeAssistant, entityId: string, then: () => void): string | undefined {
  const entry = hass.entities?.[entityId] as Config | undefined, stateObj = hass.states?.[entityId];
  const own = entry?.icon || stateObj?.attributes.icon;
  if (own) return own;
  const domain = domainOf(entityId);
  if (entry?.platform && entry.translation_key) {
    const icons = platformIcons(hass, entry.platform, then);
    if (!icons) return undefined;
    const icon = icons[domain]?.[entry.translation_key]?.default;
    if (icon) return icon;
  }
  return `${domain}:${stateObj?.attributes.device_class ?? ""}`;
}

/**
 * Whether item i of a row draws its chevron: only to tell it from another
 * item in the row that looks the same (faces: what each item shows, as
 * iconOf and its text; undefined while unknown).
 */
export function needsDirection(faces: (string | undefined)[], i: number): boolean {
  return faces[i] !== undefined && faces.some((face, j) => j !== i && face === faces[i]);
}
