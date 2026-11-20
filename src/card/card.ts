// The xTool card: Home Assistant's tile card, wrapped. The tile card still
// draws the name, state, actions and features. The card adds the state
// picture in place of the icon, the status and connection badges, the
// status light, the progress edge, an optional xTool style, and showing or
// hiding the features with a tap.
import { html, LitElement, nothing, type TemplateResult } from "lit";
import { cssColor, EDITOR_TYPE, ENABLED, formatDuration, phaseColor } from "../const";
import { adopt, findAllDeep, findDeep, sameValues, sheetOf, StatesProvider, type Config, type HassEntity, type HomeAssistant } from "../ha";
import { SAFETY_CHECKS } from "../machine/controls";
import { changedFor, deviceOf, statusOf } from "../machine/device";
import { lightOf, phaseOf, type Profile } from "../machine/models";
import { colorsChanged } from "../features/base";
import { TARGETS } from "../features/field";
import { FEATURE_TAGS } from "../features";
import { XtoolControls, XtoolJob } from "../features/keyed";
import { featurePlaces, featureRadius } from "./layout";
import { CHANNEL_PAD, DEFAULT_FEATURES_STYLE, DEFAULT_PATTERN, FEATURES_STYLES, FLAT, glassReflections, LOOKS, STYLES, TONE, WINDOW_MARGIN, type Look } from "./looks";
import {
  BADGE_RING, BAR_DIRECTION, DEFAULT_FEATURES_POSITION, defaultStatusBadges, EDGES, innerTileConfig, minimal, PART_ATTRIBUTES, PREVIEW_OPEN,
  PROGRESS_DEFAULTS, progressOptions, sensorAttributes, statesWith, styleOf, tileConfig, TRACK, xtoolStatusSensors,
} from "./options";
import { reducedMotion, statePicture } from "./picture";
import { cardStyles, HA_CONTROL_SHEET, LIGHT_SHEET } from "./styles";

type Tile = HTMLElement & {
  setConfig(config: Config): void; hass?: HomeAssistant; preview?: boolean; layout?: string;
  getGridOptions?(): Config; updateComplete?: Promise<unknown>;
};

interface Job {
  phase: string;
  value?: number;
  working: boolean;
  started?: number;
  taskTime: number;
  profile: Profile;
}

interface Badge { icon?: string; stateObj?: HassEntity; color: string; label: string }

/** Check a configuration as the card takes it; throws for one it cannot show. */
function checkConfig(config: Config): void {
  if (!config?.entity) throw new Error("Choose an xTool entity, such as the laser's Status sensor");
  if (config.style !== undefined && !STYLES.some(([id]) => id === config.style)) throw new Error(`Unknown style: ${config.style}`);
  if (config.features_style !== undefined && !FEATURES_STYLES.some(([id]) => id === config.features_style)) {
    throw new Error(`Unknown features_style: ${config.features_style}`);
  }
  if (config.progress_edge !== undefined && (typeof config.progress_edge !== "object" || Array.isArray(config.progress_edge))) {
    throw new Error("progress_edge must be a set of options, such as edge: top");
  }
  const edge = progressOptions(config).edge;
  if (!EDGES.some(([id]) => id === edge)) throw new Error(`Unknown progress edge: ${edge}`);
}

/**
 * Home Assistant's own toggle feature, in Console: a slide with a beveled
 * tab. This styles parts inside Home Assistant's controls; if an update
 * renames them, they keep their usual look.
 */
let haControlSheet: CSSStyleSheet | undefined;
function styleHaControl(control: Element, on: boolean): void {
  const root = control.shadowRoot;
  if (!root) return;
  haControlSheet ??= sheetOf(HA_CONTROL_SHEET);
  adopt(root, haControlSheet);
  control.toggleAttribute("xtool-slide", on);
}

/**
 * The control Home Assistant draws for one of its own features shown inside
 * this card's (the fill light's slider): the feature element inside
 * hui-card-feature, and the control inside that.
 */
function haControlOf(slide: Element): Element {
  let el: Element | null = slide.querySelector("hui-card-feature");
  for (let depth = 0; depth < 2 && el?.shadowRoot; depth++) {
    const next = [...el.shadowRoot.children].find((c) => c.localName !== "style");
    if (!next) break;
    el = next;
  }
  return el ?? slide;
}

let lightSheet: CSSStyleSheet | undefined;
let plainSheet: CSSStyleSheet | undefined;

export class XtoolCard extends LitElement {
  static override styles = cardStyles;

  // The configuration as given, and as shown (with the style worked out)
  private _ownConfig?: Config;
  private _config?: Config;
  private _hass?: HomeAssistant;
  private _tile?: Tile;
  private _open = false;
  private _wasOff?: boolean;
  private _preview?: boolean;
  private _layoutValue?: string;
  private _tapAt?: { x: number; y: number };
  private _job?: Job;
  private _started?: number;
  private _content?: string;
  private _timer?: ReturnType<typeof setInterval>;
  private _statesProvider = new StatesProvider(this);
  private _resize = new ResizeObserver(() => this._layout());
  // The tile card's hass: the card's entity with the state picture and the job's attributes (see _innerHass)
  private _picture?: string;
  private _pictureKey?: string;
  private _lastPicture?: string;
  private _sourceState?: HassEntity;
  private _lastExtra?: Record<string, string>;
  private _innerState?: HassEntity;
  private _innerFor?: HassEntity;
  private _outerHass?: HomeAssistant;
  private _inner?: HomeAssistant;
  private _windowSheet?: CSSStyleSheet;
  private _observed = new WeakSet<Node>();
  private _mutations?: MutationObserver;
  private _areasTimer?: ReturnType<typeof setTimeout>;
  private _areasKey?: string;
  private _placeTimer?: ReturnType<typeof setTimeout>;
  private _placedGroup?: Element;
  private _placedKey?: string;
  private _settling = false;
  private _settleUntil = 0;
  private _badgeRetry = false;

