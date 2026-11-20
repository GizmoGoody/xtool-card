// The card's editor: the laser (a device of the integration), the tile
// card's own editor without the options the card decides, and the card's
// own options under xTool.
import { css, html, LitElement, type TemplateResult } from "lit";
import { DOMAIN, ENABLED_COLOR, STATE_COLORS, TILE_EDITOR_TYPE } from "../const";
import { fire, select, StatesProvider, type Config, type HomeAssistant } from "../ha";
import { INTEGRATION, LOOK_OPTIONS, lookOf, overlayLooks, overlayStylesField, ownStyles } from "../machine/overlays";
import { DEFAULT_FEATURES_STYLE, FEATURES_STYLES, STYLES, TONE } from "../card/looks";
import {
  DEFAULT_FEATURES_POSITION, defaultStatusBadges, DIRECTIONS, EDGES, laserStatus, minimal, OWN_KEYS, PREVIEW_OPEN, PROGRESS_DEFAULTS,
  progressOptions, SHOW_WHILE, statusBadgesOf, styleOf, tileConfig, withJobAttributes, xtoolStatusSensors,
} from "../card/options";

// Tile card options this card sets itself, so they are left out of its editor:
// the laser is chosen above it (as a device), and the icon is the state picture
const HIDDEN_TILE_OPTIONS = ["entity", "icon", "show_entity_picture"];

function hideOptions(schema: Config[], entities?: string[]): Config[] {
  return schema
    .filter((item) => !HIDDEN_TILE_OPTIONS.includes(item.name))
    .map((item) => {
      if (Array.isArray(item.schema)) return { ...item, schema: hideOptions(item.schema, entities) };
      // The entity picker offers the lasers' status sensors
      if (item.name === "entity" && entities) return { ...item, selector: { entity: { include_entities: entities } } };
      return item;
    });
}

type TileEditor = HTMLElement & { hass?: HomeAssistant; lovelace?: unknown; xtoolEntities?: string[]; setConfig(config: Config): void };
type TileCard = { getConfigElement(): Promise<TileEditor> };

/**
 * The tile card's editor, with the options above left out. It is the tile
 * card's own editor class, so it keeps every future change to it. If a Home
 * Assistant update renames its form layout, the editor still works and
 * simply shows those options again.
 */
function tileEditorType(): string | null {
  if (customElements.get(TILE_EDITOR_TYPE)) return TILE_EDITOR_TYPE;
  const Base = customElements.get("hui-tile-card-editor") as (new () => TileEditor & { _schema?: unknown }) | undefined;
  if (!Base) return null;
  customElements.define(TILE_EDITOR_TYPE, class extends Base {
    constructor() {
      super();
      const original = this._schema;
      if (typeof original !== "function") return;
      let lastIn: unknown, lastKey: string | undefined, lastOut: unknown;
      this._schema = (...args: unknown[]) => {
        const schema = original.apply(this, args);
        const key = (this.xtoolEntities ?? []).join(",");
        if (schema !== lastIn || key !== lastKey) {
          lastIn = schema;
          lastKey = key;
          lastOut = Array.isArray(schema) ? hideOptions(schema, this.xtoolEntities) : schema;
        }
        return lastOut;
      };
    }
  });
  return TILE_EDITOR_TYPE;
}

const label = (s: Config) => s.label ?? s.title ?? s.name;
const helper = (s: Config) => s.helper;

export class XtoolCardEditor extends LitElement {
  static override styles = css`
    #tile { display: block; }
    #laser { display: block; margin-bottom: 24px; }
    ha-expansion-panel {
      display: block; margin-top: 24px;
      --expansion-panel-content-padding: 0;
      border-radius: var(--ha-border-radius-md, 8px);
      --ha-card-border-radius: var(--ha-border-radius-md, 8px);
    }
    ha-expansion-panel > [slot="header"] { margin: 0; font-size: inherit; font-weight: inherit; }
    .content { padding: 12px; display: grid; gap: 16px; }
    .row { display: flex; align-items: center; gap: 12px; }
  `;

