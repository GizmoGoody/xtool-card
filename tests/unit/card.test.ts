import { describe, expect, it } from "vitest";
import { formatDuration } from "../../src/const";
import { featurePlaces } from "../../src/card/layout";
import { phaseOf } from "../../src/machine/models";

const small = { tall: false, full: false, height: 42 };
const at = (places: { column: string; row: string }[]) => places.map((p) => `${p.column}@${p.row}`);

describe("featurePlaces (L-2: the camera and the features around it)", () => {
  it("fills the column beside a picture in one column until the features pass its bottom, then left and right again, the last alone across", () => {
    // A picture 100 px tall, features 42 px tall, a 12 px row gap: beside it 42, 96, then 150 px
    const { places, rows } = featurePlaces([{ tall: true, full: false, height: 100 }, ...Array(6).fill(small)], 12, true);
    expect(at(places)).toEqual(["1@1 / span 3", "2@1", "2@2", "2@3", "1@4", "2@4", "1 / -1@5"]);
    expect(rows.join(" ")).toBe("auto auto 1fr auto auto");
  });
  it("puts the feature left of a camera on the right first beside it, and the last in one column without Last feature full width", () => {
    const { places } = featurePlaces([small, { tall: true, full: false, height: 50 }, small, small], 12, false);
    expect(at(places).join("; ")).toBe("1@1; 2@1 / span 2; 1@2; 1@3");
  });
  it("gives a full-width camera both columns, and a feature alone before it, and the last", () => {
    const { places, rows } = featurePlaces([small, { tall: true, full: true, height: 200 }, small], 12, true);
    expect(at(places).join("; ")).toBe("1 / -1@1; 1 / -1@2; 1 / -1@3");
    expect(rows.join(" ")).toBe("auto auto auto");
  });
});

describe("phaseOf (the card's phase from the Status sensor)", () => {
  it("groups the laser's states", () => {
    expect(phaseOf("working_button")).toBe("processing");
    expect(phaseOf("measure_area")).toBe("framing");
    expect(phaseOf("error_tilt")).toBe("error");
    expect(phaseOf("unavailable")).toBe("off");
    expect(phaseOf(undefined)).toBe("off");
  });
  it("counts any other state as idle", () => {
    expect(phaseOf("idle")).toBe("idle");
    expect(phaseOf("something_new")).toBe("idle");
  });
});

describe("formatDuration (job times)", () => {
  it("shows minutes and seconds, and hours when there are any", () => {
    expect(formatDuration(728)).toBe("12:08");
    expect(formatDuration(3725)).toBe("1:02:05");
    expect(formatDuration(-5)).toBe("0:00");
  });
});
