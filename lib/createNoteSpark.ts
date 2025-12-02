// lib/createNoteSpark.ts
import { supabase } from './supabase';

export async function createNoteSpark(
  boardId: string,
  title: string,
  text: string,
  x: number,
  y: number
) {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  const { data, error } = await supabase
    .from('sparks')
    .insert({
      board_id: boardId,
      user_id: user?.id ?? null,
      type: 'note',
      title,
      text_content: text,
      content_url: null,
      x,
      y,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating note spark:', error);
    return null;
  }

  return data;
}
