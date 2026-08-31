-- Deterministic SmartCart demo fixtures.
-- The seeded origin is SmartCart Demo Centre (3.1390, 101.6869).
-- Prices are illustrative PriceCatcher-shaped observations, not live data.
BEGIN;

TRUNCATE TABLE current_status, premise, item RESTART IDENTITY CASCADE;

INSERT INTO item (
    item_id, item_code, item_name, unit, item_group, item_category, sara_eligible
) VALUES
    (1, 'DEMO-BERAS-JIMAT', 'BERAS CAP JIMAT (5KG)', '5 kg', 'Demo groceries', 'BERAS', TRUE),
    (2, 'DEMO-BERAS-NILAI', 'BERAS CAP NILAI (5KG)', '5 kg', 'Demo groceries', 'BERAS', NULL),
    (3, 'DEMO-SUSU-SEGAR', 'SUSU CAIR CAP SEGAR (1L)', '1 L', 'Demo groceries', 'MINUMAN', NULL),
    (4, 'DEMO-SUSU-NILAI', 'SUSU CAIR CAP NILAI (1L)', '1 L', 'Demo groceries', 'MINUMAN', TRUE),
    (5, 'DEMO-SARDIN-AYAM', 'SARDIN CAP AYAM (425G)', '425 g', 'Demo groceries', 'IKAN DALAM TIN', NULL),
    (6, 'DEMO-SARDIN-NELAYAN', 'SARDIN CAP NELAYAN (425G)', '425 g', 'Demo groceries', 'IKAN DALAM TIN', NULL),
    (7, 'DEMO-TISU-KELUARGA', 'KERTAS TISU CAP KELUARGA (4 ROLL)', '4 roll', 'Demo household', 'LAIN-LAIN', FALSE),
    (8, 'DEMO-MINYAK-DAPUR', 'MINYAK MASAK CAP DEMO (1KG)', '1 kg', 'Demo groceries', 'MINYAK DAN LEMAK', NULL);

INSERT INTO premise (
    premise_id, premise_code, premise_name, address, district, state,
    google_place_id, place_match_refreshed_at, latitude, longitude,
    location_provider, location_refreshed_at, sara_partner, sara_match_candidate
) VALUES
    (101, 'DEMO-P101', 'Demo Mart Central', '101 Jalan Demo', 'Bukit Bintang', 'W.P. Kuala Lumpur',
        'demo-place-101', CURRENT_TIMESTAMP, 3.1390, 101.6869, 'demo', CURRENT_TIMESTAMP, TRUE, FALSE),
    (102, 'DEMO-P102', 'Demo Grocer Budget', '102 Jalan Jimat', 'Bukit Bintang', 'W.P. Kuala Lumpur',
        'demo-place-102', CURRENT_TIMESTAMP, 3.1430, 101.6890, 'demo', CURRENT_TIMESTAMP, NULL, TRUE),
    (103, 'DEMO-P103', 'Demo Market Missing', '103 Jalan Tidak Lengkap', 'Pudu', 'W.P. Kuala Lumpur',
        'demo-place-103', CURRENT_TIMESTAMP, 3.1465, 101.6815, 'demo', CURRENT_TIMESTAMP, NULL, FALSE),
    (104, 'DEMO-P104', 'Demo Fresh Corner', '104 Jalan Segar', 'KLCC', 'W.P. Kuala Lumpur',
        'demo-place-104', CURRENT_TIMESTAMP, 3.1325, 101.6905, 'demo', CURRENT_TIMESTAMP, TRUE, FALSE),
    (105, 'DEMO-P105', 'Demo Community Shop', '105 Jalan Komuniti', 'Chow Kit', 'W.P. Kuala Lumpur',
        'demo-place-105', CURRENT_TIMESTAMP, 3.1510, 101.6860, 'demo', CURRENT_TIMESTAMP, NULL, TRUE);

-- Demo Mart Central: complete basket, verified SARA, and cheaper equivalents
-- for all three interchangeable product families.
INSERT INTO current_status (item_id, premise_id, current_price, price_observed_date) VALUES
    (1, 101, 18.00, CURRENT_DATE),
    (2, 101, 12.50, CURRENT_DATE),
    (3, 101, 8.00, CURRENT_DATE),
    (4, 101, 6.50, CURRENT_DATE),
    (5, 101, 6.00, CURRENT_DATE),
    (6, 101, 4.50, CURRENT_DATE),
    (7, 101, 5.00, CURRENT_DATE),
    (8, 101, 7.00, CURRENT_DATE);

-- Demo Grocer Budget: complete basket with a mix of cheaper and non-cheaper
-- alternatives, useful for demonstrating that only valid savings are shown.
INSERT INTO current_status (item_id, premise_id, current_price, price_observed_date) VALUES
    (1, 102, 16.50, CURRENT_DATE),
    (2, 102, 14.50, CURRENT_DATE),
    (3, 102, 9.25, CURRENT_DATE),
    (4, 102, 9.00, CURRENT_DATE),
    (5, 102, 5.50, CURRENT_DATE),
    (6, 102, 5.75, CURRENT_DATE),
    (7, 102, 4.75, CURRENT_DATE),
    (8, 102, 6.50, CURRENT_DATE);

-- Demo Market Missing: deliberately incomplete. Item 5 has no observation,
-- so the selected basket shows an explicit missing price and no fake subtotal.
INSERT INTO current_status (item_id, premise_id, current_price, price_observed_date) VALUES
    (1, 103, 19.00, CURRENT_DATE),
    (2, 103, 15.00, CURRENT_DATE),
    (3, 103, 9.50, CURRENT_DATE),
    (7, 103, 5.25, CURRENT_DATE);

-- Demo Fresh Corner: complete basket but no candidate alternative prices. The
-- older observations demonstrate the stale-price notice in the detail view.
INSERT INTO current_status (item_id, premise_id, current_price, price_observed_date) VALUES
    (1, 104, 19.50, CURRENT_DATE),
    (3, 104, 9.20, CURRENT_DATE - 14),
    (5, 104, 6.20, CURRENT_DATE - 3),
    (7, 104, 5.50, CURRENT_DATE - 20),
    (8, 104, 7.50, CURRENT_DATE - 2);

-- Demo Community Shop: complete but comparatively expensive, with candidate
-- SARA status and older prices for the freshness warning path.
INSERT INTO current_status (item_id, premise_id, current_price, price_observed_date) VALUES
    (1, 105, 20.00, CURRENT_DATE - 2),
    (3, 105, 10.00, CURRENT_DATE - 2),
    (5, 105, 6.80, CURRENT_DATE - 2),
    (7, 105, 6.00, CURRENT_DATE - 10),
    (8, 105, 8.00, CURRENT_DATE - 2);

SELECT setval(pg_get_serial_sequence('item', 'item_id'), GREATEST((SELECT MAX(item_id) FROM item), 1), TRUE);
SELECT setval(pg_get_serial_sequence('premise', 'premise_id'), GREATEST((SELECT MAX(premise_id) FROM premise), 1), TRUE);

COMMIT;
