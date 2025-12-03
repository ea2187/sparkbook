// lib/uploadFile.ts
import * as FileSystem from 'expo-file-system/legacy';
import * as base64 from 'base64-arraybuffer';
import { supabase } from './supabase';

export async function uploadFileAsync(uri: string, boardId: string, fileName: string, mimeType: string) {
  try {
    console.log('📄 Uploading file:', fileName);

    const base64String = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64',
    });

    // Get file extension from original filename or mime type
    const fileExt = fileName.split('.').pop() || mimeType.split('/').pop() || 'file';
    const uploadFileName = `${boardId}-${Date.now()}.${fileExt}`;
    const filePath = `files/${uploadFileName}`;

    const arrayBuffer = base64.decode(base64String);

    const { error } = await supabase.storage
      .from('spark-images') // reusing existing bucket
      .upload(filePath, arrayBuffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (error) {
      console.error('❌ Supabase file upload error:', error);
      return null;
    }

    const { data: publicURL } = supabase.storage
      .from('spark-images')
      .getPublicUrl(filePath);

    console.log('✅ File public URL:', publicURL.publicUrl);
    return publicURL.publicUrl;
  } catch (err) {
    console.error('❌ uploadFileAsync failed:', err);
    return null;
  }
}

