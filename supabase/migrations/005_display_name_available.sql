-- Migration: Create display_name_available RPC function
-- Date: February 9, 2026
-- Purpose: Required for login page signup validation

-- Drop existing function if exists (for clean re-creation)
DROP FUNCTION IF EXISTS display_name_available(text);

-- Create the function
CREATE OR REPLACE FUNCTION display_name_available(p_name text)
RETURNS boolean AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM people WHERE LOWER(full_name) = LOWER(p_name)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION display_name_available(text) TO authenticated;

COMMENT ON FUNCTION display_name_available(text) IS
'Checks if a display name is available for signup. Returns true if no existing user has the same full_name.';
