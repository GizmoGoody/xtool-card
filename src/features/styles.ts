// The features' look: keys, read-outs, fields, sliders and lights, as Home
// Assistant's own features draw them, in the theme's radius and spacing.
import { ENABLED } from "../const";
import { ITEM_MIN } from "./rows";

// Console (the xtool-console attribute): the buttons become keys that press in
export const KEY_CSS = `
  :host([xtool-console]) .key {
    background-image: linear-gradient(180deg, rgba(255,255,255,.35), rgba(255,255,255,0) 45%, rgba(0,0,0,.18));
    box-shadow: inset 0 1px 0 rgba(255,255,255,.55), inset 0 -2px 2px rgba(0,0,0,.3), 0 2px 3px rgba(0,0,0,.5);
    transition: transform 120ms ease-in-out, box-shadow 120ms ease-in-out;
  }
  :host([xtool-console]) .key:not(:disabled):active,
  :host([xtool-console]) .key:not(:disabled)[aria-pressed="true"] {
    /* Pressed in: the same size, set lower, lit from above */
    transform: translateY(1px);
    background-image: linear-gradient(180deg, rgba(0,0,0,.28), rgba(0,0,0,.06) 40%, rgba(255,255,255,.1));
    box-shadow: inset 0 3px 6px rgba(0,0,0,.55), inset 0 1px 2px rgba(0,0,0,.4), inset 0 -1px 0 rgba(255,255,255,.25);
  }
  /* A key that cannot be used now lies flat: not raised, and it does not press in */
  :host([xtool-console]) .key:disabled { background-image: none; box-shadow: none; transform: none; }
`;

// The chevron under an icon: bolder than the icon font draws it
export const CHEVRON_CSS = `
  .glyph { display: flex; flex-direction: column; align-items: center; min-width: 0; }
  .glyph .arrow {
    --mdc-icon-size: 18px; height: 18px; margin-top: -7px;
    filter: drop-shadow(0 0 .35px currentColor) drop-shadow(0 0 .35px currentColor);
  }
`;

