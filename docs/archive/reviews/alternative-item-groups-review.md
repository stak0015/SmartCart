# First-pass category-scoped item groups

- Source: `database/data/pricecatcher_images.csv` (796 item records, 796 unique item codes, 740 distinct source names).
- Categories: 59.
- Scope: checked-in image manifest only. The local SmartCart database is not configured, so this is not a full live database export.
- Grouping: compare names only within the same category; remove pack-size text; remove a `CAP`/`JENAMA` brand segment while keeping parenthetical product details; group with complete-link token Jaccard similarity at 0.67 or above.
- Complete-link means every pair in a group must meet the threshold, which limits chain-merging. Group labels show shared normalized name terms.
- Runtime matching uses the same name normalization and threshold pairwise, while retaining the exact package-basis check so savings compare equal-size packs.
- Review note: these are candidate text groups, not verified substitutes. A category and name alone cannot verify dietary suitability, product function, stock, or current price. Malay/English synonyms are not yet normalized.

## Category summary

| Category | Catalogue records | Candidate groups | Records in groups |
|---|---:|---:|---:|
| ALAT TULIS DAN BAHAN BACAAN — Stationery & Reading Materials | 3 | 0 | 0 |
| AYAM — Chicken | 10 | 0 | 0 |
| BAHAN LAUT — Seafood | 40 | 6 | 13 |
| BAHAN-BAHAN MINUMAN — Beverage Ingredients | 24 | 3 | 7 |
| BAWANG — Onions | 11 | 1 | 2 |
| BERAS — Rice | 22 | 4 | 13 |
| BERUS GIGI — Toothbrushes | 1 | 0 | 0 |
| BIHUN — Rice Vermicelli | 6 | 3 | 6 |
| BISKUT — Biscuits | 6 | 0 | 0 |
| BUAH-BUAHAN — Fruits | 18 | 0 | 0 |
| CILI KERING — Dried Chillies | 2 | 0 | 0 |
| COKLAT — Chocolate | 6 | 0 | 0 |
| DAGING — Meat | 32 | 6 | 12 |
| ESEN DAN RAGI — Essences & Yeast | 6 | 1 | 2 |
| GULA — Sugar | 4 | 0 | 0 |
| HASIL LAUT KERING — Dried Seafood | 3 | 0 | 0 |
| IKAN DALAM TIN — Canned Fish | 11 | 2 | 8 |
| IKAN DARAT — Freshwater Fish | 4 | 1 | 4 |
| KACANG — Nuts & Legumes | 7 | 0 | 0 |
| KELAPA — Coconut | 4 | 0 | 0 |
| KICAP DAN SOS — Soy Sauce & Sauces | 20 | 4 | 8 |
| KRIMER DAN SUSU TEPUNG — Creamer & Milk Powder | 24 | 3 | 8 |
| LAIN-LAIN — Other | 27 | 0 | 0 |
| LAMPIN PAKAI BUANG — Disposable Diapers | 17 | 5 | 11 |
| LAUK — Prepared Dishes | 72 | 6 | 15 |
| MAJALAH — Magazines | 2 | 0 | 0 |
| MAKANAN BAYI — Baby Food | 6 | 0 | 0 |
| MAKANAN RINGAN — Snacks | 4 | 1 | 2 |
| MAKANAN SEGERA — Instant Food | 2 | 0 | 0 |
| MEE / BIHUN / KUEY TEOW — Noodles, Rice Vermicelli & Kuey Teow | 28 | 0 | 0 |
| MEE/KUETIAU — Noodles & Kuey Teow | 2 | 0 | 0 |
| MENTEGA — Butter | 2 | 0 | 0 |
| MI SEGERA — Instant Noodles | 4 | 0 | 0 |
| MINUMAN — Beverages | 47 | 2 | 4 |
| MINYAK DAN LEMAK — Oils & Fats | 39 | 4 | 38 |
| MOUTH WASH — Mouthwash | 1 | 0 | 0 |
| NASI — Cooked Rice | 24 | 1 | 2 |
| PENGHALAU NYAMUK | 1 | 0 | 0 |
| PENJAGAAN DIRI — Personal Care | 22 | 0 | 0 |
| PENJAGAAN RUMAH — Household Care | 24 | 3 | 6 |
| PEWANGI RUMAH | 1 | 0 | 0 |
| REMPAH RATUS (BERBUNGKUS) | 30 | 2 | 4 |
| REMPAH RATUS (TIDAK BERBUNGKUS) | 18 | 0 | 0 |
| ROTI — Bread | 4 | 0 | 0 |
| SABUN BADAN — Body Wash | 1 | 0 | 0 |
| SANTAN (KOTAK) — Coconut Milk (Carton) | 4 | 1 | 4 |
| SAPUAN (SPREADS) — Spreads | 16 | 4 | 8 |
| SAYUR-SAYURAN — Vegetables | 41 | 0 | 0 |
| SUSU BAYI — Infant Formula | 27 | 5 | 12 |
| SYAMPU — Shampoo | 2 | 0 | 0 |
| TAUHU DAN TEMPE — Tofu & Tempeh | 2 | 0 | 0 |
| TELUR — Eggs | 11 | 2 | 4 |
| TEPUNG — Flour | 9 | 1 | 3 |
| TERSEDIA MINUM — Ready-to-Drink | 26 | 3 | 6 |
| TISU — Tissues | 1 | 0 | 0 |
| TUALA WANITA — Sanitary Pads | 2 | 1 | 2 |
| UBAT GIGI — Toothpaste | 1 | 0 | 0 |
| UBAT-UBATAN — Medicines | 8 | 0 | 0 |
| UBI KENTANG — Potatoes | 4 | 0 | 0 |

## ALAT TULIS DAN BAHAN BACAAN — Stationery & Reading Materials

3 catalogue records; 0 candidate groups; 3 ungrouped records.

### Ungrouped / distinct names

- `1652` PAPERMATE LIQUID PAPER (PEN) — 7ml
- `1886` PEMBARIS PLASTIK FABER CASTELL - 15CM — English: Ruler PLASTIK FABER CASTELL - 15CM — 1 unit
- `1653` UHU GLUE (GAM PELBAGAI KEGUNAAN) — English: UHU GLUE (GAM Various KEGUNAAN) — 20ml


## AYAM — Chicken

10 catalogue records; 0 candidate groups; 10 ungrouped records.

### Ungrouped / distinct names

- `1127` AYAM BELANDA IMPORT — English: Imported Turkey — 1kg
- `1` AYAM BERSIH - STANDARD — English: Cleaned Chicken - Standard — 1kg
- `2` AYAM BERSIH - SUPER — English: Cleaned Chicken - Super — 1kg
- `3` AYAM HIDUP — English: Live Chicken — 1kg
- `1364` AYAM TUA HIDUP — English: Live Old Chicken — 1kg
- `1551` DADA AYAM (CHICKEN KEEL) — English: DADA Chicken (CHICKEN KEEL) (1KG) — 1kg
- `1804` KEPAK AYAM (CHICKEN WING) — English: KEPAK Chicken (CHICKEN WING) (1KG) — 1kg
- `1550` PAHA AYAM (CHICKEN DRUMSTICK) — English: Chicken Thigh (Chicken Drumstick) — 1kg
- `1552` THIGH AYAM — English: THIGH Chicken — 1kg
- `1553` WHOLE LEG AYAM — English: WHOLE LEG Chicken — 1kg


## BAHAN LAUT — Seafood

40 catalogue records; 6 candidate groups; 27 ungrouped records.

### Group 1: IKAN ANTARA 2 HINGGA 5 EKOR SEKILOGRAM (minimum pair similarity 0.70)

- `43` IKAN BAWAL HITAM (ANTARA 2 HINGGA 5 EKOR SEKILOGRAM) — English: Black Pomfret (between 2 to 5 fish per kilogram) — 1kg
- `1475` IKAN BAWAL PUTIH (ANTARA 2 HINGGA 5 EKOR SEKILOGRAM) — English: White Pomfret (between 2 to 5 fish per kilogram) — 1kg
- `65` IKAN KERAPU (ANTARA 2 HINGGA 5 EKOR SEKILOGRAM) — English: Grouper (between 2 to 5 fish per kilogram) — 1kg

### Group 2: IKAN ANTARA 5 HINGGA 10 EKOR SEKILOGRAM (minimum pair similarity 0.78)

- `49` IKAN GELAMA (ANTARA 5 HINGGA 10 EKOR SEKILOGRAM) — English: Croaker (between 5 to 10 fish per kilogram) — 1kg
- `1436` IKAN KERISI (ANTARA 5 HINGGA 10 EKOR SEKILOGRAM) — English: Fish KERISI (between 5 to 10 fish per kilogram) — 1kg

### Group 3: IKAN B 1 KILOGRAM SEEKOR (minimum pair similarity 0.71)

- `51` IKAN JENAHAK (b	% 1 KILOGRAM SEEKOR) — English: Red Snapper (≥ 1 kilogram each) — 1kg
- `60` IKAN MERAH (b	% 1 KILOGRAM SEEKOR) — English: Red Snapper (≥ 1 kilogram each) — 1kg

### Group 4: IKAN TENGGIRI ANTARA 1 HINGGA 2 EKOR SEKILOGRAM (minimum pair similarity 0.80)

- `82` IKAN TENGGIRI BATANG (ANTARA 1 HINGGA 2 EKOR SEKILOGRAM) — English: Spanish Mackerel Batang (between 1 to 2 fish per kilogram) — 1kg
- `79` IKAN TENGGIRI PAPAN (ANTARA 1 HINGGA 2 EKOR SEKILOGRAM) — English: Spanish Mackerel PAPAN (between 1 to 2 fish per kilogram) — 1kg

### Group 5: IKAN TONGKOL AYA KAYU HITAM ANTARA 1 HINGGA 2 EKOR SEKILOGRAM (minimum pair similarity 0.92)

- `83` IKAN TONGKOL/AYA/KAYU HITAM (ANTARA 1 HINGGA 2 EKOR SEKILOGRAM) — English: Black Tuna/Longtail Tuna (between 1 to 2 fish per kilogram) — 1kg
- `2047` IKAN TONGKOL/AYA/KAYU HITAM/PUTIH (ANTARA 1 HINGGA 2 EKOR SEKILOGRAM) — 1kg

### Group 6: UDANG ANTARA 20 HINGGA 30 EKOR SEKILOGRAM (minimum pair similarity 0.70)

- `850` UDANG HARIMAU (ANTARA 20 HINGGA 30 EKOR SEKILOGRAM) — English: Tiger Prawns (between 20 to 30 fish per kilogram) — 1kg
- `1919` UDANG PUTIH BESAR (ANTARA 20 HINGGA 30 EKOR SEKILOGRAM) — English: White Prawns Large (between 20 to 30 fish per kilogram) — 1kg

### Ungrouped / distinct names

- `47` IKAN CENCARU (ANTARA 4 HINGGA 6 EKOR SEKILOGRAM) — English: Hardtail Scad (between 4 to 6 fish per kilogram) — 1kg
- `1916` IKAN DEMUDUK/CUPAK/CERMIN (≤ 3 EKOR SEKILOGRAM) — English: Demuduk/Cupak/Cermin Fish (≤ 3 fish per kilogram) — 1kg
- `1915` IKAN JENAHAK (KEPINGAN) — English: Red Snapper (Slices) — 1kg
- `1476` IKAN KEMBUNG (ANTARA 8 HINGGA 12 EKOR SEKILOGRAM) — English: Indian Mackerel (between 8 to 12 fish per kilogram) — 1kg
- `55` IKAN KEMBUNG KECIL/PELALING (ANTARA 10 HINGGA 18 EKOR SEKILOGRAM) — English: Indian Mackerel Small/PELALING (between 10 to 18 fish per kilogram) — 1kg
- `1477` IKAN MABUNG (ANTARA 6 HINGGA 10 EKOR SEKILOGRAM) — English: Fish MABUNG (between 6 to 10 fish per kilogram) — 1kg
- `1554` IKAN MERAH (KEPINGAN) — English: Red Snapper (Slices) — 1kg
- `66` IKAN PARANG (ANTARA 1 HINGGA 3 EKOR SEKILOGRAM) — English: Wolf Herring (between 1 to 3 fish per kilogram) — 1kg
- `1917` IKAN PARANG (KEPINGAN) — English: Wolf Herring (Slices) — 1kg
- `68` IKAN PARI (KEPINGAN) — English: Stingray (Slices) — 1kg
- `69` IKAN SELAR KUNING (≥ 11 EKOR SEKILOGRAM) — English: Yellowtail Scad (≥ 11 fish per kilogram) — 1kg
- `70` IKAN SELAR/PELATA (≤ 7 EKOR SEKILOGRAM) — English: Whitefin Scad (≤ 7 fish per kilogram) — 1kg
- `71` IKAN SELAYANG/SARDIN  (≥ 13 EKOR SEKILOGRAM) — English: Scad/Sardine (≥ 13 fish per kilogram) — 1kg
- `2045` IKAN SELAYANG/SARDIN (ANTARA 8-12 EKOR SEKILOGRAM) — 1kg
- `73` IKAN SENANGIN (ANTARA 2 HINGGA 8 EKOR SEKILOGRAM) — English: Threadfin (between 2 to 8 fish per kilogram) — 1kg
- `1437` IKAN SIAKAP (ANTARA 2 HINGGA 4 EKOR SEKILOGRAM) — English: Sea Bass (between 2 to 4 fish per kilogram) — 1kg
- `78` IKAN TAMBAN BELURU (ANTARA 10 HINGGA 19 EKOR SEKILOGRAM) — English: Fish TAMBAN BELURU (between 10 to 19 fish per kilogram) — 1kg
- `1438` IKAN TENGGIRI BATANG (KEPINGAN) — English: Spanish Mackerel Batang (Slices) — 1kg
- `1918` IKAN TERUBOK (b	$ 4 EKOR SEKILOGRAM) — English: Terubok Fish (≤ 4 fish per kilogram) — 1kg
- `52` KEPALA IKAN JENAHAK — English: Red Snapper Head — 1kg
- `64` KEPALA IKAN MERAH — English: Head Red Snapper — 1kg
- `1920` KERANG (SAIZ SEDERHANA) — English: Clams (Size Medium) — 1kg
- `847` KETAM RENJONG/BUNGA (≤ 4 EKOR SEKILOGRAM) — English: Crab RENJONG/BUNGA (between 5 to 8 fish per kilogram) — 1kg
- `845` SOTONG (ANTARA 11 HINGGA17 EKOR SEKILOGRAM) — English: Squid (≥ 6 fish per kilogram) — 1kg
- `1391` UDANG PUTIH BESAR (BERAT ANTARA 41 EKOR HINGGA 60 EKOR SEKILOGRAM) — English: White Prawns Large/BANANA PRAWN (Weight between 41 fish to 60 fish per kilogram) — 1kg
- `849` UDANG PUTIH KECIL (b	% 61 EKOR SEKILOGRAM) — English: Small White Prawns (≥ 61 prawns per kilogram) — 1kg
- `1555` UDANG PUTIH/VANNAMEI (TERNAK) (ANTARA 41 HINGGA 60 EKOR SEKILOGRAM) — English: White Prawns/VANNAMEI (TERNAK) (between 41 to 60 fish per kilogram) — 1kg


