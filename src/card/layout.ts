// Where the features below the title go in Home Assistant's two-column
// feature grid, as the xTool card places them.

export interface PlaceItem {
  // A camera's picture: as many rows tall as it needs
  tall: boolean;
  // Takes both columns
  full: boolean;
  height: number;
}

export interface Place {
  column: string;
  row: string;
  columns: number;
}

/**
 * The features alternate left and right in the order chosen. On top of that:
 * - a camera with Full width (its default) takes both columns;
 * - a camera without it takes one column, as many rows tall as
 *   it needs: the features after it fill the other column, one per row,
 *   until they pass its bottom; then the pattern resumes;
 * - a feature left alone in its row by a full-width feature after it takes
 *   both columns, so no empty half is left;
 * - the last feature, alone in its row, takes both columns with Last
 *   feature full width (the default), one column without it.
 * gap: the grid's row gap (px).
 */
export function featurePlaces(items: PlaceItem[], gap: number, lastWide: boolean): { places: Place[]; rows: string[] } {
  const places: Place[] = [];
  const gridRows: string[] = [];
  let row = 1, col = 0;
  const alone = (index: number) => {
    places[index] = { column: "1 / -1", row: places[index].row, columns: 1 };
  };
  for (let i = 0; i < items.length;) {
    const item = items[i];
    if (item.full) {
      if (col === 1) {
        alone(i - 1);
        row += 1;
      }
      places[i] = { column: "1 / -1", row: `${row}`, columns: 1 };
      row += 1;
      col = 0;
      i += 1;
      continue;
    }
    if (item.tall) {
      const other = 1 - col;
      let rows = col === 1 ? 1 : 0;
      let height = col === 1 ? items[i - 1].height : 0;
      let next = i + 1;
      while (next < items.length && height < item.height && !items[next].full) {
        places[next] = { column: `${other + 1}`, row: `${row + rows}`, columns: 2 };
        height += (rows ? gap : 0) + items[next].height;
        rows += 1;
        next += 1;
      }
      const span = Math.max(rows, 1);
      places[i] = { column: `${col + 1}`, row: span > 1 ? `${row} / span ${span}` : `${row}`, columns: 2 };
      gridRows[row + span - 2] = "1fr";
      row += span;
      col = 0;
      i = next;
      continue;
    }
    places[i] = { column: `${col + 1}`, row: `${row}`, columns: 2 };
    col += 1;
    if (col === 2) {
      col = 0;
      row += 1;
    }
    i += 1;
  }
  if (col === 1 && lastWide) alone(items.length - 1);
  return { places, rows: Array.from({ length: row - 1 + col }, (_, i) => gridRows[i] ?? "auto") };
}

/** A control's corner radius: the theme's feature radius, or the element's own, no more than half its height. */
export function featureRadius(el: Element, height: number): number {
  const style = getComputedStyle(el);
  const themed = parseFloat(style.getPropertyValue("--feature-border-radius"));
  const own = parseFloat(style.borderTopLeftRadius);
  const radius = Number.isFinite(themed) ? themed : Number.isFinite(own) ? own : 0;
  return Math.min(radius, height / 2);
}
