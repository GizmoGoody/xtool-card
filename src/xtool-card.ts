// xTool dashboard card and tile features, for the xtool integration. The
// card is Home Assistant's tile card, wrapped; the features work in any tile
// card for a laser.
//
// Tile features:
// - custom:xtool-job            Start, Pause, Resume and Stop, and the job's read-outs
// - custom:xtool-controls       the laser's own controls (air assist, exhaust, and more)
// - custom:xtool-configuration  the laser's settings
// - custom:xtool-safety         the safety checks, as warnings
// - custom:xtool-overlays       the camera overlays, each a switch
// - custom:xtool-position       the laser head's position, and moving it
// - custom:xtool-focus          the focus, for a laser with an outer lens
// - custom:xtool-lights         each light's icon and brightness slider
// - custom:xtool-safetypro-if2-fan  the SafetyPro IF2 fan: off, auto and its speed
// - custom:xtool-cameras        a camera, with keys to switch and a crop set with two taps
import { printBadge } from "./badge";
import { CARD_TYPE, EDITOR_TYPE, FEATURE_EDITOR_TYPE, VERSION } from "./const";
import { define, type HomeAssistant } from "./ha";
import { XtoolCard } from "./card/card";
import { XtoolCardEditor } from "./editor/card-editor";
import { XtoolFeatureEditor } from "./editor/feature-editor";
import { FEATURES } from "./features";
import { deviceOf, isXtool } from "./machine/device";

if (!customElements.get(CARD_TYPE)) {
  for (const [tag, feature] of Object.entries(FEATURES)) define(tag, feature);
  define(FEATURE_EDITOR_TYPE, XtoolFeatureEditor);
  define(CARD_TYPE, XtoolCard);
  define(EDITOR_TYPE, XtoolCardEditor);

  window.customCardFeatures = window.customCardFeatures || [];
  window.customCardFeatures.push(...Object.values(FEATURES).map((feature) => ({
    type: feature.type,
    name: feature.pickerName,
    isSupported: (hass: HomeAssistant, context?: { entity_id?: string }) =>
      isXtool(hass, context?.entity_id) && feature.supports(deviceOf(hass, context?.entity_id), hass),
    configurable: true,
  })));

  window.customCards = window.customCards || [];
  window.customCards.push({
    type: CARD_TYPE,
    name: "xTool",
    description: "A tile card for an xTool laser: its state as a picture, a progress edge, status and connection badges, and an optional xTool style.",
    preview: true,
    documentationURL: "https://github.com/GizmoGoody/xtool-card#configuration",
  });

  printBadge({
    icon: "🔦",
    name: "xTool Card",
    version: VERSION,
    description: "Status and controls for an xTool laser.",
    repo: "xtool-card",
  });
}
