// Cameras: a camera, with keys to switch between the laser's cameras. The
// picture is Home Assistant's own hui-image, the element its picture cards
// show a camera with: snapshots it refreshes itself (Auto), or the camera's
// live stream (Live), filling its box (cover), so a crop can neither
// collapse nor stretch it. Home Assistant loads hui-image with its picture
// cards; the card asks the card helpers for one, as it does for the tile card.
import { html, render, unsafeCSS, type CSSResultGroup, type TemplateResult } from "lit";
import { DOMAIN, ENABLED, TIME_FORMATS } from "../const";
import { entityName, fire, select, type Config, type HomeAssistant } from "../ha";
import { controlOf, CONTROLS } from "../machine/controls";
import { changedFor, deviceOf, phaseNow, type Camera, type Device } from "../machine/device";
import { lookColor, lookKind, lookName, lookOf } from "../machine/overlays";
import { CROP_ROLES } from "../machine/roles";
import { cardOf, displayField, XtoolFeature, type FeatureForm } from "./base";
import { HOLD_TIME, PENDING_TARGETS, TAP_SLOP, TARGETS } from "./field";
import { keyOf, shows, type Item } from "./keys";
import { ITEM_MIN } from "./rows";
import { dimmable, inputOf, LightRow, lightPart, lightPartName, lightParts, OFF_AT_MINIMUM, showSlides, slideOf } from "./slides";
import { FEATURE_CSS, LIGHT_CSS } from "./styles";

const CAMERA_VIEWS: [string, string][] = [["auto", "Auto"], ["live", "Live"]];

// The crop preset of a crop chosen on the camera's own (the P2's presets)
const CUSTOM_CROP = "custom";
// The longest a crop sent shows Cropping, should no picture of it arrive (ms)
const CROP_WAIT = 30000;

// The camera's controls that are Home Assistant's own features (and the
// close camera's light), among its keys: each only for a camera that has
// it, while that camera is shown
const CAMERA_INPUTS = ["mode", "crop", "exposure", ...lightParts("fill_light_close")];
// The camera's settings that are keys or fields, each only for a camera that
// has it, while that camera is shown: the deep camera's perspective, and the
// overview camera's thickness or distance and Measure (the P2's)
const CAMERA_SETTINGS = ["perspective", "thickness_or_distance", "measure_thickness_or_distance"];
// Controls chosen as one in the camera and kept side by side: the thickness
// or distance with Measure. The close fill light and its slider are chosen
// each on its own, and share a cell when both are chosen.
const CAMERA_PARTNERS: Record<string, string[]> = {
  thickness_or_distance: ["measure_thickness_or_distance"],
};
const unitOf = (id: string): string => Object.keys(CAMERA_PARTNERS).find((key) => CAMERA_PARTNERS[key].includes(id)) ?? id;
const PARTNERED = Object.values(CAMERA_PARTNERS).flat();

interface View { x: number; y: number; width: number; height: number }
interface Place { left: number; top: number }
type Crop = { width: number; height: number; center_x: number; center_y: number };
type Image = HTMLElement & {
  hass?: HomeAssistant; entity?: string; cameraImage?: string; cameraView?: string; fitMode?: string; updateComplete?: Promise<unknown>;
};

const CAMERA_CSS = `
  .shot {
    position: relative; display: block; width: 100%; padding: 0; border: 0; cursor: pointer;
    border-radius: var(--feature-border-radius, 12px); overflow: hidden; background: #111;
    margin-bottom: var(--ha-card-feature-gap, 12px);
  }
  .shot hui-image { display: block; }
  .shot.cropping { cursor: crosshair; }
  .shot .area {
    position: absolute; pointer-events: none; box-sizing: border-box;
    border: 2px solid ${ENABLED}; box-shadow: 0 0 0 1px rgba(0, 0, 0, .6), 0 0 0 100vmax rgba(0, 0, 0, .35);
  }
  .shot .area[hidden] { display: none; }
  .shot .hint {
    position: absolute; left: 0; right: 0; top: 0; padding: 6px 12px 16px; text-align: start; pointer-events: none;
    font-size: var(--ha-font-size-s, 12px); color: #fff; text-shadow: 0 1px 2px rgba(0, 0, 0, .9);
    background: linear-gradient(to bottom, rgba(0, 0, 0, .6), rgba(0, 0, 0, 0));
  }
  .shot .hint:empty { display: none; }
  .shot .time {
    position: absolute; left: 0; right: 0; bottom: 0; padding: 16px 12px 6px; text-align: start; pointer-events: none;
    font-size: var(--ha-font-size-s, 12px); color: #fff; text-shadow: 0 1px 2px rgba(0, 0, 0, .9);
    background: linear-gradient(to top, rgba(0, 0, 0, .6), rgba(0, 0, 0, 0));
  }
  .shot .time:empty { display: none; }
  .shot { touch-action: manipulation; -webkit-touch-callout: none; user-select: none; -webkit-user-select: none; }
  /* Where the laser goes: a dashed line from where it is to the target */
  .shot .target { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible; }
  .shot .target line, .shot .target circle { fill: none; stroke: var(--target-color, ${ENABLED}); stroke-width: 2; vector-effect: non-scaling-stroke; }
  .shot .target .path { stroke-dasharray: 6 5; }
  .shot .target .now { fill: var(--target-color, ${ENABLED}); }
  /* The overlays the card draws (see _drawLooks) */
  .shot .looks { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; overflow: hidden; }
  .shot .looks * { fill: none; vector-effect: non-scaling-stroke; stroke-linecap: round; }
  .shot .looks .label {
    fill: #fff; stroke: rgba(0, 0, 0, .85); stroke-width: 3px; paint-order: stroke; text-anchor: middle;
    font-size: var(--ha-font-size-s, 12px); font-weight: bold;
  }
  .shot .marks { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
  .shot .marks ha-icon { position: absolute; transform: translate(-50%, -50%); display: flex; filter: drop-shadow(0 0 1px rgba(0, 0, 0, .9)); }
  .row:empty { display: none; }
  /* The controls below the picture, in cells of two columns (see _layout),
     as far apart as Home Assistant's feature grid sets features: its column
     gap, which it hands its features as --feature-column-gap */
  .row.sections {
    display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); height: auto;
    row-gap: var(--ha-card-feature-gap, 12px);
    column-gap: var(--feature-column-gap, var(--ha-card-feature-column-gap, var(--ha-card-feature-gap, 12px)));
  }
  .sections > .line { min-width: 0; }
  .sections > .line.whole, .sections > .spacer { grid-column: 1 / -1; }
  .sections > .line.first { grid-column-start: 1; }
  /* Every camera's controls in the top row: each half narrows its items rather than dropping any */
  .sections > .line.squeeze > *, .sections > .line.squeeze > .group > * { min-width: 0 !important; }
  /* Within a cell, keys are as far apart as in any feature */
  .sections > .line { column-gap: var(--feature-button-spacing, 12px); }
  .sections > .spacer { height: calc(var(--rows) * var(--feature-height, 42px) + (var(--rows) - 1) * var(--ha-card-feature-gap, 12px)); }
  .line > *, .line > .group > * { height: var(--feature-height, 42px); }
`;

