// Rows of a feature's items: each item takes at least its minimum width, and
// a row that does not wrap leaves out the items that do not fit.

// The narrowest each kind of item in a row may be (px): a key or a light's
// icon is never narrower than Home Assistant's standard icon needs (its
// tile icon: 36 px around the 24 px icon); a field, a slider and a select
// need room for their numbers and text.
export const ITEM_MIN = { key: 36, field: 72, slider: 72, select: 120 };

/** An item's narrowest width (px): a field's group is its field and keys, with the gaps between them. */
function itemMin(el: Element, gap: number): number {
  if (el.classList.contains("group")) {
    const parts = [...el.children];
    return parts.reduce((sum, part) => sum + itemMin(part, gap), 0) + Math.max(0, parts.length - 1) * gap;
  }
  return Number((el as HTMLElement).dataset.min) || ITEM_MIN.key;
}

/**
 * Fit a row's items into its width, in order: each takes at least its
 * minimum (data-min), and from the first that does not fit on, the items
 * are left out (data-dropped), so the last chosen go first. The ones shown
 * grow to fill the row (their flex). Items hidden for other reasons do not
 * count. A row that wraps, or squeezes its items, leaves none out.
 */
export function fitRow(row: HTMLElement): void {
  const width = row.clientWidth;
  if (!width) return;
  if (getComputedStyle(row).flexWrap === "wrap" || row.classList.contains("squeeze")) {
    for (const item of row.children) item.removeAttribute("data-dropped");
    return;
  }
  const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
  let used = 0, shown = 0, full = false;
  for (const item of row.children) {
    if ((item as HTMLElement).hidden) continue;
    const need = itemMin(item, gap) + (shown ? gap : 0);
    full ||= used + need > width + 0.5;
    item.toggleAttribute("data-dropped", full);
    if (!full) {
      used += need;
      shown += 1;
    }
  }
}

/** Fits rows now and whenever their width changes. */
export class RowFitter {
  private _observer?: ResizeObserver;
  private _rows = new WeakSet<Element>();

  fit(rows: Iterable<HTMLElement>): void {
    this._observer ??= new ResizeObserver((entries) => entries.forEach((entry) => fitRow(entry.target as HTMLElement)));
    for (const row of rows) {
      if (!this._rows.has(row)) {
        this._rows.add(row);
        this._observer.observe(row);
      }
      fitRow(row);
    }
  }
}

/**
 * Name an item of a row for hover (its title, the tooltip on a desktop)
 * and for screen readers: every key, field, slider, select and light icon
 * is named here.
 */
export function nameItem(el: Element, name?: string): void {
  if (!name) return;
  if ((el as HTMLElement).title !== name) (el as HTMLElement).title = name;
  if (el.getAttribute("aria-label") !== name) el.setAttribute("aria-label", name);
}
