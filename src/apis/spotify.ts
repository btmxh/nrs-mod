import { buildURL, redirect, cached } from "../lib.ts";
import { Album, Artist, Service, Track } from "./common.ts";
import { Duration } from "../../deps.ts";

export interface SpotifyURL {
  type: "artist" | "album" | "track";
  id: string;
}

let accessToken: string | undefined = undefined;
// deno-lint-ignore no-explicit-any
async function fetchCached(url: string): Promise<any> {
  if (accessToken === undefined) {
    accessToken = JSON.parse(
      await Deno.readTextFile("spotify_credentials.json")
    ).access_token;
  }

  return cached(
    url,
    async () =>
      await (
        await fetch(url, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
      ).json()
  );
}

async function parseURL(url: string): Promise<SpotifyURL | undefined> {
  url = await redirect(url);
  const urlObject = new URL(url);
  const tokens = urlObject.pathname
    .split("/")
    .filter((token) => token.length > 0);
  if (!["artist", "track", "album"].includes(tokens[0])) {
    return undefined;
  }
  return {
    id: tokens[1],
    type: tokens[0] as "artist" | "track" | "album",
  };
}

async function load(
  url: SpotifyURL
): Promise<Artist | Album | Track | undefined> {
  const id = url.id;
  if (url.type === "track") {
    const response = await fetchCached(
      `https://api.spotify.com/v1/tracks/${id}`
    );

    return {
      type: "track",
      title: response.name ?? undefined,
      length: Duration.fromMillis(response.duration_ms),
      // deno-lint-ignore no-explicit-any
      artists: (response.artists ?? []).map((artist: any) => artist.name),
      references: [],
    };
  } else if (url.type === "album") {
    const response = await fetchCached(
      `https://api.spotify.com/v1/albums/${id}`
    );

    const trackPages = new Map<number, Track[]>();
    return {
      type: "album",
      title: response.name ?? undefined,
      getTrack: async (index: number) => {
        const batch = 25;
        const pageNumber = Math.floor(index / batch);
        if (!trackPages.has(pageNumber)) {
          const page: Track[] = [];
          const response = await fetchCached(
            buildURL(`https://api.spotify.com/v1/albums/${id}/tracks`, {
              offset: pageNumber * batch,
              limit: batch,
            })
          );

          for (let i = 0; i < response.items.length; i++) {
            const track = response.items[i];
            page.push({
              type: "track",
              title: track.name ?? undefined,
              // deno-lint-ignore no-explicit-any
              artists: track.artists.map((artist: any) => artist.name),
              length: Duration.fromMillis(track.duration_ms),
              references: [["spotify", track.external_urls.spotify]],
            });
          }

          trackPages.set(pageNumber, page);
        }

        return trackPages.get(pageNumber)![index - batch * pageNumber];
      },
      references: [],
    };
  } else if (url.type === "artist") {
    const response = await fetchCached(
      `https://api.spotify.com/v1/artists/${id}`
    );

    return {
      type: "artist",
      title: response.name ?? undefined,
      references: [],
    };
  }
}

export const Spotify: Service<SpotifyURL> = {
  parseURL,
  load,
};
