import {} from "./deps.ts";

const response = await fetch(
  `https://accounts.spotify.com/api/token?grant_type=client_credentials&client_id=${Deno.env.get(
    "SPOTIFY_CLIENT_ID"
  )}&client_secret=${Deno.env.get("SPOTIFY_CLIENT_SECRET")}`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  }
);

await Deno.writeTextFile("spotify_credentials.json", await response.text());
