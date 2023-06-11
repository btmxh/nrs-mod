import { HTMLDOMParser } from "../../deps.ts";
import { redirect, xml } from "../lib.ts";
import { Album, Artist, Service, Track, fetchCached } from "./common.ts";

export interface TunecoreURL {
  url: string;
  type: "album" | "artist";
}

function parseURL(url: string): Promise<TunecoreURL> {
  return Promise.resolve({
    url,
    type: url.includes("linkco.re") ? "album" : "artist",
  });
}

async function load(
  url: TunecoreURL
): Promise<Album | Artist | Track | undefined> {
  const html = await fetchCached(url.url);
  const document = new HTMLDOMParser().parseFromString(html, "text/html");
  if (url.type === "album") {
    const title =
      document?.querySelector(".release_title")?.textContent?.trim() ??
      undefined;
    const references: [string, string][] = [];
    const supportedSources = ["spotify", "youtube"];
    for (const source of supportedSources) {
      const attr = xml.select(
        document! as unknown as Element,
        `//*[contains(@href, "${source}")]/@href`
      ) as Attr;
      if (attr !== undefined) {
        references.push([source, await redirect(attr.value)]);
      }
    }
    return {
      type: "album",
      title,
      references,
    };
  } else if (url.type === "artist") {
    const json = document?.getElementById("__NEXT_DATA__")?.textContent;
    if (json === undefined) {
      return undefined;
    }

    const artist = JSON.parse(json).props.pageProps.artist;
    const references: [string, string][] = [];
    for (const [source, value] of Object.entries(artist.sns)) {
      // deno-lint-ignore no-explicit-any
      references.push([source, (value as any).url]);
    }
    return {
      type: "artist",
      title: ["nameEn", "nameJa", "nameKana"].map((key) => artist[key])[0],
      references,
    };
  }
}

export const TuneCore: Service<TunecoreURL> = {
  parseURL,
  load,
};
