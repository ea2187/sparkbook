// lib/uploadImage.ts
import * as FileSystem from 'expo-file-system/legacy';
import * as base64 from 'base64-arraybuffer';
import { supabase } from './supabase';

export async function uploadImageAsync(uri: string, boardId: string) {
  try {
    console.log("🔵 Uploading image:", uri);

    // Read file as base64 (works in Expo Go)
    const base64String = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64',
    });

    const fileExt = uri.split('.').pop() ?? 'jpg';
    const fileName = `${boardId}-${Date.now()}.${fileExt}`;
    const filePath = `sparks/${fileName}`;

    // Convert base64 → ArrayBuffer
    const arrayBuffer = base64.decode(base64String);

    // Upload to Supabase storage
    const { error: uploadError } = await supabase.storage
      .from('spark-images')
      .upload(filePath, arrayBuffer, {
        contentType: `image/${fileExt}`,
        upsert: false,
      });

    if (uploadError) {
      console.error("❌ Supabase upload error:", uploadError);
      return null;
    }

    // Get public URL
    const { data: publicURL } = supabase.storage
      .from('spark-images')
      .getPublicUrl(filePath);

    console.log("✅ Public URL:", publicURL.publicUrl);
    return publicURL.publicUrl;

  } catch (err) {
    console.error("❌ uploadImageAsync failed:", err);
    return null;
  }
}