export class XtoolCameras extends XtoolFeature {
  static override label = "Cameras";
  static override pickerName = "xTool cameras";
  // The keys to switch cameras (one for each, or one that steps to the next),
  // Custom crop, the camera's settings and its inputs; all but the camera
  // toggle by default
  static override controls = ["camera_buttons", "camera_toggle", "custom_crop", ...CAMERA_SETTINGS, ...CAMERA_INPUTS];
  static override defaults = ["camera_buttons", "custom_crop", ...CAMERA_SETTINGS, ...CAMERA_INPUTS];
  static override form = { label: "Controls", options: [OFF_AT_MINIMUM] };
  static override styles: CSSResultGroup = unsafeCSS(`${FEATURE_CSS}\n${CAMERA_CSS}\n${LIGHT_CSS}`);

  static override supports(device: Device): boolean {
    return device.cameras.length > 0;
  }

  /** What the device's cameras offer, in order, each setting named as its first camera's entity. */
  static override offered(device: Device, hass: HomeAssistant): { value: string; label: string }[] {
    const { cameras, profile } = device;
    const offered: { value: string; label: string }[] = [];
    if (cameras.length > 1) offered.push({ value: "camera_buttons", label: "Camera buttons" }, { value: "camera_toggle", label: "Camera toggle" });
    if (cameras.some((camera) => profile.cropReset[camera.key] && CROP_ROLES.every((role) => camera.settings[role]))) {
      offered.push({ value: "custom_crop", label: "Custom crop" });
    }
    // A partner is chosen with its control (see CAMERA_PARTNERS)
    for (const id of [...CAMERA_SETTINGS, ...CAMERA_INPUTS].filter((id) => !PARTNERED.includes(id))) {
      const { light, part } = lightPart(id) ?? {};
      const entityId = cameras.map((camera) => camera.settings[light ?? id]).find(Boolean);
      if (!entityId || (part === "brightness" && !dimmable(hass, entityId))) continue;
      const name = entityName(hass, entityId) ?? (CONTROLS[light ?? id].name as string);
      offered.push({ value: id, label: lightPartName(name, part ?? "icon") ?? id });
    }
    return offered;
  }

  /**
   * The camera's form: with more than one camera, its controls in two
   * lists, as the feature shows them: All cameras (in place on a camera
   * switch) and Per camera (swapped with the camera). Saved as one list,
   * All cameras first.
   */
  static override editor(hass: HomeAssistant, entityId?: string): FeatureForm {
    const device = deviceOf(hass, entityId);
    const { cameras } = device;
    const ids = cameras.map((camera) => camera.id);
    const base = super.editor(hass, entityId);
    const split = cameras.length > 1;
    const every = (id: string) => XtoolCameras.everyCamera(device, hass, id);
    const [controlsField] = (base.schema as Config[]).filter((f) => f.name === "controls");
    const listOf = (name: string, label: string, helper: string, keep: (id: string) => boolean) => ({
      ...controlsField, name, label, helper,
      selector: { select: { ...controlsField.selector.select, options: controlsField.selector.select.options.filter((o: Config) => keep(o.value)) } },
    });
    const controlsFields = split ? [
      listOf("all_cameras", "All cameras", "These stay in place when you switch cameras.", every),
      listOf("per_camera", "Per camera", "Each shows only with the camera that has it.", (id) => !every(id)),
    ] : [controlsField];
    return {
      schema: [
        {
          name: "camera", label: "Camera",
          selector: { select: { mode: "dropdown", options: cameras.map((camera) => ({ value: camera.id, label: entityName(hass, camera.entityId) ?? camera.label })) } },
        },
        {
          name: "camera_view", label: "Camera view",
          helper: "Auto: snapshots that Home Assistant refreshes. Live: the camera's stream.",
          selector: select(CAMERA_VIEWS),
        },
        ...controlsFields,
        displayField(),
        // Off at minimum, as in xTool lights, while a camera's light has a slider to choose
        ...(controlsField.selector.select.options.some((o: Config) => lightPart(o.value)?.part === "brightness")
          ? (base.schema as Config[]).filter((f) => f.name === OFF_AT_MINIMUM.name) : []),
        {
          name: "show_last_updated", label: "Show the last updated time",
          helper: "In the Auto view, along the bottom of the picture, in the card's Time format (under Content).",
          selector: { boolean: {} },
        },
        {
          name: "full_width", label: "Full width",
          helper: "The features sit beside the title in two columns. On: the picture stretches across both. Off: it takes one column, and the next feature sits beside it.",
          selector: { boolean: {} },
        },
      ],
      data: (c) => {
        const data: Config = {
          camera: ids.includes(c.camera) ? c.camera : ids[0], camera_view: c.camera_view === "live" ? "live" : "auto",
          ...base.data(c), show_last_updated: c.show_last_updated !== false, full_width: c.full_width !== false,
        };
        if (!split) return data;
        const { controls, ...rest } = data;
        return { ...rest, all_cameras: controls.filter(every), per_camera: controls.filter((id: string) => !every(id)) };
      },
      save: (data) => {
        if (!split) return data;
        const { all_cameras: all = [], per_camera: per = [], ...rest } = data;
        return { ...rest, controls: [...all, ...per] };
      },
    };
  }

  /** Whether a camera has a control. */
  static has(device: Device, hass: HomeAssistant | undefined, camera: Camera, id: string): boolean {
    const { cameras, profile } = device;
    if (id === "camera_buttons" || id === "camera_toggle") return cameras.length > 1;
    if (id === "custom_crop") return !!profile.cropReset[camera.key] && CROP_ROLES.every((role) => camera.settings[role]);
    const { light, part } = lightPart(id) ?? {};
    const role = controlOf(light ?? id)?.role;
    const entityId = role ? camera.settings[role] : undefined;
    return !!entityId && (part !== "brightness" || dimmable(hass, entityId));
  }

  /** Whether every camera has a control, with its partners: it stays in place on a camera switch. */
  static everyCamera(device: Device, hass: HomeAssistant | undefined, id: string): boolean {
    return device.cameras.every((camera) => [id, ...(CAMERA_PARTNERS[id] ?? [])].every((part) => XtoolCameras.has(device, hass, camera, part)));
  }

