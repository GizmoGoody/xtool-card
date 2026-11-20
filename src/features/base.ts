// What every feature has, and the features made of a row of keys.
import { html, LitElement, nothing, render, unsafeCSS, type CSSResultGroup, type TemplateResult } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { styleMap } from "lit/directives/style-map.js";
import { CARD_TYPE, cssColor, ENABLED, FEATURE_EDITOR_TYPE } from "../const";
import { entityName, select, type Config, type FeatureContext, type HomeAssistant } from "../ha";
import { categoryOf, controlOf, CONTROLS, present, resolved, type Control, type Moment } from "../machine/controls";
import { accessControlOn, changedFor, deviceOf, phaseNow, type Device } from "../machine/device";
import { FieldGroup } from "./field";
import { accessoryNames, fieldName, iconOf, keyOf, needsDirection, type Item } from "./keys";
import { ITEM_MIN, RowFitter } from "./rows";
import { DIRECTION_ICONS } from "./slides";
import { FEATURE_CSS } from "./styles";

// What a feature's keys show: their icons, their names, or both. A key
// without an icon shows its name, and a key without a name its icon.
const DISPLAYS: [string, string][] = [["icons", "Icons"], ["names", "Names"], ["both", "Icons and names"]];
export function displayOf(config: Config | undefined, fallback = "icons"): string {
  return DISPLAYS.some(([value]) => value === config?.show) ? config!.show : fallback;
}
export const displayField = (helper?: string): Config => ({ name: "show", label: "Show", ...(helper ? { helper } : {}), selector: select(DISPLAYS) });

/** What a key shows with Show (display): its icon, its text, or both. */
export function faceOf(b: Item, display: string): { showIcon: boolean; showText: boolean } {
  const icon = !!(b.entity || b.icon), text = !!b.text;
  const showIcon = icon && (display !== "names" || !text);
  const showText = text && (display !== "icons" || !showIcon || !!b.alwaysText);
  return { showIcon, showText };
}

/** The xTool card a feature is in, if any. */
export function cardOf(el: Element): (HTMLElement & { config?: Config }) | undefined {
  for (let node = (el.getRootNode?.() as ShadowRoot | undefined)?.host; node; node = (node.getRootNode?.() as ShadowRoot | undefined)?.host) {
    if (node.localName === CARD_TYPE) return node as HTMLElement & { config?: Config };
  }
  return undefined;
}

/**
 * Text that reads on a filled button: dark on a light color, white on a dark
 * one. The color is the one the button actually shows (a theme variable,
 * resolved by the browser). Null while the element is not on the page.
 */
let colorCanvas: CanvasRenderingContext2D | null | undefined;
// Text colors found, by element and color, until the theme or the card's colors change
let textColors = new WeakMap<Element, Map<string, string | null>>();
export const colorsChanged = (): void => void (textColors = new WeakMap());
export function textOn(el: HTMLElement, cssValue: string): string | null {
  if (!el.isConnected) return null;
  let known = textColors.get(el);
  if (!known) textColors.set(el, (known = new Map()));
  if (!known.has(cssValue)) known.set(cssValue, textColorOf(el, cssValue));
  return known.get(cssValue)!;
}

function textColorOf(el: HTMLElement, cssValue: string): string | null {
  const root = el.shadowRoot ?? el;
  let probe = root.querySelector<HTMLElement>(":scope > .color-probe");
  if (!probe) {
    probe = document.createElement("span");
    probe.className = "color-probe";
    probe.hidden = true;
    root.append(probe);
  }
  probe.style.color = "";
  probe.style.color = cssValue;
  const resolvedColor = getComputedStyle(probe).color;
  if (!resolvedColor) return null;
  colorCanvas ??= document.createElement("canvas").getContext("2d");
  if (!colorCanvas) return null;
  colorCanvas.fillStyle = "#000";
  colorCanvas.fillStyle = resolvedColor;
  const value = String(colorCanvas.fillStyle);
  const rgb = value.startsWith("#")
    ? value.slice(1).match(/../g)!.map((h) => parseInt(h, 16))
    : (value.match(/[\d.]+/g) ?? ["0", "0", "0"]).map(Number);
  const luma = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
  return luma > 0.6 ? "rgba(0, 0, 0, .85)" : "#fff";
}

