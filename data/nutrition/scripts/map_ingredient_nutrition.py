"""Build reviewed generic nutrition mappings for catalogue ingredients.

The catalogue identifier is local to PriceCatcher, so this module uses explicit
reviewed rules rather than fuzzy equality or an item-code join.  Rules point to
USDA FoodData Central (``usda:<fdcId>``) or AFCD (``afcd:<source_code>``)
records imported into this research directory.  The output deliberately leaves
uncertain species, preparation states, multi-ingredient products and non-foods
unmatched.
"""

from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent


def _workspace_root() -> Path:
    """Find the repository root from either research or tracked script copy."""
    for candidate in (ROOT, *ROOT.parents):
        if (candidate / ".tmp" / "nutrition_active_catalogue.csv").exists():
            return candidate
    raise FileNotFoundError("Cannot locate repository .tmp/nutrition_active_catalogue.csv")


WORKSPACE_ROOT = _workspace_root()
RESEARCH_ROOT = WORKSPACE_ROOT / "research" / "nutrition_coverage"
CATALOGUE_PATH = WORKSPACE_ROOT / ".tmp" / "nutrition_active_catalogue.csv"
USDA_PATH = RESEARCH_ROOT / "usda_foods.json"
AFCD_PATH = RESEARCH_ROOT / "afcd_foods.json"
MYFCD_PATH = RESEARCH_ROOT / "myfcd_foods.json"
MAPPINGS_PATH = RESEARCH_ROOT / "ingredient_mappings.json"
UNMATCHED_PATH = RESEARCH_ROOT / "ingredient_unmatched.json"

# Only these catalogue categories remain with the parent agent. Packaged drinks
# and dry/fresh noodle products are mapped here with matching product states.
PARENT_CATEGORIES = {
    "LAUK",
    "NASI",
    "MINUMAN",
    "LAIN-LAIN",
    "MEE / BIHUN / KUEY TEOW",
}

NON_FOOD_CATEGORIES = {
    "ALAT TULIS DAN BAHAN BACAAN",
    "BERUS GIGI",
    "LAMPIN PAKAI BUANG",
    "MAJALAH",
    "MOUTH WASH",
    "PENJAGAAN DIRI",
    "PENJAGAAN RUMAH",
    "PENGHALAU NYAMUK",
    "PEWANGI RUMAH",
    "SABUN BADAN",
    "SYAMPU",
    "TISU",
    "TUALA WANITA",
    "UBAT GIGI",
    "UBAT-UBATAN",
}

INFANT_CATEGORIES = {"SUSU BAYI"}


def _codes(value: str) -> set[str]:
    return {part.strip() for part in value.split(",") if part.strip()}