## BAHAN-BAHAN MINUMAN — Beverage Ingredients

24 catalogue records; 3 candidate groups; 17 ungrouped records.

### Group 1: MILO PAKET (minimum pair similarity 1.00)

- `1637` MILO (PAKET) — English: MILO (Packet) — 1kg
- `1636` MILO (PAKET) — English: MILO (Packet) — 400 g
- `2114` MILO (PAKET) — 900 g

### Group 2: KORDIAL F AND N PELBAGAI PERISA (minimum pair similarity 0.75)

- `910` KORDIAL F&N (PELBAGAI PERISA) — English: F&N Cordial (Rose Syrup) — 2 liter
- `1854` KORDIAL F&N SUN VALLEY (PELBAGAI PERISA) — English: Cordial F&N SUN VALLEY (GRENADINE) — 2 liter

### Group 3: KORDIAL SUNQUICK OREN (minimum pair similarity 1.00)

- `2113` KORDIAL SUNQUICK (OREN) — 700ml
- `171` KORDIAL SUNQUICK (OREN) — English: Cordial SUNQUICK (OREN) — 840 ml

### Ungrouped / distinct names

- `1402` HORLICKS (PAKET) — English: HORLICKS (Packet) — 400 g
- `2115` INDOCAFE (ORIGINAL BLEND) (PAKET) — 200 g
- `1638` MILO 3 IN 1 (PAKET) - ORIGINAL — English: MILO 3 IN 1 (Packet) - ORIGINAL — 30x33g
- `2019` NESCAFE 3 IN 1 ORIGINAL (AROMATIC & BALANCED) — 25 x 18g
- `1877` NESCAFE BLEND & BREW 3 IN 1 (PAKET ) - ORIGINAL — English: NESCAFE BLEND & BREW 3 IN 1 (Packet ) - ORIGINAL — 28x19g
- `929` NESCAFE CLASSIC (PAKET) — English: NESCAFE CLASSIC (Packet) — 200 g
- `1635` NESTLE COFFEE-MATE — 450 g
- `1962` NESTUM (ORIGINAL) — 500 g
- `1964` QUAKER OATS INSTANT OATMEALS — 1kg
- `1645` SERBUK KOPI CAP KAPAL API (KASAR) (BERBUNGKUS) — English: Coffee Powder Brand KAPAL API (Coarse) (Packaged) — 180 g
- `1646` SERBUK KOPI HANG TUAH ROBUSTA — English: Coffee Powder HANG TUAH ROBUSTA — 200 g
- `1856` SERBUK KOPIMAS COFFEE (BOLD TRADITIONS) — English: Powder KOPIMAS COFFEE (BOLD TRADITIONS) — 200 g
- `1084` TEH BOH (SERBUK) — English: Boh Tea (Powder) — 500 g
- `180` TEH BOH (UNCANG) — English: Boh Tea (Tea Bags) — 100 beg
- `1647` TEH LIPTON (SERBUK) — English: Tea LIPTON (Powder) — 400 g
- `1650` TEH LIPTON (UNCANG) — English: Tea LIPTON (UNCANG) — 100 beg
- `1851` TENOM COFFEE WANG EMAS (SERBUK) — English: TENOM COFFEE WANG EMAS (Powder) — 180 g


## BAWANG — Onions

11 catalogue records; 1 candidate groups; 9 ungrouped records.

### Group 1: BAWANG KECIL MERAH IMPORT INDIA (minimum pair similarity 0.71)

- `1442` BAWANG KECIL MERAH BIASA IMPORT (INDIA) — English: Shallots Regular Imported (INDIA) — 1kg
- `131` BAWANG KECIL MERAH ROSE IMPORT (INDIA) — English: Shallots ROSE Imported (INDIA) — 1kg

### Ungrouped / distinct names

- `1441` BAWANG BESAR IMPORT (CHINA) — English: Onions Imported (CHINA) — 1kg
- `1440` BAWANG BESAR IMPORT (INDIA) — English: Onions Imported (INDIA) — 1kg
- `1931` BAWANG BESAR IMPORT (PAKISTAN) — English: Onions Imported (PAKISTAN) — 1kg
- `129` BAWANG BESAR KUNING/HOLLAND — English: Onions Yellow/HOLLAND — 1kg
- `1443` BAWANG KECIL MERAH IMPORT (CHINA) — English: Shallots Imported (CHINA) — 1kg
- `1933` BAWANG KECIL MERAH IMPORT (HOLLAND) — English: Shallots Imported (HOLLAND) — 1kg
- `1444` BAWANG KECIL MERAH IMPORT (MYANMAR) — English: Shallots Imported (MYANMAR) — 1kg
- `132` BAWANG KECIL MERAH IMPORT (THAILAND) — English: Shallots Imported (THAILAND) — 1kg
- `1564` BAWANG PUTIH IMPORT (CHINA) — English: Garlic Imported (CHINA) — 1kg


## BERAS — Rice

22 catalogue records; 4 candidate groups; 9 ungrouped records.

### Group 1: BERAS SUPER IMPORT (minimum pair similarity 0.75)

- `1832` BERAS CAP BAO-BAO GOLDEN SARAWAK (SUPER IMPORT) — English: Rice Brand GOLDEN SARAWAK (SST5%) — 10 kg
- `1951` BERAS PREMIUM CAP 3A BOY (SUPER IMPORT) — English: Super Rice Brand 3A BOY (Imported) — 10 kg
- `1833` BERAS PREMIUM CAP UNCLE TAN (SUPER IMPORT) — English: Rice PREMIUM Brand UNCLE TAN — 10 kg
- `2004` BERAS SUPER IMPORT CAP FAMILY — English: Super Rice SPECIAL Brand FAMILI 5% — 10 kg

### Group 2: BERAS SST5 (minimum pair similarity 1.00)

- `1445` BERAS CAP FAIZA EMAS (SST5%) — English: Rice Brand FAIZA EMAS (SST5%) — 10 kg
- `1582` BERAS CAP JASMINE (SST5%) — English: Jasmine Brand Rice (SST5%) — 10 kg
- `992` BERAS CAP JATI (SST5%) — English: Rice Brand JATI (SST5%) — 10 kg
- `1581` BERAS CAP RAMBUTAN (SST5%) — English: Rice Brand RAMBUTAN (SST5%) — 10 kg

### Group 3: BERAS SAZARICE SUPER BERAS PUTIH IMPORT (minimum pair similarity 0.83)

- `1902` BERAS SAZARICE SUPER WR (BERAS PUTIH IMPORT) — English: Super Rice WR (5%) — 10 kg
- `1825` BERAS SUPER SAZARICE CAP ANGGUR (BERAS PUTIH IMPORT ) — English: Super Rice Brand ANGGUR SAZARICE 5% (Imported THAILAND) — 10 kg
- `1826` BERAS SUPER SAZARICE CAP RODA (BERAS PUTIH IMPORT) — English: Super Rice Brand RODA SAZARICE 5% (Imported THAILAND) — 10 kg

### Group 4: BERAS SUPER 5 IMPORT (minimum pair similarity 1.00)

- `1583` BERAS SUPER CAP JATI TWR  5% (IMPORT) — English: Super Rice Brand JATI TWR 5% (Imported) — 10 kg
- `904` BERAS SUPER CAP RAMBUTAN 5% (IMPORT) — English: Super Rice Brand RAMBUTAN 5% (Imported) — 10 kg

### Ungrouped / distinct names

- `1474` BERAS BASMATHI - FAIZA (KASHMIR) — English: Basmati Rice - FAIZA (KASHMIR) — 5 kg
- `2068` BERAS CAP JASMINE SUPER 5 SPECIAL (IMPORT) — 10 kg
- `1903` BERAS KELAS MAHIR SUPER IMPORT RICE (5%) — 10 kg
- `1492` BERAS PULUT THAILAND (BIASA) PELBAGAI JENAMA — English: Glutinous Rice THAILAND (Regular) Various Brands — 1kg
- `1491` BERAS PULUT THAILAND (SUSU) PELBAGAI JENAMA — English: Glutinous Rice THAILAND (Milk) Various Brands — 1kg
- `2066` BERAS PUTIH CAP FAIZA EMAS (IMPORT) — 10 kg
- `1822` BERAS PUTIH IMPORT SABAH RICE VAGAS TOKOU — English: Super Rice SPECIAL Local SABAH RICE VAGAS TOKOU — 10 kg
- `1823` BERAS TKC SABAH CAP TQR 5% — English: Rice TQR SABAH Brand TKC 5% — 10 kg
- `1824` BERAS TKC SUPER HUMA CAP KELISA EMAS (SABAH) — English: Super Rice HUMA Brand KELISA EMAS (SABAH) — 10 kg


## BERUS GIGI — Toothbrushes

1 catalogue records; 0 candidate groups; 1 ungrouped records.

### Ungrouped / distinct names

- `1658` COLGATE TOOTHBRUSH EXTRA CLEAN MEDIUM — 1 batang


## BIHUN — Rice Vermicelli

6 catalogue records; 3 candidate groups; 0 ungrouped records.

### Group 1: BIHUN KERING (minimum pair similarity 1.00)

- `2037` BIHUN KERING (CAP LONGKOU) — 400 g
- `1835` BIHUN KERING (CAP SWALLOW KONG MOON) — 400 g

### Group 2: BIHUN KERING IMPORT (minimum pair similarity 1.00)

- `1585` BIHUN KERING IMPORT (PELBAGAI JENAMA) — English: Rice Vermicelli Dried Imported (Brand BINTANG) — 400 g
- `2003` BIHUN KERING IMPORT (PELBAGAI JENAMA) — English: Rice Vermicelli Dried Imported (Various Brands) — 400 g

### Group 3: BIHUN KERING TEMPATAN (minimum pair similarity 1.00)

- `1493` BIHUN KERING TEMPATAN (CAP JASMINE) — English: Rice Vermicelli Dried Local (Brand JASMINE) — 400 g
- `1584` BIHUN KERING TEMPATAN (PELBAGAI JENAMA) — 400 g


## BISKUT — Biscuits

6 catalogue records; 0 candidate groups; 6 ungrouped records.

### Ungrouped / distinct names

- `1696` CHIPSMORE MINI HAZELNUTS — 88g
- `1693` CHIPSMORE ORIGINAL — 163.2g
- `1692` CREAM O BISKUT SANDWICH JENAMA JACK N JILL (PELBAGAI PERISA) — English: CREAM O Biscuits SANDWICH Brand JACK N JILL (Assorted Flavours) — 132g
- `1893` MUNCHY'S MUZIC WAFER VANILLA CUBE — 90g
- `1691` OREO BISKUT SANDWICH COKLAT JENAMA KRAFT (PELBAGAI PERISA) — English: OREO Biscuits SANDWICH Chocolate Brand KRAFT (Assorted Flavours) — paket
- `1697` TIGER BISKUAT SUSU — English: TIGER Biscuits Milk — 75 g


## BUAH-BUAHAN — Fruits

18 catalogue records; 0 candidate groups; 18 ungrouped records.

### Ungrouped / distinct names

- `26` ANGGUR HIJAU BERBIJI — English: Green Grapes With Seeds — 1kg
- `27` ANGGUR MERAH BERBIJI — English: Red Grapes With Seeds — 1kg
- `16` BETIK BIASA — English: BETIK Regular — 1kg
- `22` DRAGON FRUIT MERAH — English: Red Dragon Fruit — 1kg
- `1485` EPAL HIJAU GRANNY SMITH (SAIZ M) — English: Green Apple GRANNY SMITH (Size M) — 1 biji
- `1486` EPAL MERAH RED DELICIOUS (SAIZ M) — English: Red Apple RED DELICIOUS (Size M) — 1 biji
- `38` JAMBU BATU BERBIJI — English: Guava With Seeds — 1kg
- `39` JAMBU BATU TANPA BIJI — English: Guava without Seeds — 1kg
- `31` LAI KUNING (SAIZ M) — English: Yellow Pear (Size M) — 1 biji
- `1928` LIMAU KASTURI — English: Calamansi — 1kg
- `1132` LIMAU NIPIS — English: Lime — 1kg
- `25` NENAS BIASA (JOSAPINE/MORRIS/SARAWAK) — English: Regular Pineapple (JOSAPINE/MORRIS/SARAWAK) — 1 biji
- `1487` OREN VALENCIA (SAIZ M) — English: OREN VALENCIA (Size M) — 1 biji
- `18` PISANG BERANGAN — English: Berangan Bananas — 1kg
- `19` PISANG EMAS — English: Emas Bananas — 1kg
- `20` TEMBIKAI MERAH BERBIJI — English: Red Watermelon With Seeds — 1kg
- `21` TEMBIKAI MERAH TANPA BIJI — English: Red Watermelon without Seeds — 1kg
- `24` TEMBIKAI SUSU — English: Milk Watermelon — 1kg


## CILI KERING — Dried Chillies

2 catalogue records; 0 candidate groups; 2 ungrouped records.

### Ungrouped / distinct names

- `1899` CILI KERING KERINTING (BERTANGKAI/TIDAK BERTANGKAI) — English: Dried Curly Chili (With Stem/Without Stem) — 1kg
- `1900` CILI KERING LEPER (BERTANGKAI/TIDAK BERTANGKAI) — English: Dried Flat Chili (With Stem/Without Stem) — 1kg


## COKLAT — Chocolate

6 catalogue records; 0 candidate groups; 6 ungrouped records.

### Ungrouped / distinct names

- `1699` CADBURY DAIRY MILK HAZELNUT — 40 g
- `1063` KINDER BUENO - MILK & HAZELNUT — 43 g
- `1700` KINDER JOY FOR BOYS/FOR GIRLS — 20 g
- `1808` MENTOS (PELBAGAI PERISA) — English: MENTOS (Assorted Flavours) — 37g
- `1704` NIPS CHOCOLATE COATED ROASTED PEANUT — 85g
- `1701` TOBLERONE (MILK CHOCOLATE) — 50 g