export interface FeatureOption {
  name: string;
  label: string;
  helper?: string;
  default?: unknown;
  selector?: Config;
}

export interface FeatureForm {
  schema: Config[] | ((config: Config) => Config[]);
  data: (config: Config) => Config;
  save?: (data: Config) => Config;
}

/**
 * What every feature has: its configuration, Home Assistant and its context
 * (the card's entity), the device model, and the controls chosen. A
 * feature declares, as static fields:
 * - label: its title, its name on the row (for screen readers), which
 *   gives its element name (type: xtool- and the title); pickerName: its
 *   name in Home Assistant's feature picker,
 * - controls: the ids of the controls it offers, in their default order;
 *   defaults: the ones shown by default (all it offers that the device has,
 *   unless given); controlsKey: the option that lists the ones chosen,
 * - form: its editor's { label, helper } for the list of controls (none:
 *   no list), and options, its on and off options ({ name, label, helper,
 *   default, selector }); keepOffered: the editor leaves out chosen controls
 *   the device does not offer; offerAll: the editor offers every control,
 *   whatever the device has; category: the entity category it shows
 *   ("config" or "control"; none: any).
 * A feature whose controls depend on the device (such as each overlay
 * switch) gives them with controlIds(device) and controlFor(id, device, hass).
 *
 * Home Assistant hands a feature its state by setting hass, and the feature
 * shows it at once, as Home Assistant's own elements do (see _refresh).
 */
export class XtoolElement extends LitElement {
  static label = "";
  static pickerName = "";
  static controls: string[] = [];
  static defaults?: string[];
  static controlsKey = "controls";
  static form: { label?: string; helper?: string; options?: FeatureOption[] } = {};
  static display?: string;
  static offerAll = false;
  static keepOffered = false;
  static category?: string;
  static keyOptions?: Partial<Item>;
  static hidden?: (moment: Moment) => boolean;

