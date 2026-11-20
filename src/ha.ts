// What the card uses of Home Assistant's frontend: its types (as far as the
// card reads them), events, actions and a few shared helpers.

export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
  last_changed?: string;
  last_updated?: string;
}

export interface EntityEntry {
  entity_id: string;
  device_id?: string | null;
  platform?: string;
  translation_key?: string | null;
}

export interface DeviceEntry {
  id: string;
  model?: string | null;
  name?: string | null;
  via_device_id?: string | null;
}

export interface HomeAssistant {
  states: Record<string, HassEntity>;
  entities?: Record<string, EntityEntry>;
  devices?: Record<string, DeviceEntry>;
  themes?: { darkMode?: boolean; [key: string]: unknown };
  connected?: boolean;
  callService(domain: string, service: string, data?: Record<string, unknown>): unknown;
  formatEntityState(stateObj: HassEntity, state?: string): string;
  formatEntityName?(stateObj: HassEntity, name: unknown): string;
  [key: string]: unknown;
}

/** A card's or a feature's configuration: its own options, checked where they are read. */
export type Config = Record<string, any>;

/** The context Home Assistant gives a tile feature: the card's entity. */
export interface FeatureContext {
  entity_id?: string;
}

export interface CardHelpers {
  createCardElement(config: Config): HTMLElement & { setConfig(config: Config): void; hass?: HomeAssistant };
}

declare global {
  interface Window {
    loadCardHelpers?: () => Promise<CardHelpers>;
    customCards?: Record<string, unknown>[];
    customCardFeatures?: Record<string, unknown>[];
  }
}

export const domainOf = (entityId: string): string => entityId.split(".")[0];

/** Whether a switch, light or fan is on, or a lock is locked. */
export const isOn = (stateObj?: HassEntity): boolean => stateObj?.state === "on" || stateObj?.state === "locked";

/** Whether a state is known: neither unknown nor unavailable. */
export const known = (stateObj?: HassEntity): stateObj is HassEntity =>
  !!stateObj && !["unknown", "unavailable"].includes(stateObj.state);

/** Whether an entity can be used: it exists and is not unavailable. */
export const usable = (hass: HomeAssistant, entityId?: string): boolean => {
  const stateObj = entityId ? hass.states[entityId] : undefined;
  return !!stateObj && stateObj.state !== "unavailable";
};

export function fire(el: EventTarget, type: string, detail?: unknown): void {
  el.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
}

/** A select selector of [value, label] pairs. */
export const select = (options: [string, string][], extra: Record<string, unknown> = {}) => ({
  select: { mode: "dropdown", options: options.map(([value, label]) => ({ value, label })), ...extra },
});

/** Whether two option values are the same (lists and sets of options by their contents). */
export const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Whether two flat objects hold the same values. */
export function sameValues(a?: Record<string, unknown>, b?: Record<string, unknown>): boolean {
  if (!a || !b) return a === b;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
}

/**
 * Perform an action through Home Assistant's own action handling, as a
 * card's tap action does. With a confirmation, Home Assistant first asks in
 * its own confirmation dialog.
 */
export function performAction(host: EventTarget, service: string, entityId: string, confirmation?: Config, data?: Config): void {
  fire(host, "hass-action", {
    config: {
      tap_action: {
        action: "perform-action", perform_action: service, target: { entity_id: entityId }, ...(data ? { data } : {}),
        ...(confirmation ? { confirmation: { dismiss_text: "Keep it", ...confirmation } } : {}),
      },
    },
    action: "tap",
  });
}

export const moreInfo = (host: EventTarget, entityId: string): void => fire(host, "hass-more-info", { entityId });

/** An entity's own name, without its device's, as Home Assistant shows it; undefined without one. */
export function entityName(hass: HomeAssistant | undefined, entityId?: string): string | undefined {
  const stateObj = entityId ? hass?.states[entityId] : undefined;
  if (!stateObj || !hass) return undefined;
  return hass.formatEntityName?.(stateObj, { type: "entity" }) || stateObj.attributes.friendly_name || undefined;
}

/** A state as Home Assistant shows it, without its unit when asked. */
export function formatValue(hass: HomeAssistant, stateObj: HassEntity, noUnit = false): string {
  const text = hass.formatEntityState(stateObj);
  const unit = stateObj.attributes.unit_of_measurement;
  return noUnit && unit && text.endsWith(unit) ? text.slice(0, -unit.length).trim() : text;
}

/** Whether the theme is dark. */
export const darkMode = (hass?: HomeAssistant): boolean => !!hass?.themes?.darkMode;

/** All elements matching selector inside root and its shadow roots, a few deep. */
export function findAllDeep(root: ParentNode | null | undefined, selector: string, depth = 5, out: Element[] = []): Element[] {
  if (!root || depth < 0) return out;
  out.push(...root.querySelectorAll(selector));
  for (const el of root.querySelectorAll("*")) if (el.shadowRoot) findAllDeep(el.shadowRoot, selector, depth - 1, out);
  return out;
}

/** The first element matching selector inside root and its shadow roots. */
export function findDeep(root: ParentNode | null | undefined, selector: string, depth = 5): Element | null {
  if (!root || depth < 0) return null;
  const found = root.querySelector(selector);
  if (found) return found;
  for (const el of root.querySelectorAll("*")) {
    const hit = el.shadowRoot && findDeep(el.shadowRoot, selector, depth - 1);
    if (hit) return hit;
  }
  return null;
}

/** Add a style sheet to a shadow root once; false when the root does not take it. */
export function adopt(root: ShadowRoot, sheet: CSSStyleSheet): boolean {
  try {
    if (!root.adoptedStyleSheets.includes(sheet)) root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
    return true;
  } catch {
    return false;
  }
}

export function sheetOf(css: string): CSSStyleSheet {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  return sheet;
}

/**
 * Answers Home Assistant's "states" context inside an element, as Home
 * Assistant's own provider does (the Lit context protocol), with the states
 * the card changed, so the tile card editor's State content picker sees the
 * card's attributes.
 */
type ContextRequest = Event & { context?: unknown; subscribe?: boolean; callback: (value: unknown, unsubscribe?: () => void) => void };
export class StatesProvider {
  private _states?: Record<string, HassEntity>;
  private _waiting: ContextRequest[] = [];
  private _subscribers = new Map<ContextRequest["callback"], () => void>();

  constructor(host: EventTarget) {
    host.addEventListener("context-request", (event) => {
      const ev = event as ContextRequest;
      if (ev.context !== "states") return;
      ev.stopPropagation();
      if (this._states === undefined) this._waiting.push(ev);
      else this._answer(ev);
    });
  }

  private _answer(ev: ContextRequest): void {
    if (!ev.subscribe) {
      ev.callback(this._states);
      return;
    }
    const unsubscribe = () => this._subscribers.delete(ev.callback);
    this._subscribers.set(ev.callback, unsubscribe);
    ev.callback(this._states, unsubscribe);
  }

  set states(states: Record<string, HassEntity>) {
    if (states === this._states) return;
    this._states = states;
    for (const ev of this._waiting.splice(0)) this._answer(ev);
    for (const [callback, unsubscribe] of this._subscribers) callback(states, unsubscribe);
  }
}

/** Define an element once (a dashboard can load the card twice). */
export function define(name: string, element: CustomElementConstructor): void {
  if (!customElements.get(name)) customElements.define(name, element);
}
