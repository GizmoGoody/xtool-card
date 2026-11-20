// The features, in the order Home Assistant's feature picker lists them.
import type { XtoolElement } from "./base";
import { XtoolCameras } from "./cameras";
import { XtoolConfiguration, XtoolControls, XtoolFocus, XtoolJob, XtoolOverlays, XtoolPosition, XtoolSafety, XtoolSafetyproIf2Fan } from "./keyed";
import { XtoolLights } from "./lights";

export const FEATURES: Record<string, typeof XtoolElement> = Object.fromEntries([
  XtoolJob, XtoolControls, XtoolLights, XtoolSafety, XtoolConfiguration, XtoolCameras, XtoolOverlays, XtoolSafetyproIf2Fan, XtoolFocus, XtoolPosition,
].map((feature) => [feature.type, feature as typeof XtoolElement]));
export const FEATURE_TAGS = Object.keys(FEATURES);
