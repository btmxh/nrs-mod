import { getEntryId, poke, runPrettier, xml } from "../lib.ts";

import { VGMDB, vgmdbURLFromId } from "../apis/vgmdb.ts";
import { TuneCore } from "../apis/tunecore.ts";
import { Spotify } from "../apis/spotify.ts";
import { YouTube } from "../apis/yt.ts";
import { Album, Artist, Service, Track } from "../apis/common.ts";

await poke("**/*.xml", async (document) => {
  const entries = xml
    .selectAll(document, `//entry[@title=""]`)
    .map((e) => e as Element);
  for (const entry of entries) {
    const id = getEntryId(entry);
    if (entry.getAttribute("id")?.includes("$")) {
      const parent = xml.select(entry, "ancestor::entry[1]") as Element;
      if (parent === undefined) {
        continue;
      }

      const parentId = getEntryId(parent);
      const parentData = await getData(parentId, parent);
      const suffix = parseInt(id.split("-").reverse()[0]) - 1;
      if (parentData?.type === "album" && parentData.getTrack !== undefined) {
        const entryData = await parentData.getTrack(suffix);
        if (entryData !== undefined) {
          update(entry, entryData);
        }
      } else if (parentData?.type === "track" && suffix === 0) {
        console.warn(`assuming album ${parentId} is a single`);
        if (parentData !== undefined) {
          update(entry, parentData, false);
        }
      }
    } else {
      const entryData = await getData(id, entry);
      if (entryData !== undefined) {
        update(entry, entryData);
      }
    }
    console.log(id);
  }
});

await runPrettier();

async function getData(
  id: string,
  entry: Element
): Promise<Album | Artist | Track | undefined> {
  const entrySources: [string, string][] = [];
  if (id.startsWith("M-VGMDB")) {
    entrySources.push(["vgmdb", vgmdbURLFromId(id)]);
  }
  for (const altSource of xml
    .selectAll(entry, "source/urls/url")
    .map((x) => x as Element)) {
    entrySources.push([
      altSource.getAttribute("name")!,
      altSource.getAttribute("src")!,
    ]);
  }

  // deno-lint-ignore no-explicit-any
  const sources: [string, Service<any>][] = [
    ["vgmdb", VGMDB],
    ["spotify", Spotify],
    ["tunecore", TuneCore],
    ["linkcore", TuneCore],
    ["youtube", YouTube],
  ];

  for (let i = 0; i < sources.length; i++) {
    for (const [name, src] of entrySources) {
      if (name.startsWith(sources[i][0])) {
        const url = await sources[i][1].parseURL(src);
        if (url === undefined) {
          continue;
        }

        const data = await sources[i][1].load(url);
        entrySources.push(...(data?.references ?? []));
      }
    }
  }

  // deno-lint-ignore no-explicit-any
  const object: any = {
    references: entrySources,
  };
  for (const [sourceName, source] of sources) {
    for (const [name, src] of entrySources) {
      if (name.startsWith(sourceName)) {
        const url = await source.parseURL(src);
        if (url === undefined) {
          continue;
        }

        const data = await source.load(url);
        if (data === undefined) {
          continue;
        }

        if (object.type === undefined) {
          object.type = data.type;
        } else if (object.type !== data.type) {
          continue;
        }

        object.title ??= data.title;
        // deno-lint-ignore no-explicit-any
        const aData = data as any;
        object.artists ??= aData.artists;
        object.discs ??= aData.discs;
        object.getTrack ??= aData.getTrack;
        object.length ??= aData.length;
      }
    }
  }

  return object;
}

function update(
  entry: Element,
  data: Artist | Album | Track,
  updateSources = true
) {
  if (data.title !== undefined && (entry.getAttribute("title") ?? "") === "") {
    entry.setAttribute("title", data.title!);
  }

  if (data.type === "track") {
    const rules = xml
      .selectAll(entry, "validatorSuppress")
      .flatMap((vs) =>
        ((vs as Element).getAttribute("rules") ?? "").split(";")
      );
    let mcp = xml.select(entry, "musicConsumedProgress") as Element | undefined;
    if (
      !rules.includes("dah-no-progress") &&
      (mcp?.getAttribute("length") ?? "") === "" &&
      data.length !== undefined
    ) {
      mcp ??= (() => {
        const mcp = entry.ownerDocument.createElement("musicConsumedProgress");
        entry.appendChild(mcp);
        return mcp;
      })();

      const length = data.length;
      mcp.setAttribute(
        "length",
        length.hours === 0
          ? length.toFormat("m:ss")
          : length.toFormat("h:mm:ss")
      );
    }
  }

  if (updateSources && data.references.length > 0) {
    const urls =
      (xml.select(entry, "source/urls") as Element | undefined) ??
      (() => {
        const source = entry.ownerDocument.createElement("source");
        const urls = entry.ownerDocument.createElement("urls");
        source.appendChild(urls);
        entry.insertBefore(source, entry.firstChild);
        return urls;
      })();

    for (const [name, src] of data.references) {
      const url = entry.ownerDocument.createElement("url");
      url.setAttribute("name", name);
      url.setAttribute("src", src);
      urls.appendChild(url);
    }
  }
}

