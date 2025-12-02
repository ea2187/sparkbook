// lib/uploadAudio.ts
import * as FileSystem from 'expo-file-system/legacy';
import * as base64 from 'base64-arraybuffer';
import { supabase } from './supabase';

export async function uploadAudioAsync(uri: string, boardId: string) {
  try {
    console.log('🎙 Uploading audio:', uri);

    const base64String = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64',
    });

    // extension: often m4a on iOS
    const fileExt = uri.split('.').pop() ?? 'm4a';
    const fileName = `${boardId}-${Date.now()}.${fileExt}`;
    const filePath = `audio/${fileName}`;

    const arrayBuffer = base64.decode(base64String);

    const { error } = await supabase.storage
      .from('spark-images') // reusing existing bucket
      .upload(filePath, arrayBuffer, {
        contentType: `audio/${fileExt}`,
        upsert: false,
      });

    if (error) {
      console.error('❌ Supabase audio upload error:', error);
      return null;
    }

    const { data: publicURL } = supabase.storage
      .from('spark-images')
      .getPublicUrl(filePath);

    console.log('✅ Audio public URL:', publicURL.publicUrl);
    return publicURL.publicUrl;
  } catch (err) {
    console.error('❌ uploadAudioAsync failed:', err);
    return null;
  }
}