  static getConfigElement(): HTMLElement {
    return document.createElement(EDITOR_TYPE);
  }

  /**
   * A new card: the first xTool laser in Home Assistant, with Job and
   * Controls where the laser has controls for them; every other option at
   * its default.
   */
  static getStubConfig(hass: HomeAssistant): Config {
    const entity = xtoolStatusSensors(hass)[0];
    if (!entity) return { entity: "" };
    const device = deviceOf(hass, entity);
    const features = [XtoolJob, XtoolControls].filter((f) => f.supports(device, hass)).map((f) => ({ type: `custom:${f.type}` }));
    return minimal({ entity, ...(features.length ? { features } : {}) }, hass);
  }

  /** The card's configuration, with its style worked out. */
  get config(): Config | undefined {
    return this._config;
  }

  setConfig(config: Config): void {
    checkConfig(config);
    // Unless one is chosen, the laser model's style, once Home Assistant is known (see set hass)
    this._config = { ...config, style: styleOf(config, this._hass) };
    this._ownConfig = config;
    // The cameras draw the overlays in the card's Overlay styles
    TARGETS.dispatchEvent(new Event("change"));
    this._open = config.collapsible === false ? true
      : this._preview ? PREVIEW_OPEN.get(config.entity) ?? true : this._storedOpen() ?? config.expanded_at_load === true;
    this._wasOff = undefined;
    const tile = innerTileConfig(this._config, this._open, this._hass);
    if (this._tile) {
      this._tile.setConfig(tile);
    } else if (customElements.get("hui-tile-card")) {
      this._createTile(tile);
    } else {
      // The tile card is loaded on demand; the card helpers load it
      window.loadCardHelpers?.().then(async (helpers) => {
        helpers.createCardElement({ type: "tile", entity: tile.entity });
        await customElements.whenDefined("hui-tile-card");
        if (!this._tile && this._config) this._createTile(innerTileConfig(this._config, this._open, this._hass));
      });
    }
    this._picture = undefined;
    // Everything is shown anew for the new configuration
    const hass = this._hass;
    this._hass = undefined;
    if (hass) this.hass = hass;
    this._refresh();
  }

  private _createTile(config: Config): void {
    const tile = document.createElement("hui-tile-card") as Tile;
    tile.classList.add("tile");
    tile.setConfig(config);
    if (this._preview !== undefined) tile.preview = this._preview;
    if (this._layoutValue !== undefined) tile.layout = this._layoutValue;
    this._tile = tile;
    if (this._hass) this._setTileHass(this._hass);
    this._refresh();
  }

  /** The tile card gets the changed hass, and so does the states context inside the card. */
  private _setTileHass(hass: HomeAssistant): void {
    const inner = this._innerHass(hass);
    this._statesProvider.states = inner.states;
    this._tile!.hass = inner;
  }

  set hass(hass: HomeAssistant) {
    const before = this._hass;
    this._hass = hass;
    if (!this._config) return;
    if (before?.themes !== hass.themes) colorsChanged();
    // The model's style, when none is chosen, can be known only now
    const style = styleOf(this._ownConfig, hass);
    const restyled = style !== this._config.style;
    if (restyled) this._config = { ...this._config, style };
    // Nothing of this laser changed: the tile and its features have nothing new to show
    if (this._tile && !changedFor(before, hass, this._config.entity)) {
      if (restyled) this._refresh();
      return;
    }
    // The default State content follows the laser's entities
    const content = JSON.stringify(tileConfig(this._config, hass).state_content);
    if (this._tile && content !== this._content) this._tile.setConfig(innerTileConfig(this._config, this._open, hass));
    this._content = content;
    this._job = this._jobState(hass);
    this._followPower(this._job.phase === "off");
    if (this._tile) this._setTileHass(hass);
    this._tick();
    this._refresh();
  }

  get hass(): HomeAssistant | undefined {
    return this._hass;
  }

  /** Draw now once on the page: the card shows a new state as soon as it is handed it, as Home Assistant's cards do. */
  private _refresh(): void {
    this.requestUpdate();
    if (this.hasUpdated && this.isConnected) this.performUpdate();
  }

  // Dashboard properties the tile card uses. In the editor's preview and
  // while the dashboard is edited, the card starts expanded and changes only
  // when tapped (see PREVIEW_OPEN); when the edit ends, it returns to how it
  // is shown on the dashboard
  set preview(value: boolean) {
    const was = this._preview;
    this._preview = value;
    if (this._tile) this._tile.preview = value;
    if (!this._config || this._config.collapsible === false || !value === !was) return;
    this._setOpen(value ? PREVIEW_OPEN.get(this._config.entity) ?? true : this._dashboardOpen(), false);
  }

  get preview(): boolean | undefined {
    return this._preview;
  }

  set layout(value: string) {
    this._layoutValue = value;
    if (this._tile) this._tile.layout = value;
  }

  get layout(): string | undefined {
    return this._layoutValue;
  }

  /** Whether the card is expanded on the dashboard: as last tapped, else as set, and collapsed while the machine is off when it follows the power. */
  private _dashboardOpen(): boolean {
    if (this._wasOff && this._config!.collapse_when_powered_off !== false) return false;
    return this._storedOpen() ?? this._config!.expanded_at_load === true;
  }