  private _shot: HTMLButtonElement;
  private _target: SVGSVGElement;
  private _looks: SVGSVGElement;
  private _marks: HTMLElement;
  private _time: HTMLElement;
  private _area: HTMLElement;
  private _hint: HTMLElement;
  private _slides = new Map<string, HTMLElement>();
  private _lights = new Map<string, LightRow>();
  // The sections' cells, made once and kept (see _layout)
  private _cells: HTMLElement[] = [];
  private _spacer?: HTMLElement;
  private _sizer: ResizeObserver;
  private _laidOutAt?: number;
  private _keyItems: Element[] = [];
  private _keysKey?: string;
  private _image?: Image;
  private _watchedRoot?: ShadowRoot;
  private _stamp?: HTMLElement & Config;
  private _loading = false;
  private _camera?: string;
  private _picked?: string;
  private _pictureAt?: Date;
  private _cropping = false;
  private _first?: Place & { x: number; y: number };
  private _cropSent?: { before: string; changed: boolean; timer: ReturnType<typeof setTimeout> };
  private _presets = new Map<string, string>();
  private _down?: { x: number; y: number };
  private _tapped?: number;
  private _held = false;
  private _holding?: ReturnType<typeof setTimeout>;
  private _shapesDrawn?: string;
  private _iconsDrawn?: string;
  private _onTarget = () => this._drawTarget();

  constructor() {
    super();
    this._shot = document.createElement("button");
    this._shot.type = "button";
    this._shot.className = "shot";
    this._shot.innerHTML = `<svg class="looks"></svg><span class="marks"></span><span class="area" hidden></span><svg class="target" style="display: none">
        <line class="path"></line><circle class="now" r="3"></circle>
        <g class="reticle"><circle r="14"></circle><circle r="4"></circle>
          <line x1="-22" y1="0" x2="-8" y2="0"></line><line x1="8" y1="0" x2="22" y2="0"></line>
          <line x1="0" y1="-22" x2="0" y2="-8"></line><line x1="0" y1="8" x2="0" y2="22"></line></g>
      </svg><span class="hint"></span><span class="time"></span>`;
    this._target = this._shot.querySelector(".target")!;
    this._looks = this._shot.querySelector(".looks")!;
    this._marks = this._shot.querySelector(".marks")!;
    this._time = this._shot.querySelector(".time")!;
    this._area = this._shot.querySelector(".area")!;
    this._hint = this._shot.querySelector(".hint")!;
    // A tap is a pointer pressed and let go in about one place. On touch,
    // the browser then also sends mouse events and a click (iOS among
    // them, sometimes late or not at all): that click is the same tap, so
    // only a click without pointer events (a keyboard) is a tap of its own.
    // A press held in one place (see _aimable) sets the laser's position there
    this._shot.addEventListener("pointerdown", (ev) => {
      this._down = ev.button === 0 ? { x: ev.clientX, y: ev.clientY } : undefined;
      this._tapped = undefined;
      this._held = false;
      clearTimeout(this._holding);
      if (this._down && this._aimable()) {
        const at = { clientX: ev.clientX, clientY: ev.clientY };
        this._holding = setTimeout(() => {
          this._held = true;
          this._aim(at);
        }, HOLD_TIME);
      }
    });
    this._shot.addEventListener("pointerup", (ev) => {
      const down = this._down;
      this._down = undefined;
      clearTimeout(this._holding);
      if (!down || Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > TAP_SLOP) return;
      this._tapped = ev.timeStamp;
      // A hold is not a tap as well
      if (!this._held) this._tap(ev);
    });
    this._shot.addEventListener("pointercancel", () => {
      this._down = undefined;
      clearTimeout(this._holding);
    });
    // A long press does not open the browser's menu where a hold aims
    this._shot.addEventListener("contextmenu", (ev) => {
      if (this._aimable()) ev.preventDefault();
    });
    this._shot.addEventListener("click", (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      if (this._tapped !== undefined || this._held) {
        this._tapped = undefined;
        this._held = false;
        return;
      }
      this._tap(ev);
    });
    // After the first corner, the rectangle follows the pointer
    this._shot.addEventListener("pointermove", (ev) => {
      if (this._down && Math.hypot(ev.clientX - this._down.x, ev.clientY - this._down.y) > TAP_SLOP) clearTimeout(this._holding);
      if (this._first) this._showArea(this._first, this._placeOf(ev));
    });
    // Sections depend on the feature's width: laid out again when it changes
    this._sizer = new ResizeObserver(() => {
      if (this.clientWidth !== this._laidOutAt) this._layout();
      this._drawTarget();
    });
    this._sizer.observe(this);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    TARGETS.addEventListener("change", this._onTarget);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    TARGETS.removeEventListener("change", this._onTarget);
  }

  /**
   * Home Assistant's image stops fetching photos when the connection to
   * Home Assistant drops, and after it returns does not start again while
   * it stays on screen (its spinner shows for good). A camera that was
   * unavailable can leave it on its broken picture. Either way, the image
   * is made anew.
   */
  override set hass(hass: HomeAssistant) {
    const before = this._hass;
    super.hass = hass;
    if (before && !changedFor(before, hass, this._entityId)) return;
    if (before && this._image) {
      const camera = this._image.cameraImage!;
      const back = before.connected === false && hass.connected !== false;
      const returned = before.states[camera]?.state === "unavailable" && hass.states[camera] && hass.states[camera].state !== "unavailable";
      if (back || returned) this._dropImage();
    }
    // The crop sent has reached Home Assistant (or the camera put another in
    // its place): Cropping shows until a picture of it arrives (see _arrived)
    if (this._cropSent && JSON.stringify(this._cropNow()) !== this._cropSent.before) this._cropSent.changed = true;
    this._showCamera();
    this._drawTarget();
  }

  override get hass(): HomeAssistant | undefined {
    return this._hass;
  }

  override setConfig(config: Config): void {
    super.setConfig(config);
    this._showCamera();
  }

  protected override render(): TemplateResult {
    const buttons = this._buttons();
    const colors = this._prepare(buttons);
    this._showNothing(this._device.cameras.length === 0);
    // The keys, kept to be shown with the inputs in the order chosen (see _layout)
    const key = JSON.stringify([buttons.map(({ action, entities, ...b }) => (b.field ? { field: b.field } : b)), colors, this._display()]);
    if (key !== this._keysKey) {
      this._keysKey = key;
      this._keyItems = buttons.map((b, i) => (b.field ? this._group(b.field).el : this._keyElement(b, colors[i])));
    }
    for (const b of buttons) if (b.field) this._group(b.field).update(b);
    return html`${this._shot}<div class="row sections" role="group" aria-label=${this._type.label}></div>`;
  }

