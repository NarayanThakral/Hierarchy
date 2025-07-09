-- =================================================================
-- UNIFIED HIERARCHY SCHEMA (v2 - with Versioning)
-- This script creates the complete database schema from scratch.
-- It combines the initial setup and the versioning migration.
-- =================================================================

-- Drop existing objects to ensure a clean slate for development
DROP TABLE IF EXISTS hierarchy_data;
DROP TABLE IF EXISTS hierarchy_metadata;
DROP FUNCTION IF EXISTS update_modified_column();

-- Create a function to automatically update the 'updated_at' timestamp on any table
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- =================================================================
-- hierarchy_metadata: Stores version history and status for each hierarchy.
-- =================================================================
CREATE TABLE hierarchy_metadata (
    -- Core Fields
    id SERIAL PRIMARY KEY,
    user_input JSONB NOT NULL, -- Stores the initial user search, e.g., {"company": "Anixter", "location": "USA"}

    -- Versioning & Chaining
    root_hierarchy_id INTEGER REFERENCES hierarchy_metadata(id) ON DELETE SET NULL, -- Links all versions of a hierarchy together. NULL for the first version (v0).
    version_number INT NOT NULL DEFAULT 0, -- The sequential version number (0, 1, 2, ...).
    user_feedback JSONB, -- Stores the user feedback that prompted this version.
    version VARCHAR(20) NOT NULL DEFAULT 'v0', -- The version number (e.g., 'v0', 'v1', 'v2', ...).

    -- Status Management
    status VARCHAR(20) NOT NULL DEFAULT 'in-draft' CHECK (status IN ('in-draft', 'approved', 'archived')),
    is_active_draft BOOLEAN NOT NULL DEFAULT TRUE, -- TRUE for the latest draft in a chain, FALSE otherwise.

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    --ProjectName
    project_name VARCHAR(255),

    -- M&A update tracking
    has_ma_update BOOLEAN DEFAULT FALSE,
    last_ma_checked TIMESTAMP
);

COMMENT ON COLUMN hierarchy_metadata.root_hierarchy_id IS 'The ID of the very first version in this chain (v0).';
COMMENT ON COLUMN hierarchy_metadata.is_active_draft IS 'Indicates if this is the latest, editable draft.';


-- =================================================================
-- hierarchy_data: Stores the actual JSON data for each version.
-- =================================================================
CREATE TABLE hierarchy_data (
    id SERIAL PRIMARY KEY,
    metadata_id INTEGER NOT NULL REFERENCES hierarchy_metadata(id) ON DELETE CASCADE,
    data JSONB NOT NULL, -- The full JSON array of the hierarchy data.

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN hierarchy_data.data IS 'The complete hierarchy data as a JSONB object for a specific version.';


-- =================================================================
-- Indexes for Performance
-- =================================================================
-- Index for fast lookups of all versions belonging to a root hierarchy
CREATE INDEX idx_metadata_root_id ON hierarchy_metadata(root_hierarchy_id);

-- A GIN index is highly effective for querying into the user_input JSONB data
CREATE INDEX idx_metadata_user_input ON hierarchy_metadata USING GIN(user_input);

-- Standard index for joining hierarchy_data back to its metadata
CREATE INDEX idx_data_metadata_id ON hierarchy_data(metadata_id);


-- =================================================================
-- Triggers for Automatic Timestamp Updates
-- =================================================================
-- Trigger for the metadata table
CREATE TRIGGER update_hierarchy_metadata_modtime
BEFORE UPDATE ON hierarchy_metadata
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

-- Trigger for the data table
CREATE TRIGGER update_hierarchy_data_modtime
BEFORE UPDATE ON hierarchy_data
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

-- --- END OF SCRIPT ---