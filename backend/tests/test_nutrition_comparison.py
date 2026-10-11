from copy import deepcopy

from smartcart.nutrition_comparison import compare_category


def drink(sugar=10, energy=40, saturated=0):
    return {'basis': 'per_100g', 'nutrients': {'sugars_g': sugar, 'energy_kcal': energy,
            'fat_g': saturated, 'saturated_fat_g': saturated, 'sodium_mg': 10}}


def test_drinks_select_sugar_from_category_even_when_old_rule_used_energy():
    result, reason = compare_category('P4', drink(), drink(0, 0))
    assert reason is None
    assert result['category'] == 'drinks'
    assert result['nutrient'] == 'sugars_g'


def test_trivial_changes_and_missing_required_values_are_rejected():
    assert compare_category('P3', drink(), drink(9.9, 39))[1] == 'no_meaningful_improvement'
    incomplete = drink(0, 0)
    incomplete['nutrients']['sugars_g'] = None
    assert compare_category('P3', drink(), incomplete)[1] == 'missing_required_nutrients'


def test_zero_fat_drinks_can_compare_when_optional_saturated_fat_is_missing():
    original = drink()
    original['nutrients']['saturated_fat_g'] = None
    result, reason = compare_category('P3', original, drink(0, 0))
    assert reason is None
    assert result['missing_guard_nutrients'] == ['saturated_fat_g']
    assert compare_category('P3', original, drink(0, 0, 2))[1] == 'material_tradeoff'


def test_lower_sugar_cannot_mask_material_saturated_fat_increase():
    assert compare_category('P3', drink(), drink(5, 40, 2))[1] == 'material_tradeoff'


def test_mass_volume_and_concentrates_cannot_compare_without_evidence():
    volume = drink(0, 0)
    volume['basis'] = 'per_100ml'
    assert compare_category('P3', drink(), volume)[1] == 'incompatible_basis'
    assert compare_category('P17', drink(), drink(0, 0))[1] == 'preparation_not_comparable'


def test_absolute_floor_protects_near_zero_percentages():
    assert compare_category('P3', drink(0.2, 1), drink(0, 0))[1] == 'no_meaningful_improvement'


def test_milk_preserves_protein_and_calcium_and_reports_optional_gaps():
    left = {'basis': 'per_100g', 'nutrients': {'energy_kcal': 65, 'fat_g': 4.3, 'protein_g': 3.2, 'calcium_mg': 106}}
    right = {'basis': 'per_100g', 'nutrients': {'energy_kcal': 43, 'fat_g': 1.2, 'protein_g': 3.3, 'calcium_mg': 115}}
    decision, _ = compare_category('H2', left, right)
    assert decision['nutrient'] == 'fat_g'
    assert 'sugars_g' in decision['missing_guard_nutrients']
    richer = deepcopy(left)
    richer['nutrients'].update(protein_g=8, calcium_mg=256)
    assert compare_category('H1', richer, right)[1] == 'material_tradeoff'
