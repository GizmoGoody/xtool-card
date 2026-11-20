// The laser, its connected devices and their entities, found once for each
// version of Home Assistant's entity and device registries.
import { DOMAIN } from "../const";
import { domainOf, type DeviceEntry, type EntityEntry, type HomeAssistant } from "../ha";
import { phaseOf, profileOf, type Profile } from "./models";
import { CAMERAS, OVERLAY_ORDER, OVERLAY_PREFIX, ROLES, type RoleSpec } from "./roles";

export interface Overlay {
  key: string;
  // Its control id: the camera's id and the overlay's key (overview_laser_target)
  id: string;
  entityId: string;
}

export interface Camera {
  entityId: string;
  key: string;
  id: string;
  label: string;
  device?: string | null;
  // { role: entity_id }: its "camera" roles, and the laser's roles on its own device
  settings: Record<string, string>;
  overlays: Overlay[];
}

export interface Device {
  id?: string;
  device?: DeviceEntry;
  entities: EntityEntry[];
  children: string[];
  roles: Record<string, string>;
  cameras: Camera[];
  profile: Profile;
  // Every entity of the laser and its devices (see changedFor)
  ids: string[];
}

// The xTool entities of each device, rebuilt when Home Assistant's entity list changes
const byDeviceCache = new WeakMap<object, Map<string, EntityEntry[]>>();
function deviceEntities(hass: HomeAssistant, device?: string | null): EntityEntry[] {
  const entities = hass?.entities;
  if (!entities || !device) return [];
  let byDevice = byDeviceCache.get(entities);
  if (!byDevice) {
    byDevice = new Map();
    for (const e of Object.values(entities)) {
      if (e.platform !== DOMAIN || !e.device_id) continue;
      if (!byDevice.has(e.device_id)) byDevice.set(e.device_id, []);
      byDevice.get(e.device_id)!.push(e);
    }
    byDeviceCache.set(entities, byDevice);
  }
  return byDevice.get(device) ?? [];
}

/** The entity_id of the first entity with one of the role's keys, in one of its domains. */
function findRole(candidates: EntityEntry[], { keys, domains }: RoleSpec): string | undefined {
  for (const key of keys) {
    const found = candidates.find((e) => e.translation_key === key && domains.includes(domainOf(e.entity_id)));
    if (found) return found.entity_id;
  }
  return undefined;
}

/**
 * A camera's id in the card's options: its short name in CAMERAS, in snake
 * case (Main: main, Close: close, Fire record: fire_record), so it stays the
 * same whatever Home Assistant calls the camera.
 */
const cameraId = (label: string): string => label.toLowerCase().replace(/[^a-z0-9]+/g, "_");

function cameraModel(hass: HomeAssistant, entityId: string, key: string, label: string, laser: string, roles: Record<string, string>): Camera {
  const device = hass.entities![entityId].device_id;
  const entities = deviceEntities(hass, device);
  const settings: Record<string, string> = {};
  for (const [role, spec] of Object.entries(ROLES)) {
    if (spec.on !== "camera") continue;
    const found = findRole(entities, spec);
    if (found) settings[role] = found;
  }
  if (device !== laser) {
    for (const [role, found] of Object.entries(roles)) if (hass.entities![found]?.device_id === device) settings[role] ??= found;
  }
  const overlays: Overlay[] = [];
  for (const e of entities) {
    const overlay = e.translation_key;
    if (!overlay?.startsWith(OVERLAY_PREFIX) || domainOf(e.entity_id) !== "switch" || overlays.some((o) => o.key === overlay)) continue;
    overlays.push({ key: overlay, id: `${cameraId(label)}_${overlay.slice(OVERLAY_PREFIX.length)}`, entityId: e.entity_id });
  }
  const rank = (o: Overlay) => (OVERLAY_ORDER.includes(o.key) ? OVERLAY_ORDER.indexOf(o.key) : OVERLAY_ORDER.length);
  overlays.sort((a, b) => rank(a) - rank(b));
  return { entityId, key, id: cameraId(label), label, device, settings, overlays };
}

