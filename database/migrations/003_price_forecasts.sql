-- Versioned offline forecasts. Publishing and active-pointer changes are atomic.
CREATE TABLE IF NOT EXISTS price_forecast_batch (
    id VARCHAR(64) PRIMARY KEY,
    generated_at TIMESTAMPTZ NOT NULL,
    data_cutoff DATE NOT NULL,
    metadata JSONB NOT NULL,
    record_count INTEGER NOT NULL CHECK (record_count > 0)
);

CREATE TABLE IF NOT EXISTS price_forecast_record (
    batch_id VARCHAR(64) NOT NULL REFERENCES price_forecast_batch(id) ON DELETE CASCADE,
    item_code VARCHAR(64) NOT NULL,
    region_id VARCHAR(255) NOT NULL,
    record JSONB NOT NULL,
    PRIMARY KEY (batch_id, item_code, region_id)
);

CREATE TABLE IF NOT EXISTS price_forecast_active (
    singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
    batch_id VARCHAR(64) NOT NULL REFERENCES price_forecast_batch(id)
);
