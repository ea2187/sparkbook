import { useState, useEffect } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const SPOTIFY_CLIENT_ID = 'YOUR_SPOTIFY_CLIENT_ID'; // Replace with your Spotify Client ID
const SPOTIFY_REDIRECT_URI = AuthSession.makeRedirectUri({ useProxy: true });

// Log the redirect URI - you need to add this to your Spotify app settings
console.log('📱 Spotify Redirect URI:', SPOTIFY_REDIRECT_URI);

const discovery = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

export function useSpotifyAuth() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: SPOTIFY_CLIENT_ID,
      scopes: ['user-top-read', 'user-read-email'],
      usePKCE: false,
      redirectUri: SPOTIFY_REDIRECT_URI,
      responseType: 'token', // Use implicit flow to get token directly
    },
    discovery
  );

  useEffect(() => {
    if (response?.type === 'success') {
      const { access_token } = response.params;
      if (access_token) {
        setAccessToken(access_token);
      }
    }
  }, [response]);

  const login = async () => {
    await promptAsync();
  };

  return { accessToken, login, isReady: !!request };
}

export async function searchSpotifyTracks(query: string, accessToken: string) {
  try {
    const response = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=20`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    const data = await response.json();
    return data.tracks?.items || [];
  } catch (error) {
    console.error('Spotify search error:', error);
    return [];
  }
}

export async function getTopTracks(accessToken: string) {
  try {
    const response = await fetch(
      'https://api.spotify.com/v1/me/top/tracks?limit=20',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error('Spotify top tracks error:', error);
    return [];
  }
}