# Each target is a source record with all four minimum macronutrient fields.
# The source descriptions are checked at runtime from the imported source file.
TARGETS: dict[str, tuple[str, str]] = {
    # Chicken, turkey, meat and eggs
    "usda:171447": ("generic whole chicken, meat and skin, raw", "USDA"),
    "usda:171081": ("generic whole turkey, meat and skin, raw", "USDA"),
    "usda:172373": ("chicken drumstick, meat and skin, raw", "USDA"),
    "usda:171474": ("chicken breast, meat and skin, raw", "USDA"),
    "usda:172385": ("chicken thigh, meat and skin, raw", "USDA"),
    "usda:172378": ("chicken leg, meat and skin, raw", "USDA"),
    "usda:172390": ("chicken wing, meat and skin, raw", "USDA"),
    "afcd:AFCD-F003729-per_100g": ("chicken egg, whole, raw", "AFCD"),
    "usda:172191": ("quail egg, whole, fresh, raw", "USDA"),
    "usda:172189": ("duck egg, whole, fresh, raw", "USDA"),
    "usda:748967": ("chicken egg, whole, grade A large", "USDA"),
    # Produce
    "usda:790646": ("yellow onion, raw", "USDA"),
    "usda:170499": ("shallot, raw", "USDA"),
    "usda:1104647": ("garlic, raw", "USDA"),
    "usda:169975": ("cabbage, raw", "USDA"),
    "usda:169979": ("Chinese cabbage, raw", "USDA"),
    "usda:170393": ("carrots, raw", "USDA"),
    "usda:169228": ("eggplant, raw", "USDA"),
    "afcd:AFCD-F002239-per_100g": ("green capsicum, fresh, raw", "AFCD"),
    "afcd:AFCD-F002247-per_100g": ("red capsicum, fresh, raw", "AFCD"),
    "afcd:AFCD-F010259-per_100g": ("yellow capsicum, fresh, raw", "AFCD"),
    "usda:168409": ("cucumber with peel, raw", "USDA"),
    "usda:170457": ("red ripe tomato, raw", "USDA"),
    "usda:169246": ("leek, raw", "USDA"),
    "usda:747447": ("broccoli, raw", "USDA"),
    "usda:169986": ("cauliflower, raw", "USDA"),
    "afcd:AFCD-F008761-per_100g": ("mature spinach, fresh, raw", "AFCD"),
    "afcd:AFCD-F008763-per_100g": ("water spinach, fresh, raw", "AFCD"),
    "usda:169256": ("mustard greens, raw", "USDA"),
    "usda:170476": ("winged beans, immature seeds, raw", "USDA"),
    "usda:169988": ("celery, raw", "USDA"),
    "usda:169260": ("okra, raw", "USDA"),
    "usda:169961": ("green snap beans, raw", "USDA"),
    "usda:169222": ("yardlong bean, raw", "USDA"),
    "usda:169404": ("Chinese broccoli, raw", "USDA"),
    "myfcd:MFC-97-105007": ("winged bean pods, raw", "MyFCD"),
    "myfcd:MFC-97-105089": ("green amaranth spinach (bayam), raw", "MyFCD"),
    "myfcd:MFC-97-105093": ("red amaranth spinach (bayam merah), raw", "MyFCD"),
    "afcd:AFCD-F008806-per_100g": ("bean sprouts, fresh, raw", "AFCD"),
    "afcd:AFCD-F003761-per_100g": ("eggplant, unpeeled, fresh, raw", "AFCD"),
    "afcd:AFCD-F002896-per_100g": ("green chilli, raw", "AFCD"),
    "afcd:AFCD-F002901-per_100g": ("red chilli, raw", "AFCD"),
    "usda:170026": ("potato, flesh and skin, raw", "USDA"),
    "usda:170027": ("russet potato, raw", "USDA"),
    "usda:170028": ("white potato, raw", "USDA"),
    # Fruit
    "usda:168155": ("lime, raw", "USDA"),
    "usda:168203": ("Granny Smith apple, raw, with skin", "USDA"),
    "usda:168201": ("Red Delicious apple, raw, with skin", "USDA"),
    "usda:169097": ("orange, raw", "USDA"),
    "afcd:AFCD-F011001-per_100g": ("red papaya, peeled, raw", "AFCD"),
    "usda:1105314": ("banana, ripe, raw", "USDA"),
    "usda:167765": ("watermelon, raw", "USDA"),
    "afcd:AFCD-F005517-per_100g": ("honeydew melon, peeled, raw", "AFCD"),
    "usda:168193": ("pineapple, raw", "USDA"),
    "usda:174683": ("red or green grapes, raw", "USDA"),
    "usda:168177": ("Asian pear, raw", "USDA"),
    "usda:173044": ("common guava, raw", "USDA"),
    # Seafood with matching species or clearly stated generic type
    "afcd:AFCD-F007422-per_100g": ("banana prawn, raw", "AFCD"),
    "afcd:AFCD-F007433-per_100g": ("generic prawn, raw", "AFCD"),
    "afcd:AFCD-F007424-per_100g": ("tiger prawn, raw", "AFCD"),
    "usda:175142": ("sea bass, mixed species, raw", "USDA"),
    "usda:173673": ("Spanish mackerel, raw", "USDA"),
    "afcd:AFCD-F005268-per_100g": ("mackerel, raw", "AFCD"),
    "afcd:AFCD-F008359-per_100g": ("snapper fillet, raw", "AFCD"),
    "usda:174192": ("croaker, raw", "USDA"),
    "usda:171962": ("grouper, mixed species, raw", "USDA"),
    "usda:174223": ("squid, mixed species, raw", "USDA"),
    "usda:174214": ("clam, mixed species, raw", "USDA"),
    "usda:174186": ("channel catfish, wild, raw", "USDA"),
    "usda:175176": ("tilapia, raw", "USDA"),
    "afcd:AFCD-F007973-per_100g": ("sardine, whole, raw", "AFCD"),
    # Precise Malaysian fish and local seafood records from MyFCD.
    "myfcd:MFC-97-110001": ("fresh anchovy, whole", "MyFCD"),
    "myfcd:MFC-97-110002": ("dried anchovy, headless and gutted", "MyFCD"),
    "myfcd:MFC-97-110008": ("Japanese threadfin bream (kerisi), raw", "MyFCD"),
    "myfcd:MFC-97-110014": ("catfish (keli), raw", "MyFCD"),
    "myfcd:MFC-97-110019": ("clam (lala), raw", "MyFCD"),
    "myfcd:MFC-97-110022": ("coral cod/grouper (kerapu), raw", "MyFCD"),
    "myfcd:MFC-97-110025": ("fresh cuttlefish (sotong), raw", "MyFCD"),
    "myfcd:MFC-97-110044": ("round herring (tamban), raw", "MyFCD"),
    "myfcd:MFC-97-110045": ("wolf herring (parang), raw", "MyFCD"),
    "myfcd:MFC-97-110047": ("brown jewfish (gelama), raw", "MyFCD"),
    "myfcd:MFC-97-110052": ("barred Spanish mackerel (tenggiri batang), raw", "MyFCD"),
    "myfcd:MFC-97-110053": ("Indian mackerel (kembung), raw", "MyFCD"),
    "myfcd:MFC-97-110060": ("giant sea perch (siakap), raw", "MyFCD"),
    "myfcd:MFC-97-110061": ("sea perch (siakap), raw", "MyFCD"),
    "myfcd:MFC-97-110062": ("black pomfret (bawal hitam), raw", "MyFCD"),
    "myfcd:MFC-97-110064": ("white pomfret (bawal putih), raw", "MyFCD"),
    "myfcd:MFC-97-110067": ("salted dried prawn", "MyFCD"),
    "myfcd:MFC-97-110074": ("sardine (tamban), raw", "MyFCD"),
    "myfcd:MFC-97-110075": ("canned sardine", "MyFCD"),
    "myfcd:MFC-97-110083": ("longtail shad (terubok), raw", "MyFCD"),
    "myfcd:MFC-97-110092": ("snakehead (haruan), raw", "MyFCD"),
    "myfcd:MFC-97-110093": ("golden-striped snapper (jenahak), raw", "MyFCD"),
    "myfcd:MFC-97-110094": ("red snapper (ikan merah), raw", "MyFCD"),
    "myfcd:MFC-97-110097": ("stingray (pari), raw", "MyFCD"),
    "myfcd:MFC-97-110100": ("threadfin (senangin), raw", "MyFCD"),
    "myfcd:MFC-97-110103": ("yellow-banded trevally (selar kuning), raw", "MyFCD"),
    "myfcd:MFC-97-110105": ("little tuna/bonito (aya), raw", "MyFCD"),
    "myfcd:MFC-97-114017": ("dried anise seed", "MyFCD"),
    "myfcd:MFC-97-114019": ("cardamom", "MyFCD"),
    "myfcd:MFC-97-114020": ("dried chilli", "MyFCD"),
    "myfcd:MFC-97-114021": ("cinnamon", "MyFCD"),
    "myfcd:MFC-97-114022": ("clove", "MyFCD"),
    "myfcd:MFC-97-114023": ("coriander seed", "MyFCD"),
    "myfcd:MFC-97-114027": ("curry powder", "MyFCD"),
    "myfcd:MFC-97-114028": ("fenugreek seed", "MyFCD"),
    "myfcd:MFC-97-114029": ("fresh galangal", "MyFCD"),
    "myfcd:MFC-97-114030": ("fresh ginger root", "MyFCD"),
    "myfcd:MFC-97-114033": ("mustard seed", "MyFCD"),
    "myfcd:MFC-97-114035": ("white pepper powder", "MyFCD"),
    "myfcd:MFC-97-114038": ("tamarind paste", "MyFCD"),
    "myfcd:MFC-97-109004": ("duck egg, salted, whole", "MyFCD"),
    "myfcd:MFC-CUR-R106035": ("red dragon fruit", "MyFCD"),
    # Local products and precise dry/cooked states used by the expanded scope.
    "myfcd:MFC-97-101026": ("rice noodle (kuih-teow), raw", "MyFCD"),
    "myfcd:MFC-97-101028": ("rice noodle (mee-hoon), dry", "MyFCD"),
    "myfcd:MFC-97-101060": ("wheat noodle, dry", "MyFCD"),
    "myfcd:MFC-97-101061": ("instant wheat noodle, dry", "MyFCD"),
    "myfcd:MFC-97-101062": ("wheat noodle, wet", "MyFCD"),
    "myfcd:MFC-97-111007": ("fresh cow milk", "MyFCD"),
    "myfcd:MFC-97-111016": ("UHT chocolate milk", "MyFCD"),
    "myfcd:MFC-97-111017": ("UHT full-cream milk", "MyFCD"),
    "myfcd:MFC-CUR-R111061": ("flavoured strawberry yogurt", "MyFCD"),
    "myfcd:MFC-CUR-R113020": ("energy drink", "MyFCD"),
    "myfcd:MFC-CUR-R113024": ("isotonic drink", "MyFCD"),
    "myfcd:MFC-CUR-R113058": ("sweetened packet soy drink", "MyFCD"),
    "myfcd:MFC-CUR-R113064": ("fresh orange juice", "MyFCD"),
    "usda:174852": ("regular carbonated cola", "USDA"),
    "usda:173205": ("carbonated lemon-lime soda", "USDA"),
    "usda:174854": ("carbonated orange soda", "USDA"),
    "afcd:AFCD-F004114-per_100g": ("orange fruit drink", "AFCD"),
    "afcd:AFCD-F008421-per_100g": ("Red Bull style energy drink", "AFCD"),
    "afcd:AFCD-F008438-per_100g": ("fruit-flavour soft drink", "AFCD"),
    "afcd:AFCD-F008721-per_100g": ("regular unsweetened soy beverage", "AFCD"),
    "afcd:AFCD-F006055-per_100g": ("flavoured instant wheat noodle, dry", "AFCD"),
    "afcd:AFCD-F005614-per_100g": ("reduced-fat cow milk", "AFCD"),
    # Meat: raw state and species are preserved; cuts are generic where the
    # source does not expose the Malaysian trade cut exactly.
    "afcd:AFCD-F006001-per_100g": ("mutton, bone-in leg, untrimmed, raw", "AFCD"),
    "afcd:AFCD-F005983-per_100g": ("mutton, boneless shoulder, untrimmed, raw", "AFCD"),
    "afcd:AFCD-F005017-per_100g": ("lamb, leg roast, untrimmed, raw", "AFCD"),
    "afcd:AFCD-F005125-per_100g": ("lamb, stir-fry strips, untrimmed, raw", "AFCD"),
    "afcd:AFCD-F004243-per_100g": ("goat meat, all cuts, untrimmed, raw", "AFCD"),
    "usda:168694": ("beef round, lean and fat, raw", "USDA"),
    "afcd:AFCD-F001921-per_100g": ("riverine buffalo topside, raw", "AFCD"),
    "usda:167812": ("pork belly, raw", "USDA"),
    "usda:167810": ("pork composite cuts, lean and fat, raw", "USDA"),
    "usda:167816": ("pork leg, lean only, raw", "USDA"),
    "usda:167853": ("pork spareribs, lean and fat, raw", "USDA"),
    # Staples, pulses and coconut
    "usda:168877": ("white long-grain rice, raw", "USDA"),
    "usda:168883": ("white glutinous rice, raw", "USDA"),
    "usda:172420": ("lentils, raw", "USDA"),
    "usda:174256": ("mung beans, mature seeds, raw", "USDA"),
    "usda:175193": ("kidney beans, mature seeds, raw", "USDA"),
    "usda:174270": ("soybeans, mature seeds, raw", "USDA"),
    "usda:174263": ("Spanish peanuts, raw", "USDA"),
    "afcd:AFCD-F002983-per_100g": ("fresh mature coconut flesh", "AFCD"),
    "afcd:AFCD-F002987-per_100g": ("grated desiccated coconut", "AFCD"),
    "usda:170172": ("raw coconut milk", "USDA"),
    "afcd:AFCD-F002982-per_100g": ("coconut cream, regular fat", "AFCD"),
    "afcd:AFCD-F002991-per_100g": ("canned coconut milk, regular fat", "AFCD"),
    "usda:790276": ("corn flour", "USDA"),
    "usda:790214": ("white rice flour", "USDA"),
    "usda:789890": ("wheat all-purpose flour", "USDA"),
    "usda:1104867": ("glutinous rice flour", "USDA"),
    "usda:168895": ("self-rising wheat flour", "USDA"),
    "usda:746784": ("granulated sugar", "USDA"),
    "usda:168833": ("brown sugar", "USDA"),
    "usda:173468": ("table salt", "USDA"),
    # Oils and simple dairy/soy foods
    "usda:171029": ("corn oil", "USDA"),
    "usda:171015": ("palm oil", "USDA"),
    "usda:171411": ("soybean cooking oil", "USDA"),
    "usda:172336": ("canola oil", "USDA"),
    "usda:171017": ("sunflower oil", "USDA"),
    "afcd:AFCD-F004205-per_100g": ("ghee, clarified butter", "AFCD"),
    "afcd:AFCD-F001973-per_100g": ("salted butter", "AFCD"),
    "afcd:AFCD-F009176-per_100g": ("firm tofu", "AFCD"),
    "usda:174272": ("tempeh", "USDA"),
    # Spices, leaveners and commodity spreads
    "afcd:AFCD-F002893-per_100g": ("ground dried chilli", "AFCD"),
    "afcd:AFCD-F009335-per_100g": ("ground dried turmeric", "AFCD"),
    "afcd:AFCD-F003337-per_100g": ("generic curry powder", "AFCD"),
    "afcd:AFCD-F008933-per_100g": ("stock powder or cube", "AFCD"),
    "afcd:AFCD-F000247-per_100g": ("baking powder", "AFCD"),
    "afcd:AFCD-F009606-per_100g": ("dry yeast", "AFCD"),
    "usda:171323": ("fennel seed", "USDA"),
    "afcd:AFCD-F002963-per_100g": ("ground cinnamon", "AFCD"),
    "afcd:AFCD-F002970-per_100g": ("ground cloves", "AFCD"),
    "afcd:AFCD-F002258-per_100g": ("ground cardamom", "AFCD"),
    "afcd:AFCD-F006118-per_100g": ("ground nutmeg", "AFCD"),
    "usda:170929": ("ground mustard seed", "USDA"),
    "afcd:AFCD-F003190-per_100g": ("ground coriander seed", "AFCD"),
    "usda:170931": ("ground black pepper", "USDA"),
    "usda:170933": ("ground white pepper", "USDA"),
    "afcd:AFCD-F003821-per_100g": ("fenugreek seed", "AFCD"),
    "usda:167763": ("raw tamarind", "USDA"),
    "afcd:AFCD-F009081-per_100g": ("pure tamarind paste", "AFCD"),
    "afcd:AFCD-F005309-per_100g": ("generic margarine spread", "AFCD"),
    "afcd:AFCD-F006577-per_100g": ("sweetened and salted peanut butter", "AFCD"),
    "afcd:AFCD-F003466-per_100g": ("butter and edible oil spread", "AFCD"),
    "usda:171009": ("regular mayonnaise", "USDA"),
    "afcd:AFCD-F004600-per_100g": ("berry jam", "AFCD"),
    "usda:325198": ("processed American cheese", "USDA"),
    "afcd:AFCD-F002414-per_100g": ("natural cheddar cheese", "AFCD"),
    "afcd:AFCD-F005648-per_100g": ("whole milk powder", "AFCD"),
    "afcd:AFCD-F005581-per_100g": ("evaporated milk", "AFCD"),
    "afcd:AFCD-F005582-per_100g": ("sweetened condensed milk", "AFCD"),
    # Simple commercial sauces; brand-specific formulation is not asserted.
    "afcd:AFCD-F008026-per_100g": ("commercial oyster sauce", "AFCD"),
    "afcd:AFCD-F008065-per_100g": ("commercial soy sauce", "AFCD"),
    "afcd:AFCD-F008083-per_100g": ("commercial tomato sauce", "AFCD"),
    "usda:171595": ("bottled tomato chilli sauce", "USDA"),
    "usda:168570": ("hot chile peppers, sun-dried", "USDA"),
    "usda:175140": ("Pacific sardine, canned in tomato sauce", "USDA"),
    "usda:171661": ("instant oats, plain, dry", "USDA"),
    "usda:173220": ("natural malted drink mix, dairy-based powder", "USDA"),
    "usda:168088": ("grenadine syrup", "USDA"),
    "usda:167957": ("fruit-flavoured syrup", "USDA"),
    "afcd:AFCD-F001029-per_100g": ("Milo chocolate beverage base powder", "AFCD"),
    "afcd:AFCD-F003130-per_100g": ("regular citrus cordial base", "AFCD"),
    "usda:172718": ("chocolate sandwich cookie, regular", "USDA"),
    "usda:172716": ("commercial chocolate-chip cookie, higher fat", "USDA"),
    "afcd:AFCD-F001215-per_100g": ("plain sweet biscuit", "AFCD"),
    "usda:174973": ("vanilla wafer cookie", "USDA"),
    "afcd:AFCD-F002939-per_100g": ("milk chocolate with nuts", "AFCD"),
    "usda:167947": ("Toblerone milk chocolate with honey and almond nougat", "USDA"),
    "usda:168001": ("milk chocolate coated peanuts", "USDA"),
    # Powdered tea and coffee remain as dry powders, not brewed drinks.
    "usda:173230": ("instant tea powder, unsweetened", "USDA"),
    "usda:171893": ("instant coffee powder", "USDA"),
    # Bread uses generic state and grain descriptors.
    "afcd:AFCD-F001553-per_100g": ("wholemeal bread", "AFCD"),
    "usda:174924": ("white commercially prepared bread", "USDA"),
}