function buildDevice(hass: HomeAssistant, id: string): Device {
  const children = Object.values(hass.devices ?? {}).filter((d) => d.via_device_id === id).map((d) => d.id);
  const near = [id, ...children];
  const roles: Record<string, string> = {};
  for (const [role, spec] of Object.entries(ROLES)) {
    if (spec.on === "camera") continue;
    for (const d of spec.on === "children" ? children : near) {
      const found = findRole(deviceEntities(hass, d), spec);
      if (found) {
        roles[role] = found;
        break;
      }
    }
  }
  const all = near.flatMap((d) => deviceEntities(hass, d));
  const cameras = CAMERAS.map(([key, label]) => {
    const camera = all.find((e) => e.translation_key === key && domainOf(e.entity_id) === "camera");
    return camera && cameraModel(hass, camera.entity_id, key, label, id, roles);
  }).filter((c): c is Camera => !!c);
  return {
    id, device: hass.devices?.[id], entities: deviceEntities(hass, id), children, roles, cameras,
    profile: profileOf(hass.devices?.[id]?.model),
    ids: all.map((e) => e.entity_id),
  };
}

let noDevice: Device | undefined;
const NO_DEVICES = {};
const deviceCache = new WeakMap<object, WeakMap<object, Map<string, Device>>>();

/**
 * The device of an entity and everything the card and the features use of
 * it, found once for each version of Home Assistant's entity and device
 * registries (a new version of either is a new object). For an entity
 * without a device, a model with none of them.
 */
export function deviceOf(hass: HomeAssistant | undefined, entityId?: string): Device {
  const entities = hass?.entities;
  const id = entityId ? entities?.[entityId]?.device_id : undefined;
  if (!hass || !entities || !id) {
    noDevice ??= Object.freeze({ id: undefined, entities: [], children: [], roles: {}, cameras: [], profile: profileOf(""), ids: [] }) as Device;
    return noDevice;
  }
  const devices = hass.devices ?? NO_DEVICES;
  let byDevices = deviceCache.get(entities);
  if (!byDevices) deviceCache.set(entities, (byDevices = new WeakMap()));
  let byId = byDevices.get(devices);
  if (!byId) byDevices.set(devices, (byId = new Map()));
  if (!byId.has(id)) byId.set(id, buildDevice(hass, id));
  return byId.get(id)!;
}

// What else in hass the card and the features show: the registries, the
// theme, the language, the user and the connection
const HASS_PARTS = ["entities", "devices", "themes", "selectedTheme", "locale", "language", "user", "connected", "config"];

/**
 * Whether a new hass changes anything shown for this entity and its laser:
 * Home Assistant sends one for every change of any entity, and on a large
 * install nearly all of them are of other entities.
 */
export function changedFor(before: HomeAssistant | undefined, hass: HomeAssistant | undefined, entityId?: string): boolean {
  if (!before || !hass) return before !== hass;
  if (before === hass) return false;
  if (HASS_PARTS.some((part) => before[part] !== hass[part])) return true;
  if (!entityId) return true;
  if (before.states[entityId] !== hass.states[entityId]) return true;
  return deviceOf(hass, entityId).ids.some((id) => before.states[id] !== hass.states[id]);
}

export const isXtool = (hass: HomeAssistant | undefined, entityId?: string): boolean =>
  !!entityId && hass?.entities?.[entityId]?.platform === DOMAIN;

/** The laser's status sensor: the entity itself, or the one on its device. */
export function statusOf(hass: HomeAssistant | undefined, entityId?: string): string | undefined {
  if (!entityId) return undefined;
  return hass?.entities?.[entityId]?.translation_key === "status" ? entityId : deviceOf(hass, entityId).roles.status;
}

/** The laser's phase now, from its status sensor. */
export function phaseNow(hass: HomeAssistant | undefined, entityId?: string): string {
  const status = statusOf(hass, entityId);
  return phaseOf(status ? hass!.states[status]?.state : undefined);
}

/**
 * Whether Access control is on: autofocus, framing and starting a job from
 * the machine are then off, as in Studio, so the card shows them unavailable.
 */
export function accessControlOn(hass: HomeAssistant | undefined, entityId?: string): boolean {
  const control = deviceOf(hass, entityId).roles.access_control;
  return !!control && hass!.states[control]?.state === "on";
}