  protected override updated(): void {
    // The entities' icons follow their states without drawing the keys again
    for (const icon of this.renderRoot.querySelectorAll<HTMLElement & Config>("ha-state-icon[data-entity]")) {
      icon.hass = this._hass;
      icon.stateObj = this._hass!.states[icon.dataset.entity!];
    }
    this._layout();
  }

  /** A key as an element of its own, to be placed in a cell. */
  private _keyElement(b: Item, color: string | null): Element {
    const holder = document.createElement("div");
    render(this._button(b, color), holder);
    return holder.firstElementChild!;
  }

  private get _row(): HTMLElement | null {
    return this.renderRoot?.querySelector<HTMLElement>(".row.sections") ?? null;
  }

  /** A tap on the picture: while Crop is on it marks a corner (and never opens the camera); otherwise it opens the camera. */
  private _tap(ev: { clientX: number; clientY: number }): void {
    if (!this._camera) return;
    if (this._cropping && this._crop()) this._cropTap(ev);
    else fire(this, "hass-more-info", { entityId: this._camera });
  }

  /**
   * Whether a hold on the picture sets the laser's position: the laser has
   * the position numbers, and the shown camera has a Laser target overlay,
   * so its crop is in the laser's mm (as the target preview draws it).
   */
  private _aimable(): boolean {
    const { laser_x: x, laser_y: y } = this._device?.roles ?? {};
    return !!x && !!y && !!this._shownCamera?.overlays.some((o) => o.key === "overlay_laser_target")
      && [x, y].every((id) => this._usable(id));
  }

  /** Set the position numbers to the held point (whole mm, within their limits); Move then takes the laser there. */
  private _aim(at: { clientX: number; clientY: number }): void {
    const view = this._viewNow();
    const point = view && this._pointOf(at, view);
    if (!point) return;
    const { laser_x: x, laser_y: y } = this._device.roles;
    for (const [entityId, value] of [[x, point.x], [y, point.y]] as [string, number][]) {
      const { min = -Infinity, max = Infinity } = this._hass!.states[entityId]?.attributes ?? {};
      this._hass!.callService("number", "set_value", { entity_id: entityId, value: Math.min(max, Math.max(min, Math.round(value))) });
    }
  }

  /**
   * The laser's way to a position being set (the P2's): from where the head
   * is (the position numbers' position attribute) to the target (the
   * position being slid, or set and waiting for Move), in mm; undefined
   * when no position is being set.
   */
  private _targetNow(): { from: number[]; to: number[] } | undefined {
    const { laser_x: x, laser_y: y } = this._device.roles;
    if (!x || !y) return undefined;
    const sx = this._hass!.states[x], sy = this._hass!.states[y];
    const pending = PENDING_TARGETS.get(`${x}|${y}`);
    if (!pending && !sx?.attributes.waiting && !sy?.attributes.waiting) return undefined;
    const to = pending ?? [Number(sx?.state), Number(sy?.state)];
    const from = [Number(sx?.attributes.position ?? sx?.state), Number(sy?.attributes.position ?? sy?.state)];
    return [...to, ...from].every(Number.isFinite) ? { from, to } : undefined;
  }

  /**
   * The target on the picture, while the position is being set and the
   * shown camera's Laser target overlay is on: a reticle at the target,
   * joined to where the head is by a dashed line, all in the laser target's
   * color, placed by the camera's view (see _viewNow).
   */
  private _drawTarget(): void {
    if (!this._ready() || !this._target) return;
    this._drawLooks();
    const camera = this._shownCamera;
    const overlay = camera?.overlays.find((o) => o.key === "overlay_laser_target");
    const view = overlay && this._hass!.states[overlay.entityId]?.state === "on" ? this._viewNow() : undefined;
    const way = view && this._targetNow();
    const from = way && this._placeOfMm(way.from, view!), to = way && this._placeOfMm(way.to, view!);
    if (!from || !to) {
      this._target.style.display = "none";
      return;
    }
    const line = this._target.querySelector(".path")!;
    for (const [name, value] of Object.entries({ x1: from.left, y1: from.top, x2: to.left, y2: to.top })) line.setAttribute(name, String(value));
    const now = this._target.querySelector(".now")!;
    now.setAttribute("cx", String(from.left));
    now.setAttribute("cy", String(from.top));
    this._target.querySelector(".reticle")!.setAttribute("transform", `translate(${to.left} ${to.top})`);
    // In the laser target's color
    const own = lookOf(cardOf(this)?.config?.overlay_styles, lookName(overlay!.key));
    this._target.style.setProperty("--target-color", lookColor(own, this._hass!.states[overlay!.entityId]?.attributes.style));
    this._target.style.display = "";
  }

  /**
   * The overlays the card draws, over the picture: while the shown camera's
   * switch for one is on, and either the camera's Overlays select gives
   * them to the card or the card's Overlay styles change its style. Each
   * where its switch's position attribute says, in its style attribute's
   * style with the card's own options over it (line and size in screen
   * pixels), placed with the camera's crop. Drawn again only when changed.
   */
  private _drawLooks(): void {
    const hass = this._hass!;
    const camera = this._shownCamera, shown = camera && this._viewNow();
    const view = shown && this._onPicture(shown);
    const styles = cardOf(this)?.config?.overlay_styles;
    const byCard = hass.states[camera?.settings.overlays ?? ""]?.state === "card";
    const { laser_x: hx, laser_y: hy } = this._device.roles;
    let head: number[] | undefined = [hx, hy].map((id) => Number(hass.states[id]?.attributes.position ?? hass.states[id]?.state));
    if (!head.every(Number.isFinite)) head = undefined;
    let shapes = "", icons = "";
    for (const overlay of view ? camera!.overlays : []) {
      const stateObj = hass.states[overlay.entityId], kind = lookKind(stateObj);
      const own = lookOf(styles, lookName(overlay.key));
      if (!kind || stateObj.state !== "on" || (!byCard && !Object.keys(own).length)) continue;
      const given = stateObj.attributes.style ?? {};
      const color = lookColor(own, given);
      const line = Number(own.line ?? (given.line ?? 2) * view!.pxPerPixel);
      const size = Number(own.size ?? (given.size ?? 0) * view!.pxPerMm);
      const icon = String(own.icon ?? given.icon ?? "").replace(/[^\w:-]/g, "");
      const dash = ({ dashed: `${3 * line} ${2 * line}`, dotted: `0 ${2 * line}` } as Record<string, string>)[own.style ?? given.style] ?? "none";
      const stroke = `stroke="${color}" stroke-width="${line}" stroke-dasharray="${dash}"`;
      const at = (x: number, y: number) => view!.place(x, y);
      const mark = (p: Place) => {
        if (icon && size > 0) icons += `<ha-icon icon="${icon}" style="left:${p.left}px;top:${p.top}px;color:${color};--mdc-icon-size:${size}px"></ha-icon>`;
      };
      for (const m of stateObj.attributes.position[kind] ?? []) {
        if (kind === "areas") {
          const { x, y, width: w, height: h } = m, a = at(x, y), b = at(x + w, y + h);
          shapes += `<rect x="${a.left}" y="${a.top}" width="${b.left - a.left}" height="${b.top - a.top}" ${stroke}/>`;
          mark(a);
          mark(at(x + w / 2, y + h / 2));
        } else if (kind === "slats") {
          const { x0, y0, x1, y1, label } = m, a = at(x0, y0), b = at(x1, y1);
          shapes += `<line x1="${a.left}" y1="${a.top}" x2="${b.left}" y2="${b.top}" ${stroke}/>`;
          if (label) shapes += `<text class="label" x="${b.left}" y="${Math.min(b.top, view!.height) - 4}">${String(label).replace(/[<&]/g, "")}</text>`;
        } else if (kind === "close") {
          mark(at(m.x, m.y));
        } else if (kind === "target") {
          // Where the head is now (the position numbers, read with every
          // update of the laser), as the move preview draws it; the
          // attribute's is the picture's, which is older
          const [x, y] = head ?? [m.x, m.y];
          mark(at(x, y));
        } else {
          // A turned ellipse whose inside is the dot's size
          const { x, y, length, width, angle = 0 } = m, c = at(x, y);
          const rx = (length * view!.pxPerMm + line) / 2, ry = (width * view!.pxPerMm + line) / 2;
          shapes += `<ellipse cx="${c.left}" cy="${c.top}" rx="${rx}" ry="${ry}" transform="rotate(${angle} ${c.left} ${c.top})" ${stroke}/>`;
        }
      }
    }
    if (shapes !== this._shapesDrawn) this._looks.innerHTML = this._shapesDrawn = shapes;
    if (icons !== this._iconsDrawn) this._marks.innerHTML = this._iconsDrawn = icons;
  }