// One line of items that fills the row (see fitRow): keys of one width, a
// slider or select twice as wide, a light's icon as wide as a key. A row
// with a field (.flow): each key a fifth of the row, and the field the
// rest. Keys are tinted in their color, the ones that are on filled.
export const ROW_CSS = `
  .row { display: flex; flex-wrap: nowrap; align-items: center; column-gap: var(--feature-button-spacing, 12px); height: var(--feature-height, 42px); }
  .row [data-dropped] { display: none !important; }
  .row .key { flex: 1 1 0; min-width: ${ITEM_MIN.key}px; }
  .row .slide { flex: 2 1 0; min-width: ${ITEM_MIN.slider}px; }
  .row .slide.select { min-width: ${ITEM_MIN.select}px; }
  .row.flow .key { flex: 0 1 calc((100% - 4 * var(--feature-button-spacing, 12px)) / 5); }
  .row .field { flex: 1 1 0; min-width: ${ITEM_MIN.field}px; }
`;
// On the xTool card, Match dims the style under each key (a scrim) and
// Flat and Console give each key a solid backing.
export const FEATURE_CSS = `
  :host { display: block; min-width: 0; max-width: 100%; }
  ${ROW_CSS}
  /* A field and its keys move as one group, without a box of their own */
  .group { display: contents; }
  .field {
    position: relative; display: flex; align-items: center; justify-content: center; height: 100%; box-sizing: border-box;
    border-radius: var(--feature-border-radius, 12px); overflow: hidden; cursor: text;
    color: var(--xtool-text, var(--primary-text-color)); font-weight: var(--ha-font-weight-medium, 500);
  }
  .field::before { content: ""; position: absolute; inset: 0; background: var(--feature-color); opacity: .2; }
  /* On an xTool style, a number field is a pane of its window's glass, in its window's text color */
  .field:not(.readout):not(.disabled) { color: var(--xtool-field-text, var(--xtool-text, var(--primary-text-color))); box-shadow: var(--xtool-field-edge, none); }
  .field:not(.readout):not(.disabled)::before { background: var(--xtool-field, var(--feature-color)); opacity: var(--xtool-field-opacity, .2); }
  .field:focus-within { outline: 2px solid var(--feature-color); outline-offset: 2px; }
  .field > * { position: relative; }
  .field input {
    width: 100%; min-width: 0; margin: 0; padding: 0 4px; border: 0; outline: none; background: transparent;
    font: inherit; color: inherit; text-align: center;
  }
  /* Unavailable or unknown: as Home Assistant's own controls, in its disabled colors */
  .field.disabled { cursor: default; color: var(--disabled-text-color, #bdbdbd); }
  .field.disabled::before { background: var(--disabled-color, #bdbdbd); opacity: .2; }
  /* A read-out: a field, tinted and its icon in its state's color */
  .field.readout { cursor: pointer; gap: 6px; padding: 0 4px; font-size: var(--ha-font-size-s, 12px); min-width: 0; }
  .field.readout::before { background: var(--c, ${ENABLED}); }
  .field.readout:focus-visible { outline: 2px solid var(--c, ${ENABLED}); outline-offset: 2px; }
  .slide { --feature-color: ${ENABLED}; }
  .field.readout ha-state-icon { flex: none; --mdc-icon-size: 22px; color: var(--c, ${ENABLED}); }
  .row .field.readout { flex: 1 1 0; min-width: ${ITEM_MIN.key}px; }
  /* A field to press and drag on: the page does not scroll under it */
  .field.drag { touch-action: none; cursor: move; }
  .key {
    min-width: 0; height: 100%; padding: 0 4px; border: 0; cursor: pointer; box-sizing: border-box; overflow: hidden;
    position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; gap: 6px;
    border-radius: var(--feature-border-radius, 12px);
    background: var(--xtool-feature-backing, var(--xtool-feature-scrim, transparent));
    color: var(--xtool-text, var(--primary-text-color)); font: inherit; font-size: var(--ha-font-size-s, 12px); font-weight: 500;
  }
  .key::before { content: ""; position: absolute; inset: 0; background: var(--c, ${ENABLED}); opacity: .2; transition: opacity 180ms ease-in-out; }
  /* A switch that is off: Home Assistant's off color, not its own */
  .key[aria-pressed="false"]:not(.fill)::before { background: var(--disabled-color, #bdbdbd); }
  .key:hover::before { opacity: .35; }
  .key[aria-pressed="true"]::before { opacity: 1; }
  .key[aria-pressed="true"] { color: var(--xtool-on-color, #fff); }
  .key:focus-visible { outline: 2px solid var(--c, ${ENABLED}); outline-offset: 2px; }
  /* Unavailable or unknown (or not usable now): as Home Assistant's own
     control buttons, its disabled color behind and its disabled text color */
  .key:disabled { cursor: default; color: var(--disabled-text-color, #bdbdbd); }
  .key:disabled::before, .key:disabled:hover::before { background: var(--disabled-color, #bdbdbd); opacity: .2; }
  .key > * { position: relative; }
  .key ha-icon, .key ha-state-icon { flex: none; --mdc-icon-size: 22px; }
  /* The icon (or name) with the chevron for where the part sits centered under it */
  ${CHEVRON_CSS}
  /* A fan's icon turns while it runs, faster at a higher speed */
  .spin { animation: xtool-spin var(--spin, 1.2s) linear infinite; }
  @keyframes xtool-spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .spin { animation: none; } }
  span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  /* Filled in its color without being on: a safety check that is off */
  .key.fill::before { opacity: 1; }
  .key.fill { color: var(--xtool-on-color, #fff); }
  ${KEY_CSS}
`;

// A light's slider (its key is a key, see FEATURE_CSS)
export const LIGHT_CSS = `
  .slide { display: block; min-width: 0; border-radius: var(--feature-border-radius, 12px); }
  .slide[hidden] { display: none; }
  /* A slider's icon, centered, as large as a key's: blended into the
     slider (overlay), so it shows through its track and its filled part as
     if behind them, while the white handle stays white over it. The slide
     is isolated, so only the slider is blended with, in every features style */
  .slide.slider { position: relative; isolation: isolate; }
  .slide.slider > ha-state-icon {
    position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); pointer-events: none;
    --mdc-icon-size: 22px; color: var(--primary-text-color); mix-blend-mode: overlay; display: flex;
  }
  /* Off or unavailable, dimmed as a key is */
  .slide.slider > ha-state-icon.off { opacity: .45; }
  ${CHEVRON_CSS}
`;
