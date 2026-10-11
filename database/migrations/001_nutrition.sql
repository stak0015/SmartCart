-- Owner: Shun
-- One table holds publisher nutrient data and its source provenance.
-- Namespaces preserve different current/legacy records with overlapping IDs.
CREATE TABLE IF NOT EXISTS nutrition_food (
    dataset TEXT NOT NULL CHECK (dataset IN ('items', 'foods')),
    food_id TEXT NOT NULL,
    source_id TEXT NOT NULL,
    source_record_code TEXT NOT NULL,
    description TEXT NOT NULL,
    basis TEXT NOT NULL CHECK (basis IN ('per_100g', 'per_100ml')),
    nutrients JSONB NOT NULL CHECK (jsonb_typeof(nutrients) = 'object'),
    source_metadata JSONB NOT NULL CHECK (jsonb_typeof(source_metadata) = 'object'),
    document JSONB NOT NULL CHECK (jsonb_typeof(document) = 'object'),
    snapshot_sha256 TEXT NOT NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (dataset, food_id)
);

-- Upgrade the earlier prototype without losing food values or provenance.
ALTER TABLE nutrition_food
    ADD COLUMN IF NOT EXISTS source_record_code TEXT,
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS source_metadata JSONB,
    ADD COLUMN IF NOT EXISTS snapshot_sha256 TEXT,
    ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE nutrition_food SET source_record_code = document->>'source_code',
    description = document->>'description'
    WHERE source_record_code IS NULL OR description IS NULL;
DO $$
BEGIN
    IF to_regclass('nutrition_source') IS NOT NULL THEN
        UPDATE nutrition_food f SET source_metadata = s.document
        FROM nutrition_source s
        WHERE f.dataset = s.dataset AND f.source_id = s.source_id AND f.source_metadata IS NULL;
    END IF;
    IF to_regclass('nutrition_dataset') IS NOT NULL THEN
        UPDATE nutrition_food f SET snapshot_sha256 = d.snapshot_sha256
        FROM nutrition_dataset d WHERE f.dataset = d.dataset AND f.snapshot_sha256 IS NULL;
    END IF;
END $$;
ALTER TABLE nutrition_food
    ALTER COLUMN source_record_code SET NOT NULL,
    ALTER COLUMN description SET NOT NULL,
    ALTER COLUMN source_metadata SET NOT NULL,
    ALTER COLUMN snapshot_sha256 SET NOT NULL;
ALTER TABLE nutrition_food DROP CONSTRAINT IF EXISTS nutrition_food_dataset_source_id_fkey;

-- Remove only tables introduced by the earlier nutrition prototype.
-- No CASCADE: unexpected dependencies must be reviewed rather than deleted.
DROP TABLE IF EXISTS item_nutrition_basis_variant, nutrition_alternative_mapping,
    item_nutrition_mapping, nutrition_alternative_rule, nutrition_comparison_policy,
    nutrition_source, nutrition_dataset;
