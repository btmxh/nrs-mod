import { Album, Artist, Service, Track } from "./common.ts";
import { buildURL, fetchLog, redirect, cached } from "../lib.ts";
import { Duration } from "../../deps.ts";

export interface YoutubeURL {
  id: string;
  // user: https://www.youtube.com/user/BeasttrollMC
  // user-new: https://www.youtube.com/@Nanahira_Confetto
  type: "playlist" | "video" | "user" | "user-new";
}

let accessToken: string | undefined = undefined;
// deno-lint-ignore no-explicit-any
async function fetchCached(url: string): Promise<any> {
  if (accessToken === undefined) {
    accessToken = JSON.parse(
      await Deno.readTextFile("google_credentials.json")
    ).access_token;
  }

  return cached(
    url,
    async () =>
      await (
        await fetchLog(url, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
      ).json()
  );
}

async function parseURL(url: string): Promise<YoutubeURL | undefined> {
  // use regular youtube instead of youtube music
  url = url.replace("music.youtube", "www.youtube");
  // after redirect
  url = await redirect(url);

  const urlObject = new URL(url);
  if (url.includes("youtube.com/playlist")) {
    const id = urlObject.searchParams.get("list");
    if (id === null) {
      return undefined;
    }

    return {
      id,
      type: "playlist",
    };
  } else if (url.includes("youtube.com/watch")) {
    const id = urlObject.searchParams.get("v");
    if (id === null) {
      return undefined;
    }

    return {
      id,
      type: "video",
    };
  } else if (url.includes("youtube.com/@")) {
    return {
      type: "user-new",
      id: urlObject.pathname.split("/").filter((x) => x.length > 0)[0],
    };
  } else if (url.includes("youtube.com/user")) {
    return {
      type: "user",
      id: urlObject.pathname.split("/").filter((x) => x.length > 0)[1],
    };
  }

  console.warn(`invalid youtube url (after redirection): ${url}`);
  return undefined;
}

async function load(
  url: YoutubeURL
): Promise<Artist | Album | Track | undefined> {
  if (url.type === "video") {
    const response = await fetchCached(
      buildURL("https://youtube.googleapis.com/youtube/v3/videos", {
        part: "snippet,contentDetails",
        id: url.id,
      })
    );
    const snippet = response.items?.[0].snippet;
    const duration = response.items?.[0].contentDetails?.duration ?? undefined;

    return {
      type: "track",
      title: snippet?.title ?? undefined,
      // artists: [snippet?.channelTitle],
      length: duration === undefined ? undefined : Duration.fromISO(duration),
      references: [],
    };
  } else if (url.type === "playlist") {
    const response = await fetchCached(
      buildURL("https://youtube.googleapis.com/youtube/v3/playlists", {
        part: "snippet,contentDetails",
        id: url.id,
      })
    );
    const snippet = response.items?.[0].snippet;

    const cachedTracks: [Track, string | undefined][] = [];
    const queriedTrackIndices = new Set<number>();
    let prevPageToken: string | undefined | null = undefined;
    return {
      type: "album",
      title: snippet?.title ?? undefined,
      references: [],
      getTrack: async (index: number) => {
        while (index >= cachedTracks.length && prevPageToken !== null) {
          const response = await fetchCached(
            buildURL(
              "https://youtube.googleapis.com/youtube/v3/playlistItems",
              {
                part: "snippet,contentDetails",
                playlistId: url.id,
                maxResults: "50",
                pageToken: prevPageToken,
              }
            )
          );
          if (response.items === undefined || response.items.length === 0) {
            return undefined;
          }
          prevPageToken = response.nextPageToken;
          for (const track of response.items) {
            const videoId = track.contentDetails?.videoId;
            cachedTracks.push([
              {
                type: "track",
                title: track.snippet?.title ?? undefined,
                references: [
                  ["youtube", `https://www.youtube.com/watch?v=${videoId}`],
                ],
                length: undefined,
              },
              videoId ?? undefined,
            ]);
          }
        }

        if (!queriedTrackIndices.has(index)) {
          const videoId = cachedTracks[index][1];
          if (videoId !== undefined) {
            const response = await fetchCached(
              buildURL("https://youtube.googleapis.com/youtube/v3/videos", {
                part: "snippet,contentDetails",
                id: videoId,
              })
            );
            const duration =
              response.items?.[0]?.contentDetails?.duration ?? undefined;
            cachedTracks[index][0].length =
              duration === undefined ? undefined : Duration.fromISO(duration);
          }
          queriedTrackIndices.add(index);
        }

        return cachedTracks[index][0];
      },
    };
  } else if (url.type === "user") {
    const response = await fetchCached(
      buildURL("https://youtube.googleapis.com/youtube/v3/channels", {
        part: "snippet,contentDetails",
        id: url.id,
      })
    );

    return {
      type: "artist",
      title: response.items?.[0]?.snippet?.title ?? undefined,
      references: [],
    };
  } else if (url.type === "user-new") {
    const response = await fetchCached(
      buildURL("https://youtube.googleapis.com/youtube/v3/search", {
        part: "snippet,contentDetails",
        q: url.id,
      })
    );

    const result = (response.items ?? []).filter(
      // deno-lint-ignore no-explicit-any
      (item: any) => item?.id?.kind === "youtube#channel"
    )[0];

    return {
      type: "artist",
      title: result?.snippet?.title ?? undefined,
      references: [],
    };
  }
}

export const YouTube: Service<YoutubeURL> = {
  parseURL,
  load,
};
