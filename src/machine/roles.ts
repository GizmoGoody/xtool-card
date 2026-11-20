// Where the laser's entities are found, by role, and its cameras and their
// overlays.

/**
 * Where each role's entity is found: its translation keys (the first one
 * found wins), the domains it may be in, and the devices it is looked for on:
 * - "laser": the laser's device, then the devices connected to it (its cameras),
 * - "children": the devices connected to the laser only (its accessories,
 *   such as the SafetyPro IF2 and IF2 2.0),
 * - "camera": each camera's own device (a laser with several cameras gives
 *   each its own device), or the laser's, with the camera's name in front.
 * A camera's settings are its "camera" roles and the laser's roles whose
 * entity is on the camera's own device (see cameraModel).
 */
export interface RoleSpec {
  keys: string[];
  domains: string[];
  on: "laser" | "children" | "camera";
}

const roleSpec = (keys: string[], domains: string[], on: RoleSpec["on"] = "laser"): RoleSpec => ({ keys, domains, on });

export const ROLES: Record<string, RoleSpec> = {
  // The job
  status: roleSpec(["status"], ["sensor"]),
  progress: roleSpec(["task_progress"], ["sensor"]),
  task_time: roleSpec(["task_time"], ["sensor"]),
  pause: roleSpec(["pause_job"], ["button"]),
  resume: roleSpec(["resume_job"], ["button"]),
  cancel: roleSpec(["cancel_job"], ["button"]),
  // Parts
  power: roleSpec(["power_switch"], ["switch"]),
  // The fan itself (the F2's) or the setting that runs it after a job (the P2's)
  exhaust_fan: roleSpec(["smoking_fan", "exhaust_fan_setting"], ["switch"]),
  exhaust_running: roleSpec(["smoking_fan_running"], ["binary_sensor"]),
  cooling_fan: roleSpec(["cooling_fan"], ["switch"]),
  fill_light: roleSpec(["fill_light"], ["light"]),
  // The P2's close camera's fill light, on that camera's device
  fill_light_close: roleSpec(["fill_light_1"], ["light"]),
  fill_light_front: roleSpec(["fill_light_front"], ["light"]),
  fill_light_back: roleSpec(["fill_light_back"], ["light"]),
  fill_light_left: roleSpec(["fill_light_3"], ["light"]),
  fill_light_right: roleSpec(["fill_light_2"], ["light"]),
  red_dot: roleSpec(["ir_led", "ir_led_global"], ["switch"]),
  red_dot_close: roleSpec(["aimed_measure_light"], ["switch"]),
  red_dot_quick: roleSpec(["quick_measure_light"], ["switch"]),
  safety_lock: roleSpec(["safety_lock", "digital_lock"], ["lock", "switch"]),
  // Moving the laser, measuring and focusing
  laser_x: roleSpec(["laser_position_x"], ["number"]),
  laser_y: roleSpec(["laser_position_y"], ["number"]),
  move_laser: roleSpec(["move_laser"], ["button"]),
  home_laser: roleSpec(["home_laser_head"], ["button"]),
  wake: roleSpec(["wake"], ["button"]),
  // The P2's, on its overview camera's device
  measure_thickness_or_distance: roleSpec(["measure_thickness_or_distance"], ["button"]),
  thickness_or_distance: roleSpec(["thickness_or_distance"], ["number"]),
  measured: roleSpec(["measured_thickness_or_distance"], ["sensor"]),
  focus_height: roleSpec(["focus_height"], ["number"]),
  engraving_lens: roleSpec(["engraving_lens"], ["sensor"]),
  autofocus: roleSpec(["autofocus"], ["button"]),
  // Safety: a switch, or the P2's select of its level
  flame_alarm: roleSpec(["flame_alarm_v2", "flame_alarm", "flame_alarm_level"], ["switch", "select"]),
  stops_when_enclosure_opened: roleSpec(["gap_check"], ["switch"]),
  stops_when_moved: roleSpec(["stops_when_moved", "move_stop"], ["switch"]),
  access_control: roleSpec(["md_mode"], ["switch"]),
  alarm: roleSpec(["alarm"], ["binary_sensor"]),
  lid: roleSpec(["lid", "cover_open"], ["binary_sensor"]),
  baseplate: roleSpec(["baseplate"], ["binary_sensor"]),
  safety_key: roleSpec(["machine_lock"], ["binary_sensor"]),
  // Configuration
  firmware: roleSpec(["firmware"], ["update"]),
  // How Home Assistant reaches the laser
  connection: roleSpec(["connection"], ["sensor"]),
  buzzer: roleSpec(["beep_enable", "buzzer"], ["switch"]),
  device_sleep: roleSpec(["device_sleep"], ["switch"]),
  // The SafetyPro IF2 and IF2 2.0
  if2_fan_entity: roleSpec(["accessory_ductfanv3_fan"], ["fan"], "children"),
  if2_gear_select: roleSpec(["accessory_ductfan_gear_select"], ["select"], "children"),
  if2_buzzer: roleSpec(["accessory_ductfanv3_buzzer", "accessory_ductfan_buzzer"], ["switch"], "children"),
  // A camera's own settings
  crop_width: roleSpec(["crop_width", "camera_main_crop_width"], ["number"], "camera"),
  crop_height: roleSpec(["crop_height", "camera_main_crop_height"], ["number"], "camera"),
  crop_center_x: roleSpec(["crop_center_x", "camera_main_crop_center_x"], ["number"], "camera"),
  crop_center_y: roleSpec(["crop_center_y", "camera_main_crop_center_y"], ["number"], "camera"),
  perspective: roleSpec(["perspective", "camera_deep_perspective"], ["select"], "camera"),
  // The P2's: each camera's crop preset and exposure, and the overview
  // camera's processing mode
  crop: roleSpec(["crop_preset"], ["select"], "camera"),
  exposure: roleSpec(["exposure"], ["number"], "camera"),
  mode: roleSpec(["processing_mode"], ["select"], "camera"),
  // Who draws a camera's overlays: the integration on the picture, or the
  // card (see the Cameras feature)
  overlays: roleSpec(["overlays"], ["select"], "camera"),
};
export const CROP_ROLES = ["crop_width", "crop_height", "crop_center_x", "crop_center_y"];

// The cameras, by translation key, in the order the Cameras feature offers them
export const CAMERAS: [string, string][] = [
  ["camera_main", "Main"], ["camera_deep", "Deep"], ["camera_overview", "Overview"], ["camera_closeup", "Close"],
  ["camera_far", "Far"], ["camera_near", "Near"], ["camera_side", "Side"], ["camera_fire_record", "Fire record"],
];

// A camera's overlays are the switches on its device whose translation key
// starts with overlay_. These are shown first, in this order; any other is
// shown after them.
export const OVERLAY_PREFIX = "overlay_";
export const OVERLAY_ORDER = [
  "overlay_mode_process_on_slats", "overlay_mode_honeycomb_panel", "overlay_mode_slats_removed", "overlay_close_camera",
  "overlay_studio", "overlay_custom", "overlay_laser_target", "overlay_slat_lines", "overlay_red_dot_close", "overlay_red_dot_quick",
];

// The overlays chosen by default: where the laser fires, the close camera's
// picture on the overview, where the two red dots point, and the slats
export const DEFAULT_OVERLAYS = [
  "overlay_laser_target", "overlay_close_camera", "overlay_red_dot_close", "overlay_red_dot_quick", "overlay_slat_lines",
];
