// A field in a feature's row: numbers to type in, and to press and slide on.
import type { HassEntity } from "../ha";
import type { Control } from "../machine/controls";
import { decimalsOf, fieldName, type Item, type KeyHost } from "./keys";
import { ITEM_MIN, nameItem } from "./rows";
import type { Device } from "../machine/device";

// A tap moves the pointer less than this between press and release (px)
export const TAP_SLOP = 10;
// A press held this long (ms) is a hold, as Home Assistant's own hold action
export const HOLD_TIME = 500;

// Scrubbing: no change within this distance of the press (px), and a new
// value every tick (ms) while the pointer is held. Beyond the dead zone,
// each tick moves (distance / SCRUB_SCALE) ^ SCRUB_POWER steps: one step a
// tick at SCRUB_SCALE px, slowly faster farther out.
const SCRUB_DEAD_ZONE = 6;
const SCRUB_TICK = 50;
const SCRUB_SCALE = 60;
const SCRUB_POWER = 1.5;

type Pull = (dx: number, dy: number) => number;

/**
 * Press, then slide: while the pointer is held the values change, faster the
 * farther the pointer is from where the press started, and the pointer is
 * captured, so the slide can leave the element. pulls[i](dx, dy) is the
 * distance that counts for value i (positive raises it); change(i, steps)
 * moves value i by that many steps; done() commits them. On a key the slide
 * starts at the press, and the arrow keys move the first value one step at
 * a time. With tap (a field), it starts only once the pointer moves: a tap
 * is left to the field.
 */
export function scrub(el: HTMLElement, { pulls, change, done, tap = false }:
  { pulls: Pull[]; change: (index: number, steps: number) => void; done: () => void; tap?: boolean }): void {
  let start: { x: number; y: number } | undefined, at = { x: 0, y: 0 }, timer: ReturnType<typeof setInterval> | undefined;
  const off = () => (el as HTMLButtonElement).disabled || el.classList.contains("disabled");
  const begin = (ev: PointerEvent) => {
    try {
      el.setPointerCapture(ev.pointerId);
    } catch {
      // A pointer the browser no longer tracks: the slide still follows the moves the element gets
    }
    timer = setInterval(() => {
      pulls.forEach((pull, i) => {
        const distance = pull(at.x - start!.x, at.y - start!.y);
        const beyond = Math.max(0, Math.abs(distance) - SCRUB_DEAD_ZONE);
        if (beyond) change(i, Math.sign(distance) * (beyond / SCRUB_SCALE) ** SCRUB_POWER);
      });
    }, SCRUB_TICK);
  };
  const stop = (ev: PointerEvent) => {
    if (!start) return;
    const sliding = timer !== undefined;
    clearInterval(timer);
    timer = undefined;
    start = undefined;
    if (el.hasPointerCapture?.(ev.pointerId)) el.releasePointerCapture(ev.pointerId);
    if (sliding) done();
  };
  el.addEventListener("pointerdown", (ev) => {
    if (off() || ev.button !== 0) return;
    start = at = { x: ev.clientX, y: ev.clientY };
    if (tap) return;
    ev.preventDefault();
    begin(ev);
  });
  el.addEventListener("pointermove", (ev) => {
    if (!start) return;
    at = { x: ev.clientX, y: ev.clientY };
    if (tap && timer === undefined && Math.hypot(at.x - start.x, at.y - start.y) > SCRUB_DEAD_ZONE) {
      // A drag, not a tap: it slides, and the field is not typed in
      el.querySelector("input")?.blur();
      begin(ev);
    }
  });
  el.addEventListener("pointerup", stop);
  el.addEventListener("pointercancel", stop);
  el.addEventListener("lostpointercapture", stop);
  if (tap) return;
  el.addEventListener("keydown", (ev) => {
    const way = ({ ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 } as Record<string, number>)[ev.key];
    if (!way || off()) return;
    ev.preventDefault();
    ev.stopPropagation();
    change(0, pulls[0](way, -way) > 0 ? 1 : -1);
    done();
  });
}

// The laser's position being slid, before it is set: { "<x entity>|<y
// entity>": [x, y] }, and an event on TARGETS when it changes (the camera
// draws it)
export const PENDING_TARGETS = new Map<string, number[]>();
export const TARGETS = new EventTarget();
export function announceTarget(entities: string[] | undefined, values?: number[]): void {
  if (entities?.length !== 2) return;
  const key = entities.join("|");
  if (values) PENDING_TARGETS.set(key, values);
  else PENDING_TARGETS.delete(key);
  TARGETS.dispatchEvent(new Event("change"));
}

// What a slide counts: X right, Y down (the work area's Y runs from the
// back to the front, as in the camera picture), xy right or up
const PULLS: Record<string, Pull> = { x: (dx) => dx, y: (_dx, dy) => dy, xy: (dx, dy) => dx - dy };

// A field is in the number color, as Home Assistant's number features are
const NUMBER_ON = "var(--state-number-active-color, var(--state-active-color, var(--primary-color, #03a9f4)))";

/** What a field needs of its feature. */
export interface FieldHost extends KeyHost {
  readonly _device: Device;
}

