import { fs, path, DOMParser, XMLSerializer, xpath } from "../deps.ts";

export async function poke(
  globPattern: string,
  callback: (document: Document) => void | Promise<void>
) {
  const fullGlobPattern = `${Deno.env.get("NRS_IMPL_PATH")}/${globPattern}`;
  for await (const document of fs.walk(Deno.env.get("NRS_IMPL_PATH")!, {
    match: [path.globToRegExp(fullGlobPattern)],
  })) {
    if (!document.isFile) continue;
    const parser = new DOMParser();
    const tree = parser.parseFromString(await Deno.readTextFile(document.path));
    const result = callback(tree);
    if (result !== undefined) await result;
    const serializer = new XMLSerializer();
    await Deno.writeTextFile(document.path, serializer.serializeToString(tree));
  }
}

export const xml = {
  select: function (
    node: Node,
    xpathExpression: string
  ): xpath.SelectedValue | undefined {
    return xpath.select(xpathExpression, node, true);
  },

  selectAll: function (
    node: Node,
    xpathExpression: string
  ): xpath.SelectedValue[] {
    return xpath.select(xpathExpression, node);
  },
};

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function gitVersionHash(): Promise<string> {
  const result = await new Deno.Command("git", {
    args: ["rev-parse", "--short", "HEAD"],
  }).output();
  if (result.code === 0) {
    return new TextDecoder().decode(result.stdout).trim();
  } else {
    console.warn("'git rev-parse --short HEAD' failed, falling back to NOGIT");
    return "NOGIT";
  }
}

export function unixTimeString(): string {
  const time = Math.floor(Date.now() / 1000);
  return time.toString(16);
}

export async function runPrettier(): Promise<boolean> {
  return (
    (
      await new Deno.Command("prettier", {
        args: ["--write", "--ignore-path", ".gitignore", "."],
        cwd: Deno.env.get("NRS_IMPL_PATH"),
        stdout: "inherit",
        stderr: "inherit",
      }).output()
    ).code === 0
  );
}

export function insertBeforeSpaced(
  element: Element,
  node: Node,
  child: Node | null = null
) {
  element.insertBefore(node, child);
  element.insertBefore(element.ownerDocument.createTextNode("\n"), node);
}

export function getEntryId(entry: Element): string {
  const id = entry.getAttribute("id");
  if (id === null) {
    throw new Error("entry id not fould");
  }

  if (id.includes("$")) {
    const parent = xml.select(entry, "ancestor::entry[1]");
    if (parent === null) {
      throw new Error("parent entry id not fould");
    }
    const parentId = getEntryId(parent as Element);
    return id.replaceAll("$", parentId);
  }

  return id;
}

export function getVGMDBTrack(
  // deno-lint-ignore no-explicit-any
  album: any,
  trackIndex: number
): [/* disc index */ number, /* track index in disc */ number] {
  // 1-based to 0-based
  trackIndex--;
  const discs = album.discs;
  for (let i = 0; i < discs.length; i++) {
    if (trackIndex < discs[i].tracks.length) {
      return [i, trackIndex];
    }

    trackIndex -= discs[i].tracks.length;
  }

  throw new Error("track index out of bounds");
}

export function pickTitle(titles: Record<string, string>): string | undefined {
  const keys = [
    ["default", "romaji", "ja-latn"],
    ["english", "en", "nameen"],
    ["japanese", "jp", "ja", "nameja", "namekana"],
  ];

  for (const testKeys of keys) {
    for (const testKey of testKeys) {
      for (const key in titles) {
        if (key.toLowerCase() === testKey) {
          return titles[key];
        }
      }
    }
  }

  return Object.values(titles)[0] as string | undefined;
}

let accessToken: string | undefined = undefined;
export async function getSpotifyAuthenciation(): Promise<
  Record<string, string>
> {
  if (accessToken === undefined) {
    accessToken = JSON.parse(
      await Deno.readTextFile("spotify_credentials.json")
    ).access_token as string;
  }
  return {
    Authorization: "Bearer " + accessToken,
  };
}

export async function redirect(value: string): Promise<string> {
  const response = await fetchCachedFull(value);
  return response.url;
}

export function buildURL(base: string, queryParams: Record<string, unknown>) {
  let first = true;
  for (const key in queryParams) {
    if (queryParams[key] === null || queryParams[key] === undefined) {
      continue;
    }
    base += first ? "?" : "&";
    base += `${key}=${encodeURIComponent(`${queryParams[key]}`)}`;
    first = false;
  }
  return base;
}

export function fetchLog(
  url: string | URL | Request,
  init?: RequestInit
): Promise<Response> {
  console.log(`fetching ${url}`);
  return fetch(url, init);
}

const cache = new Map<string, unknown>();
interface ResponseLite {
  text: string;
  url: string;
  redirected: boolean;
}

export function cached<T>(key: string, callback: () => T): T {
  if (cache.has(key)) {
    return cache.get(key) as T;
  } else {
    const value = callback();
    cache.set(key, value);
    return value;
  }
}

export async function fetchCached(url: string, suffix = ""): Promise<string> {
  return (await fetchCachedFull(url, suffix)).text;
}

export function fetchCachedFull(
  url: string,
  suffix = ""
): Promise<ResponseLite> {
  return cached(url + suffix, async () => {
    const response = await fetchLog(url);
    return {
      text: await response.text(),
      url: response.url,
      redirected: response.redirected,
    };
  });
}
