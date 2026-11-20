// The lights as a light's tile card shows them: each light's icon and its
// slider are two choices, in one row, in the order chosen.
import { html, unsafeCSS, type CSSResultGroup, type TemplateResult } from "lit";
import { entityName, type HomeAssistant } from "../ha";
import { controlOf, type Control } from "../machine/controls";
import type { Device } from "../machine/device";
import { XtoolElement } from "./base";
import { iconOf, needsDirection } from "./keys";
import { dimmable, LightRow, lightPart, lightPartName, lightParts, showSlides } from "./slides";
import { LIGHT_CSS, ROW_CSS } from "./styles";

const LIGHTS = ["fill_light_left", "fill_light_right", "fill_light_front", "fill_light_back", "fill_light"];

type LightControl = Control & { part: "icon" | "brightness" };

export class XtoolLights extends XtoolElement {
  static override label = "Lights";
  static override pickerName = "xTool lights";
  static override keepOffered = true;
  static override form = {
    label: "Controls",
    options: [{
      name: "off_at_minimum", label: "Off at minimum", default: false,
      helper: "Moving a light's slider to its minimum (1%) turns the light off.",
    }],
  };
  static override styles: CSSResultGroup = unsafeCSS(`:host { display: block; min-width: 0; max-width: 100%; }\n${ROW_CSS}\n${LIGHT_CSS}`);

  /** Each light's icon and slider: "<light>" and "<light>_brightness". */
  static override controlIds(): string[] {
    return LIGHTS.flatMap(lightParts);
  }

  /** The light's control (part: icon or brightness), and its entity; a camera's own light is in the Cameras feature, not here. */
  static override controlFor(id: string, device: Device): { control?: LightControl; entityId?: string } {
    const { light, part } = lightPart(id) ?? {};
    if (!light || !LIGHTS.includes(light)) return { control: undefined };
    const entityId = device.roles[light];
    const cameras = device.cameras.some((camera) => Object.values(camera.settings).includes(entityId));
    return { control: { ...controlOf(light)!, part: part! }, entityId: cameras ? undefined : entityId };
  }

  /** Each light's icon and slider, by the light's name. */
  static override offered(device: Device, hass: HomeAssistant): { value: string; label: string }[] {
    return this.controlIds().map((id) => ({ id, ...this.controlFor(id, device) }))
      .filter(({ control, entityId }) => control && entityId && (control.part !== "brightness" || dimmable(hass, entityId)))
      .map(({ id, control, entityId }) => ({
        value: id, label: lightPartName(entityName(hass, entityId) ?? (control!.name as string), control!.part) ?? id,
      }));
  }

  private _rows = new Map<string, LightRow>();

  protected override render(): TemplateResult {
    return html`<div class="row" role="group" aria-label=${this._type.label}></div>`;
  }

  // The lights are Home Assistant's own elements, kept while they show
  protected override updated(): void {
    const device = this._device;
    const box = this.renderRoot.querySelector<HTMLElement>(".row")!;
    const chosen = this._chosen().map((id) => ({ id, ...XtoolLights.controlFor(id, device) }))
      .filter((c): c is { id: string; control: LightControl; entityId: string } => !!c.control && !!c.entityId);
    // A chevron only tells apart light icons that are the same
    const icons = chosen.filter(({ control }) => control.part === "icon");
    const faces = icons.map(({ entityId }) => iconOf(this._hass!, entityId, () => this._refresh()));
    const items = chosen
      .map(({ control, entityId }) => {
        if (!this._rows.has(entityId)) this._rows.set(entityId, new LightRow(this, entityId));
        const row = this._rows.get(entityId)!;
        const i = icons.findIndex((item) => item.entityId === entityId);
        row.update(i >= 0 && control.direction && needsDirection(faces, i) ? control.direction : undefined);
        return control.part === "icon" ? row.icon : row.slide;
      })
      // A light without a brightness has no slider
      .filter((el) => !el.hidden);
    this._showNothing(items.length === 0);
    showSlides(box, items);
    this._fitter.fit([box]);
  }
}
