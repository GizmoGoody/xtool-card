# xTool Card

A Home Assistant dashboard card and tile features for xTool devices.

The card requires the [xTool Laser integration](https://github.com/GizmoGoody/ha-xtool) for the entities it displays and controls.

![xTool Card](https://raw.githubusercontent.com/GizmoGoody/xtool-card/main/docs/xtool-card.png)

> [!WARNING]
> **Alpha developmental software. Use with caution.** This card can expose controls for a xTool machines. Check every control and entity on your machine before relying on it, and keep the manufacturer's safety procedures in place.

## Status

This card is in **Alpha** and is being developed alongside the xTool Laser integration. It is not yet a stable, broadly validated release.

The current development version is **0.1.0-alpha.2**. Alpha releases use SemVer prerelease
versions such as `0.1.0-alpha.1`; the next Alpha release will use the next
number, such as `0.1.0-alpha.2`.

- **Developed with:**
  - xTool F2 Ultra UV
  - xTool P2
- **Hardware-tested:**
  - xTool F2 Ultra UV
  - P2 basic controls
- **In development:**
  - P2 advanced controls
- **Other machines:**
  - The card may work where the integration exposes the expected entities. Please report your findings through a discussion panel and of course feel free to submit your PRs!

## Install

Home Assistant 2026.11 and later include the Marketplace, which replaces HACS. The card needs a Home Assistant version with the Marketplace, or HACS on an older one.

1. Go to **Settings** → **Marketplace**. On the first visit, select **I understand the risks and agree**.
2. In the upper-right corner, select **Add from link**, enter `GizmoGoody/xtool-card` under **GitHub link**, and select **Add**. If asked for the type, choose the dashboard type.
3. Open **xTool Card** and select **Install**, then **Install** again in the dialog.
4. Reload the browser page (in the Companion app, pull down to refresh).

The Marketplace adds the card to **Settings** → **Dashboards** → **Resources** for you. To add the card, edit a dashboard, select **Add card**, and search for **xTool**.

Adding a repository from a link needs a connection to GitHub, which the Marketplace asks for the first time. With HACS on an older Home Assistant, use ⋮ → **Custom repositories**, add `GizmoGoody/xtool-card` with the type **Dashboard**, then select **Download**.

## xTool Laser integration status and dependencies

The primary integration is the upstream
[thecodingdad/ha-xtool repository](https://github.com/thecodingdad/ha-xtool).
This card has the following dependencies:

- **Core entities (released integration):** the laser status, job buttons,
  power, exhaust, lights, safety checks, settings, and ordinary camera
  entities used by the base card features.
- **[PR #28](https://github.com/thecodingdad/ha-xtool/pull/28) — F-series fill-light percentage:** enables the F2 Ultra UV
  fill-light brightness feature to use the same percentage as Studio.
- **[PR #31](https://github.com/thecodingdad/ha-xtool/pull/31) — IF2 2.0 fan:** enables the SafetyPro IF2 fan feature with Off,
  Auto, and speed controls.
- **[PRs #37](https://github.com/thecodingdad/ha-xtool/pull/37), [#38](https://github.com/thecodingdad/ha-xtool/pull/38), [#41](https://github.com/thecodingdad/ha-xtool/pull/41), [#42](https://github.com/thecodingdad/ha-xtool/pull/42), and [#43](https://github.com/thecodingdad/ha-xtool/pull/43) — F2 camera chain:** enable reliable
  F2 camera snapshots/live view, thumbnail refresh, camera-specific devices,
  crop controls, Deep camera perspective, and the calibration image used by
  the camera feature.
- **[PR #40](https://github.com/thecodingdad/ha-xtool/pull/40) — F2 focus height:** enables the F2 focus feature with Autofocus
  and typed or stepped focus height.
- **[PRs #45](https://github.com/thecodingdad/ha-xtool/pull/45), [#46](https://github.com/thecodingdad/ha-xtool/pull/46), and [#47](https://github.com/thecodingdad/ha-xtool/pull/47) — F2 status and sensors:** enable the additional
  F2 status pictures and the F2 sensor/state-content values, including the
  red-dot state.
- **[PRs #49](https://github.com/thecodingdad/ha-xtool/pull/49) and [#50](https://github.com/thecodingdad/ha-xtool/pull/50) — job result and last-job time:** enable failed-job
  reporting and the Last job time value shown by the card's state content.
- **[PR #52](https://github.com/thecodingdad/ha-xtool/pull/52) — held written values:** makes card controls show newly written
  values immediately and retain them until the device reports them.
- **[PR #53](https://github.com/thecodingdad/ha-xtool/pull/53) — sleeping WS-V2 devices:** keeps sleeping-device controls from
  triggering invalid settings reads.
- **[PR #54](https://github.com/thecodingdad/ha-xtool/pull/54) — camera request queue:** prevents camera requests from piling up,
  improving the card's camera feature.
- **[PR #55](https://github.com/thecodingdad/ha-xtool/pull/55) — Access control:** enables the card's Access control behavior,
  including the corresponding job, focus, and safety restrictions.
- **[PR #56](https://github.com/thecodingdad/ha-xtool/pull/56) — F2 focus lens support:** limits the focus feature to the lens
  configuration on which it is usable.
- **[PR #57](https://github.com/thecodingdad/ha-xtool/pull/57) — automatic power-off:** keeps the card's Power control aligned
  with the device after Idle or Sleeping.
- **[PR #58](https://github.com/thecodingdad/ha-xtool/pull/58) — push during accessory polling:** improves the freshness of
  accessory state shown by the controls and state content.
- **[PR #60](https://github.com/thecodingdad/ha-xtool/pull/60) — P2 support:** enables the P2 Overview and Close cameras, crop
  presets, exposure and thumbnail controls, overlays, processing mode,
  thickness/distance measurement, laser positioning, red dots, fill lights,
  safety entities, and related P2 protocol support. PR #60 incorporates or
  depends on several of the camera and state changes above.

In the meantime, [GizmoGoody/ha-xtool](https://github.com/GizmoGoody/ha-xtool)
contains the features required for the card's functionality as documented
above in [Status](#status).

The card and integration are versioned and released independently. A card
update can require newer integration entities, and an integration update can
add entities that an older card does not display.

## Configuration

The card uses the standard Home Assistant tile-card options plus the xTool
options below. The `entity` key is required and must be the laser's Status
sensor. The editor normally selects it by choosing the laser device. The
`icon` and `show_entity_picture` tile options are controlled by the card and
are not configurable.

### Card options

| Key | Required | Default | Description and device support |
| --- | :---: | --- | --- |
| `type` | yes | — | `custom:xtool-card`. |
| `entity` | yes | — | The laser's Status sensor. Any supported device whose integration entities are present. |
| `style` | no | `none` | `none`, `champagne` (F-series), or `graphite` (P-series). |
| `features_style` | no | `match` | `match`, `flat`, or `console`; used only when `style` is not `none`. |
| `pattern` | no | `4242` | Seed for styled-card window reflections; used only when a style is selected. |
| `badges` | no | `alarm`, `connection`, `safety_key`, `lid`, `safety_off` | Badge keys in priority order: `alarm`, `connection`, `safety_key`, `lid`, `safety_off`, or `firmware`. |
| `status_light` | no | `true` | Draw the machine's status-light ring around the picture. Any device with a supported status sensor. |
| `progress` | no | See below | Configure the progress edge. It is determinate on devices with a progress sensor and sweeps while jobs run on devices without one. |
| `collapsible` | no | `false` | Let a tap show or hide the features. Any device. |
| `expanded` | no | `true` | Initial state when `collapsible` is enabled. |
| `auto_collapse` | no | `true` | Collapse while the machine is off and expand when it turns on; used only when `collapsible` is enabled. |

The `progress` object has these defaults:

| Key | Default | Values |
| --- | --- | --- |
| `edge` | `top` | `none`, `top`, `bottom`, `left`, `right`, `around` |
| `thickness` | `4` | Edge thickness in pixels, 1–24 |
| `start` | `0` | Start percentage, 0–100 |
| `end` | `100` | End percentage, 0–100 |
| `direction` | `clockwise` | `clockwise` or `counterclockwise` |
| `color` | `state` | `state`, `thresholds`, or a CSS color |
| `show_percentage` | `false` | Show the percentage on the edge |
| `show_while` | `processing`, `paused` | Phases in which to show the edge: `processing`, `paused`, `framing`, `finished`, `error` |

### Feature options

Features are added inside the card's `features` list or directly to a
Home Assistant tile card. A feature uses the `custom:` type shown below.
Controls are automatically limited to entities present on the selected laser
and its connected camera/accessory devices.

| Feature type | Device support | Keys and defaults |
| --- | --- | --- |
| `custom:xtool-job` | All devices with job buttons | `controls`: `start_pause`, `cancel`; `display`: `both`; `confirm_cancel`: `true`. |
| `custom:xtool-peripherals` | All devices with controls | `controls`: every available control; `display`: `icons`; `animate_fan`: `true`. |
| `custom:xtool-fill-light` | F2 Ultra UV and devices with a dimmable xTool fill light | `lights`: every available dimmable fill light. Uses Home Assistant's light-brightness feature. |
| `custom:xtool-safety` | All devices with safety entities; P2 adds lid and baseplate indicators | `controls`: every available safety control; `display`: `icons`. |
| `custom:xtool-settings` | Devices with configuration switches | `controls`: every available setting; `display`: `icons`. |
| `custom:xtool-camera` | F2 Ultra UV, P2, and any device exposing xTool camera entities | `camera`: first available camera; `camera_view`: `auto`; `display`: `names`; `show_time`: `false`; `crop` and `show_perspective`: `true` when the required entities exist. Selector entities such as crop preset and perspective are rendered as pickers. |
| `custom:xtool-if2-fan` | SafetyPro IF2 / IF2 2.0 connected to a supported laser | IF2 2.0: `controls`: `off`, `auto`, `speed`; `display`: `names`. Original IF2: shows all gear choices; optional `options` customizes their order. |
| `custom:xtool-focus` | F2 Ultra UV with the supported focus-height entities | No configuration keys. |
| `custom:xtool-laser` | P2 with laser-position entities | `display`: `names`. Provides a combined X,Y target field, gesture arrows, Move, and Home. |
| `custom:xtool-measure` | P2 with measure entities | `display`: `names`. Provides processing mode, a separate thickness/distance field, a separate measured-value field, and Measure. |

The tile card's standard `features`, `features_position`, `state_content`,
`tap_action`, `hold_action`, `double_tap_action`, `name`, and `time_format`
options remain available. The card also adds job and sensor attributes to
Home Assistant's State content picker, including progress, elapsed time,
last-job time, power, exhaust, red dot, safety, and diagnostic values when
the corresponding entities exist.

## Troubleshooting

### The card shows "Custom element does not exist"

- Check that **Settings** → **Dashboards** → **Resources** lists the card as a JavaScript module. The Marketplace adds it when you install the card.
- Reload the browser page once. A dashboard opened before the card was available can keep showing the error until then.
- If your dashboard resources are defined in YAML (`lovelace:` `resource_mode: yaml`), the Marketplace cannot add the resource. Add this instead:

  ```yaml
  lovelace:
    resources:
      - url: /hacsfiles/xtool-card/xtool-card.js
        type: module
  ```

## Development

The browser tests use the stand-ins in `tests/card` and can be run with:

```text
python tests/card/run_card_tests.py
```

Set `CHROME` to a Chromium-based browser executable when it is not on `PATH`.

## License

MIT. See [LICENSE](LICENSE).
