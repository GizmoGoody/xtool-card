# xTool card: behavior spec

The tests check the card against this list. It comes from:
- what the card does today (`reference/prototype.js`, the last single-file card),
- the decisions recorded while it was built,
- the README and COLORWAYS,
- your feedback from testing on the F2 Ultra UV and the P2.

Every behavior has an ID. Each check is named by its subject (for example "camera, crop"), and the table says which subjects cover each behavior. The checks in `feedback.html` are named by their ID.

The tests are in two places:
- **Browser pages, `tests/browser/*.html`:**
  - They load a card bundle, with stand-ins for the parts of the Home Assistant frontend that the card uses. The bundle is the page's `?bundle=`, or the built card.
  - To run them on the built card: `python tests/browser/run.py`.
  - To run them on the prototype: `python tests/browser/run.py reference/prototype.js`.
- **Unit tests, `tests/unit/*.test.ts`:**
  - They check the parts of the card that need no page.
  - To run them: `npm test`.

**What the checks use.** The checks use only what the card shows:
- element tags,
- the config they give it,
- the hass they give it,
- `data-key` on keys,
- rendered text and titles,
- computed styles,
- the service calls it makes.

They also find a few parts by their class names. The rewrite keeps these names so the checks keep working:
- `row` (a feature's row) and `sections` / `line` (the camera's two lines)
- `key`, `field` and `slide` (the items in a row), and `group` (a field with its key)
- `shot` (the camera picture), `hint`, `time`, `marks` / `looks` (the overlays drawn by the card) and `reticle`
- `frame` / `styled` (the styled card), `area` (a patch or channel), and `badge status` / `badge connection`

**"Real Home Assistant"** marks a behavior the stand-ins cannot show. Check it on a dashboard.

## The card
| ID | Behavior | Checked in |
| --- | --- | --- |
| K-1 | The card is Home Assistant's tile card, wrapped. The tile's own options keep working; the card changes only these defaults: the device's name, features inline, State content (state, engraving lens if the laser has one, elapsed), and the picture always shown. | card.html "defaults", editor.html "editor" |
| K-2 | A state picture replaces the icon for each phase: idle (a dot with a halo), processing (a galvo UV trail that never crosses itself, or a CO2 raster), paused, finished, sleeping, framing, error, fire and off. | card.html "idle", "F2 processing", "P2 processing", "paused", "finished", "sleeping", "framing", "fire warning", "error", "off" |
| K-3 | The tile card gets a new hass only when something it shows changes. Its states read through to Home Assistant's; none are copied. | card.html "updates" |
| K-4 | State content offers every sensor of the laser, the chosen diagnostics (Wi-Fi signal, working time, last job time, firmware, CPU temperature) and the parts the card reports. Elapsed shows while a job runs, and the last job's time once it is finished. | card.html "state content", "state content, sensors", "finished" |
| K-5 | A card whose laser has no style option set takes the laser model's style. A new card from the picker has the Job and Controls features, or Controls alone on a laser without a Start key. | card.html "defaults", editor.html "new card" |
| K-6 | The card counts as the tile card's rows in a sections grid, with auto rows and the tile card's columns. The camera counts as five rows. | card.html "grid" |
| K-7 | An unknown style is refused with a message. | editor.html "card" |
| B-1 | The console badge is GizmoGoody's card-badge: 🔦 xTool Card, by GizmoGoody, with the Discussions link. | feedback.html B-1 |
| N-1 | The card is xTool in the card picker. Feature types are one word, as in their names; the camera feature is Cameras (`custom:xtool-cameras`). Features are named "xTool" and their name. | feedback.html N-1, features.html "lights", "position" |

## Collapsing
| ID | Behavior | Checked in |
| --- | --- | --- |
| C-1 | Collapsible is on by default. A tap on the title row shows or hides the features; a tap between the features does nothing. The browser remembers the choice. With Collapsible off, the tile's tap action works as set. | card.html "tap shows or hides the features", "defaults", "f2_ultra_uv, match" |
| C-2 | Expanded at load is off by default. Collapsed, the first feature stays beside the title, as on a tile card, and the card is one row tall. | card.html "hidden at load", "hidden at load, inline", "collapsed, controls inline", "header" |
| C-3 | Collapse when powered off and Expand when powered on are on by default. Only a change of power does either. A card that loads while the laser is off is collapsed, and a tap still opens it. | card.html "collapse when off", "expand when powered on", "off at load" |
| C-4 | The editor's preview starts expanded. Edits and the laser turning off leave it as it is; a tap in the preview collapses it without touching the dashboard's remembered state. | card.html "editor preview" |
| C-5 | Leaving edit mode returns the card to how the dashboard shows it. | card.html "dashboard edit ends" |

