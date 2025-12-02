import { useEffect, useState } from "react";
import { ResponseType, useAuthRequest } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import AsyncStorage from '@react-native-async-storage/async-storage';

import getEnv from "./env";
import { SpotifyAuthResponse } from "./types";
import { exchangeCodeForToken } from "./apiOptions";

WebBrowser.maybeCompleteAuthSession();

const {REDIRECT_URI, SCOPES, CLIENT_ID, SPOTIFY_API: { DISCOVERY }} = getEnv();

const SPOTIFY_AUTH_KEY = '@spotify_auth_token';

export function useSpotifyAuth() {
  const [authResponse, setAuthResponse] = useState<SpotifyAuthResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [request, response, getSpotifyAuth] = useAuthRequest(
    {
      responseType: ResponseType.Code,
      clientId: CLIENT_ID,
      scopes: SCOPES,
      redirectUri: REDIRECT_URI,
    },
    DISCOVERY
  );

  // Load saved token on mount
  useEffect(() => {
    loadSavedToken();
  }, []);

  async function loadSavedToken() {
    try {
      const saved = await AsyncStorage.getItem(SPOTIFY_AUTH_KEY);
      if (saved) {
        const data: SpotifyAuthResponse = JSON.parse(saved);
        console.log('Loaded saved Spotify token');
        setAuthResponse(data);
      }
    } catch (e) {
      console.error('Error loading saved Spotify token:', e);
    } finally {
      setIsLoading(false);
    }
  }

  async function saveToken(data: SpotifyAuthResponse) {
    try {
      await AsyncStorage.setItem(SPOTIFY_AUTH_KEY, JSON.stringify(data));
      console.log('Saved Spotify token');
    } catch (e) {
      console.error('Error saving Spotify token:', e);
    }
  }

  useEffect(() => {
    console.log('Spotify auth response:', response);
    if (response?.type === "success" && request?.codeVerifier) {
      console.log('Auth successful, exchanging code for token');
      const { code } = response.params;
      if (code) {
        exchangeCodeForToken(code, request.codeVerifier, REDIRECT_URI, CLIENT_ID)
          .then((data) => {
            console.log('Token exchange successful');
            setAuthResponse(data);
            saveToken(data);
          })
          .catch((e) => {
            console.error('Token exchange error:', e);
          });
      }
    } else if (response?.type === "error") {
      console.error('Auth error:', response.error);
    }
  }, [response, request]);

  useEffect(() => {
    console.log('Spotify config:', { CLIENT_ID, REDIRECT_URI, SCOPES });
    console.log('Request ready:', !!request);
  }, [request]);

  return { authResponse, getSpotifyAuth, isLoading };
}


