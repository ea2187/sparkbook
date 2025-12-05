-- ============================================
-- COMPLETE PROFILES TABLE SETUP
-- Run this to create everything consistently
-- ============================================

-- 1. Create profiles table with consistent schema
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL,
  full_name TEXT NULL,
  username TEXT NULL,
  avatar_initial TEXT GENERATED ALWAYS AS (UPPER(SUBSTR(full_name, 1, 1))) STORED NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- 2. Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies if they exist (to avoid duplicates)
DROP POLICY IF EXISTS "Everyone can view profiles" ON profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- 4. Create RLS policies
CREATE POLICY "Everyone can view profiles" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 5. Create or replace function to automatically create profile when user signs up
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

-- 6. Create trigger to automatically create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

