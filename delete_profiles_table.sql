-- Safely delete profiles table and all dependencies
-- Run this in Supabase SQL Editor

-- 1. Drop the trigger first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Drop the function
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 3. Drop all RLS policies
DROP POLICY IF EXISTS "Everyone can view profiles" ON profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- 4. Drop the table (CASCADE will handle any remaining dependencies)
DROP TABLE IF EXISTS public.profiles CASCADE;