## DAGING — Meat

32 catalogue records; 6 candidate groups; 20 ungrouped records.

### Group 1: DAGING KAMBING BEBIRI IMPORT BERTULANG AUSTRALIA KOTAK (minimum pair similarity 0.78)

- `1907` DAGING KAMBING BEBIRI IMPORT BERTULANG (LAMB) (AUSTRALIA - KOTAK) (1KG) — English: Mutton Imported Bone-in (LAMB) (AUSTRALIA - Box) (1KG) — 1kg
- `9` DAGING KAMBING BEBIRI IMPORT BERTULANG (MUTTON) (AUSTRALIA - KOTAK) — English: Mutton Imported Bone-in (MUTTON) (AUSTRALIA - Box) — 1kg

### Group 2: DAGING KAMBING BEBIRI IMPORT BERTULANG NEW ZEALAND KOTAK (minimum pair similarity 0.80)

- `1908` DAGING KAMBING BEBIRI IMPORT BERTULANG (LAMB) (NEW ZEALAND - KOTAK) — English: Mutton Imported Bone-in (LAMB) (NEW ZEALAND - Box) — 1kg
- `10` DAGING KAMBING BEBIRI IMPORT BERTULANG (MUTTON) (NEW ZEALAND - KOTAK) — English: Mutton Imported Bone-in (MUTTON) (NEW ZEALAND - Box) — 1kg

### Group 3: DAGING KAMBING BEBIRI IMPORT TANPA TULANG TIDAK TERMASUK PAHA AUSTRALIA (minimum pair similarity 0.83)

- `1909` DAGING KAMBING BEBIRI IMPORT TANPA TULANG (LAMB) (TIDAK TERMASUK PAHA - AUSTRALIA) — English: Mutton Imported Boneless (LAMB) (Excluding Leg - AUSTRALIA) — 1kg
- `11` DAGING KAMBING BEBIRI IMPORT TANPA TULANG (MUTTON) (TIDAK TERMASUK PAHA - AUSTRALIA) — English: Mutton Imported Boneless (MUTTON) (Excluding Leg - AUSTRALIA) — 1kg

### Group 4: DAGING KAMBING BEBIRI IMPORT TANPA TULANG TIDAK TERMASUK PAHA NEW ZEALAND (minimum pair similarity 0.85)

- `1910` DAGING KAMBING BEBIRI IMPORT TANPA TULANG (LAMB) (TIDAK TERMASUK PAHA - NEW ZEALAND) — English: Mutton Imported Boneless (LAMB) (Excluding Leg - NEW ZEALAND) — 1kg
- `12` DAGING KAMBING BEBIRI IMPORT TANPA TULANG (MUTTON) (TIDAK TERMASUK PAHA - NEW ZEALAND) — English: Mutton Imported Boneless (MUTTON) (Excluding Leg - NEW ZEALAND) — 1kg

### Group 5: DAGING PAHA KAMBING BEBIRI IMPORT BERTULANG AUSTRALIA (minimum pair similarity 0.78)

- `1367` DAGING PAHA KAMBING BEBIRI IMPORT BERTULANG  (MUTTON) (AUSTRALIA) — English: Leg Meat Goat Mutton Imported Bone-in (MUTTON) (AUSTRALIA) — 1kg
- `1911` DAGING PAHA KAMBING BEBIRI IMPORT BERTULANG (LAMB) (AUSTRALIA) — English: Leg Meat Goat Mutton Imported Bone-in (LAMB) (AUSTRALIA) — 1kg

### Group 6: DAGING PAHA KAMBING BEBIRI IMPORT BERTULANG NEW ZEALAND (minimum pair similarity 0.80)

- `1912` DAGING PAHA KAMBING BEBIRI IMPORT BERTULANG (LAMB) (NEW ZEALAND) — English: Leg Meat Goat Mutton Imported Bone-in (LAMB) (NEW ZEALAND) — 1kg
- `1368` DAGING PAHA KAMBING BEBIRI IMPORT BERTULANG (MUTTON) (NEW ZEALAND) — English: Mutton Leg, Bone-in (MUTTON) (NEW ZEALAND) — 1kg

### Ungrouped / distinct names