/**
 * A field in the feature's row: the numbers of its entities in one text
 * field (several are typed with commas between them: X,Y). Pressed and
 * dragged on, it slides its numbers by its drag axes, and sets them when
 * the slide ends; a tap types in it. Kept while the feature shows it, so
 * typing and sliding go on while Home Assistant's states change.
 */
export class FieldGroup {
  readonly el: HTMLDivElement;
  private _field: HTMLLabelElement;
  private _input: HTMLInputElement;
  private _entities: string[] = [];
  private _pending?: number[];
  private _shown = "";

  constructor(private _feature: FieldHost, private _control: Control) {
    this.el = document.createElement("div");
    this.el.className = "group";
    // Its control, for the order chosen
    this.el.dataset.control = _control.id;
    this._field = document.createElement("label");
    this._field.className = "field";
    this._field.style.setProperty("--feature-color", NUMBER_ON);
    this._field.dataset.min = String(ITEM_MIN.field);
    this._input = document.createElement("input");
    this._input.type = "text";
    this._input.enterKeyHint = "done";
    this._input.inputMode = _control.roles!.length > 1 ? "text" : "decimal";
    this._field.append(this._input);
    this._input.addEventListener("keydown", (ev) => {
      ev.stopPropagation();
      if (ev.key === "Enter") this._input.blur();
      if (ev.key === "Escape") {
        this._input.value = this._shown;
        this._input.blur();
      }
    });
    this._input.addEventListener("change", () => this._typed());
    this._input.addEventListener("click", (ev) => ev.stopPropagation());
    this.el.append(this._field);
    if (_control.drag) {
      this._field.classList.add("drag");
      scrub(this._field, {
        pulls: _control.drag.map((axis) => PULLS[axis]), tap: true,
        change: (index, steps) => this._slide(index, steps),
        done: () => this._release(),
      });
    }
  }

  private get _states(): (HassEntity | undefined)[] {
    return this._entities.map((entityId) => this._feature._hass!.states[entityId]);
  }

  private _values(): number[] {
    return this._states.map((stateObj) => Number(stateObj?.state));
  }

  // Blank while no number is known (unknown or unavailable)
  private _format(values: number[]): string {
    if (!values.some(Number.isFinite)) return "";
    return values.map((value, i) => (Number.isFinite(value) ? value.toFixed(decimalsOf(this._control, this._states[i])) : "")).join(",");
  }

  /** Show the item's entities and state: the field, unless it is being typed in. */
  update(item: Item): void {
    this._entities = item.entities!;
    const feature = this._feature;
    const usable = this._entities.every((entityId) => feature._usable(entityId));
    const values = this._pending ?? this._values();
    this._shown = this._format(this._values());
    this._input.disabled = !usable;
    this._field.classList.toggle("disabled", !usable);
    // Named as in the editor: Laser position X and Y, Laser position
    nameItem(this._field, fieldName(feature._hass, this._control, feature._device) ?? this._entities.join(", "));
    this._input.setAttribute("aria-label", this._field.title);
    if (this._pending || feature.shadowRoot?.activeElement !== this._input) this._input.value = this._format(values);
  }

  // A slide moves the pending number by steps of its entity's step (never
  // less than the field shows), within its range
  private _slide(index: number, steps: number): void {
    const stateObj = this._states[index];
    const values = this._pending ?? this._values();
    if (!stateObj || !Number.isFinite(values[index])) return;
    const { min = -Infinity, max = Infinity, step = 1 } = stateObj.attributes;
    const unit = Math.max(step, 10 ** -decimalsOf(this._control, stateObj));
    this._pending = values.map((value, i) => (i === index ? Math.min(max, Math.max(min, value + steps * unit)) : value));
    this._input.value = this._format(this._pending);
    announceTarget(this._entities, this._pending);
  }

  private _release(): void {
    const pending = this._pending;
    this._pending = undefined;
    if (pending) this._commit(pending);
    announceTarget(this._entities, undefined);
  }

  // A typed number, or one for each entity with commas between them; a
  // single number may have a decimal comma
  private _typed(): void {
    const text = this._input.value.trim();
    const parts = this._entities.length > 1 ? text.split(/\s*[,;]\s*|\s+/) : [text.replace(",", ".")];
    const values = parts.map((part) => (part === "" ? NaN : Number(part)));
    if (values.length !== this._entities.length || values.some((value) => !Number.isFinite(value))) {
      this._input.value = this._shown;
      return;
    }
    this._commit(values);
  }

  /**
   * Set each number that changed, rounded to what it shows and kept within
   * its range. The field shows the new numbers once Home Assistant has them.
   */
  private _commit(values: number[]): void {
    const states = this._states, now = this._values();
    values.forEach((value, i) => {
      const stateObj = states[i];
      if (!stateObj || !Number.isFinite(value)) return;
      const factor = 10 ** decimalsOf(this._control, stateObj);
      const { min = -Infinity, max = Infinity } = stateObj.attributes;
      const next = Math.min(max, Math.max(min, Math.round(value * factor) / factor));
      if (next !== now[i]) this._feature._hass!.callService("number", "set_value", { entity_id: this._entities[i], value: next });
    });
  }
}
