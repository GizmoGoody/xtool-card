// The card's own look: the frame, the xTool style's body and window, the
// features styles' patches and channels, the progress edge and the badges.
import { css } from "lit";

export const cardStyles = css`
  :host { display: block; height: 100%; }
  .frame {
    /* The theme's text colors, for a window in the theme's own colors
       (the tile's text is the body's, see .tile.dark and .tile.light) */
    --xtool-theme-primary-text: var(--primary-text-color); --xtool-theme-secondary-text: var(--secondary-text-color);
    --xtool-theme-disabled-text: var(--disabled-text-color);
    position: relative; height: 100%; box-sizing: border-box; isolation: isolate;
    /* Exactly the tile card's own corners (ha-card), from the theme */
    border-radius: var(--ha-card-border-radius, var(--ha-border-radius-lg, 12px));
  }
  /* Only the decorations are clipped to the rounded outline; the tile
     card is not, so its callouts can extend past the card's edge */
  .clip { position: absolute; inset: 0; border-radius: inherit; overflow: hidden; pointer-events: none; }
  .clip.over { z-index: 2; }
  /* No divider between features side by side (a theme can set one) */
  .tile { position: relative; display: block; height: 100%; --ha-card-feature-divider: none; }

  /* The xTool style: the body behind everything, the window behind the title */
  #body, #window { position: absolute; display: none; }
  .styled #body { display: block; inset: 0; }
  .styled #window { display: block; overflow: hidden; border-radius: max(4px, calc(var(--ha-card-border-radius, 12px) - 5px)); }
  #window::after { content: ""; position: absolute; inset: 0; background: var(--xtool-gloss); }
  /* A machine that is off: its window dims a little, so it still reads in its own color; the body does not */
  #window { transition: filter 400ms ease-in-out; }
  .off:not(.plain) #window { filter: brightness(.8) saturate(.9); }
  .styled #body { background: var(--xtool-body); }
  .styled #window { background: var(--xtool-glass); box-shadow: var(--xtool-edge); }
  .styled::after {
    content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; z-index: 3;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, .3), inset 0 -1px 0 rgba(0, 0, 0, .4);
  }
  .styled .tile {
    --ha-card-background: transparent; --card-background-color: transparent;
    --ha-card-box-shadow: none; --ha-card-border-color: transparent; --ha-card-backdrop-filter: none;
  }
  /* The text on the body, and the controls' backing in each features style.
     Disabled text (a laser that is off or unreachable) as Material's on
     that tone, so it stays readable whatever the theme's own is */
  .tile.dark {
    --primary-text-color: rgba(255, 255, 255, .95); --secondary-text-color: rgba(235, 235, 240, .7);
    --disabled-text-color: rgba(255, 255, 255, .38);
    --xtool-text: rgba(255, 255, 255, .95); text-shadow: 0 1px 2px rgba(0, 0, 0, .8);
    --xtool-feature-scrim: rgba(0, 0, 0, .45);
  }
  .tile.light {
    --primary-text-color: rgba(0, 0, 0, .85); --secondary-text-color: rgba(40, 40, 48, .62);
    --disabled-text-color: rgba(0, 0, 0, .38);
    --xtool-text: rgba(0, 0, 0, .85); --xtool-feature-scrim: rgba(255, 255, 255, .45);
  }
  .tile.dark.solid { --xtool-feature-backing: #1e1f22; }
  .tile.light.solid { --xtool-feature-backing: #eceef1; }
  /* Flat: a patch of the body's base color behind each control; Console: a channel */
  #areas { position: absolute; inset: 0; }
  .area { position: absolute; box-sizing: border-box; }
  .area.flat { background: var(--flat); box-shadow: 0 0 3px 1px var(--flat); }
  .area.console {
    background: linear-gradient(180deg, rgba(0, 0, 0, .22), rgba(0, 0, 0, .08));
    box-shadow:
      inset 0 2px 3px rgba(0, 0, 0, .55), inset 0 1px 1px rgba(0, 0, 0, .4),
      inset 0 -1px 0 rgba(255, 255, 255, .14), 0 1px 0 rgba(255, 255, 255, .18);
  }

  /* The progress edge */
  #edge { position: absolute; display: none; overflow: hidden; }
  #edge.on { display: block; }
  #edge.around {
    inset: 0; border-radius: inherit; box-sizing: border-box;
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    mask-composite: exclude;
  }
  #edge .sweep { position: absolute; display: none; border-radius: 3px; }
  #edge.indeterminate .sweep { display: block; }
  #edge.indeterminate.horizontal .sweep { top: 0; bottom: 0; width: 30%; animation: sweep-x 2.2s ease-in-out infinite; }
  #edge.indeterminate.vertical .sweep { left: 0; right: 0; height: 30%; animation: sweep-y 2.2s ease-in-out infinite; }
  #edge.indeterminate.around { animation: pulse 2s ease-in-out infinite; }
  @keyframes sweep-x { from { left: -30%; } to { left: 100%; } }
  @keyframes sweep-y { from { top: -30%; } to { top: 100%; } }
  @keyframes pulse { 0%, 100% { opacity: .35; } 50% { opacity: 1; } }
  @media (prefers-reduced-motion: reduce) {
    #edge.indeterminate .sweep, #edge.indeterminate.around { animation: none; }
    #edge.indeterminate.horizontal .sweep { left: 35%; }
    #edge.indeterminate.vertical .sweep { top: 35%; }
  }
  #pct {
    position: absolute; right: 16px; bottom: 12px; display: none;
    font: 700 14px/1 var(--ha-font-family-body, inherit); text-shadow: 0 1px 3px rgba(0, 0, 0, .8);
  }
  #pct.on { display: block; }

  /* The badges on the picture: the status badge at the top right, the connection badge at the bottom right */
  .badge {
    position: absolute; z-index: 3; width: 18px; height: 18px; margin: -9px 0 0 -9px; box-sizing: border-box;
    display: none; place-items: center; border-radius: 50%; pointer-events: none;
    border: 2px solid var(--xtool-badge-ring, var(--ha-card-background, var(--card-background-color, #fff)));
    color: #fff;
  }
  .badge.on { display: grid; }
  .badge { overflow: hidden; line-height: 0; }
  .badge ha-state-icon {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    --mdc-icon-size: 12px; --ha-icon-display: flex;
  }
  .styled .badge { --xtool-badge-ring: rgba(0, 0, 0, .55); }
`;

