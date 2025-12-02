import { Platform } from "react-native";

/*
 * Make sure to fill in the constants marked with TODO.
 * You shouldn't need to modify anything else in this file.
 */

// ***** TODO (Part 1): Fill in your constants here ***** //
const CLIENT_ID = "fa88a0c4876a4c5c99589abe2f9b97bf"; // TODO: Replace this with your own client ID
const REDIRECT_URI = "exp://hp6j5zg-clairebirge-8081.exp.direct"; // TODO: Replace this with your own redirect URI
const ALBUM_ID = "5u8SP8bbxcA7zJoAusBfgc"; // By default, this is Lizzie McAlpine's album "5 seconds flat"
// ********************************************* //

const redirectUri = (uri: string) => {
  if (!uri) {
    const err = new Error(
      "No redirect URI provided.\nPlease provide a redirect URI in env.ts.\n You can find the file in utils/env.ts."
    );
    console.error(err);
    alert(err);
  }
  return Platform.OS === "web" ? "http://localhost:19006/" : uri;
};

const ENV = {
  CLIENT_ID: CLIENT_ID,
  SCOPES: [
    "user-read-currently-playing",
    "user-read-recently-played",
    "user-read-playback-state",
    "user-top-read",
    "user-modify-playback-state",
    "streaming",
    "user-read-email",
    "user-read-private",
  ],
  REDIRECT_URI: redirectUri(REDIRECT_URI),
  ALBUM_ID: ALBUM_ID,
  SPOTIFY_API: {
    // Endpoints for auth & token flow
    DISCOVERY: {
      authorizationEndpoint: "https://accounts.spotify.com/authorize",
      tokenEndpoint: "https://accounts.spotify.com/api/token",
    },
    // ***** TODO (Part 1): Fill this in ***** //
      TOP_TRACKS_API: "https://api.spotify.com/v1/me/top/tracks",
    // ***** TODO (Part 1): Or fill this in ***** //
    ALBUM_TRACK_API_GETTER: (albumId: string) => "TODO" + albumId,
  },
};

const getEnv = () => ENV;
export default getEnv;
// ^ use this type of exporting to ensure compliance with webpack and expo-web
