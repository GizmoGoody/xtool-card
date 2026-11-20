// The features made of a row of keys: the job, the laser's parts and
// settings, safety, the overlays, the position, the IF2 fan and focus.
import { STATE_COLORS } from "../const";
import type { Config, HomeAssistant } from "../ha";
import type { Moment } from "../machine/controls";
import { deviceOf, type Device } from "../machine/device";
import { overlayControl } from "../machine/overlays";
import { DEFAULT_OVERLAYS } from "../machine/roles";
import { displayField, displayOf, XtoolFeature, type FeatureForm } from "./base";
import type { Item } from "./keys";

// The job. The buttons are chosen in the options, in order: Start (Resume
// when paused), Start / Pause (Pause while the job runs), Pause and Cancel.
// Start / Pause and Cancel by default.
export class XtoolJob extends XtoolFeature {
  static override label = "Job";
  static override pickerName = "xTool job";
  static override controls = ["start_pause", "start", "pause", "cancel"];
  static override defaults = ["start_pause", "cancel"];
  // Every xTool laser has the job's buttons: the editor offers them all
  static override offerAll = true;
  // The job's keys start actions: they show no on or off state
  static override keyOptions = { pressed: undefined };
  static override form = {
    label: "Controls",
    helper: "Start / Pause is one key: Pause while a job runs, Start or Resume otherwise.",
    options: [{ name: "ask_before_cancelling", label: "Ask before cancelling a job" }],
  };
}

// The laser's parts and settings, on and off: Controls shows the ones the
// integration does not class as settings, Configuration the settings (its
// config entity category)
export const PARTS = [
  "power", "exhaust_fan", "fill_light_front", "fill_light_back", "fill_light", "fill_light_close", "fill_light_left", "fill_light_right",
  "red_dot", "red_dot_close", "red_dot_quick", "cooling_fan", "safety_lock", "autofocus", "wake",
  "buzzer", "if2_buzzer", "device_sleep",
];

// Controls: power, the fans, the fill lights, the red dots and the safety
// lock, on and off, and Autofocus
export class XtoolControls extends XtoolFeature {
  static override label = "Controls";
  static override pickerName = "xTool controls";
  static override controls = PARTS;
  static override category = "control";
  static override form = {
    label: "Controls",
    options: [{ name: "animate_fan", label: "Animate fan" }],
  };
}

// The configuration settings of the laser and its accessories
export class XtoolConfiguration extends XtoolFeature {
  static override label = "Configuration";
  static override pickerName = "xTool configuration";
  static override controls = PARTS;
  static override category = "config";
  static override form = { label: "Controls" };
}

const DISABLED_COLOR = "error";

// Safety: the safety checks (switches: turning one off asks first), and the
// safety key, lid and baseplate, which can only be shown (a tap opens them)
export class XtoolSafety extends XtoolFeature {
  static override label = "Safety";
  static override pickerName = "xTool safety";
  static override controls = ["flame_alarm", "stops_when_enclosure_opened", "stops_when_moved", "safety_key", "lid", "baseplate", "access_control"];
  static override form = {
    label: "Controls",
    helper: "Turning a check off always asks first. The safety key, lid and baseplate cannot be changed here; tap one for its details.",
    options: [{
      name: "disabled_color", label: "Disabled color", default: DISABLED_COLOR,
      helper: "The color of a check that is off, and of a safety key, lid or baseplate that is not safe.",
      selector: { ui_color: { default_color: DISABLED_COLOR, extra_options: STATE_COLORS } },
    }],
  };
}

// The overlays drawn on the cameras' pictures, a key for each overlay switch chosen, in order
export class XtoolOverlays extends XtoolFeature {
  static override label = "Overlays";
  static override pickerName = "xTool overlays";
  static override form = { label: "Controls" };

  /** Each camera's overlay switches, by their control ids (overview_laser_target), camera by camera. */
  static override controlIds(device: Device): string[] {
    return device.cameras.flatMap((camera) => camera.overlays.map((overlay) => overlay.id));
  }

  static override controlFor(id: string, device: Device, hass?: HomeAssistant) {
    const camera = device.cameras.find((c) => c.overlays.some((overlay) => overlay.id === id));
    const overlay = camera?.overlays.find((o) => o.id === id);
    return { control: overlay && overlayControl(id, overlay.entityId, camera!, hass), entityId: overlay?.entityId };
  }

  /** Five by default: the overlays in DEFAULT_OVERLAYS, each of the first camera that has it, then others in order. */
  static override defaultsFor(device: Device): string[] {
    const all = device.cameras.flatMap((camera) => camera.overlays);
    const picked = DEFAULT_OVERLAYS.map((key) => all.find((o) => o.key === key)?.id).filter((id): id is string => !!id);
    return [...picked, ...all.map((o) => o.id).filter((id) => !picked.includes(id))].slice(0, 5);
  }
}

