import { supabase } from './supabase';
import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export async function createMusicSpark(boardId: string, track: any) {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    console.error('No authenticated user');
    return null;
  }

  // Spawn near center with slight randomization
  const spawnX = (SCREEN_WIDTH * 5) / 2 - 100 + (Math.random() * 120 - 60);
  const spawnY = (SCREEN_HEIGHT * 5) / 2 - 100 + (Math.random() * 120 - 60);

  // Get display settings from track (added by AddMusicDetailsScreen)
  const displayMode = track.displayMode || 'album';
  const albumImage = track.album?.images?.[0]?.url;
  const spotifyUri = track.uri; // For deep linking to Spotify
  const spotifyUrl = track.external_urls?.spotify;

  // Store settings in text_content as JSON for later use
  const metadata = JSON.stringify({
    artists: track.artists?.map((a: any) => a.name).join(', ') || '',
    albumImage,
    displayMode,
    spotifyUri,
    spotifyUrl,
  });

  const { data, error } = await supabase
    .from('sparks')
    .insert({
      board_id: boardId,
      user_id: user.id,
      type: 'audio', // Using 'audio' type since 'music' isn't in DB constraint
      content_url: track.external_urls?.spotify || track.uri || '',
      title: track.name,
      text_content: metadata,
      x: spawnX,
      y: spawnY,
      width: displayMode === 'album' ? 200 : 240,
      height: displayMode === 'album' ? 200 : 120,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating music spark:', error);
    return null;
  }

  return data;
}