- `1384` BABI HIDUP (±100KG / SEEKOR) — English: Live Pig (±100 kg each) — ±100kg/seekor
- `1380` DAGING BABI (DAGING & LEMAK / LEAN & FAT) — English: Pork (Meat & LEMAK / LEAN & FAT) — 1kg
- `1381` DAGING BABI (ISI DAGING / PURE LEAN) — English: Pork (ISI Meat / PURE LEAN) — 1kg
- `1379` DAGING BABI (PERUT / BELLY) — English: Pork (PERUT / BELLY) — 1kg
- `1383` DAGING BABI (RUSUK DENGAN DAGING/ RIBS WITH MEAT) — English: Pork (Ribs with Meat/ RIBS WITH MEAT) — 1kg
- `1369` DAGING KAMBING TEMPATAN BERTULANG — English: Goat Meat Local Bone-in — 1kg
- `1914` DAGING KERBAU IMPORT (INDIA) (BLOCK) — English: Buffalo Meat Imported (INDIA) (BLOCK) — 1kg
- `1377` DAGING KERBAU IMPORT (INDIA) * (BLADE) — English: Buffalo Meat Imported (INDIA) * (BLADE) — 1kg
- `1378` DAGING KERBAU IMPORT (INDIA) * (CHUCK) — English: Buffalo Meat Imported (INDIA) * (CHUCK) — 1kg
- `1376` DAGING KERBAU IMPORT (INDIA) * (RUMP) — English: Buffalo Meat Imported (INDIA) * (RUMP) — 1kg
- `1375` DAGING KERBAU IMPORT (INDIA) * (SILVERSIDE) — English: Buffalo Meat Imported (INDIA) * (SILVERSIDE) — 1kg
- `14` DAGING KERBAU IMPORT (INDIA) * (TOP SIDE) — English: Buffalo Meat Imported (INDIA) * (TOP SIDE) — 1kg
- `1374` DAGING KERBAU TEMPATAN — English: Buffalo Meat Local — 1kg
- `1371` DAGING LEMBU IMPORT (BLADE) — English: Beef Imported (BLADE) — 1kg
- `1913` DAGING LEMBU IMPORT (BLOCK) — English: Beef Imported (BLOCK) — 1kg
- `1372` DAGING LEMBU IMPORT (CHUCKTENDER) — English: Beef Imported (CHUCKTENDER) — 1kg
- `1373` DAGING LEMBU IMPORT (KNUCKLE) — English: Beef Imported (KNUCKLE) — 1kg
- `1370` DAGING LEMBU IMPORT (TOPSIDE) — English: Beef Imported (TOPSIDE) — 1kg
- `1431` DAGING LEMBU TEMPATAN (BAHAGIAN 1 DAGING PAHA (KECUALI BATANG PINANG - TENDERLOIN) — English: Local Beef (Section 1 Leg Meat (excluding Tenderloin - TENDERLOIN) — 1kg
- `1432` DAGING LEMBU TEMPATAN (BAHAGIAN 2 DAGING PEJAL (KECUALI BATANG PINANG - TENDERLOIN) — English: Local Beef (Section 2 Lean Meat (excluding Tenderloin - TENDERLOIN) — 1kg


## ESEN DAN RAGI — Essences & Yeast

6 catalogue records; 1 candidate groups; 4 ungrouped records.

### Group 1: SERBUK PENAIK ROYAL TIN (minimum pair similarity 1.00)

- `1947` SERBUK PENAIK ROYAL (TIN) — English: Baking Powder ROYAL (Tin) — 113g
- `1080` SERBUK PENAIK ROYAL (TIN) — English: Baking Powder ROYAL (Tin) — 226g

### Ungrouped / distinct names

- `1950` BUNGA RAYA YIS SEGERA — English: BUNGA RAYA Instant Yeast — 11g
- `1613` ESEN STAR BRAND 'PELBAGAI PERISA' — English: ESEN STAR BRAND 'Assorted Flavours' — 25 ml
- `1616` MAURIPAN YIS SEGERA — English: MAURIPAN Instant Yeast — 11g
- `1948` RAGI BULAT/RAGI TAPAI — 1 biji


## GULA — Sugar

4 catalogue records; 0 candidate groups; 4 ungrouped records.

### Ungrouped / distinct names

- `1587` GULA HALUS CASTOR (PELBAGAI JENAMA) — English: Fine Sugar CASTOR (Various Brands) — +- 500g
- `1588` GULA MERAH LEMBUT (PELBAGAI JENAMA) — English: Brown Sugar LEMBUT (Various Brands) — +- 500g
- `1590` GULA PUTIH BERTAPIS HALUS (PELBAGAI JENAMA) — English: White Fine-Granulated Sugar (Various Brands) — 1kg
- `1589` GULA PUTIH BERTAPIS KASAR (PELBAGAI JENAMA) — English: White Coarse-Granulated Sugar (Various Brands) — 1kg


## HASIL LAUT KERING — Dried Seafood

3 catalogue records; 0 candidate groups; 3 ungrouped records.

### Ungrouped / distinct names

- `148` IKAN BILIS GRED B (KOPEK) — English: Anchovies Grade B (KOPEK) — 1kg
- `1563` SOTONG KERING (SAIZ SERDAHANA) — English: Dried Squid (Size SERDAHANA) — 1kg
- `1562` UDANG KERING — English: Dried Prawns — 100 g


## IKAN DALAM TIN — Canned Fish

11 catalogue records; 2 candidate groups; 3 ungrouped records.

### Group 1: MACKAREL SOS TOMATO (minimum pair similarity 1.00)

- `1082` MACKAREL CAP AYAM (SOS TOMATO) — English: Ayam Brand Mackerel (Tomato Sauce) — 155 g
- `195` MACKAREL CAP AYAM (SOS TOMATO) — English: Ayam Brand Mackerel (Tomato Sauce) — 425 g
- `1081` MACKAREL CAP KING CUP (SOS TOMATO) — English: King Cup Mackerel (Tomato Sauce) — 155 g
- `197` MACKAREL CAP KING CUP (SOS TOMATO) — English: King Cup Mackerel (Tomato Sauce) — 425 g

### Group 2: SARDIN SOS TOMATO (minimum pair similarity 1.00)

- `190` SARDIN CAP AYAM (SOS TOMATO) — English: Ayam Brand Sardines (Tomato Sauce) — 155 g
- `191` SARDIN CAP AYAM (SOS TOMATO) — English: Ayam Brand Sardines (Tomato Sauce) — 425 g
- `192` SARDIN CAP KING CUP (SOS TOMATO) — English: King Cup Sardines (Tomato Sauce) — 155 g
- `193` SARDIN CAP KING CUP (SOS TOMATO) — English: King Cup Sardines (Tomato Sauce) — 425 g

### Ungrouped / distinct names

- `1142` SARDIN CAP ADABI (SOS TOMATO DENGAN CILI) — English: Adabi Sardines (Tomato Sauce with Chili) — 425 g
- `1882` TUNA CAP AYAM (TUNA MAYONNAISE) — English: Ayam Brand Tuna (Tuna Mayonnaise) — 160 g
- `199` TUNA CAP TC BOY (SANDWICH DELITE) — English: TC Boy Tuna (Sandwich Delite) — 150 g


## IKAN DARAT — Freshwater Fish

4 catalogue records; 1 candidate groups; 0 ungrouped records.

### Group 1: IKAN ANTARA 2 HINGGA 5 EKOR SEKILOGRAM (minimum pair similarity 0.70)

- `87` IKAN HARUAN (ANTARA 2 HINGGA 5 EKOR SEKILOGRAM) — English: Snakehead Fish (between 2 to 5 fish per kilogram) — 1kg
- `88` IKAN KELI (ANTARA 2 HINGGA 5 EKOR SEKILOGRAM) — English: Catfish (between 2 to 5 fish per kilogram) — 1kg
- `89` IKAN TILAPIA HITAM (ANTARA 2 HINGGA 5 EKOR SEKILOGRAM) — English: Tilapia HITAM (between 2 to 5 fish per kilogram) — 1kg
- `1921` IKAN TILAPIA MERAH (ANTARA 2 HINGGA 5 EKOR SEKILOGRAM) — English: Tilapia Red (between 2 to 5 fish per kilogram) — 1kg


## KACANG — Nuts & Legumes

7 catalogue records; 0 candidate groups; 7 ungrouped records.

### Ungrouped / distinct names

- `1422` KACANG DAL (AUSTRALIA) — English: Lentils (AUSTRALIA) — 1kg
- `1419` KACANG DAL BIASA (INDIA) — English: Lentils Regular (INDIA) — 1kg
- `1420` KACANG DAL MALAVI (INDIA) — English: Lentils MALAVI (INDIA) — 1kg
- `152` KACANG HIJAU (IMPORT) — English: Mung Beans (Imported) — 1kg
- `1943` KACANG MERAH (IMPORT) — English: Red Beans (Imported) — 1kg
- `1944` KACANG SOYA (IMPORT) — English: Soybeans (Imported) — 1kg
- `368` KACANG TANAH (IMPORT) — English: Peanuts (Imported) — 1kg


## KELAPA — Coconut

4 catalogue records; 0 candidate groups; 4 ungrouped records.

### Ungrouped / distinct names

- `101` KELAPA BIJI — English: Whole Coconut — 1 biji
- `102` KELAPA PARUT (BIASA) — English: Grated Coconut — 1kg
- `103` SANTAN KELAPA SEGAR (BIASA) — English: Fresh Coconut Milk (Regular) — 1kg
- `1929` SANTAN KELAPA SEGAR (PEKAT) — English: Fresh Coconut Milk (Concentrated) — 1kg


## KICAP DAN SOS — Soy Sauce & Sauces

20 catalogue records; 4 candidate groups; 12 ungrouped records.

### Group 1: KICAP LEMAK MANIS (minimum pair similarity 1.00)

- `215` KICAP LEMAK MANIS CAP JALEN — English: Sweet Thick Soy Sauce Brand JALEN — 650 ml
- `214` KICAP LEMAK MANIS CAP KIPAS UDANG — English: Sweet Thick Soy Sauce Brand KIPAS Prawns — 345ml

### Group 2: KICAP TAMIN DARK SOY SAUCE (minimum pair similarity 1.00)

- `212` KICAP TAMIN (DARK SOY SAUCE) — English: Soy Sauce TAMIN (DARK SOY SAUCE) — 330 ml
- `2012` KICAP TAMIN (DARK SOY SAUCE) — English: Soy Sauce TAMIN (DARK SOY SAUCE) — 350ml

### Group 3: SOS CILI LIFE (minimum pair similarity 0.75)

- `218` SOS CILI LIFE — English: Life Chili Sauce — 340 g
- `1137` SOS CILI THAI LIFE — English: Life Thai Chili Sauce — 360g

### Group 4: SOS CILI MAGGI (minimum pair similarity 1.00)

- `1070` SOS CILI MAGGI — English: Maggi Chili Sauce — 340 g
- `1097` SOS CILI MAGGI — English: Maggi Chili Sauce — 500 g

### Ungrouped / distinct names

- `1115` KICAP LEMAK MASIN CAP KIPAS UDANG — English: Salty Thick Soy Sauce Brand KIPAS Prawns — 345ml
- `1135` KICAP MANIS ADABI — English: Sweet Soy Sauce ADABI — 340ml
- `1136` KICAP MASIN ADABI — English: Salty Soy Sauce ADABI — 340ml
- `1828` KICAP SOYA PEKAT MANIS CAP AYAM — English: Ayam Brand Thick Sweet Soy Sauce — 330 ml
- `1837` KICAP TONG NAM (DARK SOY SAUCE) — English: Soy Sauce TONG NAM (DARK SOY SAUCE) — 330 ml
- `957` SOS CILI KIMBALL — English: Kimball Chili Sauce — 340 g
- `1117` SOS TIRAM ADABI — English: Oyster Sauce ADABI — 510 g
- `1114` SOS TIRAM KIMBALL — English: Oyster Sauce KIMBALL — 510 g
- `1138` SOS TIRAM MAGGI — English: Oyster Sauce MAGGI — 340 g
- `1116` SOS TIRAM NONA — English: Oyster Sauce NONA — 510 g
- `1139` SOS TOMATO LIFE — English: Life Tomato Sauce — 330 g
- `217` SOS TOMATO MAGGI — English: Maggi Tomato Sauce — 325 g


## KRIMER DAN SUSU TEPUNG — Creamer & Milk Powder

24 catalogue records; 3 candidate groups; 16 ungrouped records.

### Group 1: KRIMER MANIS (minimum pair similarity 1.00)

- `884` KRIMER MANIS CAP GOLD COIN — English: Sweetened Creamer Brand GOLD COIN — 500 g
- `388` KRIMER MANIS CAP JUNJUNG — English: Sweetened Creamer Brand JUNJUNG — 500 g
- `1873` KRIMER MANIS CAP TEAPOT — English: Sweetened Creamer Brand TEAPOT — 500 g

### Group 2: SUSU TEPUNG SEGERA EVERYDAY (minimum pair similarity 1.00)

- `2025` SUSU TEPUNG SEGERA EVERYDAY — 500 g
- `344` SUSU TEPUNG SEGERA EVERYDAY — English: Milk Powder Instant EVERYDAY — 550 g
- `1954` SUSU TEPUNG SEGERA EVERYDAY — English: Milk Powder Instant EVERYDAY — 900 g

### Group 3: SUSU TEPUNG ISIAN KURANG LEMAK OMEGA PLUS (minimum pair similarity 1.00)

- `327` SUSU TEPUNG ISIAN KURANG LEMAK 'OMEGA PLUS' — English: Low-Fat Milk Powder (Omega Plus) — 1kg
- `345` SUSU TEPUNG ISIAN KURANG LEMAK 'OMEGA PLUS' — English: Low-Fat Milk Powder (Omega Plus) — 600 g

### Ungrouped / distinct names

- `843` ANMUM LACTA (BIASA) — English: ANMUM LACTA (Regular) — 650g
- `336` ANMUM MATERNA (BIASA/COKLAT) — English: ANMUM MATERNA (Regular/Chocolate) — 650g
- `883` KRIMER MANIS BERVITAMIN CAP F&N — English: Sweetened Creamer BERVITAMIN Brand F&N — 500 g
- `1953` KRIMER MANIS PEKAT CAP SAJI — English: Sweetened Creamer Concentrated Brand SAJI — 500 g
- `1871` KRIMER SEJAT CAIR SAJI — English: Evaporated Creamer CAIR SAJI — 390g
- `1952` KRIMER SEJAT CAP F&N — English: Evaporated Creamer Brand F&N — 390g
- `1463` KRIMER SEJAT CARNATION — English: Evaporated Creamer CARNATION — 390g
- `1105` SUSU ANLENE ACTIFIT 3X COKLAT — English: Milk ANLENE ACTIFIT 3X Chocolate — 600 g
- `334` SUSU ANLENE ACTIFIT 3X PERISA ASLI — English: Milk ANLENE ACTIFIT 3X Flavour Original — 600 g
- `335` SUSU ANLENE GOLD 5X — English: Milk ANLENE GOLD 5X — 600 g
- `1618` SUSU ISIAN PEKAT MANIS CAP F & N — English: F&N Sweetened Condensed Milk — 500 g
- `320` SUSU SEJAT PENUH KRIM CAP IDEAL — English: Evaporated Milk Full Cream Brand IDEAL — 390g
- `919` SUSU TEPUNG PENUH KRIM DUTCHLADY — English: Milk Powder Full Cream DUTCHLADY — 600 g
- `2008` SUSU TEPUNG PENUH KRIM SEGERA NESPRAY — English: Milk Powder Full Cream Instant NESPRAY — 480 g
- `1619` SUSU TEPUNG SEGERA DUTCHLADY (BIASA) — English: Milk Powder Instant DUTCHLADY (Regular ) — 600 g
- `332` SUSU TEPUNG SEGERA FERNLEAF (INSTANT) — English: Milk Powder Instant FERNLEAF (INSTANT) — 550 g


## LAIN-LAIN — Other

27 catalogue records; 0 candidate groups; 27 ungrouped records.

### Ungrouped / distinct names

- `1296` CAPATI — sekeping
- `1784` KUIH KARIPAP (KENTANG) — sebiji
- `1252` KUIH LAPIS — sebiji
- `1253` KUIH SERI MUKA — sebiji
- `1247` MAGGI GORENG — English: MAGGI Fried — sepinggan
- `1248` MAGGI SUP — English: MAGGI Soup — semangkuk
- `1299` MURTABAK AYAM — English: Chicken Murtabak — sekeping
- `1300` MURTABAK DAGING — English: Meat Murtabak — sekeping
- `1301` MURTABAK KAMBING — English: Mutton Murtabak — sekeping
- `1255` PAU AYAM — English: Steamed Bun Chicken — sebiji
- `1279` PAU DAGING — English: Steamed Bun Meat — sebiji
- `1254` PAU KACANG MERAH — English: Steamed Bun Red Beans — sebiji
- `1256` PAU KAYA — English: Steamed Bun KAYA — sebiji
- `1294` RAWA TOSAI — sekeping
- `1787` ROJAK BIASA — English: ROJAK Regular — sepinggan
- `1788` ROJAK MI — English: ROJAK Noodles — sepinggan
- `1298` ROTI BAKAR — English: Toast — 1 set
- `1292` ROTI BAWANG — English: Onion Bread — sekeping
- `1293` ROTI BOOM — sekeping
- `1783` ROTI CANAI BIASA — English: Plain Roti Canai — sekeping
- `1782` ROTI NAAN — English: Naan Bread — sekeping
- `1291` ROTI PISANG — English: Banana Bread — sekeping
- `1358` ROTI SARDIN — English: Sardine Bread — sekeping
- `1250` ROTI TELUR — English: Egg Bread — sekeping
- `1295` ROTI TISU — sekeping
- `1785` VADAI MASALA — sebiji
- `1786` VADAI ULUNDHU — sebiji


## LAMPIN PAKAI BUANG — Disposable Diapers

17 catalogue records; 5 candidate groups; 6 ungrouped records.

### Group 1: DRYPERS WEE WEE DRY (minimum pair similarity 0.75)

- `1522` DRYPERS WEE WEE DRY — M74
- `2098` DRYPERS WEE WEE DRY — S80, M60, L58, XL50
- `1968` DRYPERS WEE WEE DRY (M74) — M74

### Group 2: DRYPERS DRYPANTZ (minimum pair similarity 1.00)

- `2100` DRYPERS DRYPANTZ — M58, L48, XL42
- `1974` DRYPERS DRYPANTZ — M60

### Group 3: HUGGIES DRY PANTS (minimum pair similarity 1.00)

- `1975` HUGGIES DRY PANTS — M60
- `2101` HUGGIES DRY PANTS — S66, M50, L40, XL32

### Group 4: PETPET GOLD (minimum pair similarity 1.00)

- `2032` PETPET GOLD+ — M64, L54, XL42
- `1967` PETPET GOLD+ — M70

### Group 5: PETPET PANTS GOLD (minimum pair similarity 1.00)

- `2042` PETPET PANTS GOLD+ — M56, L46, XL38
- `2015` PETPET PANTS GOLD+ — M60

### Ungrouped / distinct names

- `1970` DIAPEX EASY — M70
- `1971` FITTI — M60
- `1969` HUGGIES DRY DIAPERS (M72) — M72
- `2099` HUGGIES DRY TAPE — S80, M60, L54, XL42
- `1972` MAMYPOKO EXTRA DRY — M54
- `1973` PETPET DAY NIGHT PANTS — M54


## LAUK — Prepared Dishes

72 catalogue records; 6 candidate groups; 57 ungrouped records.

### Group 1: IKAN TIGA RASA SAIZ SEDERHANA (minimum pair similarity 0.71)

- `1774` IKAN KEMBUNG TIGA RASA (SAIZ SEDERHANA) — English: Indian Mackerel Three Flavours (Size Medium) — 1 ekor
- `1763` IKAN KERAPU TIGA RASA (SAIZ SEDERHANA) — English: Grouper Three Flavours (Size Medium) — 1 ekor
- `1759` IKAN SIAKAP TIGA RASA (SAIZ SEDERHANA) — English: Sea Bass Three Flavours (Size Medium) — 1 ekor

### Group 2: IKAN KUKUS STIM SAIZ SEDERHANA (minimum pair similarity 0.71)

- `1764` IKAN KERAPU KUKUS/STIM (SAIZ SEDERHANA) — English: Grouper Steamed/Steamed (Size Medium) — 1 ekor
- `1760` IKAN SIAKAP KUKUS/STIM (SAIZ SEDERHANA) — English: Sea Bass Steamed/Steamed (Size Medium) — 1 ekor
- `1779` IKAN TILAPIA KUKUS/STIM (SAIZ SEDERHANA) — English: Tilapia Steamed/Steamed (Size Medium) — 1 ekor

### Group 3: IKAN MASAM MANIS SAIZ SEDERHANA (minimum pair similarity 0.71)

- `1762` IKAN KERAPU MASAM MANIS (SAIZ SEDERHANA) — English: Grouper Sweet and Sour (Size Medium) — 1 ekor
- `1758` IKAN SIAKAP MASAM MANIS (SAIZ SEDERHANA) — English: Sea Bass Sweet and Sour (Size Medium) — 1 ekor
- `1778` IKAN TILAPIA MASAM MANIS (SAIZ SEDERHANA) — English: Tilapia Sweet and Sour (Size Medium) — 1 ekor

### Group 4: IKAN BAWAL GORENG SAIZ SEDERHANA (minimum pair similarity 0.71)

- `1765` IKAN BAWAL HITAM GORENG (SAIZ SEDERHANA) — English: Black Pomfret Fried (Size Medium) — 1 ekor
- `1769` IKAN BAWAL PUTIH GORENG (SAIZ SEDERHANA) — English: White Pomfret Fried (Size Medium) — 1 ekor

### Group 5: IKAN BAWAL KUKUS STIM SAIZ SEDERHANA (minimum pair similarity 0.75)

- `1768` IKAN BAWAL HITAM KUKUS/STIM (SAIZ SEDERHANA) — English: Black Pomfret Steamed/Steamed (Size Medium) — 1 ekor
- `1771` IKAN BAWAL PUTIH KUKUS/STIM (SAIZ SEDERHANA) — English: White Pomfret Steamed/Steamed (Size Medium) — 1 ekor

### Group 6: IKAN BAWAL MASAM MANIS SAIZ SEDERHANA (minimum pair similarity 0.75)

- `1766` IKAN BAWAL HITAM MASAM MANIS (SAIZ SEDERHANA) — English: Black Pomfret Sweet and Sour (Size Medium) — 1 ekor
- `1770` IKAN BAWAL PUTIH MASAM MANIS (SAIZ SEDERHANA) — English: White Pomfret Sweet and Sour (Size Medium) — 1 ekor

### Ungrouped / distinct names

- `1198` AYAM GORENG — English: Chicken Fried — seketul
- `1201` AYAM MASAK HALIA — English: Chicken with Ginger — seketul
- `1285` AYAM MASAK KARI — English: Chicken Curry — seketul
- `1200` AYAM MASAK KICAP — English: Chicken in Soy Sauce — seketul
- `1199` AYAM MASAK MERAH — English: Chicken in Red Sauce — seketul
- `1264` AYAM SOS LEMON — English: Chicken with Lemon Sauce — sepiring
- `1297` Ayam Tandoori — English: Chicken Tandoori — seketul
- `1755` BABI (PORK) GORENG — English: Fried Pork (PORK) — sepiring
- `1756` BABI (PORK) MASAM MANIS — English: Pork (PORK) Sweet and Sour — sepiring
- `1752` DAGING KAMBING MASAK KARI — English: Goat Meat Curry — sepiring
- `1204` DAGING MASAK HALIA — English: Meat with Ginger — sepiring
- `1203` DAGING MASAK KICAP — English: Meat in Soy Sauce — sepiring
- `1202` DAGING MASAK MERAH — English: Meat in Red Sauce — sepiring
- `1205` DAGING MASAK PAPRIK — English: Meat with Paprik Sauce — sepiring
- `1767` IKAN BAWAL HITAM TIGA RASA (SAIZ SEDERHANA) — English: Black Pomfret Three Flavours (Size Medium) — 1 ekor
- `1772` IKAN KEMBUNG GORENG (SAIZ SEDERHANA) — English: Indian Mackerel Fried (Size Medium) — 1 ekor
- `1773` IKAN KEMBUNG MASAK KICAP (SAIZ SEDERHANA) — English: Indian Mackerel in Soy Sauce (Size Medium) — 1 ekor
- `1761` IKAN KERAPU GORENG (SAIZ SEDERHANA) — English: Grouper Fried (Size Medium) — 1 ekor
- `1757` IKAN SIAKAP GORENG (SAIZ SEDERHANA) — English: Sea Bass Fried (Size Medium) — 1 ekor
- `1775` IKAN TENGGIRI GORENG — English: Spanish Mackerel Fried — sekeping
- `1776` IKAN TENGGIRI MASAK KARI — English: Spanish Mackerel Curry — sekeping
- `1777` IKAN TILAPIA GORENG BIASA (SAIZ SEDERHANA) — English: Tilapia Fried Regular (Size Medium) — 1 ekor
- `1753` PAK CHOY SOS TIRAM — English: PAK CHOY Oyster Sauce — sepiring
- `1214` SAYUR CAMPUR — English: Vegetables CAMPUR — sepiring
- `1215` SAYUR KAILAN IKAN MASIN — English: Vegetables KAILAN Fish Salty — sepiring
- `1216` SAYUR KANGKUNG GORENG BELACAN — English: Vegetables Water Spinach Fried BELACAN — sepiring
- `1754` SAYUR TAUGEH — English: Vegetables Bean Sprouts — sepiring
- `1206` SOTONG GORENG — English: Squid Fried — sepiring
- `1265` SOTONG GORENG ASAM — English: Squid Fried ASAM — sepiring
- `1209` SOTONG MASAK HALIA — English: Squid with Ginger — sepiring
- `1208` SOTONG MASAK KICAP — English: Squid in Soy Sauce — sepiring
- `1207` SOTONG MASAK MERAH — English: Squid in Red Sauce — sepiring
- `1238` SUP AYAM — English: Chicken Soup — semangkuk
- `1241` SUP CAMPUR — English: Mixed Soup — semangkuk
- `1239` SUP DAGING — English: Meat Soup — semangkuk
- `1240` SUP EKOR — English: Oxtail Soup — semangkuk
- `1277` SUP IKAN — English: Fish Soup — semangkuk
- `1290` SUP KAMBING — English: Mutton Soup — semangkuk
- `1780` SUP PERUT — English: Tripe Soup — semangkuk
- `1278` SUP SAYUR MASIN — English: Soup Vegetables Salty — semangkuk
- `1289` SUP TULANG — English: Bone Soup — semangkuk
- `1234` TELUR BISTIK — English: Eggs BISTIK — 1 set
- `1233` TELUR DADAR — English: Omelette — sebiji
- `1237` TELUR MASIN — English: Salted Eggs — sebiji
- `1232` TELUR MATA KERBAU — English: Sunny-Side-Up Egg — sebiji
- `1236` TELUR REBUS — English: Boiled Eggs — sebiji
- `1235` TELUR SETENGAH MASAK — English: Half-Boiled Eggs — sebiji
- `1243` TOM YAM AYAM — English: Chicken Tom Yam — semangkuk
- `1242` TOM YAM CAMPUR — English: Mixed Tom Yam — semangkuk
- `1244` TOM YAM DAGING — English: Meat Tom Yam — semangkuk
- `1246` TOM YAM SOTONG — English: Squid Tom Yam — semangkuk
- `1245` TOM YAM UDANG — English: Prawn Tom Yam — semangkuk
- `1266` UDANG BUTTER — English: Butter Prawns — sepiring
- `1210` UDANG GORENG — English: Prawns Fried — sepiring
- `1213` UDANG MASAK HALIA — English: Prawns with Ginger — sepiring
- `1212` UDANG MASAK KICAP — English: Prawns in Soy Sauce — sepiring
- `1211` UDANG MASAK MERAH — English: Prawns in Red Sauce — sepiring


## MAJALAH — Magazines

2 catalogue records; 0 candidate groups; 2 ungrouped records.

### Ungrouped / distinct names

- `1654` MAJALAH CLEO — English: Magazine CLEO — senaskah
- `1657` MAJALAH MINGGUAN WANITA — English: Magazine MINGGUAN WANITA — senaskah


## MAKANAN BAYI — Baby Food

6 catalogue records; 0 candidate groups; 6 ungrouped records.

### Ungrouped / distinct names

- `1517` HEINZ APPLE PUREE — 110 g
- `1515` HEINZ FARLEY RUSKS (PELBAGAI PERISA) — English: HEINZ FARLEY RUSKS (ORIGINAL) — 120 g
- `1966` MILNA BISKUT RUSK (PELBAGAI PERISA) — English: MILNA Biscuits RUSK (Original) — 130g
- `1145` NESTLE CERELAC BERAS - TIN — English: NESTLE CERELAC Rice - Tin — 500 g
- `1629` NESTLE CERELAC BERAS MERAH & SUSU - TIN — English: NESTLE CERELAC Rice Red & Milk - Tin — 350 g
- `1628` NESTLE CERELAC GANDUM DAN MADU - KOTAK — English: Nestle Cerelac Wheat and Honey - Box — 225g


## MAKANAN RINGAN — Snacks

4 catalogue records; 1 candidate groups; 2 ungrouped records.

### Group 1: POTATO CRISPS PELBAGAI PERISA BOTOL (minimum pair similarity 0.71)

- `1683` MISTER POTATO CRISPS (PELBAGAI PERISA) - BOTOL — English: MISTER POTATO CRISPS (Assorted Flavours) - Bottle — 160 g
- `1684` PRINGLES POTATO CRISPS (PELBAGAI PERISA) - BOTOL — English: PRINGLES POTATO CRISPS (Assorted Flavours) - Bottle — 110 g

### Ungrouped / distinct names

- `1685` MISTER POTATO CHIPS (PELBAGAI PERISA) - PAKET — English: MISTER POTATO CHIPS (Assorted Flavours) - Packet — 75 g
- `1891` SUPER RING SNACKS CHEESE — 60 g


## MAKANAN SEGERA — Instant Food

2 catalogue records; 0 candidate groups; 2 ungrouped records.

### Ungrouped / distinct names

- `1710` MAGGI HOT CUP (CURRY) — 64g
- `1050` MAGGI MEE CURRY — English: MAGGI Noodles CURRY — 79 g


## MEE / BIHUN / KUEY TEOW — Noodles, Rice Vermicelli & Kuey Teow

28 catalogue records; 0 candidate groups; 28 ungrouped records.

### Ungrouped / distinct names

- `1187` BIHUN BANDUNG — English: Rice Vermicelli BANDUNG — semangkuk
- `1183` BIHUN GORENG — English: Fried Rice Vermicelli — sepinggan
- `1184` BIHUN HAILAM — English: Rice Vermicelli HAILAM — sepinggan
- `1189` BIHUN KUNGFU — English: Rice Vermicelli KUNGFU — sepinggan
- `1188` BIHUN LADNA — English: Rice Vermicelli LADNA — sepinggan
- `1738` BIHUN SUP (AYAM/DAGING) — English: Rice Vermicelli Soup (Chicken/Meat) — semangkuk
- `1186` BIHUN TOMYAM — English: Rice Vermicelli TOMYAM — semangkuk
- `1746` CHAR KUETIAU — English: CHAR Flat Rice Noodles — sepinggan
- `1748` KON LOH MI (KICAP) — English: KON LOH Noodles (Soy Sauce) — sepinggan
- `1743` KUETIAU BANDUNG — English: Flat Rice Noodles BANDUNG — semangkuk
- `1739` KUETIAU GORENG BIASA — English: Flat Rice Noodles Fried Regular — sepinggan
- `1740` KUETIAU HAILAM — English: Flat Rice Noodles HAILAM — sepinggan
- `1745` KUETIAU KUNGFU — English: Flat Rice Noodles KUNGFU — sepinggan
- `1744` KUETIAU LADNA — English: Flat Rice Noodles LADNA — sepinggan
- `1741` KUETIAU SUP (AYAM/DAGING) — English: Flat Rice Noodles Soup (Chicken/Meat) — semangkuk
- `1742` KUETIAU TOM YAM — English: Flat Rice Noodles TOM YAM — semangkuk
- `1735` MI BANDUNG — English: Noodles BANDUNG — sepinggan
- `1730` MI GORENG BIASA — English: Noodles Fried Regular — sepinggan
- `1731` MI GORENG MAMAK — English: Noodles Fried MAMAK — sepinggan
- `1732` MI HAILAM — English: Noodles HAILAM — sepinggan
- `1747` MI HOKKIEN — English: Noodles HOKKIEN — sepinggan
- `1751` MI KARI — English: Noodles Curry — semangkuk
- `1737` MI KUNGFU — English: Noodles KUNGFU — sepinggan
- `1736` MI LADNA — English: Noodles LADNA — sepinggan
- `1733` MI SUP (AYAM/DAGING) — English: Noodles Soup (Chicken/Meat) — semangkuk
- `1734` MI TOM YAM — English: Noodles TOM YAM — semangkuk
- `1750` MI UDANG — English: Noodles Prawns — semangkuk
- `1749` WAN TAN MI — English: WAN TAN Noodles — semangkuk


## MEE/KUETIAU — Noodles & Kuey Teow

2 catalogue records; 0 candidate groups; 2 ungrouped records.

### Ungrouped / distinct names

- `1484` KUETIAU BASAH (PELBAGAI JENAMA) — English: Flat Rice Noodles, Wet (Various Brands) — +-450g
- `1483` MEE KUNING BASAH (PELBAGAI JENAMA) — English: Yellow Noodles, Wet (Various Brands) — +-450g


## MENTEGA — Butter

2 catalogue records; 0 candidate groups; 2 ungrouped records.

### Ungrouped / distinct names

- `1615` MENTEGA ANCHOR (SALTED) — English: Butter ANCHOR (SALTED) — 227g
- `1609` MENTEGA SCS (SALTED) — English: Butter SCS (SALTED) — 250 g


## MI SEGERA — Instant Noodles

4 catalogue records; 0 candidate groups; 4 ungrouped records.

### Ungrouped / distinct names

- `1977` CINTAN MI SEGERA PERISA AYAM — English: CINTAN Noodles Instant Flavour Chicken — 5 X 75g
- `1905` MAGGI 2 MINUTE NOODLE CURRY FLAVOUR (5X79G) — 5 X 79g
- `1976` MAGGI MI SEGERA PERISA KARI — English: MAGGI Noodles Instant Flavour Curry — 5 X 79g
- `1978` MI SEDAP MI GORENG PERISA ASLI — English: Noodles SEDAP Noodles Fried Flavour Original — 5 X 90g


## MINUMAN — Beverages

47 catalogue records; 2 candidate groups; 43 ungrouped records.

### Group 1: TEH O AIS (minimum pair similarity 0.75)

- `1859` TEH "O" AIS — English: Tea "O" Iced — gelas besar
- `1860` TEH "O" LIMAU AIS — English: Iced 'O' Tea with Lime — gelas besar

### Group 2: TEH O PANAS (minimum pair similarity 0.75)

- `1311` TEH 'O' LIMAU PANAS — English: Hot 'O' Tea with Lime — gelas kecil
- `1360` TEH 'O' PANAS — English: Tea 'O' Hot — gelas kecil

### Ungrouped / distinct names

- `1322` AIR KOSONG — English: Plain Water — gelas besar
- `1307` AIR SUAM — English: Warm Water — gelas kecil
- `1320` BARLI PANAS — English: Barley Hot — gelas kecil
- `1894` CALPIS (PELBAGAI PERISA) — English: CALPIS (Assorted Flavours) — 350ml
- `1796` CARROT SUSU — English: CARROT Milk — segelas
- `1896` COCA COLA LIGHT — 320ml
- `1727` COOL RHINO COOLING WATER — 350ml
- `1864` HORLICKS AIS — English: HORLICKS Iced — gelas besar
- `1318` HORLICKS PANAS — English: HORLICKS Hot — gelas kecil
- `1343` JUS BELIMBING — English: Starfruit Juice — segelas
- `1339` JUS EPAL — English: Apple Juice — segelas
- `1344` JUS LAICI — English: Lychee Juice — segelas
- `1340` JUS MANGGA — English: Mango Juice — segelas
- `1795` JUS OREN — English: Orange Juice — segelas
- `1341` JUS TEMBIKAI — English: Watermelon Juice — segelas
- `1790` KOPI "O" AIS — English: Coffee "O" Iced — gelas besar
- `1359` KOPI 'O' PANAS — English: Coffee 'O' Hot — gelas kecil
- `1791` KOPI AIS — English: Iced Coffee — gelas besar
- `1309` Kopi Panas — English: Coffee Hot — gelas kecil
- `1794` LIMAU AIS — English: Iced Lime Drink — gelas besar
- `1814` LIMAU PANAS — English: Hot Lime Drink — gelas kecil
- `1718` LIVITA WITH HONEY (TIN) — 250 ml
- `1866` MILO "O" AIS — English: MILO "O" Iced — gelas besar
- `1321` MILO 'O' PANAS — English: MILO 'O' Hot — gelas kecil
- `1865` MILO AIS — English: MILO Iced — gelas besar
- `1319` MILO PANAS — English: Hot Milo — gelas kecil
- `1862` NESCAFE "O" AIS — English: NESCAFE "O" Iced — gelas besar
- `1469` NESCAFE ''O'' PANAS — English: NESCAFE ''O'' Hot — gelas kecil
- `1793` NESCAFE AIS — English: Iced Nescafe — gelas besar
- `1315` NESCAFE PANAS — English: Hot Nescafe — gelas kecil
- `1863` NESLO AIS — English: NESLO Iced — gelas besar
- `1317` NESLO PANAS — English: NESLO Hot — gelas kecil
- `1719` SEVEN UP LEMON & LIME — 500 ml
- `1867` SIRAP AIS — English: Iced Syrup Drink — gelas besar
- `1869` SIRAP BANDUNG AIS — English: Iced Bandung Syrup Drink — gelas besar
- `1868` SIRAP LIMAU AIS — English: Iced Lime Syrup Drink — gelas besar
- `1792` TEH AIS — English: Iced Tea — gelas besar
- `1861` TEH HALIA AIS — English: Tea Ginger Iced — gelas besar
- `1314` TEH HALIA PANAS — English: Hot Ginger Tea — gelas kecil
- `1312` Teh Panas — English: Tea Hot — gelas kecil
- `1789` TEH TARIK PANAS — English: Hot Teh Tarik — gelas kecil
- `1725` THREE LEGS COOLING WATER — 200 ml
- `1712` YAKULT (ACE/ACE LIGHT) — 80ml


## MINYAK DAN LEMAK — Oils & Fats

39 catalogue records; 4 candidate groups; 1 ungrouped records.

### Group 1: MINYAK MASAK TULEN (minimum pair similarity 1.00)

- `1940` MINYAK MASAK TULEN CAP ALIF — English: Pure Cooking Oil Brand ALIF — 1kg
- `1941` MINYAK MASAK TULEN CAP ALIF — English: Pure Cooking Oil Brand ALIF — 2 kg
- `1942` MINYAK MASAK TULEN CAP ALIF — English: Pure Cooking Oil Brand ALIF — 5 kg
- `1094` MINYAK MASAK TULEN CAP BURUH — English: Pure Cooking Oil Brand BURUH — 1kg
- `1601` MINYAK MASAK TULEN CAP BURUH — English: Pure Cooking Oil Brand BURUH — 2 kg
- `263` MINYAK MASAK TULEN CAP BURUH — English: Pure Cooking Oil Brand BURUH — 5 kg
- `1937` MINYAK MASAK TULEN CAP SAJI — English: Pure Cooking Oil Brand SAJI — 1kg
- `1938` MINYAK MASAK TULEN CAP SAJI — English: Pure Cooking Oil Brand SAJI — 2 kg
- `1939` MINYAK MASAK TULEN CAP SAJI — English: Pure Cooking Oil Brand SAJI — 5 kg
- `1100` MINYAK MASAK TULEN CAP SERI MURNI — English: Pure Cooking Oil Brand SERI MURNI — 1kg
- `1101` MINYAK MASAK TULEN CAP SERI MURNI — English: Pure Cooking Oil Brand SERI MURNI — 2 kg
- `266` MINYAK MASAK TULEN CAP SERI MURNI — English: Pure Cooking Oil Brand SERI MURNI — 5 kg
- `267` MINYAK MASAK TULEN CAP VESAWIT — English: Vesawit Brand Pure Cooking Oil — 1kg
- `1602` MINYAK MASAK TULEN CAP VESAWIT — English: Pure Cooking Oil Brand VESAWIT — 2 kg
- `1095` MINYAK MASAK TULEN CAP VESAWIT — English: Pure Cooking Oil Brand VESAWIT — 5 kg

### Group 2: MINYAK MASAK SEBATIAN (minimum pair similarity 1.00)

- `1934` MINYAK MASAK SEBATIAN CAP ADELA GOLD — English: Blended Cooking Oil Brand ADELA GOLD — 1kg
- `1935` MINYAK MASAK SEBATIAN CAP ADELA GOLD — English: Blended Cooking Oil Brand ADELA GOLD — 2 kg
- `1936` MINYAK MASAK SEBATIAN CAP ADELA GOLD — English: Blended Cooking Oil Brand ADELA GOLD — 5 kg
- `1093` MINYAK MASAK SEBATIAN CAP KNIFE — English: Blended Cooking Oil Brand PISAU — 1kg
- `1600` MINYAK MASAK SEBATIAN CAP KNIFE — English: Blended Cooking Oil Brand PISAU — 2 kg
- `260` MINYAK MASAK SEBATIAN CAP KNIFE — English: Blended Cooking Oil Brand PISAU — 5 kg
- `1092` MINYAK MASAK SEBATIAN CAP NEPTUNE — English: Blended Cooking Oil Brand NEPTUNE — 1kg
- `1599` MINYAK MASAK SEBATIAN CAP NEPTUNE — English: Blended Cooking Oil Brand NEPTUNE — 2 kg
- `257` MINYAK MASAK SEBATIAN CAP NEPTUNE — English: Blended Cooking Oil Brand NEPTUNE — 5 kg
- `1091` MINYAK MASAK SEBATIAN CAP RED EAGLE — English: Blended Cooking Oil Brand HELANG — 1kg
- `1598` MINYAK MASAK SEBATIAN CAP RED EAGLE — English: Blended Cooking Oil Brand HELANG — 2 kg
- `254` MINYAK MASAK SEBATIAN CAP RED EAGLE — English: Blended Cooking Oil Brand HELANG — 5 kg

### Group 3: MINYAK JAGUNG (minimum pair similarity 1.00)

- `1086` MINYAK JAGUNG CAP DAISY — English: Daisy Corn Oil — 1kg
- `1595` MINYAK JAGUNG CAP DAISY — English: Daisy Corn Oil — 2 kg
- `1087` MINYAK JAGUNG CAP DAISY — English: Daisy Corn Oil — 3 kg
- `246` MINYAK JAGUNG CAP MAZOLA — English: Mazola Corn Oil — 1kg
- `1596` MINYAK JAGUNG CAP MAZOLA — English: Mazola Corn Oil — 2 kg
- `1088` MINYAK JAGUNG CAP MAZOLA — English: Mazola Corn Oil — 3 kg
- `1090` MINYAK JAGUNG CAP VECORN — English: Vecorn Corn Oil — 1kg
- `1597` MINYAK JAGUNG CAP VECORN — English: Vecorn Corn Oil — 2 kg
- `1089` MINYAK JAGUNG CAP VECORN — English: Vecorn Corn Oil — 3 kg

### Group 4: MINYAK SAPI (minimum pair similarity 1.00)

- `271` MINYAK SAPI CAP QBB — English: Ghee Brand QBB — 400 g
- `1603` MINYAK SAPI CAP WINDMILL GHEEBLEND — English: Ghee Brand WINDMILL GHEEBLEND — 400 g

### Ungrouped / distinct names

- `918` MINYAK MASAK PAKET (PELBAGAI JENAMA) — English: Cooking Oil Packet (Various Brands) — 1kg


## MOUTH WASH — Mouthwash

1 catalogue records; 0 candidate groups; 1 ungrouped records.

### Ungrouped / distinct names

- `1025` LISTERINE COOL MINT — 250 ml


## NASI — Cooked Rice

24 catalogue records; 1 candidate groups; 22 ungrouped records.

### Group 1: NASI LEMAK BERBUNGKUS (minimum pair similarity 0.75)

- `1159` NASI LEMAK (BERBUNGKUS) — English: Nasi Lemak (Wrapped) — sebungkus
- `1160` NASI LEMAK (TIDAK BERBUNGKUS) — English: Nasi Lemak (Unwrapped) — sepinggan

### Ungrouped / distinct names

- `1162` NASI + SAYUR + AYAM — English: Rice + Vegetables + Chicken — sepinggan
- `1163` NASI + SAYUR + DAGING — English: Rice + Vegetables + Meat — sepinggan
- `1161` NASI + SAYUR + IKAN — English: Rice + Vegetables + Fish — sepinggan
- `1164` NASI + SAYUR + SOTONG — English: Rice + Vegetables + Squid — sepinggan
- `1165` NASI + SAYUR + UDANG — English: Rice + Vegetables + Prawns — sepinggan
- `1158` NASI AYAM — English: Chicken Rice — sepinggan
- `1281` NASI BRIYANI AYAM — English: NASI BRIYANI Chicken — sepinggan
- `1284` NASI BRIYANI BUKHARA — sepinggan
- `1282` NASI BRIYANI KAMBING — English: NASI BRIYANI Goat — sepinggan
- `1858` NASI DAGANG (BIASA) — English: Nasi Dagang (Regular) — sepinggan
- `1175` NASI GORENG AYAM — English: Chicken Fried Rice — sepinggan
- `1728` NASI GORENG BIASA — English: Plain Fried Rice — sepinggan
- `1172` NASI GORENG CILI PADI — English: NASI Fried Chili PADI — sepinggan
- `1169` NASI GORENG CINA — English: Chinese Fried Rice — sepinggan
- `1173` NASI GORENG DAGING MERAH — English: NASI Fried Meat Red — sepinggan
- `1167` NASI GORENG KAMPUNG — English: Village-Style Fried Rice — sepinggan
- `1168` NASI GORENG PAPRIK — English: NASI Fried PAPRIK — sepinggan
- `1170` NASI GORENG PATAYA — English: NASI Fried PATAYA — sepinggan
- `1729` NASI GORENG SEAFOOD — English: Seafood Fried Rice — sepinggan
- `1174` NASI GORENG USA — English: NASI Fried USA — sepinggan
- `1857` NASI KERABU (BIASA) — English: Nasi Kerabu (Regular) — sepinggan
- `1157` NASI PUTIH KOSONG — English: Plain White Rice — sepinggan


## PENGHALAU NYAMUK

1 catalogue records; 0 candidate groups; 1 ungrouped records.

### Ungrouped / distinct names

- `1678` FUMAKILLA D1 (LINGKARAN NYAMUK) - 1 X 10'S — paket


## PENJAGAAN DIRI — Personal Care

22 catalogue records; 0 candidate groups; 22 ungrouped records.

### Ungrouped / distinct names

- `1630` BERUS GIGI COLGATE (TWISTER - SOFT) — English: Toothbrush COLGATE (TWISTER - SOFT) — 1 batang
- `1524` BERUS GIGI COLGATE (ZIG ZAG - SOFT) — English: Toothbrush COLGATE (ZIG ZAG - SOFT) — 1 batang
- `1525` BERUS GIGI ORAL B (COMPLETE EASY CLEAN - SOFT) — English: Toothbrush ORAL B (COMPLETE EASY CLEAN - SOFT) — 1 batang
- `1988` DEODORAN NIVEA (EXTRA BRIGHTENING) — English: Deodorant NIVEA (EXTRA BRIGHTENING) — 150 ml
- `1987` DEODORAN NIVEA MAN (BLACK & WHITE INVISIBLE - ORIGINAL) — English: Deodorant NIVEA MAN (BLACK & WHITE INVISIBLE - ORIGINAL) — 150 ml
- `1990` DEODORAN REXONA (POWDER DRY BRIGHTENING) — English: Deodorant REXONA (POWDER DRY BRIGHTENING) — 50 ml
- `1989` DEODORAN REXONA MEN (SPORT DEFENSE) — English: Deodorant REXONA MEN (SPORT DEFENSE) — 50 ml
- `2103` SABUN MANDIAN DETTOL (PELBAGAI JENIS) — 950g
- `1980` SABUN MANDIAN DETTOL ANTIBACTERIAL (FRESH) — English: Body Wash DETTOL ANTIBACTERIAL (FRESH) — 500 ml
- `1979` SABUN MANDIAN LIFEBUOY (COOL FRESH) — English: Body Wash LIFEBUOY (COOL FRESH) — 300ml
- `2102` SABUN MANDIAN LIFEBUOY (PELBAGAI JENIS) — 920 ML
- `1981` SABUN MANDIAN LUX (MAGICAL SPELL) — English: Body Wash LUX (MAGICAL SPELL) — 220 ml
- `1984` SYAMPU HEAD & SHOULDERS (SMOOTH & SILKY) — English: Shampoo HEAD & SHOULDERS (SMOOTH & SILKY) — 330 ml
- `1983` SYAMPU PANTENE PRO-V (HAIR FALL CONTROL) — English: Shampoo PANTENE PRO-V (HAIR FALL CONTROL) — 340ml
- `2106` SYAMPU REJOICE (PELBAGAI JENIS) — 600 ml
- `1982` SYAMPU REJOICE (RICH SOFT SMOOTH) — English: Shampoo REJOICE (RICH SOFT SMOOTH) — 340ml
- `2108` SYAMPU SUNSILK (PELBAGAI JENIS) — 625ml
- `1985` TUALA WANITA KOTEX SOFT & SMOOTH (MAXI - NON WING) — English: Sanitary Pads KOTEX SOFT & SMOOTH (MAXI - NON WING) — 10 PAD
- `1986` TUALA WANITA LIBRESSE (MAXI - NON WING) — English: Sanitary Pads LIBRESSE (MAXI - NON WING) — 10 PAD
- `292` UBAT GIGI COLGATE (PUDINA SEGAR) — English: Colgate Toothpaste (Fresh Mint) — 250 g
- `293` UBAT GIGI DARLIE DOUBLE ACTION (PUDINA ASLI) — English: Darlie Double Action Toothpaste (Original Mint) — 250 g
- `295` UBAT GIGI FRESH & WHITE (PUDINA SEGAR) — English: Fresh & White Toothpaste (Fresh Mint) — 160 g


## PENJAGAAN RUMAH — Household Care

24 catalogue records; 3 candidate groups; 18 ungrouped records.

### Group 1: DYNAMO POWER GEL PERFECT CLEAN (minimum pair similarity 1.00)

- `2017` DYNAMO POWER GEL (PERFECT CLEAN) — 2.6kg
- `1994` DYNAMO POWER GEL (PERFECT CLEAN) — 3 kg

### Group 2: SABUN PENCUCI SUNLIGHT LEMON (minimum pair similarity 1.00)

- `1541` SABUN PENCUCI SUNLIGHT (LEMON) — English: Soap Cleaner SUNLIGHT (LEMON) — 1000 ml
- `2018` SABUN PENCUCI SUNLIGHT (LEMON) — English: Soap Cleaner SUNLIGHT (LEMON) — 900ml

### Group 3: SABUN SERBUK FAB PERFECT (minimum pair similarity 1.00)

- `2016` SABUN SERBUK FAB (PERFECT) — English: Laundry Detergent FAB (PERFECT) — 680g
- `1884` SABUN SERBUK FAB (PERFECT) — English: Laundry Detergent FAB (PERFECT) — 720g

### Ungrouped / distinct names

- `1995` DAIA EXCELLENT WASHING POWER (EUA DE PARFUM) — 750 g
- `1876` PELEMBUT PAKAIAN - DOWNY (PREMIUM PARFUM PASSION) — English: Fabric Softener - DOWNY (PREMIUM PARFUM PASSION) — 800ml
- `1996` PELEMBUT PAKAIAN - SOFTLAN (FLORAL FANTASY) — English: Fabric Softener - SOFTLAN (FLORAL FANTASY) — 1 liter
- `2002` PELUNTUR CLOROX (ORIGINAL) — English: Bleach CLOROX (ORIGINAL) — 1 liter
- `2000` PENCUCI PELBAGAI GUNA AJAX FABULOSO (LAVENDER) — English: Ajax Fabuloso Multi-Purpose Cleaner (Lavender) — 2 liter
- `1998` PENCUCI PELBAGAI GUNA DETTOL (LAVENDER) — English: Dettol Multi-Purpose Cleaner (Lavender) — 2.5 liter
- `1999` PENCUCI PELBAGAI GUNA MR MUSCLE (LAVENDER) — English: Mr Muscle Multi-Purpose Cleaner (Lavender) — 2 liter
- `2111` SABUN DAIA EXCELLENT WASHING POWER (PELBAGAI JENIS) — 2.1kg
- `2110` SABUN DETERGEN TOP (PELBAGAI JENIS) — 3.6 KG
- `1538` SABUN PENCUCI AXION PASTE (LEMON) — English: Soap Cleaner AXION PASTE (LEMON) — 350 g
- `2056` SABUN PENCUCI AXION PASTE (PELBAGAI JENIS) — 325 g
- `1540` SABUN PENCUCI GLO (LEMON) — English: Soap Cleaner GLO (LEMON) — 900ml
- `1539` SABUN PENCUCI KUAT HARIMAU (LEMON) — English: Soap Cleaner KUAT HARIMAU (LEMON) — 400 g
- `2112` SABUN PENCUCI SUNLIGHT (PELBAGAI JENIS) — 800ml
- `1992` SABUN SERBUK ATTACK (AROMA FRESH + COLOUR) — English: Laundry Detergent ATTACK (AROMA FRESH + COLOUR) — 800 g
- `2109` SABUN SERBUK BREEZE (PELBAGAI JENIS) — 2.1kg
- `1991` SABUN SERBUK BREEZE (POWER CLEAN) — English: Laundry Detergent BREEZE (POWER CLEAN) — 750 g
- `1993` SABUN SERBUK TOP (SUPER COLOUR) — English: Laundry Detergent TOP (SUPER COLOUR) — 750 g


## PEWANGI RUMAH

1 catalogue records; 0 candidate groups; 1 ungrouped records.

### Ungrouped / distinct names

- `1889` AMBI PUR GEL FRESH AIR FRESHENER (PELBAGAI JENIS) — English: AMBI PUR GEL FRESH Water FRESHENER (Assorted Types) — 180ml


## REMPAH RATUS (BERBUNGKUS)

30 catalogue records; 2 candidate groups; 26 ungrouped records.

### Group 1: SERBUK KARI DAGING ALAGAPPAS (minimum pair similarity 1.00)

- `1839` SERBUK KARI DAGING ALAGAPPAS — English: Curry Powder Meat ALAGAPPAS — 200 g
- `1571` SERBUK KARI DAGING ALAGAPPAS — English: Curry Powder Meat ALAGAPPAS — 250 g

### Group 2: SERBUK KARI IKAN ALAGAPPAS (minimum pair similarity 1.00)

- `1838` SERBUK KARI IKAN ALAGAPPAS — English: Curry Powder Fish ALAGAPPAS — 200 g
- `1569` SERBUK KARI IKAN ALAGAPPAS — English: Curry Powder Fish ALAGAPPAS — 250 g

### Ungrouped / distinct names

- `1489` ASAM JAWA (BERBIJI) PELBAGAI JENAMA — English: Tamarind (With Seeds) Various Brands — 200 g
- `1604` ASAM JAWA (TIDAK BERBIJI) ADABI — English: Adabi Tamarind (Seedless) — 200 g
- `1605` GARAM HALUS BIASA (PELBAGAI JENAMA) — English: Fine Salt Regular (Various Brands) — +-350g
- `2011` KIUB SUP TOM YAM (MAGGI) — English: Tom Yam Soup Cube (Maggi) — 6 X 10g
- `1543` KIUB SUP TOMYAM (MAGGI) — English: Tom Yam Soup Cube (Maggi) — 2 X 10G
- `1545` PERENCAH NASI GORENG IKAN BILIS SERI AJI — English: Seasoning NASI Fried Anchovies SERI AJI — 26G
- `1153` PERENCAH TOM YAM ADABI — English: Seasoning TOM YAM ADABI — 40 g
- `1881` SERBUK CABAI ALAGAPPAS — English: Chili Powder ALAGAPPAS — 230g
- `364` SERBUK CILI BABAS — English: Chili Powder BABAS — 250 g
- `1125` SERBUK CILI KIJANG — English: Chili Powder KIJANG — 250 g
- `1570` SERBUK KARI AYAM DAN DAGING ADABI — English: Adabi Chicken and Meat Curry Powder — 250 g
- `1572` SERBUK KARI DAGING BABAS — English: Curry Powder Meat BABAS — 250 g
- `1568` SERBUK KARI IKAN ADABI — English: Curry Powder Fish ADABI — 250 g
- `350` SERBUK KARI IKAN BABAS — English: Curry Powder Fish BABAS — 250 g
- `1576` SERBUK KARI KURMA ALAGAPPAS — English: Curry Powder Korma ALAGAPPAS — 200 g
- `1924` SERBUK KUNYIT ALAGAPPAS — English: Turmeric Powder ALAGAPPAS — 230g
- `367` SERBUK KUNYIT BABAS — English: Turmeric Powder BABAS — 250 g
- `365` SERBUK KUNYIT CAMPURAN (SEBATIAN) ADABI — English: Turmeric Powder CAMPURAN (Blended) ADABI — 250 g
- `1573` SERBUK KURMA AYAM & DAGING ADABI — English: Powder Korma Chicken & Meat ADABI — 250 g
- `1575` SERBUK KURMA BABAS — English: Powder Korma BABAS — 125 g
- `1544` SERBUK NASI GORENG CINA ADABI — English: Powder NASI Fried CINA ADABI — 17 g
- `1577` SERBUK PERENCAH SUP ADABI — English: Powder Seasoning Soup ADABI — 250 g
- `1578` SERBUK REMPAH SUP MAK SITI — English: Spice Powder Soup MAK SITI — 250 g
- `1579` SERBUK SUP FAIZA — English: Powder Soup FAIZA — 220 g
- `360` SUP BUNJUT ADABI — English: Soup BUNJUT ADABI — 8 g
- `361` SUP PUNJUT MAK SITI — English: Soup PUNJUT MAK SITI — 10 g


## REMPAH RATUS (TIDAK BERBUNGKUS)

18 catalogue records; 0 candidate groups; 18 ungrouped records.

### Ungrouped / distinct names

- `870` BIJI KETUMBAR — English: Coriander Seeds — 100 g
- `869` BIJI SAWI — English: Mustard Seeds — 100 g
- `867` BUAH KERAS — English: Candlenut — 100 g
- `868` BUAH PALA — English: Nutmeg — 100 g
- `866` BUAH PELAGA — English: Cardamom — 100 g
- `864` BUNGA CENGKIH — English: Cloves — 100 g
- `865` BUNGA LAWANG — English: Star Anise — 100 g
- `896` HALBA — English: Fenugreek — 100 g
- `863` JINTAN MANIS (KASAR) — English: Fennel (Coarse) — 100 g
- `343` KULIT KAYU MANIS — English: Cinnamon Bark — 100 g
- `871` LADA HITAM — English: Black Pepper — 100 g
- `873` LADA PUTIH — English: White Pepper — 100 g
- `346` REMPAH KURMA (TIDAK BERBUNGKUS) — English: Spice Korma (Unwrapped) — 100 g
- `347` REMPAH SUP (TIDAK BERBUNGKUS) — English: Spice Soup (Unwrapped) — 100 g
- `155` SERBUK CILI  (TIDAK BERBUNGKUS) — English: Chili Powder (Unwrapped) — 100 g
- `1567` SERBUK KARI DAGING (TIDAK BERBUNGKUS) — English: Curry Powder Meat (Unwrapped) — 100 g
- `1566` SERBUK KARI IKAN (TIDAK BERBUNGKUS) — English: Curry Powder Fish (Unwrapped) — 100 g
- `154` SERBUK KUNYIT (TIDAK BERBUNGKUS) — English: Turmeric Powder (Unwrapped) — 100 g


## ROTI — Bread

4 catalogue records; 0 candidate groups; 4 ungrouped records.

### Ungrouped / distinct names

- `1494` ROTI GARDENIA BREAKTHRU - ROTI GANDUM PENUH — English: Bread GARDENIA BREAKTHRU - Bread GANDUM Full — 400 g
- `272` ROTI SANDWICH GARDENIA ORIGINAL CLASSIC — English: Bread SANDWICH GARDENIA ORIGINAL CLASSIC — 400 g
- `1586` ROTI SANDWICH MASSIMO DENGAN GERMA GANDUM — English: Massimo Sandwich Bread with Wheat Germ — 400 g
- `1949` ROTI WHOLEMEAL (PELBAGAI JENAMA) — English: Bread WHOLEMEAL (Various Brands) — 400 g


## SABUN BADAN — Body Wash

1 catalogue records; 0 candidate groups; 1 ungrouped records.

### Ungrouped / distinct names

- `1887` DETTOL SHOWER FOAM ORIGINAL — 250 ml


## SANTAN (KOTAK) — Coconut Milk (Carton)

4 catalogue records; 1 candidate groups; 0 ungrouped records.

### Group 1: SANTAN KELAPA (minimum pair similarity 1.00)

- `1151` SANTAN KELAPA JENAMA AYAM BRAND — English: Ayam Brand Coconut Milk — 1 liter
- `1612` SANTAN KELAPA JENAMA HARMUNI — English: Harmuni Coconut Milk — 200 ml
- `1611` SANTAN KELAPA JENAMA KARA — English: Kara Coconut Milk — 200 ml
- `1610` SANTAN KELAPA JENAMA M&S — English: M&S Coconut Milk — 500 ml


## SAPUAN (SPREADS) — Spreads

16 catalogue records; 4 candidate groups; 8 ungrouped records.

### Group 1: LEPAAN BUTTERCUP (minimum pair similarity 1.00)

- `2022` LEPAAN BUTTERCUP — 227g
- `1608` LEPAAN BUTTERCUP — 250 g

### Group 2: MARJERIN DAISY (minimum pair similarity 1.00)

- `1141` MARJERIN DAISY — English: Margarine DAISY — 240 g
- `205` MARJERIN DAISY — English: Margarine DAISY — 480 g

### Group 3: MARJERIN PLANTA (minimum pair similarity 1.00)

- `1140` MARJERIN PLANTA — English: Margarine PLANTA — 240 g
- `206` MARJERIN PLANTA — English: Margarine PLANTA — 480 g

### Group 4: MENTEGA KACANG HALUS LADY S CHOICE (minimum pair similarity 1.00)

- `1144` MENTEGA KACANG HALUS LADY'S CHOICE — English: Butter Beans Fine LADY'S CHOICE — 340 g
- `1606` MENTEGA KACANG HALUS LADY'S CHOICE — English: Butter Beans Fine LADY'S CHOICE — 500 g

### Ungrouped / distinct names

- `1829` BUTTERLITE (LEPA SUSU ISTIMEWA) — English: BUTTERLITE (LEPA Milk ISTIMEWA) — 250 g
- `201` JEM STRAWBERI LADY'S CHOICE — 400 g
- `2013` KRAFT DAIRYLEA SINGLES CHEESE 12 SLICES — 250 g
- `204` KRAFT HI - CALCIUM SINGLES PROCESSED CHEESE 12 SLICES — 250 g
- `1607` LEPAAN FARMCOWS — 250 g
- `203` MAINLAND CHESDALE CHEDDAR CHEESE SPREAD 12 CHEDDAR — 250 g
- `1872` MAYONIS SEBENAR LADY'S CHOICE — 220ml
- `202` SERI KAYA YEO'S — 480 g


## SAYUR-SAYURAN — Vegetables

41 catalogue records; 0 candidate groups; 41 ungrouped records.

### Ungrouped / distinct names

- `1400` BAWANG PERAI (LEEK) IMPORT — English: Leeks (LEEK) Imported — 1kg
- `1399` BAWANG PERAI (LEEK) TEMPATAN — English: Leeks (LEEK) Local — 1kg
- `1556` BAYAM HIJAU — English: Green Spinach — 1kg
- `1557` BAYAM MERAH — English: Red Spinach — 1kg
- `1479` BROKOLI — English: Broccoli — 1kg
- `1926` CILI AKAR HIJAU — English: Chili AKAR Green — 1kg
- `1927` CILI AKAR MERAH — English: Chili AKAR Red — 1kg
- `716` CILI API/PADI HIJAU — English: Bird's Eye Chili Green — 1kg
- `1925` CILI API/PADI MERAH — English: Bird's Eye Chili Red — 1kg
- `92` CILI HIJAU — English: Green Chili — 1kg
- `93` CILI MERAH - KULAI — English: Red Chili - KULAI — 1kg
- `94` CILI MERAH - MINYAK — English: Red Chili - MINYAK — 1kg
- `95` HALIA BASAH (TUA) — English: Fresh Ginger (TUA) — 1kg
- `96` KACANG BENDI — English: Okra — 1kg
- `1818` KACANG BOTOL — English: Winged Beans — 1kg
- `97` KACANG BUNCIS — English: French Beans — 1kg
- `98` KACANG PANJANG — English: Long Beans — 1kg
- `1560` KAILAN — 1kg
- `1559` KANGKUNG — English: Water Spinach — 1kg
- `105` KUBIS BULAT (TEMPATAN) — English: Round Cabbage (Local) — 1kg
- `1458` KUBIS BULAT IMPORT (BEIJING) — English: Round Cabbage Imported (BEIJING) — 1kg
- `104` KUBIS BULAT IMPORT (CHINA) — English: Round Cabbage Imported (CHINA) — 1kg
- `1396` KUBIS BULAT IMPORT (INDONESIA) — English: Round Cabbage Imported (INDONESIA) — 1kg
- `1481` KUBIS BUNGA (CAULIFLOWER) — English: Cauliflower (CAULIFLOWER) — 1kg
- `1482` KUBIS PANJANG (TEMPATAN) — English: Chinese Cabbage (Local) — 1kg
- `1412` KUBIS PANJANG CHINA - BESAR — English: Chinese Cabbage CHINA - Large — 1kg
- `108` KUNYIT HIDUP — English: Fresh Turmeric — 1kg
- `1128` LADA BENGGALA HIJAU (CAPSICUM) — English: Bell Pepper Green (CAPSICUM) — 1kg
- `1130` LADA BENGGALA KUNING (CAPSICUM) — English: Bell Pepper Yellow (CAPSICUM) — 1kg
- `1129` LADA BENGGALA MERAH (CAPSICUM) — English: Bell Pepper Red (CAPSICUM) — 1kg
- `1819` LENGKUAS — English: Galangal — 1kg
- `109` LOBAK MERAH — English: Carrots — 1kg
- `2087` LOBAK PUTIH (1KG) — 1kg
- `1922` SADERI — 1kg
- `1558` SAWI HIJAU — English: Green Mustard Greens — 1kg
- `2086` SAWI PENDEK/JEPUN/SIOW PAK CHOY (1KG) — 1kg
- `1561` TAUGE KACANG HIJAU — English: Bean Sprouts Mung Beans — 1kg
- `1923` TERUNG BULAT — English: Round Eggplant — 1kg
- `112` TERUNG PANJANG — English: Long Eggplant — 1kg
- `113` TIMUN — English: Cucumber — 1kg
- `114` TOMATO — 1kg


## SUSU BAYI — Infant Formula

27 catalogue records; 5 candidate groups; 15 ungrouped records.

### Group 1: S 26 RUMUSAN BAYI LANGKAH 1 KOTAK (minimum pair similarity 0.78)

- `1624` S-26 GOLD SMA RUMUSAN BAYI LANGKAH 1 - (KOTAK) — English: S-26 Gold SMA Infant Formula Stage 1 (Box) — 600 g
- `2031` S-26 RUMUSAN BAYI LANGKAH 1 - (KOTAK) — 600 g
- `1623` S-26 SMA RUMUSAN BAYI LANGKAH 1 - (KOTAK) — English: S-26 SMA Infant Formula Stage 1 - (Box) — 600 g
- `2062` S-26 SMA RUMUSAN BAYI LANGKAH 1 - (KOTAK) (550g) — 550 g

### Group 2: ANMUM ESSENTIAL LANGKAH 4 PERISA ASLI TANPA GULA TAMBAHAN (minimum pair similarity 0.82)

- `1963` ANMUM ESSENTIAL LANGKAH 4 PERISA ASLI (TANPA GULA TAMBAHAN) - KOTAK — English: REFILL ANMUM ESSENTIAL Stage 4 Flavour Original (without GULA TAMBAHAN) - Box — 550 g
- `1961` ANMUM ESSENTIAL LANGKAH 4 PERISA ASLI (TANPA GULA TAMBAHAN) - TIN — English: ANMUM ESSENTIAL Stage 4 Flavour Original (without GULA TAMBAHAN) - Tin — 1.5kg

### Group 3: ENFAGROW A MIND PRO LANGKAH 3 KOTAK (minimum pair similarity 0.70)

- `2014` ENFAGROW A+ MIND PRO LANGKAH 3 (PELBAGAI PERISA) (KOTAK) — English: ENFAGROW A+ MIND PRO Stage 3 VANILA (Box) — 500 g
- `303` ENFAGROW A+ MIND PRO LANGKAH 3 VANILLA (KOTAK) — English: ENFAGROW A+ MIND PRO Stage 3 VANILLA (Box) — 600 g

### Group 4: NAN LANGKAH 1 RUMUSAN BAYI KOTAK (minimum pair similarity 0.86)

- `2027` NAN LANGKAH 1 RUMUSAN BAYI (KOTAK) — 600 g
- `1956` NAN PRO LANGKAH 1 RUMUSAN BAYI (KOTAK) — English: NAN PRO Stage 1 Infant Formula (Box) — 600 g

### Group 5: NAN LANGKAH 2 RUMUSAN SUSULAN KOTAK (minimum pair similarity 0.86)

- `2030` NAN LANGKAH 2 RUMUSAN SUSULAN (KOTAK) — 600 g
- `1957` NAN PRO LANGKAH 2 RUMUSAN SUSULAN (KOTAK) — English: NAN PRO Stage 2 Follow-Up Formula (Box) — 600 g

### Ungrouped / distinct names

- `1904` DUMEX DUGRO 3 (1-3 TAHUN) (PELBAGAI PERISA) — English: DUMEX DUGRO 3 (1-3 TAHUN) Flavour Original (850G) — 850g
- `2001` DUMEX DUPRO 2 (RUMUSAN SUSULAN) — English: DUMEX DUPRO 2 (Follow-Up Formula) — 850g
- `1874` DUTCH LADY 123 (BIASA) — English: DUTCH LADY 123 (Regular) — 900 g
- `2009` DUTCH LADY 123 (PELBAGAI PERISA) — English: DUTCH LADY 123 (Regular) — 850g
- `2010` DUTCH LADY 456 (PELBAGAI PERISA) — English: DUTCH LADY 456 (Regular) — 850g
- `2104` FERNLEAF 1-3 TAHUN (PELBAGAI PERISA) — 850g
- `2105` FERNLEAF 4-6 TAHUN (PELBAGAI PERISA) — 850g
- `299` LACTOGEN 1 RUMUSAN BAYI (KOTAK) — English: LACTOGEN 1 Infant Formula (Box) — 650g
- `300` LACTOGEN 2 RUMUSAN SUSULAN (KOTAK) — English: LACTOGEN 2 Follow-Up Formula (Box) — 650g
- `1512` MAMEX LANGKAH 1 - RUMUSAN BAYI (KOTAK) — English: MAMEX Stage 1 - Infant Formula (Box) — 600 g
- `1958` NANKID OPTIPRO LANGKAH 3 RUMUSAN UNTUK KANAK-KANAK — English: NANKID OPTIPRO Stage 3 Children's Formula — 600 g
- `1965` PEDIASURE (VANILA) — 600 g
- `2097` SUSTAGEN ALL-IN-ONE (PELBAGAI PERISA) — 600 g
- `1514` SUSTAGEN JUNIOR 1+ (VANILLA ) - KOTAK — English: SUSTAGEN JUNIOR 1+ (VANILLA ) - Box — 600 g
- `1513` SUSTAGEN KID 3+ (VANILLA) - KOTAK — English: SUSTAGEN KID 3+ (VANILLA) - Box — 600 g


## SYAMPU — Shampoo

2 catalogue records; 0 candidate groups; 2 ungrouped records.

### Ungrouped / distinct names

- `1673` HEAD AND SHOULDERS COOL MENTHOL SHAMPOO — 70ml
- `1671` REJOICE RICH SOFT SMOOTH SHAMPOO — 70ml


## TAUHU DAN TEMPE — Tofu & Tempeh

2 catalogue records; 0 candidate groups; 2 ungrouped records.

### Ungrouped / distinct names

- `1945` TAUHU (JENIS KERAS) — English: Firm Tofu — sekeping
- `1946` TEMPE (BUNGKUSAN PLASTIK) — sekeping


## TELUR — Eggs

11 catalogue records; 2 candidate groups; 7 ungrouped records.

### Group 1: TELUR AYAM GRED BERAT HINGGA SEBIJI (minimum pair similarity 0.75)

- `118` TELUR AYAM GRED A (BERAT 65.0 GM HINGGA 69.9 GM SEBIJI) — English: Eggs Chicken Grade A (Weight 65.0 GM to 69.9 GM each) — 10 biji
- `120` TELUR AYAM GRED C (BERAT 55.0 GM HINGGA 59.9 GM SEBIJI) — English: Eggs Chicken Grade C (Weight 55.0 GM to 59.9 GM each) — 10 biji

### Group 2: TELUR MASIN (minimum pair similarity 1.00)

- `1820` TELUR MASIN — English: Salted Eggs — 1 biji
- `1821` TELUR MASIN — English: Salted Eggs — 4 Biji

### Ungrouped / distinct names

- `1109` TELUR AYAM GRED A — English: Eggs Chicken Grade A — 30 biji
- `1110` TELUR AYAM GRED B — English: Grade B Chicken Eggs — 30 biji
- `119` TELUR AYAM GRED B (BERAT 60.0 GM HINGGA 64.9 GM) — English: Eggs Chicken Grade B (Weight 60.0 GM to 64.9 GM) — 10 biji
- `1111` TELUR AYAM GRED C — English: Eggs Chicken Grade C — 30 biji
- `1930` TELUR AYAM KAMPUNG — English: Free-Range Chicken Eggs — 10 biji
- `125` TELUR ITIK — English: Duck Eggs — 10 biji
- `124` TELUR PUYUH — English: Quail Eggs — 15 Biji


## TEPUNG — Flour

9 catalogue records; 1 candidate groups; 6 ungrouped records.

### Group 1: TEPUNG GANDUM NGP BERBUNGKUS (minimum pair similarity 1.00)

- `1870` TEPUNG GANDUM NGP (BERBUNGKUS, CAP  FAIZA) — English: Wheat Flour NGP (Packaged, Brand FAIZA) — 1kg
- `1827` TEPUNG GANDUM NGP (BERBUNGKUS, CAP MUHIBAH) — English: Wheat Flour NGP (Packaged, Brand MUHIBAH) — 1kg
- `917` TEPUNG GANDUM NGP (BERBUNGKUS, CAP SAUH) — English: Wheat Flour NGP (Packaged, Brand SAUH) — 1kg

### Ungrouped / distinct names

- `1591` TEPUNG BERAS (PELBAGAI JENAMA) — English: Rice Flour (Various Brands) — 500 g
- `2036` TEPUNG GANDUM CAP KUDA HIJAU — 1kg
- `1593` TEPUNG GANDUM GP (BERBUNGKUS) PELBAGAI JENAMA — English: Wheat Flour GP (Packaged) Various Brands — 1kg
- `1498` TEPUNG JAGUNG (PELBAGAI JENAMA) — English: Corn Flour (Various Brands) — 400 g
- `1849` TEPUNG NAIK SENDIRI CAP 'BLUE KEY' — English: TEPUNG NAIK SENDIRI Brand 'BLUE KEY' — 1kg
- `1594` TEPUNG PULUT (PELBAGAI JENAMA) — English: Glutinous Rice Flour (Various Brands) — 500 g


## TERSEDIA MINUM — Ready-to-Drink

26 catalogue records; 3 candidate groups; 20 ungrouped records.

### Group 1: SUSU MARIGOLD HL (minimum pair similarity 1.00)

- `225` SUSU MARIGOLD HL — English: Milk MARIGOLD HL — 1 liter
- `2060` SUSU MARIGOLD HL — 946ML

### Group 2: SUSU SEGAR FARM FRESH (minimum pair similarity 0.80)

- `1959` SUSU SEGAR FARM FRESH — English: Fresh Milk FARM FRESH — 1 liter
- `1960` SUSU SEGAR KURMA FARM FRESH — English: Fresh Milk Korma FARM FRESH — 700 g

### Group 3: YOGURT LACTEL FAT FREE STRAWBERRY (minimum pair similarity 1.00)

- `1880` YOGURT LACTEL (FAT FREE) (STRAWBERRY) — 125 g
- `2020` YOGURT LACTEL (FAT FREE) (STRAWBERRY) — 130g

### Ungrouped / distinct names

- `1355` 100 PLUS (ORIGINAL) — 1.5 liter
- `228` COCA COLA (BOTOL) — English: COCA COLA (Bottle) — 1.5 liter
- `1507` COCA COLA (TIN) — 320 ml
- `1852` DESA FRESH MILK (KOTAK) — English: DESA FRESH MILK (Box) — 1 liter
- `221` DRINHO SOYA (KOTAK) — English: Drinho Soya Drink (Box) — 250 ml
- `1505` DUTCH LADY UHT COKLAT (KOTAK) — English: DUTCH LADY UHT Chocolate (Box) — 200 ml
- `1506` DUTCH LADY UHT FULL CREAM (KOTAK) — English: DUTCH LADY UHT FULL CREAM (Box) — 200 ml
- `230` F&N OREN (BOTOL) — English: F&N OREN (Bottle) — 1.5 liter
- `229` F&N OREN (TIN) — 325 ml
- `235` JUS OREN PEEL FRESH (MARIGOLD) — English: Juice OREN PEEL FRESH (MARIGOLD) — 1 liter
- `236` JUS OREN SUNKIST — English: Sunkist Orange Juice — 1 liter
- `240` LIVITA WITH HONEY (BOTOL) — English: LIVITA WITH HONEY (Bottle) — 150 ml
- `232` MIRINDA OREN (BOTOL) — English: MIRINDA OREN (Bottle) — 1.5 liter
- `1547` PEPSI COLA (TIN) — 320 ml
- `239` RED BULL (BOTOL) — English: RED BULL (Bottle) — 150 ml
- `1879` SEVEN UP LEMON & LIME (TIN) — 320ml
- `224` SUSU SEGAR DUTCH LADY — English: Fresh Milk DUTCH LADY — 1 liter
- `226` YEO'S LAICI (KOTAK) — English: YEO'S LAICI (Box) — 250 ml
- `1651` YEO'S SOYA (KOTAK) — English: Yeo's Soya Drink (Box) — 250 ml
- `1955` YOGURT MARIGOLD (LOW FAT) (STRAWBERRY) — 130g


## TISU — Tissues

1 catalogue records; 0 candidate groups; 1 ungrouped records.

### Ungrouped / distinct names

- `1677` KLEENEX FACIAL TISSUE VINTAGE SOFTPACK 50S X 3 — paket


## TUALA WANITA — Sanitary Pads

2 catalogue records; 1 candidate groups; 0 ungrouped records.

### Group 1: KOTEX SOFT AND SMOOTH WING (minimum pair similarity 0.71)

- `1670` KOTEX SOFT & SMOOTH MAXI WING 10 PADS — paket
- `1669` KOTEX SOFT AND SMOOTH OVERNIGHT WING 8 PADS (28CM) — paket


## UBAT GIGI — Toothpaste

1 catalogue records; 0 candidate groups; 1 ungrouped records.

### Ungrouped / distinct names

- `1659` DARLIE TRAVEL KIT ADULT — 1 unit


## UBAT-UBATAN — Medicines

8 catalogue records; 0 candidate groups; 8 ungrouped records.

### Ungrouped / distinct names

- `1890` BYE BYE FEVER SUPER COOL (DEWASA) — 6sheets
- `1695` ENO SACHET GINGER — 2x4.3g
- `1017` FISHERMAN'S FRIEND ORIGINAL — 25 g
- `1019` MINYAK ANGIN CAP KAPAK — English: Kapak Brand Medicated Oil — 3 ml
- `1680` PANADOL ACTIFAST 10S — paket
- `1468` PANADOL FOR CHILDREN SUSPENSION 1-6 — 60ml
- `1682` STREPSILS ORIGINAL 6 LOZENGES — paket
- `1020` VICKS VAPORUB — 10 g


## UBI KENTANG — Potatoes

4 catalogue records; 0 candidate groups; 4 ungrouped records.

### Ungrouped / distinct names

- `861` UBI KENTANG HOLLAND — English: Potatoes HOLLAND — 1kg
- `1131` UBI KENTANG IMPORT (CHINA) — English: Potatoes Imported (CHINA) — 1kg
- `2107` UBI KENTANG IMPORT (PAKISTAN) — 1kg
- `160` UBI KENTANG RUSSET — English: Potatoes RUSSET — 1kg
