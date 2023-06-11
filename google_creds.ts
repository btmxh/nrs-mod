import { buildURL } from "./src/lib.ts";

const SCOPES = ["https://www.googleapis.com/auth/youtube.readonly"];

const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const redirectUri = Deno.env.get("GOOGLE_REDIRECT_URI")!;

const authUrl = buildURL("https://accounts.google.com/o/oauth2/v2/auth", {
  access_type: "offline",
  scope: SCOPES.join(" "),
  client_id: clientId,
  redirect_uri: redirectUri,
  response_type: "code",
});

const codeUrl = prompt(
  `go to this url: ${authUrl}, then paste the redirected url here:`
);
if (codeUrl === null) {
  throw new Error("invalid code");
}

const code = new URL(codeUrl).searchParams.get("code");
if (code === null) {
  throw new Error("invalid code");
}
const response = await fetch(
  buildURL("https://oauth2.googleapis.com/token", {
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  }),
  {
    method: "POST",
  }
);

await Deno.writeTextFile("google_credentials.json", await response.text());
