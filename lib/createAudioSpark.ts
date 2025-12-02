// lib/createAudioSpark.ts
import { supabase } from './supabase';

export async function createAudioSpark(
  boardId: string,
  audioUrl: string,
  x: number,
  y: number,
  title?: string,
  durationMs?: number
) {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return null;

  const { data, error } = await supabase
    .from('sparks')
    .insert({
      board_id: boardId,
      user_id: user.id,
      type: 'audio',
      content_url: audioUrl,
      x,
      y,
      width: 160,
      height: 80,
      title: title || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating audio spark:', error);
    return null;
  }

  return data;
}
