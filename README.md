# nrs-mod

basically nrsml transformer

use this to fill data/fix issues in nrsml document, like fetching altsrc and
`musicConsumedProgress` elements.

> this repo is messy af, so don't question anything here
> (you may find some free api keys or tokens here btw)

## brief usage

> this thing heavily uses constructs from the deno runtime, so use that. to run
> a file, do: `deno run --allow-all {scriptName}.ts`
>
> (skip the `--allow-all` flag if you feel insecure and want to spam yes)

authenticate to google and spotify apis by running the two files
`google_creds.ts` and `spotify_creds.ts`, then follow the instructions (click on
links and give access). bla bla bla im not hacking your account source: dude
trust me bro

then one can run the scripts, basically all of them were worthless but the
`fill.sh` is somewhat useful (it will fill metadata for entries with blank
title).