def _load_sources() -> tuple[
    dict[str, dict[str, Any]], dict[str, dict[str, Any]], dict[str, dict[str, Any]]
]:
    usda_payload = json.loads(USDA_PATH.read_text(encoding="utf-8"))
    usda = {f"usda:{row['fdc_id']}": row for row in usda_payload["records"]}
    afcd_payload = json.loads(AFCD_PATH.read_text(encoding="utf-8"))
    afcd = {f"afcd:{row['id']}": row for row in afcd_payload["foods"]}
    myfcd_payload = json.loads(MYFCD_PATH.read_text(encoding="utf-8"))
    myfcd = {f"myfcd:{row['id']}": row for row in myfcd_payload["foods"]}
    return usda, afcd, myfcd


def _validate_targets(
    usda: dict[str, dict[str, Any]],
    afcd: dict[str, dict[str, Any]],
    myfcd: dict[str, dict[str, Any]],
) -> None:
    for food_id, (label, _) in TARGETS.items():
        if food_id.startswith("usda:"):
            source_records = usda
        elif food_id.startswith("afcd:"):
            source_records = afcd
        else:
            source_records = myfcd
        food = source_records.get(food_id)
        if food is None:
            raise KeyError(f"Target {food_id} ({label}) is not in imported source data")
        nutrients = food["nutrients"]
        required = ("energy_kcal", "protein_g", "fat_g", "carbohydrate_g")
        missing = [name for name in required if nutrients.get(name) is None]
        if missing:
            raise ValueError(f"Target {food_id} ({label}) misses required nutrients: {missing}")


