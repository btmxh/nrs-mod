import { gitVersionHash, poke, sleep, unixTimeString, xml } from "../lib.ts";

const version = await gitVersionHash();
const timestamp = await unixTimeString();
const generatedByString = `mal-best-girl.ts ${version}-${timestamp}`;

await poke("**/*.xml", async (doc) => {
  for (const entryNode of xml.selectAll(doc, "//entry[@id]")) {
    const entry = entryNode as Element;
    if (!entry.getAttribute("id")?.startsWith("A-MAL")) {
      continue;
    }

    const bestGirlNode = xml.select(entry, "bestGirl[last()]");
    if (bestGirlNode !== undefined) {
      const bestGirlName = xml.select(bestGirlNode as Node, "@name") as Attr;
      const bestGirlGeneratedBy = xml.select(
        bestGirlNode as Node,
        "@generatedBy"
      ) as Attr;

      const generatedBy = bestGirlGeneratedBy?.value;
      if (generatedBy === undefined || checkIgnoreGeneratedBy(generatedBy)) {
        bestGirlName.value = await transformBestGirlName(bestGirlName.value);
        (bestGirlNode as Element).setAttribute(
          "generatedBy",
          generatedByString
        );
      }
    }
  }
});

async function transformBestGirlName(name: string): Promise<string> {
  const encodedName = encodeURIComponent(name);
  const result = await fetch(
    `https://api.jikan.moe/v4/characters?q=${encodedName}&limit=1`
  );
  const json = await result.json();
  const newName = json?.data?.[0]?.name;
  console.log(`${name} -> ${newName}`);
  await sleep(2000);
  return newName ?? name;
}

function checkIgnoreGeneratedBy(generatedBy: string): boolean {
  if(Deno.args.includes("-fc") || Deno.args.includes("--force-invalidate-cache")) {
    return true;
  }

  const regex = /^mal-best-girl.ts ([a-f0-9]+)-([a-f0-9]+)$/;
  const match = generatedBy.match(regex);
  if(match === null || match.length != 2) {
    return true;
  }

  if(Deno.args.includes("-f") || Deno.args.includes("--force")) {
    return version !== match[0];
  } else {
    return false;
  }
}