  getCardSize(): number {
    // A camera picture is about five rows tall; every other feature is one
    const features: Config[] = this._config?.features ?? [];
    const rows = features.reduce((sum, f) => sum + (f?.type === "custom:xtool-cameras" ? 5 : 1), 0);
    return 1 + (this._open === false ? 0 : rows);
  }

  /**
   * The tile card's columns, and a height that follows the content (rows:
   * auto): a camera's picture grows with the width, a collapsible card's
   * features come and go, and the features take the rows their layout
   * needs. A fixed row count would leave a taller cell than the content,
   * and the tile card would share the spare height out above the title.
   */
  getGridOptions(): Config {
    const options: Config = { ...(this._tile?.getGridOptions?.() ?? { columns: 6 }), rows: "auto" };
    delete options.min_rows;
    return options;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.isUpdatePending && this._config) this.performUpdate();
    this._layout();
    this._tick();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearInterval(this._timer);
    this._timer = undefined;
  }

  protected override render(): TemplateResult | typeof nothing {
    if (!this._config) return nothing;
    return html`<div class="frame" @pointerdown=${this._pointerDown} @ll-custom=${this._toggle}>
        <div class="clip under"><div id="body"></div><div id="window"></div><div id="areas"></div></div>
        ${this._tile ?? nothing}
        <div class="clip over"><div id="edge"><div class="sweep"></div></div><span id="pct"></span></div>
        <span class="badge status" role="img"><ha-state-icon aria-hidden="true"></ha-state-icon></span>
        <span class="badge connection" role="img"><ha-state-icon aria-hidden="true"></ha-state-icon></span>
      </div>`;
  }

  protected override firstUpdated(): void {
    this._resize.observe(this._frame!);
  }

  protected override updated(): void {
    this._frame?.classList.toggle("off", this._job?.phase === "off");
    this._updateBadges();
    this._updateLight();
    this._updateEdge();
    this._layout();
  }

  private get _frame(): HTMLElement | null {
    return this.renderRoot?.querySelector<HTMLElement>(".frame") ?? null;
  }

  private _part<T extends Element = HTMLElement>(selector: string): T {
    return this.renderRoot.querySelector<T>(selector)!;
  }

  // A tap on the card shows or hides the features (see innerTileConfig),
  // except a tap between the features, which reaches the card behind them
  private _pointerDown = (ev: PointerEvent): void => {
    this._tapAt = { x: ev.clientX, y: ev.clientY };
  };

  private _toggle = (ev: Event): void => {
    if ((ev as CustomEvent).detail?.xtool_card !== "toggle") return;
    ev.stopPropagation();
    const at = this._tapAt;
    this._tapAt = undefined;
    if (this._open && at && this._amongFeatures(at)) return;
    this._setOpen(!this._open);
  };

  /** True when a point is in one of the tile card's feature areas. */
  private _amongFeatures({ x, y }: { x: number; y: number }): boolean {
    return [...(this._tile?.shadowRoot?.querySelectorAll("hui-card-features") ?? [])].some((features) => {
      const box = features.getBoundingClientRect();
      return box.width > 0 && x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
    });
  }

  // Whether the features are shown is remembered in this browser, per laser
  private get _storageKey(): string {
    return `xtool-card:${this._config?.entity}`;
  }

  private _storedOpen(): boolean | undefined {
    try {
      const v = window.localStorage.getItem(this._storageKey);
      return v === null ? undefined : v === "1";
    } catch {
      return undefined;
    }
  }

  /**
   * A collapsible card follows the machine's power, each option on its own:
   * - Collapse when powered off: the card collapses when the machine turns
   *   off (or is off as the card loads).
   * - Expand when powered on: the card expands when the machine turns on.
   * An option that is off leaves the card as it is. The browser keeps the
   * choice made by a tap, not these.
   */
  private _followPower(off: boolean): void {
    const was = this._wasOff;
    this._wasOff = off;
    const c = this._config!;
    if (c.collapsible === false || off === was || this._preview) return;
    if (off && c.collapse_when_powered_off !== false && this._open) this._setOpen(false, false);
    else if (!off && was === true && c.expand_when_powered_on !== false && !this._open) this._setOpen(true, false);
  }

  private _setOpen(open: boolean, remember = true): void {
    this._open = open;
    if (this._preview) PREVIEW_OPEN.set(this._config!.entity, open);
    try {
      if (remember && !this._preview) window.localStorage.setItem(this._storageKey, open ? "1" : "0");
    } catch {
      // Storage can be unavailable (private windows); the card still works
    }
    if (this._tile) this._tile.setConfig(innerTileConfig(this._config!, open, this._hass));
    this._areasKey = undefined;
    this._layout();
  }

  /** The job as the card shows it: phase, progress (0 to 1), start time. */
  private _jobState(hass: HomeAssistant): Job {
    const id = this._config!.entity;
    const status = statusOf(hass, id);
    const statusObj = status ? hass.states[status] : undefined;
    const phase = phaseOf(statusObj?.state);
    const { roles, profile } = deviceOf(hass, id);
    const progressId = roles.progress;
    const raw = progressId ? Number(hass.states[progressId]?.state) : NaN;
    const value = Number.isFinite(raw) ? Math.max(0, Math.min(1, raw / 100)) : undefined;
    const working = phase === "processing" || phase === "paused";
    if (!working) this._started = undefined;
    else if (this._started === undefined) {
      // Counted from when the status last changed: the job's start, unless
      // the card first sees the job while it is paused
      const changed = Date.parse(statusObj?.last_changed ?? "");
      this._started = Number.isFinite(changed) ? changed : Date.now();
    }
    const taskTimeId = roles.task_time;
    const taskTime = taskTimeId ? Number(hass.states[taskTimeId]?.state) : NaN;
    return { phase, value, working, started: this._started, taskTime, profile };
  }

  /** The attributes for the tile card's State content (see JOB_ATTRIBUTES). */
  private _attributes(): Record<string, string> {
    const { phase, value, working, started, taskTime } = this._job!;
    const hass = this._hass!, entity = this._config!.entity;
    const extra = sensorAttributes(hass, entity);
    if (working && value !== undefined) extra.progress = `${Math.round(value * 100)} %`;
    if (working && started !== undefined) extra.elapsed = formatDuration((Date.now() - started) / 1000);
    if (phase === "finished" && Number.isFinite(taskTime)) extra.job_time = formatDuration(taskTime);
    const { roles } = deviceOf(hass, entity);
    for (const [name, role, onText, offText, otherwise] of PART_ATTRIBUTES) {
      const entityId = roles[role] ?? (otherwise ? roles[otherwise] : undefined);
      const state = entityId ? hass.states[entityId]?.state : undefined;
      if (state === "on") extra[name] = onText;
      else if (state === "off") extra[name] = offText;
    }
    return extra;
  }

  /**
   * The Home Assistant object the tile card sees: the same, except that the
   * card's entity has the state picture and the job's attributes. The
   * changed state object is reused until any of them changes.
   */
  private _innerHass(hass: HomeAssistant): HomeAssistant {
    const entity = this._config?.entity;
    const stateObj = entity ? hass.states[entity] : undefined;
    if (!stateObj || !this._job) return hass;
    const { phase, profile, started } = this._job;
    const pictureKey = `${phase}|${profile.laser}|${profile.galvo}|${started}|${this._config!.style}|${reducedMotion()}`;
    if (pictureKey !== this._pictureKey || !this._picture) {
      this._pictureKey = pictureKey;
      this._picture = statePicture(phase, phaseColor(phase, profile.laser) ?? "", {
        galvo: profile.galvo, seed: started ?? 1, backing: this._config!.style !== "none", motion: !reducedMotion(),
      });
    }
    const extra = this._attributes();
    if (this._sourceState !== stateObj || this._lastPicture !== this._picture || !sameValues(this._lastExtra, extra)) {
      this._sourceState = stateObj;
      this._lastPicture = this._picture;
      this._lastExtra = extra;
      this._innerState = { ...stateObj, attributes: { ...stateObj.attributes, ...extra, entity_picture: this._picture } };
    }
    if (this._outerHass === hass && this._innerFor === this._innerState) return this._inner!;
    this._outerHass = hass;
    this._innerFor = this._innerState;
    this._inner = { ...hass, states: statesWith(hass.states, entity!, this._innerState!) };
    return this._inner;
  }

  /** While a job runs and State content shows its time, the time counts up each second. */
  private _tick(): void {
    const shown = ([] as string[]).concat(this._config?.state_content ?? []).includes("elapsed");
    const run = this.isConnected && shown && this._job?.phase === "processing";
    if (run && !this._timer) {
      this._timer = setInterval(() => {
        if (this._tile && this._hass) this._setTileHass(this._hass);
      }, 1000);
    } else if (!run && this._timer) {
      clearInterval(this._timer);
      this._timer = undefined;
    }
  }

  /**
   * What the status badge shows, or undefined: the first of the chosen
   * statuses, in the order chosen, that applies.
   */
  private _statusBadgeNow(): Badge | undefined {
    const hass = this._hass!, id = this._config!.entity;
    const chosen: string[] = Array.isArray(this._config!.status_badge) ? this._config!.status_badge : defaultStatusBadges(hass, id);
    const { roles } = deviceOf(hass, id);
    const stateOf = (role?: string) => (role && roles[role] ? hass.states[roles[role]]?.state : undefined);
    const phase = this._job!.phase;
    const error = "var(--error-color, #db4437)", warning = "var(--warning-color, #ffa600)";
    // The first safety check that is off: its own icon tells which
    const checkOff = SAFETY_CHECKS.find((role) => stateOf(role) === "off");
    // Each option: what applies now, as [applies, icon, color, label], most
    // urgent first. The icon is an entity's own (as Home Assistant shows it)
    // or, for a phase of the job, one of Home Assistant's icons
    type Option = [boolean, { icon?: string; entity?: string }, string, string];
    const options: Record<string, Option[]> = {
      alarm: [
        [phase === "fire", { icon: "mdi:fire" }, error, "Fire warning"],
        [phase === "overheat", { icon: "mdi:thermometer-alert" }, error, "Laser overheat"],
        [stateOf("alarm") === "on", { entity: roles.alarm }, error, "Alarm"],
        [phase === "error", { icon: "mdi:alert" }, error, "Alarm"],
      ],
      safety_key: [[stateOf("safety_key") === "off", { entity: roles.safety_key }, warning, "Safety key removed"]],
      lid: [[stateOf("lid") === "on", { entity: roles.lid }, warning, "Lid open"]],
      safety_checks: [[!!checkOff, { entity: checkOff && roles[checkOff] }, warning, "A safety check is off"]],
      firmware: [[stateOf("firmware") === "on", { entity: roles.firmware }, "var(--info-color, #039be5)", "Firmware update available"]],
    };
    for (const option of chosen) {
      const hit = (options[option] ?? []).find(([applies]) => applies);
      if (hit) return { icon: hit[1].icon, stateObj: hit[1].entity ? hass.states[hit[1].entity] : undefined, color: hit[2], label: hit[3] };
    }
    return undefined;
  }

  /**
   * What the connection badge shows, or undefined: Unavailable while the
   * Status entity is, otherwise how Home Assistant reaches the laser (its
   * Connection sensor), in the enabled color.
   */
  private _connectionBadgeNow(): Badge | undefined {
    if (this._config!.connection_badge === false) return undefined;
    const hass = this._hass!, id = this._config!.entity;
    const status = statusOf(hass, id);
    if (!status || hass.states[status]?.state === "unavailable") return { icon: "mdi:lan-disconnect", color: "#616161", label: "Unavailable" };
    // The Connection sensor's own icon (Ethernet, Wi-Fi, USB), as Home Assistant shows it
    const stateObj = hass.states[deviceOf(hass, id).roles.connection];
    if (!stateObj || ["unknown", "unavailable"].includes(stateObj.state)) return undefined;
    return { stateObj, color: ENABLED, label: `Connection: ${hass.formatEntityState(stateObj)}` };
  }

  private _updateBadges(): void {
    const ready = this._hass && this._job;
    const status = this._showBadge(this._part(".badge.status"), ready ? this._statusBadgeNow() : undefined);
    const connection = this._showBadge(this._part(".badge.connection"), ready ? this._connectionBadgeNow() : undefined);
    if (status || connection) this._placeBadges();
  }

  /** Show a badge (or hide it, for none); whether it shows. */
  private _showBadge(el: HTMLElement, badge?: Badge): boolean {
    el.classList.toggle("on", !!badge);
    if (!badge) {
      el.removeAttribute("aria-label");
      el.title = "";
      return false;
    }
    el.style.background = badge.color;
    // Home Assistant's state icon: the entity's own icon, or the icon given
    const icon = el.querySelector("ha-state-icon") as HTMLElement & Config;
    if (icon.hass !== this._hass) icon.hass = this._hass;
    if (icon.stateObj !== badge.stateObj) icon.stateObj = badge.stateObj;
    if (icon.icon !== badge.icon) icon.icon = badge.icon;
    el.title = badge.label;
    el.setAttribute("aria-label", badge.label);
    return true;
  }

  private get _badgesShown(): boolean {
    return !!this.renderRoot?.querySelector(".badge.on");
  }

  // The badges sit tucked in from the picture's edge, on a circle at
  // BADGE_RING of its radius: the status badge up and to the right, the
  // connection badge down and to the right
  private _placeBadges(): void {
    const icon = this._tile?.shadowRoot?.querySelector("ha-tile-icon");
    if (!icon) {
      if (this._tile && !this._badgeRetry) {
        this._badgeRetry = true;
        Promise.resolve(this._tile.updateComplete).then(() => {
          this._badgeRetry = false;
          if (this._tile?.shadowRoot?.querySelector("ha-tile-icon")) this._placeBadges();
        });
      }
      return;
    }
    const frameEl = this._frame!;
    const frame = frameEl.getBoundingClientRect(), box = icon.getBoundingClientRect();
    if (!box.width) return;
    const scale = frame.width / frameEl.offsetWidth || 1;
    const r = box.width / 2 / scale;
    const cx = (box.left - frame.left) / scale + r, cy = (box.top - frame.top) / scale + r;
    const ring = r * BADGE_RING;
    const status = this._part(".badge.status"), connection = this._part(".badge.connection");
    status.style.left = connection.style.left = `${cx + ring * .7071}px`;
    status.style.top = `${cy - ring * .7071}px`;
    connection.style.top = `${cy + ring * .7071}px`;
  }

  /** The machine's status light, as a ring around the state picture. */
  private _updateLight(): void {
    const tile = this._tile, root = tile?.shadowRoot;
    if (!tile || !root) return;
    lightSheet ??= sheetOf(LIGHT_SHEET);
    if (!adopt(root, lightSheet)) {
      console.warn("xTool card: could not draw the status light");
      return;
    }
    const entity = this._config!.entity;
    const status = this._hass ? statusOf(this._hass, entity) : undefined;
    const light = status && this._config!.status_light !== false
      ? lightOf(deviceOf(this._hass, entity).profile, this._hass!.states[status]?.state) : undefined;
    if (!light) {
      tile.removeAttribute("xtool-light");
      return;
    }
    tile.style.setProperty("--xtool-light", light[0]);
    tile.setAttribute("xtool-light", light[1]);
  }

  /** The progress edge, as configured, for the job's phase. */
  private _updateEdge(): void {
    const edge = this._part("#edge"), pct = this._part("#pct");
    const p = progressOptions(this._config);
    const job = this._job;
    const showWhile: string[] = Array.isArray(p.show_while) ? p.show_while : PROGRESS_DEFAULTS.show_while;
    edge.className = "";
    edge.removeAttribute("style");
    pct.className = "";
    if (!job || p.edge === "none" || !showWhile.includes(job.phase)) return;
    const value = job.phase === "finished" ? 1 : job.value;
    const determinate = value !== undefined;
    const color = this._edgeColor(p.color, job, value);
    const thickness = Math.max(1, Math.min(24, Number(p.thickness) || PROGRESS_DEFAULTS.thickness));
    const clamp = (v: unknown, d: number) => (Number.isFinite(Number(v)) ? Math.max(0, Math.min(100, Number(v))) : d);
    let start = clamp(p.starts_at, 0), end = clamp(p.ends_at, 100);
    if (start > end) [start, end] = [end, start];
    const counter = p.direction === "counterclockwise";
    edge.classList.add("on");
    if (!determinate) edge.classList.add("indeterminate");
    if (p.edge === "around") {
      edge.classList.add("around");
      edge.style.padding = `${thickness}px`;
      if (!determinate) {
        edge.style.background = color;
      } else {
        const deg = Math.round(value! * 36000) / 100;
        edge.style.background = counter
          ? `conic-gradient(from 0deg, ${TRACK} 0deg ${360 - deg}deg, ${color} ${360 - deg}deg 360deg)`
          : `conic-gradient(from 0deg, ${color} 0deg ${deg}deg, ${TRACK} ${deg}deg 360deg)`;
      }
    } else {
      const horizontal = p.edge === "top" || p.edge === "bottom";
      edge.classList.add(horizontal ? "horizontal" : "vertical");
      const place = ({
        top: `top: 0; left: 0; right: 0; height: ${thickness}px;`,
        bottom: `bottom: 0; left: 0; right: 0; height: ${thickness}px;`,
        left: `top: 0; bottom: 0; left: 0; width: ${thickness}px;`,
        right: `top: 0; bottom: 0; right: 0; width: ${thickness}px;`,
      } as Record<string, string>)[p.edge];
      const direction = BAR_DIRECTION[p.edge][counter ? "counterclockwise" : "clockwise"];
      // Rounded: 100 * 0.42 is 42.00000000000001 in floating point
      const stop = Math.round((start + (end - start) * (value ?? 0)) * 100) / 100;
      const background = determinate
        ? `linear-gradient(${direction}, ${TRACK} 0%, ${TRACK} ${start}%, ${color} ${start}%, ${color} ${stop}%, ${TRACK} ${stop}%, ${TRACK} 100%)`
        : TRACK;
      edge.style.cssText = `${place} background: ${background}; transition: background 3s linear;`;
      edge.querySelector<HTMLElement>(".sweep")!.style.background = color;
    }
    if (p.show_percentage && determinate) {
      pct.classList.add("on");
      pct.textContent = `${Math.round(value! * 100)}%`;
      pct.style.color = color;
    }
  }

  private _edgeColor(spec: string | undefined, job: Job, value?: number): string {
    if (spec === "thresholds" && value !== undefined) {
      if (value > 0.6) return "var(--success-color, #43a047)";
      if (value > 0.2) return "var(--warning-color, #ffa600)";
      return "var(--error-color, #db4437)";
    }
    if (!spec || spec === "state" || spec === "thresholds") return phaseColor(job.phase, job.profile.laser) ?? "";
    return cssColor(spec);
  }

  private _layout(): void {
    const frame = this._frame;
    if (!this._config || !frame) return;
    const style = this._config.style;
    const tone = TONE[style];
    const look: Look | undefined = LOOKS[style];
    frame.classList.toggle("styled", !!look);
    frame.classList.toggle("plain", !!look?.plain);
    // A number field is a pane of the window's glass (see the features' styles)
    for (const [name, value] of [["--xtool-field", look && "var(--xtool-glass)"], ["--xtool-field-opacity", look && "1"],
      ["--xtool-field-text", look?.ink], ["--xtool-field-edge", look && "var(--xtool-edge)"],
      ["--xtool-body", look?.body], ["--xtool-glass", look?.glass], ["--xtool-edge", look?.edge]] as [string, string | undefined][]) {
      if (value) frame.style.setProperty(name, value);
      else frame.style.removeProperty(name);
    }
    // The Enabled color, for every feature inside
    if (this._config.enabled_color) this.style.setProperty("--xtool-enabled-color", cssColor(this._config.enabled_color));
    else this.style.removeProperty("--xtool-enabled-color");
    if (tone) {
      const pattern = Number.isFinite(this._config.pattern) ? this._config.pattern : DEFAULT_PATTERN;
      this._part("#window").style.setProperty("--xtool-gloss", look.glare ? glassReflections(look.glare, pattern) : "none");
    }
    if (this._tile) {
      this._tile.classList.toggle("dark", tone === "dark");
      this._tile.classList.toggle("light", tone === "light");
      this._tile.classList.toggle("solid", !!tone && (this._config.features_style ?? DEFAULT_FEATURES_STYLE) !== "match");
      // For the space under the title row (see _styleWindowText)
      this._tile.style.setProperty("--xtool-channel-pad", `${CHANNEL_PAD[this._featuresStyle()]}px`);
      this._tile.style.setProperty("--xtool-window-margin", `${tone ? WINDOW_MARGIN : 0}px`);
      this._styleWindowText(look);
    }
    this._settle();
  }

  /** Lay out what the tile card's own layout decides: run again as it settles (see _drawAreas). */
  private _placeAll(): void {
    this._removeDividers();
    this._placeFeatures();
    this._clampCorners();
    this._drawWindow();
    this._drawAreas();
    if (this._badgesShown) this._placeBadges();
  }

  /**
   * Place the features below the title in the tile card's feature grid
   * (see featurePlaces), as inline grid places on Home Assistant's own
   * feature items. Only when the card's options call for it: otherwise the
   * grid is Home Assistant's as it is. The places are written after the
   * layout pass (they change the card's height), and only when they change.
   */
  private _placeFeatures(): void {
    const group = findAllDeep(this._tile?.shadowRoot, 'hui-card-features[slot="features"]')[0] as HTMLElement | undefined;
    const items = [...(group?.shadowRoot?.querySelectorAll<HTMLElement & { feature?: Config }>("hui-card-feature") ?? [])];
    const inline = (this._config!.features_position ?? DEFAULT_FEATURES_POSITION) === "inline";
    const lastWide = this._config!.last_feature_full_width !== false;
    const isCamera = (item: HTMLElement & { feature?: Config }) => item.feature?.type === "custom:xtool-cameras";
    const placed = inline && items.length > 0 && (!lastWide || items.some(isCamera));
    const gap = placed ? parseFloat(getComputedStyle(group!).rowGap) || 0 : 0;
    // A feature that shows nothing (Focus with the inner lens) takes no place
    const shown = items.filter((item) => item.style.display !== "none");
    const { places, rows } = placed
      ? featurePlaces(shown.map((item) => ({ tall: isCamera(item), full: isCamera(item) && item.feature!.full_width !== false, height: item.offsetHeight })), gap, lastWide)
      : { places: [], rows: [] };
    const key = JSON.stringify([places, rows, items.length - shown.length]);
    if (group === this._placedGroup && key === this._placedKey) return;
    clearTimeout(this._placeTimer);
    this._placeTimer = setTimeout(() => {
      this._placedGroup = group;
      this._placedKey = key;
      if (!group) return;
      // Two columns for one feature below the title that takes one
      group.style.gridTemplateColumns = places.some((p) => p.columns === 2) && group.getAttribute("columns") !== "2" ? "repeat(2, minmax(0, 1fr))" : "";
      group.style.gridTemplateRows = rows.includes("1fr") ? rows.join(" ") : "";
      for (const item of items) {
        const place = places[shown.indexOf(item)];
        item.style.gridColumn = place?.column ?? "";
        item.style.gridRow = place?.row ?? "";
        // Each feature as tall as itself, so the rows beside a picture
        // follow the features' own heights
        item.style.alignSelf = place ? "start" : "";
        if (place) item.style.setProperty("--feature-columns", `${place.columns}`);
        else item.style.removeProperty("--feature-columns");
      }
    }, 0);
  }

  /**
   * The title's text on the window, in the style's own colors, and the
   * space below the title row. This styles the tile card's title from
   * inside it; if Home Assistant renames that part, the title keeps the
   * body's text color.
   */
  private _styleWindowText(look?: Look): void {
    const root = this._tile?.shadowRoot;
    if (!root) return;
    this._windowSheet ??= new CSSStyleSheet();
    this._windowSheet.replaceSync(`
        /* Space between the title row and the features below it (none
           while collapsed, when no features show below): from the window's
           edge to the first patch or channel, the same as between two rows
           of them (the feature gap, less a pad on each side) */
        hui-card-features[slot="features"] {
          margin-top: calc(var(--ha-card-feature-gap, 12px) - var(--xtool-window-margin, 0px) - var(--xtool-channel-pad, 0px));
        }
        ${look ? `ha-tile-info { ${look.text}; }` : ""}`);
    if (!adopt(root, this._windowSheet)) console.warn("xTool card: could not style the title on the window");
  }

  /** A box in the card's own pixels (the card can be scaled in the editor). */
  private _box(el: Element): { x: number; y: number; w: number; h: number } | null {
    const frame = this._frame!;
    const origin = frame.getBoundingClientRect();
    const scale = origin.width / frame.offsetWidth || 1;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    return { x: (r.left - origin.left) / scale, y: (r.top - origin.top) / scale, w: r.width / scale, h: r.height / scale };
  }

  /**
   * The tile card's title row: its height when nothing stretches it (its
   * minimum, one row), and the middle of its icon, in the card's own pixels.
   */
  private _titleRow(): { height: number; middle: number } | null {
    const root = this._tile?.shadowRoot;
    const content = root && findDeep(root, "ha-tile-container")?.shadowRoot?.querySelector(".content");
    const icon = root && findDeep(root, "ha-tile-icon");
    const box = icon && this._box(icon);
    const height = content ? parseFloat(getComputedStyle(content).minHeight) : NaN;
    if (!box || !Number.isFinite(height) || !height) return null;
    return { height, middle: box.y + box.h / 2 };
  }

  /**
   * The window covers the title row (and any feature beside it); the body
   * shows below, behind the features. It is one row tall whatever the
   * card's height, 4 px inside the row's edges. Read from the tile card's
   * rendered layout; if it ever changes, the window covers the whole card.
   */
  private _drawWindow(): void {
    if (!TONE[this._config!.style]) return;
    const frame = this._frame!;
    const W = frame.offsetWidth, H = frame.offsetHeight;
    if (!W || !H) return;
    const margin = WINDOW_MARGIN;
    let top = margin, bottom = H - margin;
    const row = this._titleRow();
    if (row) {
      top = Math.max(margin, row.middle - row.height / 2 + margin);
      bottom = Math.min(H - margin, row.middle + row.height / 2 - margin);
    }
    Object.assign(this._part("#window").style, {
      left: `${margin}px`, top: `${top}px`, width: `${W - 2 * margin}px`, height: `${Math.max(0, bottom - top)}px`,
    });
  }

  /**
   * The card's corners: the theme's, but never rounder than half the title
   * row (one row of the tile card), so the card keeps the corners it shows
   * collapsed, however tall it is.
   */
  private _clampCorners(): void {
    const frame = this._frame!;
    const row = this._titleRow();
    frame.style.removeProperty("--ha-card-border-radius");
    if (!row) return;
    const themed = parseFloat(getComputedStyle(frame).borderTopLeftRadius);
    const half = row.height / 2;
    if (Number.isFinite(themed) && themed > half) frame.style.setProperty("--ha-card-border-radius", `${half}px`);
  }

  /**
   * The areas the feature controls take, in the card's own pixels: each
   * control, except that each button of this card's features counts on its
   * own, so the body shows between them.
   */
  private _featureAreas(): { x: number; y: number; w: number; h: number; radius: number }[] {
    const root = this._tile?.shadowRoot;
    if (!root) return [];
    const areas = [];
    for (const wrap of findAllDeep(root, "hui-card-feature")) {
      // The feature this card's fill light shows is measured with it
      if (FEATURE_TAGS.includes(((wrap.getRootNode() as ShadowRoot)?.host as Element | undefined)?.localName ?? "")) continue;
      this._watchAdded(wrap.shadowRoot);
      const inner = wrap.shadowRoot ?? wrap;
      const ours = findDeep(inner, FEATURE_TAGS.join(", "));
      this._watchAdded(ours?.shadowRoot);
      const keys = ours ? [...(ours.shadowRoot?.querySelectorAll(".key, .shot, .slide:not([hidden]), .field, ha-tile-icon") ?? [])] : [];
      const element = [...inner.children].find((c) => c.tagName !== "STYLE");
      for (const key of keys.length ? keys : [element]) {
        // A Home Assistant feature inside one of this card's: its own control
        const el = key?.classList?.contains("slide") ? haControlOf(key) : key;
        const b = el && this._box(el);
        if (!b) continue;
        // A tile icon is round; every other control has the features' corners
        areas.push({ ...b, radius: el.localName === "ha-tile-icon" ? b.h / 2 : featureRadius(el, b.h) });
      }
    }
    this._watchAdded(root);
    return areas;
  }

  /**
   * Home Assistant draws a vertical divider before each feature in a second
   * column. Taken out here, from inside the tile card's feature groups; if
   * Home Assistant renames that part, the dividers simply stay. The feature
   * beside the title also keeps a steady height.
   */
  private _removeDividers(): void {
    const root = this._tile?.shadowRoot;
    if (!root) return;
    plainSheet ??= sheetOf(`
      .divided { border-inline-start: none !important; margin-inline-start: 0 !important; padding-inline-start: 0 !important; }
      /* The feature beside the title keeps the height it has when the card
         is collapsed; the tile card would let it fill a taller row once
         features show below it */
      :host([slot="features-inline"]) { --feature-height: var(--ha-space-9, 36px) !important; }`);
    for (const group of findAllDeep(root, "hui-card-features")) {
      if (group.shadowRoot && !adopt(group.shadowRoot, plainSheet)) console.warn("xTool card: could not remove the feature dividers");
    }
  }

  // Console: this card's buttons become keys, and Home Assistant's toggle a slide
  private _styleControls(keys: boolean): void {
    const root = this._tile?.shadowRoot;
    if (!root) return;
    for (const el of findAllDeep(root, FEATURE_TAGS.join(", "))) el.toggleAttribute("xtool-console", keys);
    for (const el of findAllDeep(root, "ha-control-switch")) styleHaControl(el, keys);
  }

  // Draw again when elements are added in the tile card (features render late)
  private _watchAdded(root?: Node | null): void {
    if (!root || this._observed.has(root)) return;
    this._observed.add(root);
    this._mutations ??= new MutationObserver(() => {
      clearTimeout(this._areasTimer);
      this._areasTimer = setTimeout(() => this._layout(), 0);
    });
    this._mutations.observe(root, { childList: true, subtree: true });
  }

  /** The features style drawn: Match without an xTool style. */
  private _featuresStyle(): string {
    return TONE[this._config?.style] ? this._config!.features_style ?? DEFAULT_FEATURES_STYLE : "match";
  }

  private _drawAreas(): void {
    const style = this._featuresStyle();
    const box = this._part("#areas");
    this._styleControls(style === "console");
    if (style === "match") {
      box.replaceChildren();
      this._areasKey = undefined;
      return;
    }
    const pad = CHANNEL_PAD[style];
    const areas = this._featureAreas().map((b) => ({
      x: b.x - pad, y: b.y - pad, w: b.w + 2 * pad, h: b.h + 2 * pad,
      radius: Math.min(b.radius + pad, (b.h + 2 * pad) / 2),
    }));
    const key = style + JSON.stringify(areas.map((a) => [a.x, a.y, a.w, a.h, a.radius].map(Math.round)));
    if (key === this._areasKey) return;
    this._areasKey = key;
    box.style.setProperty("--flat", FLAT[this._config!.style] ?? "transparent");
    box.replaceChildren(...areas.map((a) => {
      const el = document.createElement("div");
      el.className = `area ${style}`;
      Object.assign(el.style, { left: `${a.x}px`, top: `${a.y}px`, width: `${a.w}px`, height: `${a.h}px`, borderRadius: `${a.radius}px` });
      return el;
    }));
  }

  /**
   * The tile card can move its features without changing size (fonts
   * loading, the editor preview opening): lay out now, and again for about
   * a second.
   */
  private _settle(): void {
    this._placeAll();
    this._settleUntil = performance.now() + 1200;
    if (this._settling) return;
    this._settling = true;
    const check = () => {
      if (performance.now() > this._settleUntil || !this.isConnected) {
        this._settling = false;
        return;
      }
      this._placeAll();
      setTimeout(check, 100);
    };
    setTimeout(check, 100);
  }
}