  private _hass?: HomeAssistant;
  private _config?: Config;
  private _lovelace?: unknown;
  private _tileEditor?: TileEditor;
  private _loading?: Promise<void>;
  private _statesProvider = new StatesProvider(this);

  constructor() {
    super();
    // A new editor: its preview starts expanded
    PREVIEW_OPEN.clear();
  }

  set hass(hass: HomeAssistant) {
    this._hass = hass;
    this._setTileEditorHass();
    this._refresh();
  }

  get hass(): HomeAssistant | undefined {
    return this._hass;
  }

  set lovelace(lovelace: unknown) {
    this._lovelace = lovelace;
    if (this._tileEditor) this._tileEditor.lovelace = lovelace;
  }

  get lovelace(): unknown {
    return this._lovelace;
  }

  setConfig(config: Config): void {
    this._config = minimal(config, this._hass);
    this._setTileEditorHass();
    this._setTileEditorConfig();
    this._refresh();
    if (JSON.stringify(this._config) !== JSON.stringify(config)) this._fire();
  }

  /** Draw now once on the page: a change shows in the form as it is made. */
  private _refresh(): void {
    this.requestUpdate();
    if (this.hasUpdated && this.isConnected) this.performUpdate();
  }

  /** The tile editor gets Home Assistant's own hass (its action editors need all of it); the states context, which its State content picker reads, carries the card's attributes. */
  private _setTileEditorHass(): void {
    if (!this._hass) return;
    this._statesProvider.states = withJobAttributes(this._hass, this._config?.entity).states;
    if (this._tileEditor) this._tileEditor.hass = this._hass;
  }

  private async _setTileEditorConfig(): Promise<void> {
    this._loading ??= this._loadTileEditor();
    await this._loading;
    if (this._config) this._tileEditor?.setConfig(tileConfig(this._config, this._hass));
  }

  private async _loadTileEditor(): Promise<void> {
    const helpers = await window.loadCardHelpers!();
    helpers.createCardElement({ type: "tile", entity: this._config?.entity });
    await customElements.whenDefined("hui-tile-card");
    const original = await (customElements.get("hui-tile-card") as unknown as TileCard).getConfigElement();
    const type = tileEditorType();
    const editor = type ? document.createElement(type) as TileEditor : original;
    editor.id = "tile";
    editor.addEventListener("config-changed", (ev) => {
      // The tile card's options changed: keep ours and pass the whole card on
      ev.stopPropagation();
      const c = this._config!;
      const detail = (ev as CustomEvent).detail.config;
      const own = Object.fromEntries(OWN_KEYS.filter((k) => k in c).map((k) => [k, c[k]]));
      const next: Config = { ...detail, ...own, type: c.type };
      delete next.show_entity_picture; // always on: the state picture is shown there
      this._config = minimal(next, this._hass);
      this._fire();
      // Some of the card's options show only for some tile options (Features position)
      this._refresh();
      // The tile editor shows a change only once its configuration is handed back
      editor.setConfig(tileConfig(this._config, this._hass));
      if (detail.entity) this._setTileEditorHass();
    });
    editor.xtoolEntities = xtoolStatusSensors(this._hass);
    if (this._lovelace) editor.lovelace = this._lovelace;
    this._tileEditor = editor;
    this._setTileEditorHass();
    this._refresh();
  }