  /**
   * The area the shown camera's picture shows (mm): the camera's view
   * attribute (the P2's, for any crop), or else its crop numbers (the F2's
   * cameras, which have no view attribute); undefined while not known, or
   * with a side of the crop left whole.
   */
  private _viewNow(): View | undefined {
    const view = this._hass!.states[this._shownCamera?.entityId ?? ""]?.attributes.view;
    if (view) return view.width > 0 && view.height > 0 ? view : undefined;
    const crop = this._cropNow();
    if (!crop || !(crop.width > 0) || !(crop.height > 0)) return undefined;
    return { x: crop.center_x - crop.width / 2, y: crop.center_y - crop.height / 2, width: crop.width, height: crop.height };
  }

  /**
   * How an area's mm fall on the picture box: place(x, y) in px (as
   * _pointOf reads a point), the box's height, and the picture's scale (px
   * per mm, and per pixel of the picture as sent); undefined without a picture.
   */
  private _onPicture(view: View) {
    const img = this._image?.shadowRoot?.querySelector("img");
    if (!img?.naturalWidth) return undefined;
    const box = img.getBoundingClientRect(), shot = this._shot.getBoundingClientRect();
    const ratio = shot.width / this._shot.offsetWidth || 1;
    const scale = Math.max(box.width / img.naturalWidth, box.height / img.naturalHeight);
    const shownW = img.naturalWidth * scale, shownH = img.naturalHeight * scale;
    const left = box.left - shot.left + (box.width - shownW) / 2, top = box.top - shot.top + (box.height - shownH) / 2;
    return {
      place: (x: number, y: number): Place => ({
        left: (left + (x - view.x) / view.width * shownW) / ratio,
        top: (top + (y - view.y) / view.height * shownH) / ratio,
      }),
      height: shot.height / ratio,
      pxPerMm: shownW / view.width / ratio,
      pxPerPixel: scale / ratio,
    };
  }

  /** A point on the work surface (mm) in the picture box (px); undefined without a picture. */
  private _placeOfMm([x, y]: number[], view: View): Place | undefined {
    return this._onPicture(view)?.place(x, y);
  }

  /**
   * A chosen control's items for the camera shown: its keys, or its input
   * (Home Assistant's own feature, or the light's icon or slider, as in
   * xTool lights). An input whose entity has no value to show (unknown, or
   * a select's state that is not one of its options) is left out: Home
   * Assistant would draw it blank.
   */
  private _itemsOf(id: string): Element[] {
    const camera = this._shownCamera;
    if (!CAMERA_INPUTS.includes(id)) return this._keyItems.filter((key) => (key as HTMLElement).dataset.control === id);
    if (!camera) return [];
    const { light, part } = lightPart(id) ?? {};
    const control = controlOf(light ?? id)!;
    const entityId = camera.settings[control.role];
    if (!entityId || !shows(this._hass!.states[entityId])) return [];
    if (light) {
      if (!this._lights.has(entityId)) this._lights.set(entityId, new LightRow(this, entityId, control));
      const row = this._lights.get(entityId)!;
      row.update();
      return part === "icon" ? (row.icon ? [row.icon] : []) : row.slide.hidden ? [] : [row.slide];
    }
    const slide = slideOf(this._slides, entityId, inputOf(control));
    (slide.firstChild as HTMLElement & Config).hass = this._hass;
    return [slide];
  }

  private _has(camera: Camera, id: string): boolean {
    return XtoolCameras.has(this._device, this._hass, camera, id);
  }

  /**
   * The size of controls' items as a line shows them: their least width
   * (gaps included), the shares of the line they grow by (a slider or
   * select two), and how many there are.
   */
  private _sizeOf(ids: string[], gap: number): { min: number; grow: number; count: number } {
    const items = ids.flatMap((id): [number, number][] => {
      if (id === "camera_buttons") return this._device.cameras.map(() => [ITEM_MIN.key, 1]);
      if (id === "thickness_or_distance") return [[ITEM_MIN.field, 1]];
      if (!CAMERA_INPUTS.includes(id)) return [[ITEM_MIN.key, 1]];
      const { light, part } = lightPart(id) ?? {};
      if (light) return [part === "icon" ? [ITEM_MIN.key, 1] : [ITEM_MIN.slider, 2]];
      return [[inputOf(controlOf(id)!).type === "select-options" ? ITEM_MIN.select : ITEM_MIN.slider, 2]];
    });
    return {
      min: items.reduce((sum, [min]) => sum + min, 0) + Math.max(0, items.length - 1) * gap,
      grow: items.reduce((sum, [, grow]) => sum + grow, 0),
      count: items.length,
    };
  }

