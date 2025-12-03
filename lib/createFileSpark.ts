import { supabase } from './supabase';
import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export async function createFileSpark(
  boardId: string,
  url: string,
  fileName: string,
  mimeType: string
) {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    console.error('No authenticated user');
    return null;
  }

  // Spawn near center with slight randomization
  const spawnX = (SCREEN_WIDTH * 5) / 2 - 100 + (Math.random() * 120 - 60);
  const spawnY = (SCREEN_HEIGHT * 5) / 2 - 100 + (Math.random() * 120 - 60);

  const { data, error } = await supabase
    .from('sparks')
    .insert({
      board_id: boardId,
      user_id: user.id,
      type: 'image', // Using 'image' type since 'file' isn't in DB constraint
      content_url: url,
      title: fileName,
      text_content: mimeType, // Store mime type in text_content
      x: spawnX,
      y: spawnY,
      width: 240,
      height: 120,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating file spark:', error);
    return null;
  }

  return data;
}

