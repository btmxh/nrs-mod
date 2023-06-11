import { poke, runPrettier, xml } from "./lib.ts";

const lines = await Deno.readTextFile("/home/torani/dev/nrs-ipynb/new.csv");
let pairs = lines
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line.length > 0)
  .map((line) => line.split(","));
await poke("**/*.xml", (document) => {
  pairs = pairs.filter(([id, score]) => {
    console.log(id);
    score = parseFloat(score).toFixed(2);
    let entrySelector = `//entry[@id="${id}"]`;
    const tokens = id.split("-");
    if (
      tokens.length === 5 &&
      tokens[0] === "M" &&
      tokens[1] === "VGMDB" &&
      tokens[2] === "AL"
    ) {
      entrySelector += `|//entry[@id="M-VGMDB-AL-${tokens[3]}"]/entry[@id="$-${tokens[4]}"]`;
    }

    const musicSelector = `(music/@base|ref[@name="ReStepMusic"]/@a_base|ref[@name="FesALiveMusic"]/@a_base)`;

    let node = xml.select(document, entrySelector);
    if (node !== undefined) {
      node = xml.select(node as Node, musicSelector);
    }

    if (node !== undefined) {
      (node as Attr).value = score;
      return false;
    }

    return true;
  });
});
await Deno.writeTextFile(
  "fucku.csv",
  pairs.map(([id, score]) => `${id},${score}`).join("\n")
);
await runPrettier();