// async function getEntryTitle(
//   id: string,
//   entry: Element
// ): Promise<string | undefined> {
//   const services = [
//     ["tunecore", TuneCore],
//     ["vgmdb", VGMDB],
//   ];
//   if (id.startsWith("M-VGMDB")) {
//     const tokens = id.split("-");
//     const vgmdbPrefix = "http://0.0.0.0:9990";
//     const url = `${vgmdbPrefix}/${tokens[2] === "AL" ? "album" : "artist"}/${
//       tokens[3]
//     }`;
//     const json = JSON.parse(await fetchCached(url));
//     if (tokens.length > 4) {
//       const [disc, track] = getVGMDBTrack(json, parseInt(tokens[4]));
//       return pickTitle(json.discs[disc].tracks[track].names);
//     } else {
//       return json.name ?? pickTitle(json.names);
//     }
//   }

//   const supportedSources: [
//     string,
//     (url: string, track: number | undefined) => Promise<string | undefined>
//   ][] = [
//     ["linkcore", getLinkcoreTitle],
//     ["tunecore", getTunecoreTitle],
//     ["youtube", getYoutubeTitle],
//   ];
//   for (const supportedSource of supportedSources) {
//     const xpath = `(ancestor-or-self::entry/source/urls/url[@name="${supportedSource[0]}"]/@src)[1]`;
//     const url = xml.select(entry, xpath) as Attr;
//     if (url !== undefined) {
//       const track = id.split("-")[2];
//       return await supportedSource[1](
//         url.value,
//         track === undefined ? undefined : parseInt(track)
//       );
//     }
//   }
// }

// async function getLinkcoreTitle(
//   url: string,
//   track: number | undefined
// ): Promise<string | undefined> {
//   const response = await fetchCached(url);
//   const html = new HTMLDOMParser().parseFromString(response, "text/html");

//   if (track === undefined) {
//     return html?.querySelector(".release_title")?.textContent?.trim();
//   } else {
//     const processors: [
//       string,
//       (url: string, track: number) => Promise<string | undefined>
//     ][] = [
//       ["spotify", getSpotifyTrackTitle],
//       ["youtube", getYoutubeTrackTitle],
//     ];

//     for (const [source, processor] of processors) {
//       const attr = xml.select(
//         html! as unknown as Element,
//         `//*[contains(@href, "${source}")]/@href`
//       ) as Attr;
//       if (attr !== undefined) {
//         return await processor(await redirect(attr.value), track - 1);
//       }
//     }
//   }
// }

// async function getTunecoreTitle(url: string): Promise<string | undefined> {
//   const response = await fetchCached(url);
//   const html = new HTMLDOMParser().parseFromString(response, "text/html");

//   const jsonText = html?.getElementById("__NEXT_DATA__")?.textContent;
//   if (jsonText === null || jsonText === undefined) {
//     return undefined;
//   }

//   const json = JSON.parse(jsonText);
//   return pickTitle(json.props.pageProps.artist);
// }

// function getYoutubeVideoId(url: string): string {
//   const regex =
//     /^((?:https?:)?\/\/)?((?:www|m)\.)?((?:youtube(-nocookie)?\.com|youtu.be))(\/(?:[\w\-]+\?v=|embed\/|live\/|v\/)?)([\w\-]+)(\S+)?$/;
//   return regex.exec(url)![6];
// }

// function getYoutubeListId(url: string): string {
//   const regex = /^.*(youtu.be\/|list=)([^#\&\?]*).*/;
//   return regex.exec(url)![2];
// }

// async function getYoutubeTitle(url: string): Promise<string | undefined> {
//   url = url.replace("music.youtube", "www.youtube");
//   const request = await youtube().videos.list({
//     auth: await getGoogleAuth(),
//     part: ["snippet"],
//     id: [getYoutubeVideoId(url)],
//   });
//   // const duration = request.data.items[0].contentDetails?.duration;
//   const title = request.data.items?.[0]?.snippet?.title ?? undefined;
//   console.log(`${url}: ${title}`);
//   return title;
// }

// async function getYoutubeTrackTitle(
//   url: string,
//   trackIndex: number
// ): Promise<string | undefined> {
//   url = url.replace("music.youtube", "www.youtube");
//   const request = await youtube().playlistItems.list({
//     auth: await getGoogleAuth(),
//     part: ["snippet"],
//     playlistId: getYoutubeListId(url),
//   });
//   // const duration = request.data.items[0].contentDetails?.duration;
//   // TODO pagination etc etc
//   const title = request.data.items?.[trackIndex]?.snippet?.title ?? undefined;
//   console.log(`${url}, track ${trackIndex + 1}: ${title}`);
//   return title;
// }

// async function getSpotifyTrackTitle(
//   url: string,
//   trackIndex: number
// ): Promise<string | undefined> {
//   const spotifyURLRegex =
//     /https?:\/\/(?:embed\.|open\.)(?:spotify\.com\/)(?:(album|track|playlist)\/|\?uri=spotify:track:)((\w|-){22})/;
//   const id = spotifyURLRegex.exec(url)?.[2];
//   if (id === undefined) {
//     throw new Error(`album id not found in spotify album url: ${url}`);
//   }

//   const response = await fetch(
//     `https://api.spotify.com/v1/albums/${id}/tracks`,
//     {
//       headers: {
//         ...(await getSpotifyAuthenciation()),
//       },
//     }
//   );
//   const json = await response.json();
//   console.debug(json);
//   return json.items[trackIndex].name;
// }