// Moving the laser: its position X,Y in whole millimeters (typed, or slid
// by pressing and dragging on the field), and Move goes there; Home homes it
export class XtoolPosition extends XtoolFeature {
  static override label = "Position";
  static override pickerName = "xTool position";
  static override controls = ["laser_position", "move_laser", "home_laser"];
  static override form = { label: "Controls" };
}

// The first IF2's gears' icons
const IF2_ICONS: Record<string, string> = { off: "mdi:fan-off", 1: "mdi:fan-speed-1", 2: "mdi:fan-speed-2", 3: "mdi:fan-speed-3" };

/**
 * The SafetyPro IF2 inline fan, as one row of keys, the one chosen pressed:
 * - IF2 2.0 (its fan entity): Off turns the fan off, A sets Auto, where each
 *   job sets the speed as Studio does, a speed sets 25 % a step.
 * - The first IF2 (its gear select): the select's options.
 * Shown disabled while the laser does not see the IF2, as Home Assistant's are.
 */
export class XtoolSafetyproIf2Fan extends XtoolFeature {
  static override label = "SafetyPro IF2 fan";
  static override pickerName = "xTool SafetyPro IF2 fan";
  static override controls = ["fan_off", "fan_auto", "fan_speed"];
  static override form = { label: "Controls", helper: "The speed key shows the current speed; tap it for the next speed." };

  static override supports(device: Device): boolean {
    return !!(device.roles.if2_fan_entity ?? device.roles.if2_gear_select);
  }

  // The IF2 2.0: its keys; the first IF2: its gears
  static override editor(hass: HomeAssistant, entityId?: string): FeatureForm {
    const { roles } = deviceOf(hass, entityId);
    if (roles.if2_fan_entity) return super.editor(hass, entityId);
    const gears = roles.if2_gear_select;
    const options: string[] = gears ? hass.states[gears]?.attributes.options ?? [] : [];
    return {
      schema: (c: Config) => [
        displayField(),
        ...(gears ? [
          { name: "customize_choices", label: "Customize choices", selector: { boolean: {} } },
          ...(Array.isArray(c.choices) ? [{
            name: "choices", label: "Choices",
            selector: { select: { multiple: true, reorder: true, options } },
          }] : []),
        ] : []),
      ],
      data: (c: Config) => ({
        show: displayOf(c),
        ...(gears ? { customize_choices: Array.isArray(c.choices), ...(Array.isArray(c.choices) ? { choices: c.choices } : {}) } : {}),
      }),
      // Turning Customize on starts with every choice; off removes the list
      save: (v: Config) => {
        const { customize_choices: customChoices, ...c } = v;
        if (gears && customChoices) c.choices = Array.isArray(c.choices) ? c.choices : options;
        else delete c.choices;
        return c;
      },
    };
  }

  override _buttons(): Item[] {
    const hass = this._hass!, c = this._config!, { roles } = this._device;
    if (roles.if2_fan_entity) return super._buttons();
    const gears = roles.if2_gear_select;
    const gearState = gears ? hass.states[gears] : undefined;
    if (!gearState) return [];
    const all: string[] = gearState.attributes.options ?? [];
    const shown: string[] = Array.isArray(c.choices) ? c.choices.filter((o: string) => all.includes(o)) : all;
    return shown.map((value) => {
      const name = hass.formatEntityState?.(gearState, value) ?? value;
      return {
        key: value, label: name, text: name, icon: IF2_ICONS[String(value).toLowerCase()],
        pressed: gearState.state === value, disabled: gearState.state === "unavailable",
        action: () => value !== gearState.state && hass.callService("select", "select_option", { entity_id: gears, option: value }),
      };
    });
  }
}

/**
 * Focus (F2 Ultra UV), in one row: Autofocus, then the material thickness
 * the laser is focused on, in a field: type a thickness and press Enter to
 * focus there, as Studio's manual focus does, or press and slide on it
 * (right or up raises it, 0.1 mm a step); the head moves only once the
 * slide ends. Unavailable while the laser is off, as Home Assistant's
 * features are. With the inner engraving lens there is no focusing (the job
 * sets the height, as in Studio), so the feature is hidden.
 */
export class XtoolFocus extends XtoolFeature {
  static override label = "Focus";
  static override pickerName = "xTool focus";
  static override controls = ["autofocus", "focus_height"];
  static override form = { label: "Controls" };
  // Autofocus starts an action: it shows no on or off state
  static override keyOptions = { pressed: undefined };

  static override supports(device: Device): boolean {
    return !!device.roles.focus_height;
  }

  static override hidden = ({ hass, device }: Moment): boolean => {
    const lens = device.roles.engraving_lens;
    return !!device.roles.focus_height && ["small", "none"].includes((lens ? hass.states[lens]?.state : undefined) ?? "");
  };
}
