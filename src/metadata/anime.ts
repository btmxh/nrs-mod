import {
  gitVersionHash,
  poke,
  insertBeforeSpaced,
  runPrettier,
  unixTimeString,
  xml,
fetchLog,
} from "../lib.ts";

const version = await gitVersionHash();
const timestamp = await unixTimeString();
const generatedByString = `mal-best-girl.ts ${version}-${timestamp}`;

await poke("**/*.xml", async (document) => {
  const animeEntries = xml
    .selectAll(document, "//entry[starts-with(@id, 'A')]")
    .map((entry) => entry as Element);
  for (const entry of animeEntries) {
    const id = entry.getAttribute("id")!;
    console.log(id);
    if ((entry.getAttribute("title")?.length ?? 0) === 0) {
      const title = await fetchEntryTitle(id, entry);
      if (title !== undefined) {
        entry.setAttribute("title", title);
      }
    }

    if (xml.select(entry, "source") === undefined) {
      const sources = await fetchAnimeSources(id);
      const elem = document.createElement("source");
      elem.setAttribute("generatedBy", generatedByString);
      insertBeforeSpaced(entry, elem, entry.firstChild);
      if (sources === undefined || Object.values(sources).includes(undefined)) {
        let supr = xml.select(entry, "validatorSuppress") as Element;
        if(supr === undefined) {
          supr = document.createElement("validatorSuppress");
          insertBeforeSpaced(entry, supr, elem.nextSibling);
        }
        const rules = supr.getAttribute("rules");
        if (!rules?.includes("dah-no-anime-altsrc")) {
          supr.setAttribute(
            "rules",
            rules === null
              ? "dah-no-anime-altsrc"
              : rules + ";dah-no-anime-altsrc"
          );
        }
      }

      if (sources !== undefined) {
        for (const [key, value] of Object.entries(sources)) {
          const child = document.createElement(key);
          child.setAttribute("id", value.toString());
          elem.appendChild(child);
        }
      }
    }
  }
});

await runPrettier();

async function fetchEntryTitle(
  id: string,
  _entry: Element
): Promise<string | undefined> {
  if (!id.startsWith("A-MAL")) {
    console.warn(`non-MAL anime are not supported: ${id}`);
    return undefined;
  }
  const response = await fetchLog(`https://api.jikan.moe/v4/anime/${id}`);
  const json = await response.json();
  // deno-lint-ignore no-explicit-any
  return json.titles.filter((title: any) =>
    ["default", "romaji"].includes(title.type.toLowerCase())
  )[0] as string | undefined;
}

interface AnimeSource {
  mal?: string;
  al?: string;
  kitsu?: string;
  anidb?: string;
}

async function fetchAnimeSources(id: string): Promise<AnimeSource | undefined> {
  const tokens = id.split("-");
  if (tokens.length != 3) {
    return undefined;
  }

  const source = {
    MAL: "myanimelist",
    AL: "anilist",
    KS: "kitsu",
    ADB: "anidb",
  }[tokens[1]];
  if (source === undefined) {
    return undefined;
  }

  const response = await fetchLog(
    `https://relations.yuna.moe/api/v2/ids?source=${source}&id=${tokens[2]}`
  );

  const json = await response.json();

  const src: AnimeSource = {
    mal: json.myanimelist?.toString(),
    al: json.anilist?.toString(),
    kitsu: json.kitsu?.toString(),
    anidb: json.anidb?.toString(),
  };

  return Object.values(src).filter((s) => s !== undefined).length > 0
    ? src
    : undefined;
}
