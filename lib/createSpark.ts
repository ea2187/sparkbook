import { supabase } from './supabase';

export async function createSpark(
  boardId: string,
  url: string,
  x: number,
  y: number
) {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    console.error("❌ No authenticated user");
    return null;
  }

  const { data, error } = await supabase
    .from('sparks')
    .insert({
      board_id: boardId,
      user_id: user.id,
      type: 'image',
      content_url: url,
      x,
      y
    })
    .select()
    .single();

  if (error) {
    console.error("❌ Error creating spark:", error);
    return null;
  }

  return data;
}
