// The overlays the card can draw over a camera's picture, and their styles
// in the card's options.
import { ENABLED, cssColor, STATE_COLORS } from "../const";
import { entityName, type Config, type HassEntity, type HomeAssistant } from "../ha";
import type { Control } from "./controls";
import { deviceOf, type Camera } from "./device";
import { OVERLAY_PREFIX } from "./roles";

// The overlays the card can draw over the picture: each overlay switch
// whose position attribute says where its marks are, by kind (the
// attribute's key). The integration's style attribute says how it draws
// them; the card's Overlay styles (overlay_styles, by the overlay's key
// without overlay_) change that. Each kind's options:
export const LOOK_OPTIONS: Record<string, string[]> = {
  areas: ["color", "line", "style", "icon", "size"],  // outlines, a dot at the origin and the centre
  slats: ["color", "line", "style"],
  target: ["color", "icon", "size"],
  close: ["color", "icon", "size"],  // an icon, as the laser target
  quick: ["color", "line", "style"],  // a turned ellipse
};
// "Integration": a style left as the integration draws it
export const INTEGRATION = "integration";
const LINE_STYLES: [string, string][] = [["solid", "Solid"], ["dashed", "Dashed"], ["dotted", "Dotted"]];

/** An overlay switch's kind (see LOOK_OPTIONS); undefined when it says nothing of where its marks are. */
export function lookKind(stateObj?: HassEntity): string | undefined {
  return Object.keys(stateObj?.attributes?.position ?? {}).find((kind) => LOOK_OPTIONS[kind]);
}

/** An overlay's name in the card's Overlay styles: its key without overlay_ (laser_target). */
export const lookName = (key: string): string => key.slice(OVERLAY_PREFIX.length);

export interface Look { name: string; kind: string; entityId: string; style: Config }

/**
 * The overlays of a laser's cameras the card can draw, once each: their
 * name, kind and the integration's style (of the first camera that has it).
 */
export function overlayLooks(hass: HomeAssistant | undefined, entity?: string): Look[] {
  if (!entity || !hass?.entities?.[entity]) return [];
  const looks = new Map<string, Look>();
  for (const overlay of deviceOf(hass, entity).cameras.flatMap((camera) => camera.overlays)) {
    const stateObj = hass.states[overlay.entityId], kind = lookKind(stateObj);
    if (kind && !looks.has(overlay.key)) {
      looks.set(overlay.key, { name: lookName(overlay.key), kind, entityId: overlay.entityId, style: stateObj.attributes.style ?? {} });
    }
  }
  return [...looks.values()];
}

/** An overlay's color: the card's own, or else the integration's (its style attribute), or else the Enabled color. */
export function lookColor(own: Config, given?: Config): string {
  return own.color ? cssColor(own.color) : Array.isArray(given?.color) ? `rgb(${given!.color.join(",")})` : ENABLED;
}

/** An overlay's style in the card's Overlay styles, without what follows the integration (empty: none of its own). */
export function lookOf(styles: Config | undefined, name: string): Config {
  return Object.fromEntries(Object.entries(styles?.[name] ?? {}).filter(([, value]) => value !== undefined && value !== "" && value !== INTEGRATION));
}

/** The card's Overlay styles as it keeps them: only the overlays, and their options, that differ from the integration. */
export function ownStyles(styles?: Config): Config | undefined {
  const own = Object.fromEntries(Object.keys(styles ?? {}).map((name) => [name, lookOf(styles, name)]).filter(([, look]) => Object.keys(look).length));
  return Object.keys(own).length ? own : undefined;
}

/** A style option's field; left empty (or Integration), the integration's. */
function lookField(option: string, style: Config): Config {
  const integration = { value: INTEGRATION, label: "Integration" };
  switch (option) {
    case "color":
      return { name: "color", label: "Color", selector: { ui_color: { default_color: INTEGRATION, extra_options: [integration, ...STATE_COLORS] } } };
    case "line":
      return { name: "line", label: "Line (px)", helper: "Leave empty to use the integration's.", selector: { number: { mode: "box", min: 1, max: 20, step: 1 } } };
    case "style":
      return {
        name: "style", label: "Style",
        selector: { select: { mode: "dropdown", options: [integration, ...LINE_STYLES.map(([value, label]) => ({ value, label }))] } },
      };
    case "icon":
      return { name: "icon", label: "Icon", selector: { icon: { placeholder: style.icon ?? "" } } };
    default:
      return { name: "size", label: "Size (px)", helper: "Leave empty to use the integration's.", selector: { number: { mode: "box", min: 4, max: 96, step: 1 } } };
  }
}

/**
 * The card editor's Overlay styles: folded away, a section for each overlay
 * the card can draw, named as its switch is; none without one.
 */
export function overlayStylesField(hass: HomeAssistant | undefined, entity?: string): Config[] {
  const looks = overlayLooks(hass, entity);
  if (!looks.length) return [];
  return [{
    type: "expandable", name: "overlay_styles", title: "Overlay styles",
    schema: looks.map((look) => ({
      type: "expandable", name: look.name, title: entityName(hass, look.entityId) ?? look.name,
      schema: LOOK_OPTIONS[look.kind].map((option) => lookField(option, look.style)),
    })),
  }];
}

/** An overlay's control: its switch, named by its entity and its camera. */
export function overlayControl(id: string, entityId: string, camera: Camera, hass?: HomeAssistant): Control {
  const name = `${entityName(hass, entityId) ?? entityId} (${entityName(hass, camera.entityId) ?? camera.label})`;
  return { id, role: id, kind: "toggle", option: name, title: name };
}