const ICON_PADDING = "6px";
export const LIGHT_SHEET = `
  :host([xtool-light]) ha-tile-icon { position: relative; }
  :host([xtool-light]) ha-tile-icon::after {
    content: ""; position: absolute; inset: ${ICON_PADDING}; z-index: 1; pointer-events: none;
    border-radius: 50%; border: 3px solid var(--xtool-light);
  }
  :host([xtool-light="slow"]) ha-tile-icon::after { animation: xtool-light-blink 2s step-end infinite; }
  :host([xtool-light="fast"]) ha-tile-icon::after { animation: xtool-light-blink .6s step-end infinite; }
  :host([xtool-light="breathe"]) ha-tile-icon::after { animation: xtool-light-breathe 3s ease-in-out infinite; }
  @keyframes xtool-light-blink { 50% { border-color: transparent; } }
  @keyframes xtool-light-breathe { 50% { border-color: transparent; } }
  @media (prefers-reduced-motion: reduce) { :host([xtool-light]) ha-tile-icon::after { animation: none; } }`;

export const HA_CONTROL_SHEET = `
  :host([xtool-slide]) .switch .background,
  :host([xtool-slide]) .switch:hover .background,
  :host([xtool-slide]) .switch:focus-visible .background { opacity: 0 !important; }
  :host([xtool-slide]) { --control-switch-padding: 0px !important; }
  :host([xtool-slide]) .switch { padding: 0 !important; }
  :host([xtool-slide]) .switch .button {
    position: relative;
    background-color: var(--control-switch-on-color);
    background-image: linear-gradient(180deg, rgba(255,255,255,.4), rgba(255,255,255,.05) 40%, rgba(0,0,0,.05) 60%, rgba(0,0,0,.3));
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,.6), inset 0 -1px 0 rgba(0,0,0,.35),
      inset 1px 0 0 rgba(255,255,255,.25), inset -1px 0 0 rgba(0,0,0,.25),
      0 1px 2px rgba(0,0,0,.55);
  }
  :host([xtool-slide]) .switch .button ha-svg-icon,
  :host([xtool-slide]) .switch .button slot { display: none; }
`;
