-- Enable RLS on all tables
-- This ensures that users can only access/modify their own data (or public data where appropriate)

-- ============================================
-- BOARDS TABLE
-- ============================================
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;

-- Users can view their own boards
CREATE POLICY "Users can view own boards" ON boards
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create their own boards
CREATE POLICY "Users can create own boards" ON boards
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own boards
CREATE POLICY "Users can update own boards" ON boards
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own boards
CREATE POLICY "Users can delete own boards" ON boards
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- SPARKS TABLE
-- ============================================
ALTER TABLE sparks ENABLE ROW LEVEL SECURITY;

-- Users can view sparks from their own boards
CREATE POLICY "Users can view sparks from own boards" ON sparks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM boards
      WHERE boards.id = sparks.board_id
      AND boards.user_id = auth.uid()
    )
  );

-- Users can create sparks in their own boards
CREATE POLICY "Users can create sparks in own boards" ON sparks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM boards
      WHERE boards.id = sparks.board_id
      AND boards.user_id = auth.uid()
    )
  );

-- Users can update sparks in their own boards
CREATE POLICY "Users can update sparks in own boards" ON sparks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM boards
      WHERE boards.id = sparks.board_id
      AND boards.user_id = auth.uid()
    )
  );

-- Users can delete sparks from their own boards
CREATE POLICY "Users can delete sparks from own boards" ON sparks
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM boards
      WHERE boards.id = sparks.board_id
      AND boards.user_id = auth.uid()
    )
  );

-- ============================================
-- COMMUNITY_POSTS TABLE
-- ============================================
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;

-- Everyone can view community posts (for the feed)
CREATE POLICY "Everyone can view community posts" ON community_posts
  FOR SELECT USING (true);

-- Users can create their own community posts
CREATE POLICY "Users can create own community posts" ON community_posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own community posts
CREATE POLICY "Users can update own community posts" ON community_posts
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own community posts
CREATE POLICY "Users can delete own community posts" ON community_posts
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- COMMUNITY_ATTACHMENTS TABLE
-- ============================================
ALTER TABLE community_attachments ENABLE ROW LEVEL SECURITY;

-- Everyone can view community attachments (for the feed)
CREATE POLICY "Everyone can view community attachments" ON community_attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM community_posts
      WHERE community_posts.id = community_attachments.post_id
    )
  );

-- Users can create attachments for their own posts
CREATE POLICY "Users can create attachments for own posts" ON community_attachments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM community_posts
      WHERE community_posts.id = community_attachments.post_id
      AND community_posts.user_id = auth.uid()
    )
  );

-- Users can update attachments for their own posts
CREATE POLICY "Users can update attachments for own posts" ON community_attachments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM community_posts
      WHERE community_posts.id = community_attachments.post_id
      AND community_posts.user_id = auth.uid()
    )
  );

-- Users can delete attachments from their own posts
CREATE POLICY "Users can delete attachments from own posts" ON community_attachments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM community_posts
      WHERE community_posts.id = community_attachments.post_id
      AND community_posts.user_id = auth.uid()
    )
  );

