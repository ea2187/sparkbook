-- Trigger to automatically update board's updated_at when sparks are modified
-- This ensures the board's "last modified" time reflects any changes to its content

-- First, ensure the updated_at column exists on boards table
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

-- Function to update board's updated_at timestamp
CREATE OR REPLACE FUNCTION update_board_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the board's updated_at when a spark is inserted, updated, or deleted
  UPDATE boards
  SET updated_at = NOW()
  WHERE id = (
    CASE
      WHEN TG_OP = 'DELETE' THEN OLD.board_id
      ELSE NEW.board_id
    END
  );
  
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_board_on_spark_insert ON sparks;
DROP TRIGGER IF EXISTS update_board_on_spark_update ON sparks;
DROP TRIGGER IF EXISTS update_board_on_spark_delete ON sparks;

-- Create triggers for spark insert, update, and delete
CREATE TRIGGER update_board_on_spark_insert
  AFTER INSERT ON sparks
  FOR EACH ROW
  EXECUTE FUNCTION update_board_updated_at();

CREATE TRIGGER update_board_on_spark_update
  AFTER UPDATE ON sparks
  FOR EACH ROW
  EXECUTE FUNCTION update_board_updated_at();

CREATE TRIGGER update_board_on_spark_delete
  AFTER DELETE ON sparks
  FOR EACH ROW
  EXECUTE FUNCTION update_board_updated_at();

-- Also update updated_at when board itself is updated (e.g., name change)
-- This trigger ensures updated_at is set even if not explicitly provided
CREATE OR REPLACE FUNCTION set_board_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_board_updated_at_trigger ON boards;

CREATE TRIGGER set_board_updated_at_trigger
  BEFORE UPDATE ON boards
  FOR EACH ROW
  EXECUTE FUNCTION set_board_updated_at();