def _build_rules() -> dict[str, tuple[str, str]]:
    rules: dict[str, tuple[str, str]] = {}

    def add(codes: str, target: str, rationale: str) -> None:
        for code in _codes(codes):
            rules[code] = (target, rationale)

    # Raw chicken and turkey (live animals stay unmatched).
    add("1,2", "usda:171447", "Cleaned chicken is represented by a generic broiler meat-and-skin raw profile; brand/grade is not asserted.")
    add("1127", "usda:171081", "Turkey is matched to whole turkey meat and skin raw; imported origin and grade are not asserted.")
    add("1550", "usda:172373", "Chicken drumstick is matched to the same raw cut with meat and skin.")
    add("1551", "usda:171474", "Chicken breast/keel is matched to a raw breast meat-and-skin profile.")
    add("1552", "usda:172385", "Chicken thigh is matched to the same raw cut with meat and skin.")
    add("1553", "usda:172378", "Whole chicken leg is matched to a raw leg meat-and-skin profile.")
    add("1804", "usda:172390", "Chicken wing is matched to the same raw cut with meat and skin.")

    # Fish and shellfish where the source species/state is sufficiently close.
    add("1391", "afcd:AFCD-F007422-per_100g", "Banana prawn is matched to AFCD banana prawn flesh raw.")
    add("1555,849", "afcd:AFCD-F007433-per_100g", "White prawn is matched to AFCD generic green prawn flesh raw; farm/size is not asserted.")
    add("1919", "afcd:AFCD-F007433-per_100g", "Large white prawn is matched to generic prawn flesh raw; size is not a nutrient basis.")
    add("850", "afcd:AFCD-F007424-per_100g", "Tiger prawn is matched to AFCD raw tiger prawn; farm/size is not asserted.")
    add("1437", "usda:175142", "Sea bass is matched to USDA mixed-species sea bass raw.")
    add("1438,79,82", "usda:173673", "Spanish mackerel items are matched to Spanish mackerel raw; local size and cut do not change the species basis.")
    add("71", "afcd:AFCD-F007973-per_100g", "Fresh selayang/sardine is matched to whole sardine raw; local size and Australian origin are not asserted.")
    add("1476,55", "afcd:AFCD-F005268-per_100g", "Indian mackerel is matched to AFCD mackerel raw; local size is not asserted.")
    add("1554,1915,51,60", "afcd:AFCD-F008359-per_100g", "Red snapper is matched to AFCD snapper fillet raw; slices are treated as the same edible fish tissue.")
    add("49", "usda:174192", "Croaker is matched to USDA Atlantic croaker raw.")
    add("65", "usda:171962", "Grouper is matched to USDA mixed-species grouper raw.")
    add("845", "usda:174223", "Squid is matched to USDA mixed-species squid raw.")
    add("1920", "usda:174214", "Clams are matched to USDA mixed-species clam raw.")
    add("88", "usda:174186", "Catfish is matched to USDA channel catfish raw; farm/origin is not asserted.")
    add("89,1921", "usda:175176", "Tilapia is matched to USDA tilapia raw; colour and size are not asserted.")

    # Produce and fruit.
    add("129,1440,1441,1931", "usda:790646", "Yellow/common onion origin is not nutrition-distinct in this generic profile.")
    add("131,132,1442,1443,1444,1933", "usda:170499", "Shallot is matched to shallot raw; import origin is not asserted.")
    add("1564", "usda:1104647", "Garlic is matched to garlic raw; import origin is not asserted.")
    add("104,105,1396,1458", "usda:169975", "Common cabbage is matched to cabbage raw; import origin is not asserted.")
    add("1412,1482", "usda:169979", "Chinese cabbage is matched to Chinese pe-tsai raw.")
    add("109", "usda:170393", "Carrot is matched to carrot raw.")
    add("112,1923", "usda:169228", "Eggplant is matched to eggplant raw; local shape is not asserted.")
    add("1128", "afcd:AFCD-F002239-per_100g", "Green capsicum is matched to AFCD green capsicum raw.")
    add("1129", "afcd:AFCD-F002247-per_100g", "Red capsicum is matched to AFCD red capsicum raw.")
    add("1130", "afcd:AFCD-F010259-per_100g", "Yellow capsicum is matched to AFCD yellow capsicum raw.")
    add("113", "usda:168409", "Cucumber is matched with peel, raw.")
    add("114", "usda:170457", "Tomato is matched to red ripe tomato raw.")
    add("1399,1400", "usda:169246", "Leek is matched to leek raw; import origin is not asserted.")
    add("1479", "usda:747447", "Broccoli is matched to broccoli raw.")
    add("1481", "usda:169986", "Cauliflower is matched to cauliflower raw.")
    add("1556", "afcd:AFCD-F008761-per_100g", "Green spinach is matched to mature spinach raw.")
    add("1557", "afcd:AFCD-F008761-per_100g", "Red spinach has no separate imported profile; mature spinach raw is used with an explicit generic disclaimer.")
    add("1558", "usda:169256", "Mustard greens are matched to mustard greens raw.")
    add("1559", "afcd:AFCD-F008763-per_100g", "Water spinach is matched to AFCD water spinach raw.")
    add("1561", "afcd:AFCD-F008806-per_100g", "Mung bean sprouts are matched to bean sprouts raw.")
    add("1560", "usda:169404", "Kailan is matched to Chinese broccoli raw; cultivar and import origin are not asserted.")
    add("1818", "usda:170476", "Winged beans are matched to immature seeds raw.")
    add("1922", "usda:169988", "Celery is matched to celery raw.")
    add("1925,716", "afcd:AFCD-F002896-per_100g", "Green bird's-eye chilli is matched to green chilli raw; cultivar is not asserted.")
    add("1926,1927", "afcd:AFCD-F002896-per_100g", "Green AKAR chilli is matched to green chilli raw; cultivar is not asserted.")
    add("92", "afcd:AFCD-F002896-per_100g", "Green chilli is matched to green chilli raw.")
    add("93,94", "afcd:AFCD-F002901-per_100g", "Red chilli is matched to red chilli raw; cultivar is not asserted.")
    add("96", "usda:169260", "Okra is matched to okra raw.")
    add("97", "usda:169961", "French beans are matched to green snap beans raw.")
    add("98", "usda:169222", "Long beans are matched to yardlong bean raw.")

    # Malaysian catalogue names identify these forms more precisely than the
    # generic USDA entries above: bayam is amaranth, kacang botol is the pod,
    # and halia basah is fresh ginger root.
    add("1556", "myfcd:MFC-97-105089", "Bayam hijau is matched to MyFCD green amaranth (Amaranthus viridis), raw.")
    add("1557", "myfcd:MFC-97-105093", "Bayam merah is matched to MyFCD red amaranth (Amaranthus gangeticus), raw.")
    add("1818", "myfcd:MFC-97-105007", "Kacang botol is matched to MyFCD four-angled winged bean pods, raw; the catalogue item is the pod rather than immature seeds.")
    add("95", "myfcd:MFC-97-114030", "Halia basah (tua) is matched to MyFCD fresh ginger root, raw.")
    add("1928", "usda:168155", "Calamansi is represented by the closest small citrus raw profile; the specific cultivar is not present.")
    add("1131", "usda:170026", "Imported potato is matched to potato flesh and skin raw; origin is not asserted.")
    add("160", "usda:170027", "Russet potato is matched to russet potato flesh and skin raw.")
    add("861", "usda:170028", "Holland potato is matched to white potato flesh and skin raw; cultivar is not asserted.")
    add("1132", "usda:168155", "Lime is matched to lime raw.")
    add("1485", "usda:168203", "Granny Smith apple is matched to apple raw with skin.")
    add("1486", "usda:168201", "Red Delicious apple is matched to apple raw with skin.")
    add("1487", "usda:169097", "Valencia orange is matched to orange raw; cultivar is not asserted.")
    add("16", "afcd:AFCD-F011001-per_100g", "Papaya is matched to AFCD red papaya peeled raw; local variety is not asserted.")
    add("18,19", "usda:1105314", "Bananas are matched to ripe banana raw; cultivar is not asserted.")
    add("20,21", "usda:167765", "Watermelon is matched to watermelon raw; seed treatment does not alter the edible flesh profile here.")
    add("24", "afcd:AFCD-F005517-per_100g", "Milk watermelon is matched to honeydew melon raw as the closest documented melon flesh type.")
    add("25", "usda:168193", "Pineapple is matched to traditional-variety pineapple raw.")
    add("26,27", "usda:174683", "Red/green grapes are matched to common European-type grapes raw; seeds are not separately quantified.")
    add("31", "usda:168177", "Yellow pear is matched to Asian pear raw.")
    add("38,39", "usda:173044", "Guava is matched to common guava raw; seed descriptor is not a separate source profile.")

    # Meat and eggs.
    add("9,10,1368", "afcd:AFCD-F006001-per_100g", "Bone-in mutton is matched to an untrimmed raw mutton leg profile; origin/box size is not asserted.")
    add("11,12", "afcd:AFCD-F005983-per_100g", "Boneless mutton excluding leg is matched to untrimmed raw mutton shoulder, preserving the non-leg limitation.")
    add("1367", "afcd:AFCD-F006001-per_100g", "Bone-in mutton leg is matched to untrimmed raw mutton leg.")
    add("1369", "afcd:AFCD-F004243-per_100g", "Local goat is matched to goat meat, all cuts, untrimmed raw; local origin is not asserted.")
    add("1907,1908,1911,1912", "afcd:AFCD-F005017-per_100g", "Lamb bone-in and leg items are matched to untrimmed raw lamb leg; origin and box size are not asserted.")
    add("1909,1910", "afcd:AFCD-F005125-per_100g", "Boneless lamb excluding leg is represented by untrimmed raw lamb strips; exact trade cut is not asserted.")
    add("1370,1371,1372,1373,1431,1432,1913", "usda:168694", "Beef cuts are represented by a raw beef round lean-and-fat profile; exact local trim and grade are not asserted.")
    add("14,1374,1375,1376,1377,1378,1914", "afcd:AFCD-F001921-per_100g", "Buffalo is represented by raw riverine buffalo topside; exact local cut/species subtype is not asserted.")
    add("1379", "usda:167812", "Pork belly is matched to pork belly raw.")
    add("1380", "usda:167810", "Pork lean-and-fat is matched to a raw composite pork cut profile.")
    add("1381", "usda:167816", "Pure lean pork is matched to raw pork leg lean only.")
    add("1383", "usda:167853", "Pork ribs are matched to raw pork spareribs lean and fat.")
    add("1109,1110,1111,118,119,120,1930", "afcd:AFCD-F003729-per_100g", "Chicken egg grades and free-range wording are represented by whole chicken egg raw; grade/origin is not asserted.")
    add("124", "usda:172191", "Quail egg is matched to quail egg whole fresh raw.")
    add("125", "usda:172189", "Duck egg is matched to duck egg whole fresh raw.")

    # Beans, grains, coconut and flour.
    add("1419,1420,1422", "usda:172420", "Lentils are matched to lentils raw; import origin and cultivar are not asserted.")
    add("152", "usda:174256", "Mung beans are matched to mature seeds raw.")
    add("1943", "usda:175193", "Red beans are matched to kidney beans mature seeds raw.")
    add("1944", "usda:174270", "Soybeans are matched to mature seeds raw.")
    add("368", "usda:174263", "Peanuts are matched to Spanish peanuts raw; origin is not asserted.")
    add("101", "afcd:AFCD-F002983-per_100g", "Whole coconut is matched to fresh mature coconut flesh; shell weight is not part of the edible basis.")
    add("102", "afcd:AFCD-F002983-per_100g", "Fresh grated coconut is represented by the fresh mature coconut flesh profile; grating does not change the edible raw flesh basis, and desiccated coconut is not asserted.")
    add("103", "usda:170172", "Fresh coconut milk is matched to raw coconut milk expressed from grated meat and water.")
    add("1929", "afcd:AFCD-F002982-per_100g", "Concentrated coconut milk is matched to regular-fat coconut cream; concentration is generic and not brand-specific.")
    add("1445,1581,1582,1583,1822,1823,1824,1825,1826,1832,1833,1902,1951,2004,904,992", "usda:168877", "Branded white rice is mapped to raw white long-grain rice; brand, origin and cultivar-specific differences are not asserted.")
    add("1474", "usda:168877", "Basmati rice is represented by raw white long-grain rice because no Basmati record is in the selected imports; this is explicitly generic.")
    add("1491,1492", "usda:168883", "Glutinous rice is matched to raw white glutinous rice; brand/origin is not asserted.")
    add("1498", "usda:790276", "Corn flour is matched to yellow fine corn flour.")
    add("1591", "usda:790214", "Rice flour is matched to white unenriched rice flour.")
    add("1593,1827,1870,917", "usda:789890", "Packaged wheat flour is matched to generic all-purpose wheat flour; brand and enrichment differences are not asserted.")
    add("1594", "usda:1104867", "Glutinous rice flour is matched to glutinous rice flour.")
    add("1849", "usda:168895", "Self-raising flour is matched to self-rising wheat flour.")
    add("1587,1589,1590", "usda:746784", "White/granulated sugar is matched to USDA granulated sugar; brand/granularity is not asserted.")
    add("1588", "usda:168833", "Brown sugar is matched to USDA brown sugar; brand/moisture is not asserted.")
    add("1605", "usda:173468", "Packaged table salt is matched to table salt; iodisation is not asserted.")

    # Oils and dairy/spreads.
    add("1086,1087,1088,1089,1090,1595,1596,1597,246", "usda:171029", "Corn oil brand is mapped to generic corn oil; brand formulation is not asserted.")
    add("1091,1092,1093,1094,1095,1100,1101,1598,1599,1600,1601,1602,1934,1935,1936,1937,1938,1939,1940,1941,1942,254,257,260,263,266,267,918", "usda:171015", "Palm or blended cooking oil is represented by generic palm oil; brand blend and refinement are not asserted.")
    add("1603,271", "afcd:AFCD-F004205-per_100g", "Ghee is matched to AFCD clarified butter/ghee; brand is not asserted.")
    add("1609,1615", "afcd:AFCD-F001973-per_100g", "Salted butter is matched to AFCD salted butter; brand is not asserted.")
    add("1140,1141,205,206", "afcd:AFCD-F005309-per_100g", "Margarine brands are represented by generic margarine spread; fat profile and brand formula are not asserted.")
    add("1144,1606", "afcd:AFCD-F006577-per_100g", "Peanut butter is represented by generic sweetened/salted peanut butter; brand recipe is not asserted.")
    add("1607,1608,1829", "afcd:AFCD-F003466-per_100g", "Butter spreads are represented by generic butter and edible-oil spread; brand recipe is not asserted.")
    add("1872", "usda:171009", "Mayonnaise is represented by regular mayonnaise; brand recipe is not asserted.")
    add("201", "afcd:AFCD-F004600-per_100g", "Strawberry/berry jam is represented by generic berry jam; sugar and fruit ratios are not asserted.")
    add("2013,204", "usda:325198", "Processed cheese slices are represented by generic processed American cheese; brand formula is not asserted.")
    add("203", "afcd:AFCD-F002414-per_100g", "Cheddar cheese spread is represented by natural regular-fat cheddar; spread formulation is not asserted.")
    add("1945", "afcd:AFCD-F009176-per_100g", "Firm tofu is matched to AFCD firm tofu as purchased.")
    add("1946", "usda:174272", "Tempeh is matched to USDA tempeh; package brand is not asserted.")
    add("1463,1871,1952,320", "afcd:AFCD-F005581-per_100g", "Evaporated dairy products are represented by AFCD evaporated milk; brand and fat grade are not asserted.")
    add("1618,1873,1953,388,883,884", "afcd:AFCD-F005582-per_100g", "Sweetened creamer/condensed milk is represented by AFCD sweetened condensed milk; brand and exact formulation are not asserted.")
    add("1619,1954,2008,332,344,919", "afcd:AFCD-F005648-per_100g", "Plain milk powder is represented by AFCD whole milk powder; brand and fortification differences are not asserted.")

    # Simple seasoning and bread products.
    add("1125,1881,364", "afcd:AFCD-F002893-per_100g", "Chilli powder is represented by AFCD dried ground chilli; brand is not asserted.")
    add("155", "afcd:AFCD-F002893-per_100g", "Unwrapped chilli powder is represented by dried ground chilli.")
    add("1568,1569,1570,1571,1572,1573,1575,1576,1838,1839,350", "afcd:AFCD-F003337-per_100g", "Curry powder is represented by generic curry powder; blend recipe and brand are not asserted.")
    add("1543,2011", "afcd:AFCD-F008933-per_100g", "Soup cube is represented by generic stock powder/cube; sodium and brand recipe can differ.")
    add("154,1924,367", "afcd:AFCD-F009335-per_100g", "Turmeric powder is represented by dried ground turmeric; brand is not asserted.")
    add("1566,1567,346", "afcd:AFCD-F003337-per_100g", "Unwrapped curry/korma spice is represented by generic curry powder; blend recipe is not asserted.")
    add("347", "afcd:AFCD-F008933-per_100g", "Unwrapped soup spice is represented by generic stock powder/cube; recipe is not asserted.")
    add("1605", "usda:173468", "Salt is represented by table salt.")
    add("343", "afcd:AFCD-F002963-per_100g", "Cinnamon is represented by dried ground cinnamon.")
    add("863", "usda:171323", "Fennel is represented by fennel seed.")
    add("864", "afcd:AFCD-F002970-per_100g", "Cloves are represented by dried ground cloves.")
    add("866", "afcd:AFCD-F002258-per_100g", "Cardamom is represented by dried ground cardamom.")
    add("868", "afcd:AFCD-F006118-per_100g", "Nutmeg is represented by dried ground nutmeg.")
    add("869", "usda:170929", "Mustard seed is represented by ground mustard seed; seed preparation differences are not asserted.")
    add("870", "afcd:AFCD-F003190-per_100g", "Coriander seed is represented by dried ground coriander seed.")
    add("871", "usda:170931", "Black pepper is represented by ground black pepper.")
    add("873", "usda:170933", "White pepper is represented by ground white pepper.")
    add("896", "afcd:AFCD-F003821-per_100g", "Fenugreek is represented by dried fenugreek seed.")
    add("1080,1947", "afcd:AFCD-F000247-per_100g", "Baking powder is represented by generic baking powder; brand formula is not asserted.")
    add("1616,1950", "afcd:AFCD-F009606-per_100g", "Instant yeast is represented by dry yeast; brand is not asserted.")
    add("1494,1586,1949", "afcd:AFCD-F001553-per_100g", "Wholemeal bread is represented by AFCD wholemeal bread; brand formulation is not asserted.")
    add("272", "usda:174924", "White sandwich bread is represented by generic commercially prepared white bread; brand formulation is not asserted.")
    add("929", "usda:171893", "Nescafe Classic is represented by unsweetened instant coffee powder; brand/roast is not asserted.")
    add("1151,1610,1611,1612", "afcd:AFCD-F002991-per_100g", "Packaged coconut milk is represented by regular-fat canned coconut milk; brand and stabilizer formulation are not asserted.")
    add("1899,1900", "usda:168570", "Dried whole chilli is matched to sun-dried hot chile peppers; stem/shape is not a separate nutrient profile.")
    add("1142,190,191,192,193", "usda:175140", "Sardines in tomato sauce are represented by USDA Pacific sardines canned in tomato sauce; brand/chilli level is not asserted.")
    add("1070,1097,1137,218,957", "usda:171595", "Commercial chilli sauces are represented by bottled tomato chilli sauce; brand recipe is not asserted.")
    add("1114,1116,1117,1138", "afcd:AFCD-F008026-per_100g", "Commercial oyster sauces are represented by generic oyster sauce; brand recipe is not asserted.")
    add("1115,1135,1136,1828,1837,2012,212,214,215", "afcd:AFCD-F008065-per_100g", "Soy sauces are represented by commercial soy sauce; sweet/salty brand formulations are not asserted.")
    add("1139,217", "afcd:AFCD-F008083-per_100g", "Tomato sauces are represented by commercial tomato sauce; brand recipe is not asserted.")
    add("1489,1604", "afcd:AFCD-F009081-per_100g", "Packaged tamarind is matched to pure tamarind paste; seed/pulp preparation and brand formulation are not asserted.")
    add("1402", "usda:173220", "Horlicks malt powder is represented by a natural dairy-based malted drink mix; brand fortification and recipe are not asserted.")
    add("1636,1637", "afcd:AFCD-F001029-per_100g", "Plain Milo packets are represented by AFCD Milo chocolate beverage base powder; package size and brand batch are not asserted.")
    add("1964", "usda:171661", "Plain instant oatmeal is represented by fortified plain dry instant oats; package formulation and fortification are not asserted.")
    add("171", "afcd:AFCD-F003130-per_100g", "Orange cordial is represented by a generic regular citrus cordial base; dilution and brand recipe are not asserted.")
    add("1854", "usda:168088", "Grenadine cordial is represented by generic grenadine syrup; brand recipe is not asserted.")
    add("910", "usda:167957", "Rose cordial is represented by generic fruit-flavoured syrup; brand recipe and dilution are not asserted.")
    add("1691,1692", "usda:172718", "Chocolate sandwich biscuits are represented by a generic regular chocolate sandwich cookie; brand recipe and package size are not asserted.")
    add("1693,1696", "usda:172716", "Chocolate-chip biscuits are represented by a generic commercially prepared higher-fat chocolate-chip cookie; hazelnut/mini format and brand recipe are not asserted.")
    add("1697", "afcd:AFCD-F001215-per_100g", "Milk biscuits are represented by a generic plain sweet biscuit; brand recipe is not asserted.")
    add("1893", "usda:174973", "Vanilla wafer biscuits are represented by a generic vanilla wafer; brand recipe is not asserted.")
    add("1699", "afcd:AFCD-F002939-per_100g", "Hazelnut milk chocolate is represented by generic milk chocolate with nuts; brand recipe and nut ratio are not asserted.")
    add("1701", "usda:167947", "Toblerone milk chocolate is represented by the matching generic Toblerone milk chocolate with honey and almond nougat record.")
    add("1704", "usda:168001", "Chocolate-coated roasted peanuts are represented by generic milk chocolate coated peanuts; brand recipe is not asserted.")
    # MyFCD local species and preparation records supersede broad imports when
    # the catalogue names the same Malaysian food and state.
    add("1436", "myfcd:MFC-97-110008", "Kerisi is matched to MyFCD Japanese threadfin bream raw.")
    add("1475", "myfcd:MFC-97-110064", "White pomfret is matched to the MyFCD raw white pomfret record.")
    add("43", "myfcd:MFC-97-110062", "Black pomfret is matched to the MyFCD raw black pomfret record.")
    add("1917,66", "myfcd:MFC-97-110045", "Parang is matched to MyFCD raw wolf herring; local size and cut are not asserted.")
    add("1918", "myfcd:MFC-97-110083", "Terubok is matched to MyFCD raw longtail shad.")
    add("68", "myfcd:MFC-97-110097", "Pari is matched to MyFCD raw stingray.")
    add("69", "myfcd:MFC-97-110103", "Selar kuning is matched to MyFCD raw yellow-banded trevally.")
    add("71", "myfcd:MFC-97-110074", "Selayang/sardin is matched to MyFCD raw sardine (pucuk tamban).")
    add("73", "myfcd:MFC-97-110100", "Senangin is matched to MyFCD raw threadfin.")
    add("78", "myfcd:MFC-97-110044", "Tamban beluru is represented by MyFCD raw round herring; local variant is not asserted.")
    add("83", "myfcd:MFC-97-110105", "Tongkol/aya is matched to MyFCD raw little tuna/bonito (aya).")
    add("87", "myfcd:MFC-97-110092", "Haruan is matched to MyFCD raw snakehead.")
    add("1437", "myfcd:MFC-97-110061", "Siakap is matched to MyFCD raw sea perch (Lates calcarifer).")
    add("1438,79,82", "myfcd:MFC-97-110052", "Tenggiri batang is matched to MyFCD raw barred Spanish mackerel.")
    add("1476,55", "myfcd:MFC-97-110053", "Kembung is matched to MyFCD raw Indian mackerel.")
    add("49", "myfcd:MFC-97-110047", "Gelama is represented by MyFCD raw brown jewfish; local size is not asserted.")
    add("65", "myfcd:MFC-97-110022", "Kerapu is matched to MyFCD raw coral cod/grouper.")
    add("845", "myfcd:MFC-97-110025", "Sotong is matched to MyFCD fresh raw cuttlefish.")
    add("1920", "myfcd:MFC-97-110019", "Kerang is matched to MyFCD raw clam (lala).")
    add("88", "myfcd:MFC-97-110014", "Keli is matched to MyFCD raw catfish.")
    add("89", "myfcd:MFC-97-110006", "Black tilapia is matched to MyFCD raw African bream/tilapia.")
    add("1921", "myfcd:MFC-97-110007", "Red tilapia is matched to MyFCD raw red African bream/tilapia.")
    add("1554,60", "myfcd:MFC-97-110094", "Ikan merah is matched to MyFCD raw red snapper.")
    add("1915,51", "myfcd:MFC-97-110093", "Jenahak is matched to MyFCD raw golden-striped snapper.")
    add("148", "myfcd:MFC-97-110002", "Peeled dried anchovy is matched to MyFCD dried headless and gutted anchovy.")
    add("1562", "myfcd:MFC-97-110067", "Dried shrimp is matched to MyFCD salted dried prawn.")
    add("1563", "myfcd:MFC-97-110026", "Dried squid is matched to MyFCD dried cuttlefish.")
    add("1142,190,191,192,193", "myfcd:MFC-97-110075", "Canned sardines are matched to MyFCD canned sardine; brand and sauce recipe are not asserted.")
    add("22", "myfcd:MFC-CUR-R106035", "Red dragon fruit is matched to the MyFCD red dragon fruit record.")
    add("1819", "myfcd:MFC-97-114029", "Galangal is matched to MyFCD fresh galangal root.")
    add("1820,1821", "myfcd:MFC-97-109004", "Salted egg is matched to MyFCD whole salted duck egg; brand and egg size are not asserted.")
    # Local spices retain their dry powder/seed state from MyFCD.
    add("1125,1881,364,155", "myfcd:MFC-97-114020", "Chilli powder is matched to MyFCD dried chilli; brand and grind are not asserted.")
    add("1568,1569,1570,1571,1572,1573,1575,1576,1838,1839,350,1566,1567,346", "myfcd:MFC-97-114027", "Curry powder is matched to MyFCD curry powder; blend recipe and brand are not asserted.")
    add("343", "myfcd:MFC-97-114021", "Cinnamon is matched to MyFCD cinnamon.")
    add("864", "myfcd:MFC-97-114022", "Cloves are matched to MyFCD clove.")
    add("866", "myfcd:MFC-97-114019", "Cardamom is matched to MyFCD cardamom.")
    add("870", "myfcd:MFC-97-114023", "Coriander seed is matched to MyFCD coriander seed.")
    add("869", "myfcd:MFC-97-114033", "Mustard seed is matched to MyFCD mustard seed.")
    add("873", "myfcd:MFC-97-114035", "White pepper powder is matched to MyFCD white pepper powder.")
    add("896", "myfcd:MFC-97-114028", "Fenugreek is matched to MyFCD fenugreek seed.")
    add("1489,1604", "myfcd:MFC-97-114038", "Packaged tamarind is matched to MyFCD tamarind paste; seed/pulp preparation and brand are not asserted.")
    # Expanded packaged drinks and dry/fresh noodle categories.
    add("1355", "myfcd:MFC-CUR-R113024", "100 Plus is represented by MyFCD isotonic drink per 100 ml; brand flavour and formulation are not asserted.")
    add("1505", "myfcd:MFC-97-111016", "UHT chocolate milk is matched to MyFCD UHT chocolate milk; brand and fortification are not asserted.")
    add("1506", "myfcd:MFC-97-111017", "UHT full-cream milk is matched to MyFCD UHT full-cream milk; brand is not asserted.")
    add("1507,1547,228", "usda:174852", "Packaged regular cola is represented by generic carbonated cola; brand and sweetener formulation are not asserted.")
    add("1651,221", "afcd:AFCD-F008721-per_100g", "Packet soy drinks are represented by regular unsweetened soy beverage; brand sugar level and fortification are not asserted.")
    add("1852,1959,224", "myfcd:MFC-97-111007", "Fresh milk products are matched to MyFCD fresh cow milk; brand and fat grade are not asserted.")
    add("225", "afcd:AFCD-F005614-per_100g", "Marigold HL milk is represented by AFCD reduced-fat cow milk; brand fortification is not asserted.")
    add("1879", "usda:173205", "Seven Up lemon-lime soda is represented by generic caffeine-free lemon-lime soda; brand recipe is not asserted.")
    add("1880,1955,2020", "myfcd:MFC-CUR-R111061", "Strawberry yogurt is matched to MyFCD flavoured yogurt; brand and fat grade are not asserted.")
    add("226", "afcd:AFCD-F008438-per_100g", "Lychee packet drink is represented by generic fruit-flavour soft drink; brand recipe is not asserted.")
    add("229,230,232", "usda:174854", "Orange sodas are represented by generic carbonated orange soda; brand recipe is not asserted.")
    add("235,236", "afcd:AFCD-F004114-per_100g", "Packaged orange juices are represented by generic orange fruit drink; brand and juice concentration are not asserted.")
    add("239,240", "afcd:AFCD-F008421-per_100g", "Energy drinks are represented by a generic Red Bull style energy drink; brand and honey/caffeine formulation are not asserted.")
    add("1493,1585,2003", "myfcd:MFC-97-101028", "Dry bihun is matched to MyFCD dry rice mee-hoon; brand and grain formulation are not asserted.")
    add("1483", "myfcd:MFC-97-101062", "Wet yellow noodles are matched to MyFCD wet wheat noodles; brand and alkaline formulation are not asserted.")
    add("1484", "myfcd:MFC-97-101026", "Wet kuey teow is matched to MyFCD rice noodle/kuih-teow; brand and preparation are not asserted.")
    add("1050,1710,1905,1976,1977,1978", "afcd:AFCD-F006055-per_100g", "Flavoured dry instant noodles are represented by AFCD instant wheat noodles, flavoured, dry and uncooked; brand seasoning recipe is not asserted.")
    return rules


