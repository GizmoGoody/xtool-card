// Home Assistant's own features inside this card's (sliders and selects),
// and the lights as a light's tile card shows them.
import { DAYLIGHT } from "../const";
import { entityName, performAction, type Config, type HomeAssistant } from "../ha";
import { CONTROLS, type Control } from "../machine/controls";
import { KINDS, type KeyHost } from "./keys";
import { ITEM_MIN, nameItem } from "./rows";

// The chevron under a key's icon for where its part sits
export const DIRECTION_ICONS: Record<string, string> = {
  left: "mdi:chevron-left", right: "mdi:chevron-right", back: "mdi:chevron-up", up: "mdi:chevron-up", front: "mdi:chevron-down", down: "mdi:chevron-down",
};

/** Whether one of Home Assistant's features is a slider. */
const SLIDERS = (feature: Config) => feature.type === "light-brightness" || (feature.type === "numeric-input" && feature.style === "slider");

type CardFeature = HTMLElement & { feature?: Config; context?: Config; hass?: HomeAssistant; color?: string };

/** A slide holding Home Assistant's own feature for an entity, made once and kept in slides. */
export function slideOf(slides: Map<string, HTMLElement>, entityId: string, feature: Config): HTMLElement {
  const id = `${entityId}|${feature.type}`;
  let slide = slides.get(id);
  if (!slide) {
    slide = document.createElement("div");
    slide.className = feature.type === "select-options" ? "slide select" : "slide";
    slide.dataset.min = String(feature.type === "select-options" ? ITEM_MIN.select : ITEM_MIN.slider);
    const el = document.createElement("hui-card-feature") as CardFeature;
    el.feature = { ...feature };
    el.context = { entity_id: entityId };
    slide.append(el);
    // A slider (an exposure, a brightness) shows its entity's icon at its
    // start, over Home Assistant's slider (see showSlides)
    if (SLIDERS(feature)) {
      slide.classList.add("slider");
      slide.append(document.createElement("ha-state-icon"));
    }
    slides.set(id, slide);
  }
  return slide;
}

/** The Home Assistant feature that shows a control as an input: its kind's, with the control's changes. */
export const inputOf = (control: Control): Config => ({ ...KINDS[control.kind!].input, ...(control.input ?? {}) });

/**
 * Show these slides in a box, replacing what it shows only when they
 * differ. Each slide (Home Assistant's feature) is named by its entity, and
 * shows the entity's icon at its start when it is a slider (see slideOf).
 */
export function showSlides(box: Element, slides: Element[]): void {
  for (const slide of slides) {
    const feature = slide.querySelector?.(":scope > hui-card-feature") as CardFeature | null;
    const hass = feature?.hass, entityId = feature?.context?.entity_id;
    if (hass && entityId) nameItem(slide, entityName(hass, entityId));
    const icon = slide.querySelector?.(":scope > ha-state-icon") as (HTMLElement & Config) | null;
    if (icon && hass) {
      icon.hass = hass;
      icon.stateObj = hass.states[entityId];
      icon.classList.toggle("off", !icon.stateObj || ["off", "unavailable", "unknown"].includes(icon.stateObj.state));
    }
  }
  if (slides.length !== box.children.length || slides.some((slide, i) => box.children[i] !== slide)) box.replaceChildren(...slides);
}

// A light's color in a feature: its own color when it has one, daylight
// otherwise; Home Assistant's color for a light that is off
const LIGHT_OFF = "var(--state-light-inactive-color, var(--state-inactive-color, var(--disabled-color, #bdbdbd)))";

// A light's two parts, each chosen on its own: its icon (a tap turns it on
// or off), whose id is the light's control id, and its brightness slider,
// "<light>_brightness"
const BRIGHTNESS = "_brightness";
export const lightParts = (light: string): string[] => [light, `${light}${BRIGHTNESS}`];

/** A light part's id: { light (its control id), part: "icon" or "brightness" }, or undefined for another id. */
export function lightPart(id?: string): { light: string; part: "icon" | "brightness" } | undefined {
  const isLight = (light?: string) => !!light && CONTROLS[light]?.kind === "light";
  if (isLight(id)) return { light: id!, part: "icon" };
  const light = id?.endsWith(BRIGHTNESS) ? id.slice(0, -BRIGHTNESS.length) : undefined;
  return isLight(light) ? { light: light!, part: "brightness" } : undefined;
}