## Badges, status light and progress edge
| ID | Behavior | Checked in |
| --- | --- | --- |
| D-1 | The status badge is at the top right of the picture: the first in the Status badge list that applies (alarm, safety key, lid, safety checks, firmware), with that entity's own icon. A fire warning comes first. Only the badges the laser has are offered. | card.html "no badge", "safety key out", "a safety check off", "badge order", "badge icons", "P2 lid open", "badges turned off", editor.html "badges" |
| D-2 | The connection badge is at the bottom right: Ethernet, Wi-Fi or USB in the Enabled color, or Unavailable. It is the same size as the status badge, straight below it, tucked in from the picture's edge. It is on by default. | card.html "connection", "unavailable", "badge icons" |
| D-3 | The status light is a 3 px ring on the tile's icon, in the color and pattern of the laser's own light (white, blinking slowly while it works; the P2's ring white while idle). None while the laser is off. It is on by default. | card.html "status light", editor.html "status light" |
| D-4 | The progress edge fills along the chosen edge (top by default, or bottom, left, right, around) while a job runs. It can start and end along the edge, show the percentage, and use the state's color or thresholds. With no progress sensor it sweeps. | card.html "progress 42 on top", "from 10 to 90", "around", "left", "edge none", "not shown while idle", "thresholds", "no progress sensor: sweep" |

## Styles
| ID | Behavior | Checked in |
| --- | --- | --- |
| Y-1 | There is a style for each xTool model and each color it is sold in (COLORWAYS), and None (theme). A style has a body and a window. Every orange plexi uses the F2 Ultra UV's orange. A model with no window shows the theme's card behind the title. | card.html "styles", "f2_ultra_uv, match", editor.html "editor" |
| Y-2 | The window covers the title row only. It keeps its height when the card expands, and its glass has a sheen and reflections set by the pattern (4242 by default; Randomize reflections in the editor). | card.html "f2_ultra_uv, match", "reflections", editor.html "reflections" |
| Y-3 | While the laser is off, only the window dims (slightly on the F2 Ultra UV), never the body. | card.html "off, p2", "off, f2_ultra_uv" |
| Y-4 | Features style is Console by default: each key a key and each toggle a slide, in a channel. Flat puts a patch behind each button, Match none. No line under the title row; the theme's feature divider is off. | card.html "defaults", "p2, console", "f2_ultra_uv, flat", "no style", editor.html "editor" |
| Y-5 | Text and disabled colors are readable on the style's tone. Number fields take the window's glass on a style, and Home Assistant's number color without one. | card.html "styles", "number fields" |
| Y-6 | The Enabled color (Info by default, then blue) is shared by every feature for keys that are on and for sliders. Red is for warnings only. | card.html "enabled color", features.html "safety" |
| Y-7 | Corners follow the theme; a rounder theme stays as round as the collapsed card allows. | card.html "corners", real Home Assistant |

## Layout and spacing
| ID | Behavior | Checked in |
| --- | --- | --- |
| L-1 | Features inline: half width, left and right in the order chosen, none overlapping. Last feature full width (on by default) stretches a last feature alone in its row. Each feature is told how many columns share its row. At the bottom, Home Assistant's one column. | card.html "layout, last feature", "layout, bottom", "layout, core" |
| L-2 | The camera is full width by default. Without it, the features after it sit beside it, one per row, until they pass the bottom of the picture. A feature alone before a full-width camera takes the full width. | card.html "layout, camera full width", "layout, camera in one column", "layout, camera cells"; unit "featurePlaces" |
| L-3 | A feature that shows nothing takes no place, and neither does Home Assistant's element around it. | features.html "empty", "focus, inner lens" |
| L-4 | The window holds the inline feature, centered on the icon. Space under the window equals the space between rows, in every features style and position. The title row is the same height on every card. | card.html "gap", "inline job", "header" |
| L-5 | Spacing follows the tile card (56 px title row, 42 px features, 36 px beside the title, 12 px between features). | features.html "heights", real Home Assistant |
| L-6 | Home Assistant's features inside a Console card get one channel each, fitted to the 42 px controls. | card.html "console, Home Assistant features inside" |

## Rows and keys
| ID | Behavior | Checked in |
| --- | --- | --- |
| R-1 | A row never wraps into a second line and never overflows its feature, at desktop and phone width. | feedback.html R-1 |
| R-2 | Keys share the row's width and fill it. No key is narrower than Home Assistant's 36 px icon; the last chosen are left out until they fit. The icon keeps its size. | features.html "keys", feedback.html R-2 |
| R-3 | Show is Icons by default in every feature: the entity's own icon (Home Assistant's state icon). Names are one word. Icons and names shows both. | features.html "show", "controls", "camera, show" |
| R-4 | Every key, field and slider names its entity when hovered. | features.html "controls", "P2 camera", "position", feedback.html T-1 |
| R-5 | Keys show on and off, in the Enabled color when on. A key that starts something (Autofocus, Measure) is pressed, not toggled. A read-out that cannot be changed is a field, not a button. | features.html "controls", "safety, read-out" |
| R-6 | Unavailable or unknown controls are dimmed, in no state's color, and kept in place. | features.html "safety", "settings", "IF2 fan, unavailable", "focus, off" |
| R-7 | When two lights share an icon, a chevron under it shows where each sits (front down, back up). No chevrons when the icons differ. | features.html "direction", "lights" |
| R-8 | A running fan's icon turns (Animate fan, on by default); a fan that is off is still. | features.html "animate fan" |
| R-9 | Fields: tap to type, or press and slide to change; farther from the press is faster; the value is set when the slide ends. Typed text that is not a number is put back. A field keeps its focus and typed text while the keys change. | features.html "focus, slide", "focus, typed", "position, drag", "field" |
| R-10 | Options at their defaults are not saved, in the card and in every feature. | features.html "defaults", editor.html "editor" |