  /**
   * The chosen controls below the picture, in a grid of two columns, so a
   * camera switch moves nothing that stays:
   * - Every camera: the units every camera has, first, never moving: with
   *   more than one camera, the top row alone, in the order chosen, split
   *   between its two halves.
   * - Shown camera: the units only some cameras have, after them, swapped
   *   as a whole for the camera shown.
   * A unit is a control with its partners, in the order chosen. Each unit is
   * a cell, a row of its own (see fitRow): half the width, or the whole
   * width when it does not fit in half. Keys next to keys, and inputs next
   * to inputs, share a cell while they fit in half. The camera's own cells
   * take as many rows as the camera with the most (an empty space below the
   * fewer), so nothing below the feature moves. When the every-camera cells
   * leave the right half of their last row free and each camera's own
   * controls fit in one half, the shown camera's cell takes that half.
   */
  private _layout(): void {
    const box = this._row, full = this.clientWidth;
    if (!box || !full || !this._ready()) return;
    this._laidOutAt = full;
    const cameras = this._device.cameras;
    const gap = parseFloat(getComputedStyle(box).columnGap) || 0;
    const keyGap = parseFloat(getComputedStyle(box).getPropertyValue("--feature-button-spacing")) || 12;
    const half = (full - gap) / 2;
    const units: { key: string; ids: string[] }[] = [];
    for (const id of this._chosen()) {
      const key = unitOf(id);
      const unit = units.find((u) => u.key === key);
      if (unit) unit.ids.push(id);
      else units.push({ key, ids: [id] });
    }
    const everywhere = (unit: { ids: string[] }) => cameras.every((camera) => unit.ids.every((id) => this._has(camera, id)));
    // What shares a cell: keys with keys, inputs with inputs, a light's icon
    // with its own slider; a field keeps its own
    const kindOf = (ids: string[]) => {
      const light = ids.map((id) => lightPart(id)?.light).find(Boolean);
      return ids.includes("thickness_or_distance") ? "field" : light ? `light:${light}` : ids.some((id) => CAMERA_INPUTS.includes(id)) ? "input" : "keys";
    };
    type Cell = { ids: string[]; span: number; squeeze?: boolean };
    const cells = (list: string[][]): Cell[] => {
      const out: { kind: string; ids: string[] }[] = [];
      for (const ids of list) {
        const last = out.at(-1), kind = kindOf(ids);
        if (last && last.kind === kind && kind !== "field" && this._sizeOf([...last.ids, ...ids], keyGap).min <= half + 0.5) last.ids.push(...ids);
        else out.push({ kind, ids: [...ids] });
      }
      return out.map((cell) => ({ ids: cell.ids, span: this._sizeOf(cell.ids, keyGap).min <= half + 0.5 ? 1 : 2 }));
    };
    // With more than one camera, every camera's controls take the top row
    // alone, in the order chosen: split between its two halves where they
    // fit best, each half narrowing its items as needed (see .squeeze)
    const everyUnits = units.filter(everywhere).map((u) => u.ids);
    let every = cells(everyUnits);
    if (cameras.length > 1 && everyUnits.length > 1) {
      let best: { need: number; left: string[]; right: string[] } | undefined;
      for (let k = 1; k < everyUnits.length; k++) {
        const left = everyUnits.slice(0, k).flat(), right = everyUnits.slice(k).flat();
        const need = Math.max(this._sizeOf(left, keyGap).min, this._sizeOf(right, keyGap).min);
        if (!best || need < best.need) best = { need, left, right };
      }
      every = [{ ids: best!.left, span: 1, squeeze: true }, { ids: best!.right, span: 1, squeeze: true }];
    }
    const owns = cameras.map((camera) => cells(units.filter((u) => !everywhere(u)).map((u) => u.ids.filter((id) => this._has(camera, id))).filter((ids) => ids.length)));
    const mine = owns[cameras.findIndex((camera) => camera.entityId === this._camera)] ?? [];
    // The rows the cells take, as the grid places them (a whole-width cell after a half starts a row)
    const rowsOf = (list: { span: number }[]) => {
      let row = 0, col = 0;
      for (const { span } of list) {
        if (span === 2) {
          if (col) row += 1;
          row += 1;
          col = 0;
        } else if (++col === 2) {
          row += 1;
          col = 0;
        }
      }
      return row + (col ? 1 : 0);
    };
    const halfFree = every.length > 0 && rowsOf([...every, { span: 1 }]) === rowsOf(every);
    const share = halfFree && owns.every((own) => own.length <= 1 && (own[0]?.span ?? 1) === 1);
    const spare = share ? 0 : Math.max(0, ...owns.map((own) => rowsOf(own))) - rowsOf(mine);
    const lines: HTMLElement[] = [...every, ...mine].map((cell, i) => {
      const line = this._cells[i] ??= Object.assign(document.createElement("div"), { className: "row line" });
      line.classList.toggle("whole", cell.span === 2);
      line.classList.toggle("squeeze", !!cell.squeeze);
      // The shown camera's controls start a row of their own, unless they share the free half
      line.classList.toggle("first", i === every.length && !share);
      const items = cell.ids.flatMap((id) => this._itemsOf(id));
      showSlides(line, items);
      // A cell with a field lays its keys out as a field's row does (flow)
      line.classList.toggle("flow", items.some((item) => item.classList.contains("group")));
      return line;
    });
    if (spare) {
      this._spacer ??= Object.assign(document.createElement("div"), { className: "spacer" });
      this._spacer.style.setProperty("--rows", String(spare));
      lines.push(this._spacer);
    }
    showSlides(box, lines);
    this._fitter.fit([...box.children].filter((line): line is HTMLElement => line.classList.contains("line")));
  }

  /** Show another camera. */
  private _pick(entityId: string): void {
    this._picked = entityId;
    this._keysKey = undefined;
    this._refresh();
  }

  /** Remove the image: taken off the page, Home Assistant's image stops fetching (and closes a live stream). */
  private _dropImage(): void {
    this._image?.remove();
    this._image = undefined;
    this._watchedRoot = undefined;
  }

  private get _view(): string {
    return this._config?.camera_view === "live" ? "live" : "auto";
  }

  /** The camera shown, or undefined. */
  private get _shownCamera(): Camera | undefined {
    return this._device.cameras.find((camera) => camera.entityId === this._camera);
  }

  override _chosen(): string[] {
    return [...new Set(super._chosen().flatMap((id) => [id, ...(CAMERA_PARTNERS[id] ?? [])]))];
  }

