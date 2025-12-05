-- Add updated_at column to boards table if it doesn't exist
-- This column will track when the board was last modified

-- Check if column exists and add it if it doesn't
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'boards' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE boards ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        
        -- Set initial value for existing boards to their created_at time
        UPDATE boards 
        SET updated_at = created_at 
        WHERE updated_at IS NULL;
    END IF;
END $$;

