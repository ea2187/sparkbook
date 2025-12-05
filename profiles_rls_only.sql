-- ============================================
-- PROFILES TABLE RLS POLICIES
-- Run this section only if other policies already exist
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid duplicates)
DROP POLICY IF EXISTS "Everyone can view profiles" ON profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Everyone can view profiles (needed for community page to show usernames)
-- This works with your schema: full_name, avatar_initial
CREATE POLICY "Everyone can view profiles" ON profiles
  FOR SELECT USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