  /** Its element name: xtool- and its title (label). */
  static get type(): string {
    return `xtool-${this.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  }

  static getStubConfig(): Config {
    return { type: `custom:${this.type}` };
  }

  static getConfigElement(): HTMLElement {
    return document.createElement(FEATURE_EDITOR_TYPE);
  }

  /** The controls shown when none are chosen: the feature's defaults, or (undefined) all it offers. */
  static defaultsFor(_device: Device): string[] | undefined {
    return this.defaults;
  }

  /**
   * The ids of the controls the feature can show for a device, in their
   * default order: its own, less those another feature holds (see
   * ControlSpec.feature), and any held by this one.
   */
  static controlIds(_device: Device): string[] {
    const own = this.controls.filter((id) => (CONTROLS[id]?.feature ?? this.type) === this.type);
    const held = Object.keys(CONTROLS).filter((id) => CONTROLS[id].feature === this.type && !own.includes(id));
    return [...own, ...held];
  }

  /**
   * A control the feature shows, and the entity it acts on (none for a key
   * that stands for others, or for an entity of another category than the
   * feature's).
   */
  static controlFor(id: string, device: Device, hass?: HomeAssistant): { control?: Control; entityId?: string } {
    const control = controlOf(id);
    const entityId = control && device.roles[control.role];
    if (entityId && this.category && categoryOf(hass, entityId) !== this.category) return { control, entityId: undefined };
    return { control: control && resolved(control, entityId), entityId };
  }

  /** The controls the feature offers for a device, in order, for the editor, each named as its entity is (or by its option). */
  static offered(device: Device, hass: HomeAssistant): { value: string; label: string }[] {
    const items = this.controlIds(device).map((id) => ({ id, ...this.controlFor(id, device, hass) }))
      .filter((i): i is { id: string; control: Control; entityId?: string } =>
        !!i.control && (this.offerAll || !!i.entityId || (!!i.control.picks && present(i.control, device))));
    const names = accessoryNames(hass, device, items);
    return items.map(({ id, control, entityId }) => ({
      value: id,
      label: (control.option ?? (control.roles ? fieldName(hass, control, device) : names.get(id) ?? entityName(hass, entityId))
        ?? (typeof control.name === "string" ? control.name : id)),
    }));
  }

  /** Whether Home Assistant's feature picker offers the feature for this device: it has one of its controls. */
  static supports(device: Device, hass: HomeAssistant): boolean {
    return this.offered(device, hass).length > 0 && (!this.offerAll || this.controlIds(device).some((id) => {
      const { control, entityId } = this.controlFor(id, device, hass);
      return !!entityId || (!!control?.picks && present(control, device));
    }));
  }

  /** The feature's editor form, from its controls, display and options. */
  static editor(hass: HomeAssistant, entityId?: string): FeatureForm {
    const { label, helper, options = [] } = this.form;
    const device = deviceOf(hass, entityId);
    const offered = this.offered(device, hass);
    const values = offered.map((o) => o.value);
    const key = this.controlsKey;
    return {
      schema: [
        ...(label ? [{
          name: key, label, ...(helper ? { helper } : {}),
          selector: { select: { multiple: true, reorder: true, mode: "dropdown", options: offered } },
        }] : []),
        ...(this.display ? [displayField()] : []),
        ...options.map((option) => ({
          name: option.name, label: option.label, ...(option.helper ? { helper: option.helper } : {}), selector: option.selector ?? { boolean: {} },
        })),
      ],
      data: (c) => ({
        ...(label ? {
          [key]: this.keepOffered && Array.isArray(c[key]) ? c[key].filter((value: string) => values.includes(value))
            : c[key] ?? (this.defaultsFor(device) ?? values).filter((value) => values.includes(value)),
        } : {}),
        ...(this.display ? { show: displayOf(c, this.display) } : {}),
        ...Object.fromEntries(options.map(({ name, selector, default: value = true }) => [
          name, selector ? c[name] ?? value : typeof c[name] === "boolean" ? c[name] : value,
        ])),
      }),
    };
  }

  _config?: Config;
  _hass?: HomeAssistant;
  protected _context?: FeatureContext;
  _speed?: number;

  // The class's statics, from an instance
  protected get _type(): typeof XtoolElement {
    return this.constructor as typeof XtoolElement;
  }

  constructor() {
    super();
    // Keep taps on a control from reaching the cards around it, such as an
    // expander card whose header opens and closes on a tap
    for (const type of ["click", "touchstart", "touchend", "mousedown", "mouseup"]) {
      this.addEventListener(type, (ev) => ev.stopPropagation());
    }
  }

  setConfig(config: Config): void {
    if (!config) throw new Error("Invalid configuration");
    this._config = config;
    this._refresh();
  }

  set hass(hass: HomeAssistant) {
    const before = this._hass;
    this._hass = hass;
    if (this._config && this._context && !changedFor(before, hass, this._entityId) && !this._watched().some((id) => before?.states[id] !== hass.states[id])) return;
    this._refresh();
  }

  get hass(): HomeAssistant | undefined {
    return this._hass;
  }

  set context(context: FeatureContext) {
    this._context = context;
    this._refresh();
  }

  get context(): FeatureContext | undefined {
    return this._context;
  }

  /** Entities outside the laser's that the feature shows. */
  protected _watched(): string[] {
    return [];
  }

  /**
   * Draw again now: Home Assistant's elements show a new state as soon as
   * they are handed it, and so does each feature once it is on the page
   * (its first drawing waits until it is).
   */
  _refresh(): void {
    this.requestUpdate();
    if (this.hasUpdated && this.isConnected) this.performUpdate();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.isUpdatePending && this._ready()) this.performUpdate();
  }

  get _entityId(): string | undefined {
    return this._context?.entity_id;
  }

  get _device(): Device {
    return deviceOf(this._hass, this._entityId);
  }

  _ready(): boolean {
    return !!(this._hass && this._config && this._context);
  }

  protected override shouldUpdate(): boolean {
    return this._ready();
  }

  /** What the controls' rules look at: hass, the device, the laser's phase, Access control and the configuration. */
  _moment(): Moment {
    const hass = this._hass!, id = this._entityId;
    return { hass, device: deviceOf(hass, id), phase: phaseNow(hass, id), controlled: accessControlOn(hass, id), config: this._config! };
  }

  /** The ids of the controls chosen, in order: the option's list, or the defaults. */
  _chosen(): string[] {
    const chosen = this._config![this._type.controlsKey];
    return Array.isArray(chosen) ? chosen : this._type.defaultsFor(this._device) ?? this._type.controlIds(this._device);
  }

  _usable(entityId?: string): boolean {
    const stateObj = entityId ? this._hass?.states[entityId] : undefined;
    return !!stateObj && stateObj.state !== "unavailable";
  }

  /**
   * A feature with nothing to show shows nothing at all: neither itself nor
   * its place among the card's features (Home Assistant's feature element
   * around it, which would keep the gap between features).
   */
  protected _showNothing(empty: boolean): void {
    const display = empty ? "none" : "";
    if (this.style.display !== display) this.style.display = display;
    const host = (this.getRootNode() as ShadowRoot)?.host as HTMLElement | undefined;
    if (host?.localName === "hui-card-feature" && host.style.display !== display) host.style.display = display;
  }

  // Rows fitted to their width (see fitRow)
  protected _fitter = new RowFitter();
}

/**
 * A row of keys: the chosen controls' (a field's group among them). A
 * feature with keys of its own lists them in _buttons(). static keyOptions
 * changes every key the feature makes from a control.
 */
export class XtoolFeature extends XtoolElement {
  static override display: string | undefined = "icons";
  static override styles: CSSResultGroup = unsafeCSS(FEATURE_CSS);

  private _groups = new Map<string, FieldGroup>();
  private _retry = false;

  _buttons(): Item[] {
    const moment = this._moment();
    if (this._type.hidden?.(moment)) return [];
    // Titled as in the editor (see accessoryNames)
    const { device, hass } = moment;
    moment.names = accessoryNames(hass, device, this._type.controlIds(device)
      .map((id) => ({ id, ...this._type.controlFor(id, device, hass) })).filter((i): i is { id: string; control: Control } => !!i.control));
    return this._chosen().map((id) => this._controlKey(id, moment, this._type.keyOptions)).filter((b): b is Item => !!b);
  }

  /** The key for one of the feature's controls, or undefined when the device does not have it. */
  _controlKey(id: string, moment: Moment, options?: Partial<Item>): Item | undefined {
    if (!this._type.controlIds(moment.device).includes(id)) return undefined;
    const { control, entityId } = this._type.controlFor(id, moment.device, moment.hass);
    if (!control) return undefined;
    if (control.pick) return this._controlKey(control.pick(moment), moment, options);
    const key = entityId ? keyOf(this, control, entityId, moment) : undefined;
    return key && { ...key, ...options };
  }

  /** The keys with their chevrons only where they tell apart keys that look the same, and the text color on each. */
  protected _prepare(buttons: Item[]): (string | null)[] {
    const display = this._display();
    const faces = buttons.map((b) => {
      const { showIcon, showText } = faceOf(b, display);
      if (showIcon && b.entity) {
        const icon = iconOf(this._hass!, b.entity, () => this._refresh());
        return icon === undefined ? undefined : `${icon}|${showText ? b.text : ""}`;
      }
      return `${showIcon ? b.icon : ""}|${showText ? b.text : ""}`;
    });
    buttons.forEach((b, i) => {
      if (b.direction && !needsDirection(faces, i)) delete b.direction;
    });
    const colors = buttons.map((b) => textOn(this, b.color ? cssColor(b.color) : ENABLED));
    if (colors.includes(null) && !this._retry) {
      // Not on the page yet: the text colors are found once it is
      this._retry = true;
      requestAnimationFrame(() => {
        this._retry = false;
        this._refresh();
      });
    }
    return colors;
  }

  protected override render(): TemplateResult {
    const buttons = this._buttons();
    const colors = this._prepare(buttons);
    // Nothing: no control chosen that the device has, or the feature does
    // not apply to the device as it is now
    this._showNothing(this._empty(buttons));
    const fields = buttons.some((b) => b.field);
    for (const b of buttons) if (b.field) this._group(b.field).update(b);
    return html`<div class="row ${fields ? "flow" : ""}" role="group" aria-label=${this._type.label}>${repeat(buttons, (b) => b.key,
      (b, i) => (b.field ? this._group(b.field).el : this._button(b, colors[i])))}</div>`;
  }

  protected override updated(): void {
    this._fitter.fit(this.renderRoot.querySelectorAll<HTMLElement>(".row"));
  }

  /** Whether the feature has nothing to show (see _showNothing). */
  protected _empty(buttons: Item[]): boolean {
    return buttons.length === 0 || !!this._type.hidden?.(this._moment());
  }

  /** A field's group, made once and kept while the feature shows it. */
  _group(id: string): FieldGroup {
    if (!this._groups.has(id)) this._groups.set(id, new FieldGroup(this, controlOf(id)!));
    return this._groups.get(id)!;
  }

  /** What the buttons show: icons, names or both. */
  _display(): string {
    return displayOf(this._config, this._type.display ?? "icons");
  }

  /**
   * A key drawn on its own, into holder (kept, so the same key is redrawn,
   * wherever it has been moved): for a key placed outside the feature's row.
   * The key once it is first drawn (later, it may no longer be in holder).
   */
  _drawKey(b: Item, holder: HTMLElement): HTMLElement | null {
    const color = textOn(this, b.color ? cssColor(b.color) : ENABLED);
    if (color === null && !this._retry) {
      // Not on the page yet: the text color is found once it is
      this._retry = true;
      requestAnimationFrame(() => {
        this._retry = false;
        this._refresh();
      });
    }
    render(this._button(b, color), holder);
    return holder.firstElementChild as HTMLElement | null;
  }

  /** A key, or a read-out (a state that is only shown, which looks like a field). */
  _button(b: Item, onColor: string | null): TemplateResult {
    const { showIcon, showText } = faceOf(b, this._display());
    const spin = b.spin ? { "--spin": `${b.spin}s` } : {};
    const icon = b.entity
      ? html`<ha-state-icon class=${b.spin ? "spin" : ""} style=${styleMap(spin)} data-entity=${b.entity}
          .hass=${this._hass} .stateObj=${this._hass!.states[b.entity]}></ha-state-icon>`
      : b.icon ? html`<ha-icon class=${b.spin ? "spin" : ""} style=${styleMap(spin)} .icon=${b.icon}></ha-icon>` : nothing;
    const text = b.text ? html`<span>${b.text}</span>` : nothing;
    // The arrow goes under the icon, or under the name without one
    const first = showIcon ? icon : showText ? text : nothing;
    const face = first !== nothing && b.direction
      ? html`<span class="glyph">${first}<ha-icon class="arrow" .icon=${DIRECTION_ICONS[b.direction]}></ha-icon></span>` : first;
    // With its icon alone, a key that has one shows its state in brief beside it
    const after = showIcon && showText ? text : showIcon && b.brief ? html`<span>${b.brief}</span>` : nothing;
    const style = styleMap({ ...(b.color ? { "--c": cssColor(b.color) } : {}), ...(onColor ? { "--xtool-on-color": onColor } : {}) });
    const press = (ev: Event) => {
      ev.stopPropagation();
      b.action?.();
    };
    if (b.readout) {
      return html`<div class="field readout ${b.disabled ? "disabled" : ""}" tabindex="0" role="button" data-key=${b.key}
        data-control=${b.control ?? nothing} data-min=${ITEM_MIN.key} title=${b.label ?? nothing} aria-label=${b.label ?? nothing}
        style=${style} .disabled=${!!b.disabled} @click=${press} @keydown=${(ev: KeyboardEvent) => {
          if (ev.key !== "Enter" && ev.key !== " ") return;
          ev.preventDefault();
          b.action?.();
        }}>${face}${after}</div>`;
    }
    return html`<button type="button" class="key ${b.fill ? "fill" : ""}" data-key=${b.key} data-control=${b.control ?? nothing}
      data-min=${ITEM_MIN.key} title=${b.label ?? nothing} aria-label=${b.label ?? nothing}
      aria-pressed=${b.pressed === undefined ? nothing : String(!!b.pressed)} ?disabled=${!!b.disabled} style=${style}
      @click=${press}>${face}${after}</button>`;
  }
}
