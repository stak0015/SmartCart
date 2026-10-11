-- A stable surrogate key permits a direct item foreign key while retaining
-- current/legacy source namespaces whose publisher food IDs overlap.
ALTER TABLE nutrition_food ADD COLUMN IF NOT EXISTS nutrition_id BIGSERIAL;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'nutrition_food'::regclass
                   AND conname = 'nutrition_food_nutrition_id_key') THEN
        ALTER TABLE nutrition_food ADD CONSTRAINT nutrition_food_nutrition_id_key UNIQUE (nutrition_id);
    END IF;
END $$;
ALTER TABLE item
    ADD COLUMN IF NOT EXISTS nutrition_food_id BIGINT,
    ADD COLUMN IF NOT EXISTS nutrition_mapping_metadata JSONB;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'item'::regclass
                   AND conname = 'item_nutrition_food_fk') THEN
        ALTER TABLE item ADD CONSTRAINT item_nutrition_food_fk
            FOREIGN KEY (nutrition_food_id) REFERENCES nutrition_food(nutrition_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'item'::regclass
                   AND conname = 'item_nutrition_metadata_check') THEN
        ALTER TABLE item ADD CONSTRAINT item_nutrition_metadata_check
            CHECK (nutrition_mapping_metadata IS NULL OR jsonb_typeof(nutrition_mapping_metadata) = 'object');
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS item_nutrition_food_id_idx
    ON item (nutrition_food_id) WHERE nutrition_food_id IS NOT NULL;
