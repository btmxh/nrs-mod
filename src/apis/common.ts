import { Duration } from "../../deps.ts";

export interface Album {
  type: "album";
  title?: string;
  artists?: string[];
  discs?: Disc[];
  getTrack?(index: number): Promise<Track | undefined>;
  references: [string, string][];
}

export interface Track {
  type: "track";
  title?: string;
  artists?: string[];
  length?: Duration;
  references: [string, string][];
}

export interface Disc {
  name: string;
  numSongs: number;
}

export interface Artist {
  type: "artist";
  // consistency
  title?: string;
  references: [string, string][];
}

export interface Service<URL> {
  parseURL(url: string): Promise<URL | undefined>;
  load(url: URL): Promise<Artist | Album | Track | undefined>;
}

const cache = new Map<string, unknown>();
export function cached<T>(key: string, callback: () => T): T {
  if (cache.has(key)) {
    return cache.get(key) as T;
  } else {
    const value = callback();
    cache.set(key, value);
    return value;
  }
}

export function fetchCached(url: string, suffix = ""): Promise<string> {
  return cached(url + suffix, async () => {
    const response = await fetch(url);
    return await response.text();
  });
}
