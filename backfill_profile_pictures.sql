-- Backfill profile_picture in profiles from auth.users raw metadata (one-time helper)
-- Run this in Supabase SQL editor.

UPDATE public.profiles AS p
SET profile_picture = auth_users.raw_user_meta_data->>'profile_picture'
FROM auth.users AS auth_users
WHERE p.id = auth_users.id
  AND p.profile_picture IS NULL
  AND auth_users.raw_user_meta_data->>'profile_picture' IS NOT NULL;

-- Also try camelCase key if that's what was stored
UPDATE public.profiles AS p
SET profile_picture = auth_users.raw_user_meta_data->>'profilePicture'
FROM auth.users AS auth_users
WHERE p.id = auth_users.id
  AND p.profile_picture IS NULL
  AND auth_users.raw_user_meta_data->>'profilePicture' IS NOT NULL;

