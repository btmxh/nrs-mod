#/bin/sh

deno run --allow-all src/metadata/music.ts
deno run --allow-all src/alt-src/post-proc.ts
deno run --allow-all src/prettier.ts
