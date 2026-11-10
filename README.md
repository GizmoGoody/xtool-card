# xTool Card

A Home Assistant dashboard card and tile features for xTool devices.

The card requires the [xTool Laser integration](https://github.com/GizmoGoody/ha-xtool) for the entities it displays and controls.

![xTool Card](https://raw.githubusercontent.com/GizmoGoody/xtool-card/main/docs/xtool-card.png)

> [!WARNING]
> **Alpha developmental software. Use with caution.** This card can expose controls for a xTool machines. Check every control and entity on your machine before relying on it, and keep the manufacturer's safety procedures in place.

## Status

This card is in **Alpha** and is being developed alongside the xTool Laser integration. It is not yet a stable, broadly validated release.

The current release is **0.1.0-alpha.1**. Alpha releases use SemVer prerelease
versions; later Alpha releases increment the final prerelease number.

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

The card requires [GizmoGoody/ha-xtool](https://github.com/GizmoGoody/ha-xtool). That integration is also in active development; the current card is ahead of the released upstream integration and should be treated as a development pairing.

For the card features currently in this repository:

- The integration's existing laser, camera, accessory, and control entities are required.
- The P2 features depend primarily on upstream [PR #60](https://github.com/thecodingdad/ha-xtool/pull/60), which adds the P2 cameras, crop presets, camera exposure and thumbnail controls, overlays, measuring, laser positioning, lights, safety entities, and related protocol support.
- PR #60 is built on or incorporates the camera and entity work from [PR #43](https://github.com/thecodingdad/ha-xtool/pull/43), [PR #52](https://github.com/thecodingdad/ha-xtool/pull/52), [PR #53](https://github.com/thecodingdad/ha-xtool/pull/53), and [PR #54](https://github.com/thecodingdad/ha-xtool/pull/54).
- Other card controls use the integration changes in the open [xTool Laser pull requests](https://github.com/thecodingdad/ha-xtool/pulls). Until those changes are merged and released, matching development versions of the integration may be required.

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
