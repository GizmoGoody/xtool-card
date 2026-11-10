# xTool Card

A Home Assistant dashboard card and tile features for xTool laser entities.

The card is developed separately from the [xTool Laser integration](https://github.com/GizmoGoody/ha-xtool), but it requires that integration for the entities it displays and controls.

![xTool Card](https://raw.githubusercontent.com/GizmoGoody/xtool-card/main/docs/xtool-card.png)

## Installation

Install **xTool Card** from Home Assistant's **Marketplace**:

1. Open **Settings > Marketplace** and choose **Add from link**.
2. Enter `GizmoGoody/xtool-card` as the GitHub link and choose the dashboard type.
3. Install **xTool Card**, then reload the browser.
4. Add `custom:xtool-card` to a dashboard.

On older Home Assistant versions with HACS, add `GizmoGoody/xtool-card` as a custom **Dashboard** repository and install it.

If you previously used the card bundled by the integration, remove `/xtool/xtool-card.js` from **Settings > Dashboards > Resources** after installing this project.

The card editor is available from the dashboard card picker after the resource loads.

## Development

The browser tests use the stand-ins in `tests/card` and can be run with:

```text
python tests/card/run_card_tests.py
```

Set `CHROME` to a Chromium-based browser executable when it is not on `PATH`.

## License

MIT. See [LICENSE](LICENSE).