  protected override render(): TemplateResult {
    const c = this._config;
    const hass = this._hass;
    const style = c ? styleOf(c, hass) : "none";
    const styled = !!TONE[style];
    return html`
      <ha-form id="laser" .hass=${hass} .schema=${this._laserSchema()} .data=${{ device: c && hass?.entities?.[c.entity]?.device_id }}
        .computeLabel=${label} .computeHelper=${helper} @value-changed=${this._laserChanged}></ha-form>
      ${this._tileEditor ?? html`<div id="tile"></div>`}
      <ha-expansion-panel outlined expanded>
        <div slot="header" role="heading" aria-level="3">xTool</div>
        <div class="content">
          <ha-form id="style" .hass=${hass} .schema=${this._styleSchema()} .data=${{ style }}
            .computeLabel=${label} .computeHelper=${helper} @value-changed=${this._changed}></ha-form>
          <div class="row" id="row" style=${styled ? "" : "display: none"}><ha-button id="randomize" @click=${this._randomize}>Randomize reflections</ha-button></div>
          <ha-form id="form" .hass=${hass} .schema=${c ? this._schema(c, styled) : []} .data=${c ? this._data(c) : {}}
            .computeLabel=${label} .computeHelper=${helper} @value-changed=${this._changed}></ha-form>
        </div>
      </ha-expansion-panel>`;
  }

  private _laserSchema(): Config[] {
    return [{
      name: "device", label: "Laser", required: true,
      selector: { device: { integration: DOMAIN, entity: [{ integration: DOMAIN, domain: "sensor", device_class: "enum" }] } },
    }];
  }

  private _styleSchema(): Config[] {
    return [{
      name: "style", label: "xTool style",
      helper: "Defaults to your laser model's style. None follows your theme.",
      selector: select(STYLES),
    }];
  }

  private _schema(c: Config, styled: boolean): Config[] {
    return [
      ...(styled ? [{
        name: "features_style", label: "Features style",
        helper: "Match style: the controls sit on the body. Flat: on a plain patch of the body's color. Console: in a channel pressed into the body.",
        selector: select(FEATURES_STYLES),
      }] : []),
      {
        name: "enabled_color", label: "Enabled color",
        helper: "The color of keys that are on, and of sliders. Job keys and Safety warnings keep their own colors.",
        selector: { ui_color: { default_color: ENABLED_COLOR, extra_options: STATE_COLORS } },
      },
      {
        name: "collapsible", label: "Collapsible",
        helper: "Tapping the card shows or hides its features, in place of the card's Tap behavior (under Interactions). Tapping the icon still works as set.",
        selector: { boolean: {} },
      },
      ...(c.collapsible !== false ? [
        { name: "expanded_at_load", label: "Expanded at load", selector: { boolean: {} } },
        { name: "expand_when_powered_on", label: "Expand when powered on", selector: { boolean: {} } },
        { name: "collapse_when_powered_off", label: "Collapse when powered off", selector: { boolean: {} } },
      ] : []),
      ...((c.features_position ?? DEFAULT_FEATURES_POSITION) === "inline" ? [{
        name: "last_feature_full_width", label: "Last feature full width",
        helper: "The features sit beside the title in two columns. When the last one ends up alone in its row, it stretches across both columns instead of leaving the other empty.",
        selector: { boolean: {} },
      }] : []),
      {
        name: "status_badge", label: "Status badge",
        helper: "Shown at the top right of the picture. When several apply, the first in this list shows.",
        selector: { select: { multiple: true, reorder: true, mode: "dropdown", options: statusBadgesOf(this._hass, c.entity).map(([value, text]) => ({ value, label: text })) } },
      },
      {
        name: "connection_badge", label: "Connection badge",
        helper: "Shown at the bottom right of the picture: how Home Assistant reaches the laser (Ethernet, Wi-Fi or USB), or that the laser is unavailable.",
        selector: { boolean: {} },
      },
      {
        name: "status_light", label: "Status light",
        helper: "A thin ring around the picture that copies the color and pattern of the laser's own status light.",
        selector: { boolean: {} },
      },
      {
        type: "expandable", name: "progress_edge", title: "Progress edge",
        schema: [
          { name: "edge", label: "Edge", selector: select(EDGES) },
          {
            type: "grid", name: "", schema: [
              { name: "thickness", label: "Thickness (px)", selector: { number: { mode: "box", min: 1, max: 24, step: 1 } } },
              { name: "starts_at", label: "Starts at (%)", selector: { number: { mode: "box", min: 0, max: 100, step: 1 } } },
              { name: "ends_at", label: "Ends at (%)", selector: { number: { mode: "box", min: 0, max: 100, step: 1 } } },
            ],
          },
          { name: "direction", label: "Direction", selector: select(DIRECTIONS) },
          {
            name: "color", label: "Color",
            helper: "Follows the state: the laser's working color, amber when paused, green when finished. Thresholds: green above 60%, amber above 20%, red below. Or type any color.",
            selector: select([["state", "Follows the state"], ["thresholds", "Thresholds"]], { custom_value: true }),
          },
          { name: "show_percentage", label: "Show the percentage", selector: { boolean: {} } },
          {
            name: "show_while", label: "Show while",
            helper: "For a laser that does not report progress, the edge sweeps back and forth instead of filling.",
            selector: { select: { multiple: true, mode: "list", options: SHOW_WHILE.map(([value, text]) => ({ value, label: text })) } },
          },
        ],
      },
      ...overlayStylesField(this._hass, c.entity),
    ];
  }