  override _buttons(): Item[] {
    const moment = this._moment();
    const cameras = moment.device.cameras;
    const current = this._currentCamera(cameras);
    if (current !== this._camera) {
      this._camera = current;
      this._pictureAt = undefined;
      this._first = undefined;
      clearTimeout(this._cropSent?.timer);
      this._cropSent = undefined;
      this._area.hidden = true;
      // Crop starts on when the camera shows a crop of its own (see _ownCrop)
      this._cropping = this._ownCrop();
      this._showCamera();
    }
    this._notePreset();
    const camera = this._shownCamera;
    const nameOf = ({ entityId, label }: Camera) => entityName(moment.hass, entityId) ?? `${label} camera`;
    const keys: Record<string, () => Item[]> = {
      // A key for each camera
      camera_buttons: () => (cameras.length < 2 ? [] : cameras.map((c) => ({
        key: c.entityId, entity: c.entityId, label: nameOf(c), text: c.label,
        pressed: c.entityId === current, disabled: !this._usable(c.entityId), action: () => this._pick(c.entityId),
      }))),
      // One key for the camera shown: a tap shows the next one that can be shown
      camera_toggle: () => {
        if (cameras.length < 2) return [];
        const at = cameras.findIndex((c) => c.entityId === current);
        const next = [...cameras.slice(at + 1), ...cameras.slice(0, at)].find((c) => this._usable(c.entityId));
        const shown = cameras[at];
        return [{
          key: "camera_toggle", entity: shown.entityId, text: shown.label,
          label: next ? `${nameOf(shown)}. Tap for ${nameOf(next)}` : nameOf(shown), pressed: false, disabled: !next,
          action: () => next && this._pick(next.entityId),
        }];
      },
      // On: taps on the picture choose a crop of its own, until it is
      // turned off or another camera is shown. Off: the camera's crop
      // returns to its preset (off while the crop numbers are not known)
      custom_crop: () => {
        if (!this._cropReset || !camera || !CROP_ROLES.every((role) => camera.settings[role])) return [];
        const usable = this._usable(current) && !!this._crop();
        const on = usable && !!this._cropping;
        return [{
          key: "custom_crop", label: on ? "Custom crop: on. Tap two corners on the picture; tap again to go back" : "Custom crop",
          text: "Crop", icon: "mdi:crop",
          pressed: on, disabled: !usable, action: () => this._toggleCropping(),
        }];
      },
      // The deep camera's perspective
      perspective: () => {
        const entityId = camera?.settings.perspective;
        const key = entityId && keyOf(this, controlOf("perspective")!, entityId, moment);
        return key ? [key] : [];
      },
      // The overview camera's thickness or distance, in a field, and Measure
      thickness_or_distance: () => {
        const entityId = camera?.settings.thickness_or_distance;
        return entityId ? [{ key: "thickness_or_distance", field: "thickness_or_distance", entities: [entityId] }] : [];
      },
      measure_thickness_or_distance: () => {
        const entityId = camera?.settings.measure_thickness_or_distance;
        const key = entityId && keyOf(this, controlOf("measure_thickness_or_distance")!, entityId, moment);
        return key ? [key] : [];
      },
    };
    // Each key knows its control, for the order chosen (see _itemsOf)
    return this._chosen().flatMap((id) => (keys[id]?.() ?? []).map((key) => ({ ...key, control: id })));
  }

  /** The area the shown camera's Crop key returns to, or undefined. */
  private get _cropReset(): Crop | undefined {
    return this._device.profile.cropReset[this._shownCamera?.key ?? ""];
  }

  /**
   * The shown camera's crop now (mm), when a tap on its picture crops it:
   * Crop is chosen, and the camera has the crop numbers and a crop area.
   */
  private _crop(): Crop | undefined {
    if (!this._cropReset || !this._chosen().includes("custom_crop")) return undefined;
    return this._cropNow();
  }

  /** The shown camera's crop numbers now (mm), or undefined while any is not known. */
  private _cropNow(): Crop | undefined {
    const camera = this._shownCamera;
    if (!camera) return undefined;
    const crop: Record<string, number> = {};
    for (const role of CROP_ROLES) {
      const entityId = camera.settings[role];
      if (!entityId) return undefined;
      const value = Number(this._hass!.states[entityId]?.state);
      if (!Number.isFinite(value)) return undefined;
      crop[role.slice(5)] = value;
    }
    return crop as Crop;
  }

  /** Whether a crop is in effect: not the camera's whole crop area. */
  private _cropped(crop: Crop): boolean {
    return Object.entries(this._cropReset ?? {}).some(([side, value]) => crop[side as keyof Crop] !== value);
  }

  /**
   * Whether the shown camera shows a crop of its own (not a preset): with
   * crop presets (the P2's), its preset is Custom; without (the F2 Ultra
   * UV's), its crop is not its whole area.
   */
  private _ownCrop(): boolean {
    const preset = this._shownCamera?.settings.crop;
    if (preset) return this._hass!.states[preset]?.state === CUSTOM_CROP;
    const crop = this._crop();
    return !!crop && this._cropped(crop);
  }

  /** Remember each camera's last crop preset (not Custom): Crop goes back to it. */
  private _notePreset(): void {
    for (const camera of this._device.cameras) {
      const stateObj = this._hass!.states[camera.settings.crop ?? ""];
      const state = stateObj?.state;
      if (state && state !== CUSTOM_CROP && shows(stateObj)) this._presets.set(camera.entityId, state);
    }
  }

  /** A point's place in the picture box (px). */
  private _placeOf(ev: { clientX: number; clientY: number }): Place {
    const box = this._shot.getBoundingClientRect();
    return { left: ev.clientX - box.left, top: ev.clientY - box.top };
  }

  /** The rectangle between two places in the picture box. */
  private _showArea(a: Place, b: Place): void {
    Object.assign(this._area.style, {
      left: `${Math.min(a.left, b.left)}px`, top: `${Math.min(a.top, b.top)}px`,
      width: `${Math.abs(b.left - a.left)}px`, height: `${Math.abs(b.top - a.top)}px`,
    });
    this._area.hidden = false;
  }

  /** The tapped point on the work surface (mm), or undefined off the picture. */
  private _pointOf(ev: { clientX: number; clientY: number }, view: View): (Place & { x: number; y: number }) | undefined {
    const img = this._image?.shadowRoot?.querySelector("img");
    if (!img?.naturalWidth) return undefined;
    const box = img.getBoundingClientRect();
    // The picture fills its box (cover): find the part of it that is shown
    const scale = Math.max(box.width / img.naturalWidth, box.height / img.naturalHeight);
    const shownW = img.naturalWidth * scale, shownH = img.naturalHeight * scale;
    const u = (ev.clientX - box.left - (box.width - shownW) / 2) / shownW;
    const v = (ev.clientY - box.top - (box.height - shownH) / 2) / shownH;
    if (u < 0 || u > 1 || v < 0 || v > 1) return undefined;
    return { x: view.x + u * view.width, y: view.y + v * view.height, ...this._placeOf(ev) };
  }