def _food_row(
    food_id: str,
    usda: dict[str, dict[str, Any]],
    afcd: dict[str, dict[str, Any]],
    myfcd: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    if food_id.startswith("usda:"):
        row = usda[food_id]
    elif food_id.startswith("afcd:"):
        row = afcd[food_id]
    else:
        row = myfcd[food_id]
    source = (
        "USDA FoodData Central"
        if food_id.startswith("usda:")
        else "Australian Food Composition Database"
        if food_id.startswith("afcd:")
        else "Malaysian Food Composition Database"
    )
    if food_id.startswith("usda:"):
        return {
            # Keep the public id format used by the combined nutrition
            # document.  The importer key above remains source-local.
            "id": f"USDA-{row['fdc_id']}",
            "source": "usda",
            "source_record_id": row["fdc_id"],
            "description": row["description"],
            "basis": row["basis"],
            "url": row["source_url"],
            "nutrients": row["nutrients"],
            "source_name": source,
        }
    if food_id.startswith("afcd:"):
        return {
            # AFCD ids already carry the per-100-g basis and are kept verbatim
            # so mappings join the imported source records without
            # normalization.
            "id": row["id"],
            "source": "afcd",
            "source_record_id": row["id"],
            "description": row["description"],
            "basis": row["basis"],
            "url": row["url"],
            "nutrients": row["nutrients"],
            "source_name": source,
        }
    return {
        "id": row["id"],
        "source": "myfcd",
        "source_record_id": row["id"],
        "description": row["description"],
        "basis": row["basis"],
        "url": row["source_url"],
        "nutrients": row["nutrients"],
        "source_name": source,
    }


def build() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    usda, afcd, myfcd = _load_sources()
    _validate_targets(usda, afcd, myfcd)
    rules = _build_rules()
    with CATALOGUE_PATH.open(encoding="utf-8-sig", newline="") as catalogue_file:
        rows = list(csv.DictReader(catalogue_file))
    mappings: list[dict[str, Any]] = []
    unmatched: list[dict[str, Any]] = []
    for item in rows:
        code = item.get("item_code", "").strip()
        name = item.get("item_name", "").strip()
        category = item.get("item_category", "").strip()
        if not name or code == "-1":
            continue
        if category in PARENT_CATEGORIES:
            unmatched.append({"item_code": code, "item_name": name, "category": category, "reason": "parent_owned_category"})
            continue
        if category in NON_FOOD_CATEGORIES:
            unmatched.append({"item_code": code, "item_name": name, "category": category, "reason": "non_food"})
            continue
        if category in INFANT_CATEGORIES:
            unmatched.append({"item_code": code, "item_name": name, "category": category, "reason": "infant_formula_or_child_formula_excluded"})
            continue
        rule = rules.get(code)
        if rule is None:
            reason = "ambiguous_or_no_exact_generic_source"
            if category in {"BISKUT", "COKLAT", "MAKANAN RINGAN", "MAKANAN BAYI", "MAKANAN SEGERA", "IKAN DALAM TIN", "REMPAH RATUS (BERBUNGKUS)", "BAHAN-BAHAN MINUMAN"}:
                reason = "multi_ingredient_or_preparation_mismatch"
            unmatched.append({"item_code": code, "item_name": name, "category": category, "reason": reason})
            continue
        target, rationale = rule
        food = _food_row(target, usda, afcd, myfcd)
        mappings.append(
            {
                "item_code": code,
                "food_id": food["id"],
                "match_type": "generic",
                "rationale": rationale,
                "status": "approved",
                "source": food["source"],
                "source_record_id": food["source_record_id"],
                "source_description": food["description"],
                "source_url": food["url"],
                "basis": food["basis"],
                "nutrients": food["nutrients"],
            }
        )
    return mappings, unmatched


def main() -> None:
    mappings, unmatched = build()
    MAPPINGS_PATH.write_text(json.dumps(mappings, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    UNMATCHED_PATH.write_text(json.dumps(unmatched, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"approved mappings: {len(mappings)}")
    print(f"unmatched rows: {len(unmatched)}")
    print(f"wrote {MAPPINGS_PATH}")
    print(f"wrote {UNMATCHED_PATH}")


if __name__ == "__main__":
    main()