/** A light part's name in the editor: the light's name, and for its slider "<name> brightness". */
export const lightPartName = (name: string | undefined, part: string): string | undefined =>
  (part === "brightness" && name ? `${name} brightness` : name);

/** Whether a light has a brightness. */
export const dimmable = (hass: HomeAssistant | undefined, light: string): boolean =>
  ((hass?.states[light]?.attributes.supported_color_modes ?? []) as string[]).some((mode) => mode !== "onoff");

/**
 * A light as a light's tile card shows it: Home Assistant's tile icon with
 * the light's own icon (and the chevron for where it sits, when update is
 * given one), where a tap turns the light on or off, and Home Assistant's
 * light brightness feature (for a light with a brightness). el holds both,
 * side by side; icon and slide are each on its own. The feature's
 * off_at_minimum option turns the light off when its slider is set to the
 * minimum (1 %).
 */
export class LightRow {
  readonly el: HTMLDivElement;
  readonly icon: HTMLElement & Config;
  readonly slide: HTMLElement;
  private _state: HTMLElement & Config;
  private _drawn = false;
  private _direction?: string;

  constructor(private _feature: KeyHost, private _entityId: string) {
    this.el = document.createElement("div");
    this.el.className = "light";
    this.icon = document.createElement("ha-tile-icon") as HTMLElement & Config;
    this.icon.dataset.min = String(ITEM_MIN.key);
    this.icon.interactive = true;
    this.icon.actionHandlerOptions = { hasHold: false, hasDoubleClick: false };
    this._state = document.createElement("ha-state-icon") as HTMLElement & Config;
    // Home Assistant's action handler on the tile icon sends an action event for a tap
    this.icon.addEventListener("action", (ev) => {
      ev.stopPropagation();
      if ((ev as CustomEvent).detail?.action === "tap") performAction(_feature, "light.toggle", _entityId);
    });
    this.slide = slideOf(new Map(), _entityId, KINDS.light.input!);
    // Home Assistant's brightness feature keeps its slider's value-changed
    // to itself (it sets the brightness): heard on the way down, at the
    // minimum it goes no further, and the light turns off instead
    this.slide.addEventListener("value-changed", (ev) => {
      const slider = ev.composedPath()[0] as HTMLInputElement | undefined;
      if (_feature._config?.off_at_minimum === true && (ev as CustomEvent).detail?.value <= Number(slider?.min ?? 1)) {
        ev.stopPropagation();
        _feature._hass!.callService("light", "turn_off", { entity_id: _entityId });
      }
    }, true);
    this.el.append(this.icon, this.slide);
  }

  /** The light as it is now, with the chevron for direction (none: without one). */
  update(direction?: string): HTMLElement {
    if (!this._drawn || direction !== this._direction) this._drawIcon(direction);
    const hass = this._feature._hass!, stateObj = hass.states[this._entityId];
    const rgb = stateObj?.attributes.rgb_color;
    const color = stateObj?.state === "on" ? (Array.isArray(rgb) ? `rgb(${rgb.join(", ")})` : DAYLIGHT) : LIGHT_OFF;
    // As the tile card's icon: the icon in the color, its circle the color at Home Assistant's opacity
    this.icon.style.setProperty("--tile-icon-color", color);
    this.icon.accessibleLabel = entityName(hass, this._entityId);
    nameItem(this.icon, this.icon.accessibleLabel);
    this._state.hass = hass;
    this._state.stateObj = stateObj;
    this.slide.hidden = !dimmable(hass, this._entityId);
    this.slide.style.setProperty("--feature-color", color);
    const feature = this.slide.firstChild as CardFeature;
    feature.color = color;
    feature.hass = hass;
    return this.el;
  }

  /** The tile icon's content: the light's icon, with the chevron under it for direction. */
  private _drawIcon(direction?: string): void {
    this._drawn = true;
    this._direction = direction;
    this.icon.replaceChildren();
    if (direction) {
      const glyph = document.createElement("span");
      glyph.className = "glyph";
      glyph.slot = "icon";
      const arrow = document.createElement("ha-icon") as HTMLElement & Config;
      arrow.className = "arrow";
      arrow.icon = DIRECTION_ICONS[direction];
      this._state.removeAttribute("slot");
      glyph.append(this._state, arrow);
      this.icon.append(glyph);
    } else {
      this._state.slot = "icon";
      this.icon.append(this._state);
    }
  }
}