  // First tap: a corner; second tap: the opposite corner, which sets the crop
  private _cropTap(ev: { clientX: number; clientY: number }): void {
    const crop = this._crop();
    // A crop on its way: taps wait for it
    if (this._cropSent) return;
    const view = crop && this._viewNow();
    const point = view && this._pointOf(ev, view);
    if (!point) return;
    if (!this._first) {
      this._first = point;
      this._showArea(point, point);
      this._showHint();
      return;
    }
    const first = this._first;
    this._first = undefined;
    this._area.hidden = true;
    this._showHint();
    const width = Math.abs(point.x - first.x), height = Math.abs(point.y - first.y);
    if (!width || !height) return;
    // Until a picture with the new crop arrives, the hint says it is
    // cropping (at most CROP_WAIT, should the crop never take effect)
    this._cropSent = { before: JSON.stringify(crop), changed: false, timer: setTimeout(() => this._cropDone(), CROP_WAIT) };
    this._showHint();
    this._sendCrop({
      width: Math.round(width), height: Math.round(height),
      center_x: Math.round((point.x + first.x) / 2), center_y: Math.round((point.y + first.y) / 2),
    });
  }

  /**
   * Off: turn on, and taps on the picture choose a crop. On: turn off, and
   * the camera goes back to its crop preset (the last one it showed; the
   * first of its presets if it showed none), or, without presets, to its
   * whole area.
   */
  private _toggleCropping(): void {
    // The crop now (the key can be older than the numbers)
    const crop = this._crop();
    if (!this._cropping) {
      this._cropping = true;
      this._showHint();
      this._keysKey = undefined;
      this._refresh();
      return;
    }
    this._stopCropping();
    const preset = this._shownCamera?.settings.crop;
    if (preset) {
      const stateObj = this._hass!.states[preset];
      const option = this._presets.get(this._camera!) ?? stateObj?.attributes.options?.find((o: string) => o !== CUSTOM_CROP);
      if (option && option !== stateObj?.state) this._hass!.callService("select", "select_option", { entity_id: preset, option });
    } else if (crop && this._cropped(crop)) {
      this._sendCrop(this._cropReset!);
    }
  }

  /** The crop sent is shown (or was given up on): taps choose a crop again. */
  private _cropDone(): void {
    clearTimeout(this._cropSent?.timer);
    this._cropSent = undefined;
    this._showHint();
  }

  private _stopCropping(): void {
    this._cropping = false;
    this._cropDone();
    this._first = undefined;
    this._area.hidden = true;
    this._showHint();
    this._keysKey = undefined;
    this._refresh();
  }

  private _sendCrop(crop: Crop): void {
    (this._hass!.callService as (...args: unknown[]) => unknown)(DOMAIN, "camera", {
      crop_width: crop.width, crop_height: crop.height, crop_center_x: crop.center_x, crop_center_y: crop.center_y,
    }, { entity_id: this._camera });
  }

  private _showHint(): void {
    const crop = this._cropping ? this._crop() : undefined;
    this._shot.classList.toggle("cropping", !!crop);
    this._hint.textContent = !crop ? "" : this._cropSent ? "Cropping" : this._first ? "Tap the opposite corner of the custom crop area"
      : "Tap a corner to start selection of a crop area";
  }

  private _currentCamera(cameras: Camera[]): string | undefined {
    const ids = cameras.map((camera) => camera.entityId);
    if (this._picked && ids.includes(this._picked)) return this._picked;
    const configured = cameras.find((camera) => camera.id === this._config!.camera)?.entityId;
    return configured ?? ids[0];
  }

  private _showCamera(): void {
    if (!this._hass || !this._config || !this._camera) return;
    if (!customElements.get("hui-image")) {
      // Loaded with Home Assistant's picture cards: ask the card helpers for one
      if (!this._loading) {
        this._loading = true;
        const camera = this._camera;
        window.loadCardHelpers?.()
          .then((helpers) => helpers.createCardElement({ type: "picture-entity", entity: camera, camera_image: camera }))
          .then(() => customElements.whenDefined("hui-image"))
          .then(() => {
            this._loading = false;
            this._showCamera();
          });
      }
      return;
    }
    // One Home Assistant image, for the camera shown, as its picture cards
    // have: it fetches a new photo every 10 s while it is on screen (or
    // streams, in the Live view); another camera gets an image of its own
    if (this._image?.cameraImage !== this._camera) {
      this._dropImage();
      this._image = document.createElement("hui-image") as Image;
      Object.assign(this._image, { entity: this._camera, cameraImage: this._camera, fitMode: "cover" });
      this._shot.prepend(this._image);
    }
    if (this._image.hass !== this._hass) this._image.hass = this._hass;
    if (this._image.cameraView !== this._view) this._image.cameraView = this._view;
    this._showHint();
    this._shot.setAttribute("aria-label", `${this._shownCamera?.label ?? ""} camera: ${this._cropping ? "crop" : "open"}`);
    this._watchPictures();
    this._showTime();
  }

  // The time shown is when the latest picture arrived in Home Assistant's image
  private _watchPictures(): void {
    const root = this._image?.shadowRoot;
    if (!root) {
      Promise.resolve(this._image?.updateComplete).then(() => this._image?.shadowRoot && this._watchPictures());
      return;
    }
    if (this._watchedRoot === root) return;
    this._watchedRoot = root;
    root.addEventListener("load", () => this._arrived(), true);
  }

  /** A picture has arrived for the shown camera. */
  private _arrived(): void {
    // The first picture after the crop changed shows it: cropping is done
    if (this._cropSent?.changed) this._cropDone();
    this._drawTarget();
    // While the laser is off or asleep it takes no photos: a picture that
    // loads then is an old one Home Assistant still serves, so the time
    // stays when the last one arrived while it could take one
    if (["off", "sleeping"].includes(phaseNow(this._hass, this._entityId))) return;
    this._pictureAt = new Date();
    this._showTime();
  }

  /**
   * The last updated time along the bottom of the picture (an option, for
   * the Auto view): Home Assistant's timestamp display, the element the tile
   * card shows times with, in the tile card's time formats.
   */
  private _showTime(): void {
    const shown = this._config?.show_last_updated !== false && this._view === "auto" && this._pictureAt;
    if (!shown) {
      this._time.replaceChildren();
      return;
    }
    const chosen = cardOf(this)?.config?.time_format;
    this._stamp ??= document.createElement("hui-timestamp-display") as HTMLElement & Config;
    this._stamp.hass = this._hass;
    this._stamp.ts = this._pictureAt;
    this._stamp.format = TIME_FORMATS.includes(chosen) ? chosen : undefined;
    if (this._stamp.parentNode !== this._time) this._time.replaceChildren("Updated ", this._stamp);
  }
}
