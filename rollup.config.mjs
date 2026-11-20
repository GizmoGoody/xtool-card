// Builds the card into one file, dist/xtool-card.js, for the Marketplace.
// The version is VERSION from the environment (the release workflow stamps
// it), or package.json's.
import { readFileSync } from "node:fs";
import resolve from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";

const version = process.env.VERSION || JSON.parse(readFileSync("package.json", "utf8")).version;

export default {
  input: "src/xtool-card.ts",
  output: { file: "dist/xtool-card.js", format: "es", sourcemap: false },
  plugins: [
    replace({ preventAssignment: true, values: { __VERSION__: JSON.stringify(version) } }),
    resolve(),
    typescript({ noEmit: false }),
    terser({ format: { comments: false } }),
  ],
};