  private _data(c: Config): Config {
    return {
      features_style: c.features_style ?? DEFAULT_FEATURES_STYLE,
      ...(c.enabled_color ? { enabled_color: c.enabled_color } : {}),
      status_badge: Array.isArray(c.status_badge) ? c.status_badge : defaultStatusBadges(this._hass, c.entity),
      connection_badge: c.connection_badge !== false,
      status_light: c.status_light !== false,
      progress_edge: progressOptions(c),
      collapsible: c.collapsible !== false,
      expanded_at_load: c.expanded_at_load === true,
      collapse_when_powered_off: c.collapse_when_powered_off !== false,
      expand_when_powered_on: c.expand_when_powered_on !== false,
      last_feature_full_width: c.last_feature_full_width !== false,
      // Style shows Integration until one of its own is chosen
      overlay_styles: Object.fromEntries(overlayLooks(this._hass, c.entity).map((look) => [look.name,
        { ...(LOOK_OPTIONS[look.kind].includes("style") ? { style: INTEGRATION } : {}), ...lookOf(c.overlay_styles, look.name) }])),
    };
  }

  private _laserChanged = (ev: CustomEvent): void => {
    ev.stopPropagation();
    const status = laserStatus(this._hass, ev.detail.value?.device);
    if (status && status !== this._config?.entity) this._update({ entity: status });
  };

  private _randomize = (): void => {
    this._update({ pattern: 1 + Math.floor(Math.random() * 99999) });
  };

  // Either form changed: both forms' values make the card's options
  private _changed = (ev: CustomEvent): void => {
    ev.stopPropagation();
    const root = this.renderRoot;
    const formData = (id: string) => (root.querySelector(`#${id}`) as HTMLElement & { data?: Config } | null)?.data ?? {};
    const v = { ...formData("style"), ...formData("form"), ...ev.detail.value };
    this._update({
      style: v.style ?? "none",
      features_style: v.features_style,
      enabled_color: v.enabled_color,
      status_badge: v.status_badge ?? [],
      connection_badge: v.connection_badge !== false,
      status_light: v.status_light !== false,
      progress_edge: { ...PROGRESS_DEFAULTS, ...(v.progress_edge ?? {}) },
      collapsible: v.collapsible !== false,
      expanded_at_load: v.expanded_at_load === true,
      collapse_when_powered_off: v.collapse_when_powered_off !== false,
      expand_when_powered_on: v.expand_when_powered_on !== false,
      last_feature_full_width: v.last_feature_full_width !== false,
      overlay_styles: ownStyles(v.overlay_styles),
    });
  };

  private _update(changes: Config): void {
    const next: Config = { ...this._config, ...changes };
    for (const [key, value] of Object.entries(changes)) if (value === undefined) delete next[key];
    this._config = minimal(next, this._hass);
    this._refresh();
    if ("entity" in changes) {
      this._setTileEditorHass();
      this._setTileEditorConfig();
    }
    this._fire();
  }

  private _fire(): void {
    fire(this, "config-changed", { config: this._config });
  }
}
