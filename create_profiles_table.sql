-- Create profiles table with the correct schema
-- Run this first if the table doesn't exist

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL,
  full_name TEXT NULL,
  avatar_initial TEXT GENERATED ALWAYS AS (UPPER(SUBSTR(full_name, 1, 1))) STORED NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Everyone can view profiles" ON profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Create RLS policies
CREATE POLICY "Everyone can view profiles" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

