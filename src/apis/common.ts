import { Duration } from "../../deps.ts";
import { fetchLog } from "../lib.ts";

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
