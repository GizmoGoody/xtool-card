// The features' editor: one element; the form is the feature's (its static
// editor). Home Assistant reads the form as soon as it hands the editor its
// configuration, so the form is drawn at once, in the element itself.
import { html, nothing, render } from "lit";
import { fire, same, type Config, type FeatureContext, type HomeAssistant } from "../ha";
import { FEATURES } from "../features";

const label = (s: Config) => s.label ?? s.name;
const helper = (s: Config) => s.helper;

export class XtoolFeatureEditor extends HTMLElement {
  private _hass?: HomeAssistant;
  private _context?: FeatureContext;
  private _config?: Config;

  set hass(hass: HomeAssistant) {
    this._hass = hass;
    this._render();
  }

  get hass(): HomeAssistant | undefined {
    return this._hass;
  }

  set context(context: FeatureContext) {
    this._context = context;
    this._render();
  }

  get context(): FeatureContext | undefined {
    return this._context;
  }

  setConfig(config: Config): void {
    this._config = config;
    this._render();
  }

  private _form() {
    return this._hass && this._config
      ? FEATURES[`${this._config.type ?? ""}`.replace(/^custom:/, "")]?.editor(this._hass, this._context?.entity_id) : undefined;
  }

  private _render(): void {
    const form = this._form();
    if (!form) return;
    render(form ? html`<ha-form .hass=${this._hass} .schema=${typeof form.schema === "function" ? form.schema(this._config!) : form.schema}
      .data=${form.data(this._config!)} .computeLabel=${label} .computeHelper=${helper} @value-changed=${this._changed}></ha-form>` : nothing, this);
  }

  /** Only what differs from the feature's defaults is written: the feature applies its defaults to every option left out. */
  private _changed = (ev: CustomEvent): void => {
    ev.stopPropagation();
    const form = this._form();
    if (!form) return;
    const saved = (data: Config) => (form.save ? form.save(data) : data);
    const value: Config = saved({ ...ev.detail.value });
    const defaults = saved(form.data({ type: this._config!.type }));
    for (const [key, option] of Object.entries(value)) if (key in defaults && same(option, defaults[key])) delete value[key];
    this._config = { type: this._config!.type, ...value };
    fire(this, "config-changed", { config: this._config });
    // Some options show only for some choices
    this._render();
  };
}
