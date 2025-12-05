-- Add username column to profiles table and update everything

-- 1. Add username column if it doesn't exist
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS username TEXT;

-- 2. Update the trigger function to include username
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, username)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      TRIM(CONCAT(
        COALESCE(NEW.raw_user_meta_data->>'first_name', NEW.raw_user_meta_data->>'firstName', ''),
        ' ',
        COALESCE(NEW.raw_user_meta_data->>'last_name', NEW.raw_user_meta_data->>'lastName', '')
      )),
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      split_part(NEW.email, '@', 1)
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Backfill username for existing profiles
UPDATE public.profiles
SET username = COALESCE(
  (SELECT raw_user_meta_data->>'username' FROM auth.users WHERE auth.users.id = profiles.id),
  split_part((SELECT email FROM auth.users WHERE auth.users.id = profiles.id), '@', 1)
)
WHERE username IS NULL;

