-- Backfill profiles for existing users who don't have profiles yet
-- Run this to create profiles for users who signed up before the trigger was set up

INSERT INTO public.profiles (id, full_name, username)
SELECT 
  u.id,
  COALESCE(
    u.raw_user_meta_data->>'full_name',
    TRIM(CONCAT(
      COALESCE(u.raw_user_meta_data->>'first_name', u.raw_user_meta_data->>'firstName', ''),
      ' ',
      COALESCE(u.raw_user_meta_data->>'last_name', u.raw_user_meta_data->>'lastName', '')
    )),
    split_part(u.email, '@', 1)
  ) AS full_name,
  COALESCE(
    u.raw_user_meta_data->>'username',
    split_part(u.email, '@', 1)
  ) AS username
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL  -- Only users without profiles
ON CONFLICT (id) DO NOTHING;