## Features
| ID | Behavior | Checked in |
| --- | --- | --- |
| J-1 | Job: Start / Pause and Cancel by default, or Start, Pause and Cancel apart, in the chosen order. Resume while paused. Cancel asks first in Home Assistant's dialog (Keep it, or cancel), unless turned off. | features.html "job, processing", "job, idle", "job, paused", "job, chosen", "job, options" |
| O-1 | Controls: every control the laser has, in order, Autofocus last. Power asks first while a job runs. No Autofocus while a job runs. Fill lights are buttons with no dimming. | features.html "controls", "controls, chosen", "fill lights as buttons" |
| O-2 | Configuration: the integration's config entities; every other entity is in Controls. An accessory's control starts with the accessory's name (IF2 Buzzer). | features.html "settings", "settings, P2", "settings, accessory", "accessories" |
| O-3 | The P2's Wake key is in Controls. | features.html "wake, P2" |
| S-1 | Safety: the checks, the safety key, the lid and Access control. A check that is off is in the Disabled color (the theme's Error, else red); the color picker offers the theme's Error, Warning, Success and Info first. Turning the flame alarm off asks: Turn off or Keep on. No dialog of the card's own. | features.html "safety", "safety, disabled color" |
| S-2 | The P2's flame alarm level is in Safety: its icon with H or L; a tap steps to the next level. No letter while unknown or unavailable. | features.html "safety, flame alarm", "safety, P2", "P2 safety" |
| S-3 | Access control: turning it on asks and says what it turns off. While on: no Autofocus, no Start and no Pause, as in Studio; Cancel and Resume stay. | features.html "safety, access control", "access control on" |
| G-1 | Lights: Home Assistant's tile icon and light brightness feature for each light, in one row, in the order chosen, colored as the tile card colors them. A new feature shows every light. Off at minimum (off by default) turns a light off at 1%. | features.html "lights", "lights, off at minimum", "lights, options", "lights, P2" |
| G-2 | A slider's icon is centered in it, as large as a key's icon, dimmed while its light is off. | features.html "slider icon" |
| F-1 | Focus: Autofocus (as wide as one of five Controls keys), then the focus height in a field, always one decimal, no unit, within its range. Hidden with the inner lens. No Autofocus while a job runs or with Access control on. | features.html "focus", "focus, slide", "focus, typed", "focus, options", "focus, inner lens", "focus, busy", "focus, access control", "focus, off" |
| I-1 | SafetyPro IF2 fan: Off, A (Auto) and the speed key, which steps 1 to 4. Auto spinning: A in the Enabled color, turning with the speed. Keys can be chosen and ordered. Kept in place, disabled, while the laser does not see the IF2. | features.html "IF2 fan", "IF2 fan, keys", "IF2 fan, options", "IF2 fan, unavailable", "first IF2" |
| P-1 | Position: X and Y in one field in whole mm (blank, not a lone comma, when unknown), then Move and Home. Drag right or left for X, up or down for Y, diagonally for both. | features.html "position", "position, typed", "position, drag", "position, unknown", "position, chosen", "position, options" |
| P-2 | While a position is being set, a dashed line runs from the head to a reticle at the target, in the laser target's color. Only while the Laser target overlay is on. | features.html "target" |
| V-1 | Overlays: each camera's overlay switches by name, five by default (laser target, close camera, slat lines first). | features.html "overlays", "overlays, options", "keys" |

## Cameras
| ID | Behavior | Checked in |
| --- | --- | --- |
| M-1 | Cameras shows Home Assistant's image element, Auto view by default. Home Assistant loads it through the card helpers. A tap opens the camera. Live hides the camera keys. | camera-loading.html, features.html "camera", "camera, live" |
| M-2 | One image at a time: switching cameras removes the other's image, so it stops fetching and a live stream closes. When the connection returns, the image is made anew. | features.html "camera", "camera, switch", "P2 camera, switch", "camera, reconnect" |
| M-3 | Kept in place while the laser is off. The last updated time shows by default, in the card's Time format; none on a live stream or before a picture arrives. | features.html "camera, off", "camera, time", card.html "camera time" |
| M-4 | Controls in two lists: All cameras (the top line) and Per camera (the bottom line), each in the order chosen. They keep their places and sizes when the camera changes, each list in its half-width cells. On a camera with few controls, both fit one line. | features.html "P2 camera, sections", "P2 camera, phone", "camera, one row", "camera, order", editor.html "camera, lists" |
| M-5 | Camera buttons (each camera's own icon), Camera toggle (steps to the next camera), Crop, Exposure, the crop preset, Perspective (one key that steps), Mode, Thickness or distance with Measure, and the close fill light's icon and slider. | features.html "P2 camera", "P2 camera, close", "camera toggle", "camera, perspective", "camera, measure", "P2 camera, options" |
| M-6 | Crop on: a tap marks a corner ("Tap a corner to start selection of a crop area"), a rectangle follows the pointer, the second tap crops ("Tap the opposite corner of the custom crop area."). Then "Cropping" until the next picture. Crop stays on until it is turned off. Off: back to the last crop preset, or the whole 200 x 200 mm area. Works with touch and mouse; a swipe is not a tap. | features.html "camera, crop", "P2 crop", "tap, touch", "tap, mouse" |
| M-7 | A cropped picture is never stretched. With Crop off, the whole picture shows, sized by the last picture known, so it never collapses. | real Home Assistant |
| M-8 | Hold on the overview picture to set X and Y to that point. | features.html "hold" |
| M-9 | Overlay styles: the card can draw the overlays itself, in the integration's style or its own (Color, Line, Style, Icon, Size). The laser target follows the head position numbers. A style changed in the editor shows at once. | card.html "overlays, style", "overlays, by the card", editor.html "overlays, style" |

## Editor
| ID | Behavior | Checked in |
| --- | --- | --- |
| E-1 | The tile card's own editor is inside, without the entity and icon options. The laser is chosen with a device picker for xTool lasers. | editor.html "editor", "laser" |
| E-2 | The editor shows the defaults and saves only what differs. The model's style is shown when none is written; None is written for a model with a style. | editor.html "editor", "new card" |
| E-3 | Wording: no note names a model or camera, none just says the list is in order, no "(in priority order)". Expand when powered on comes before Collapse when powered off. With the features at the bottom, Last feature full width is not offered. | editor.html "editor", "editor notes", features.html "editor notes", feedback.html E-1 |
| E-4 | Each feature's editor lists the controls the laser has, to choose and order. | features.html "controls, chosen", "job, options", "focus, options", "overlays, options", "position, options" |

## Real Home Assistant
These cannot be checked with the stand-ins.
| ID | What to check on a dashboard |
| --- | --- |
| H-1 | The camera picture loads, refreshes, and comes back after the phone app returns from the background. |
| H-2 | Theme corners, the tile card's spacing and the window's height look as on a tile card, on desktop and phone (L-5, Y-7). |
| H-3 | A cropped picture keeps its shape and is never stretched; Crop off shows the whole picture (M-7). |
| H-4 | Home Assistant's own elements (light brightness, select options, number fields, confirmation dialogs) look and behave as in a tile card. |
