// CONVENTION: use query parameters to specify track index
// like: https://vgmdb.net/album/109271?trackindex=4 => Akogare Future Sign (in Re:STAGE! THE BEST)

import { Duration } from "../../deps.ts";
import { pickTitle, fetchCached } from "../lib.ts";
import { Album, Artist, Disc, Service, Track } from "./common.ts";

export interface VGMDBURL {
  url: string;
  trackIndex: number | undefined;
}

const VGMDB_API_PREFIX = Deno.env.get("VGMDB_API_PREFIX");
function parseURL(url: string): Promise<VGMDBURL | undefined> {
  const urlObject = new URL(url);
  const trackIndexString = urlObject.searchParams.get("trackindex");
  return Promise.resolve({
    url: `${VGMDB_API_PREFIX}${urlObject.pathname}?format=json`,
    trackIndex:
      trackIndexString === null ? undefined : parseInt(trackIndexString),
  });
}

async function load(
  url: VGMDBURL
): Promise<Track | Album | Artist | undefined> {
  const response = JSON.parse(await fetchCached(url.url));
  if (url.url.includes("album")) {
    // deno-lint-ignore no-explicit-any
    const tracks = response.discs.flatMap((disc: any) => disc.tracks);
    const storeRefs = (response.stores ?? []).map((store: any) => {
      return [
        store.name
          .toLowerCase()
          .replaceAll(/[\(\)]/g, "")
          .replaceAll(/\s+/g, "-"),
        store.link,
      ] as [string, string];
    });
    const websiteRefs = Object.entries(response.websites ?? {}).flatMap(
      ([key, value]) => {
        // deno-lint-ignore no-explicit-any
        return (value as any).map((ref: any) => [key.toLowerCase(), ref.link]);
      }
    );
    const album: Album = {
      type: "album",
      title: response.name,
      references: [...storeRefs, ...websiteRefs],
      // deno-lint-ignore no-explicit-any
      discs: response.discs.map((disc: any) => {
        const obj: Disc = {
          name: disc.name,
          numSongs: disc.tracks.length,
        };
        return obj;
      }),
      getTrack: (index) => {
        const pickName = (names: Record<string, string>) => {
          return pickTitle(names);
        };

        const parseDuration = (str: string) => {
          const [seconds, minutes, hours] = str
            .split(":")
            .reverse()
            .map((x) => parseInt(x));
          return Duration.fromObject({
            hours,
            minutes,
            seconds,
          });
        };

        const track = tracks[index];

        return Promise.resolve({
          type: "track",
          title: pickName(track.names),
          length:
            track.track_length === "Unknown"
              ? undefined
              : parseDuration(track.track_length),
          references: [],
        });
      },
    };

    return url.trackIndex === undefined
      ? album
      : await album.getTrack!(url.trackIndex);
  } else if (url.url.includes("artist")) {
    const references: [string, string][] = [];
    for (const twitterHandle of new Set(...(response.twitter_names ?? []))) {
      references.push(["twitter", `twitter.com/${twitterHandle}`]);
    }

    return {
      type: "artist",
      title: response.name,
      references,
    };
  }
}

export const VGMDB: Service<VGMDBURL> = {
  parseURL,
  load,
};

export function vgmdbURLFromId(id: string): string {
  const tokens = id.split("-");
  if (
    (tokens.length != 4 && tokens.length != 5) ||
    tokens[0] !== "M" ||
    tokens[1] !== "VGMDB"
  ) {
    throw new Error("invalid vgmdb id");
  }

  if (tokens[2] === "AL") {
    let url = `https://vgmdb.net/album/${tokens[3]}`;
    if (tokens.length === 5) {
      url += `?trackindex=${parseInt(tokens[4]) - 1}`;
    }
    return url;
  } else if (tokens[2] === "AR") {
    return `https://vgmdb.net/artist/${tokens[3]}`;
  } else {
    throw new Error("invalid vgmdb id");
  }
}
