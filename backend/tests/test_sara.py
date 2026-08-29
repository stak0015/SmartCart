from smartcart.sara import SARA_CATEGORY_CANDIDATES, is_sara_credit_line


def test_verified_item_flag_wins_over_category() -> None:
    # sara_eligible IS TRUE counts as credit even outside candidate categories
    assert is_sara_credit_line(True, "LAUK") is True
    assert is_sara_credit_line(True, None) is True


def test_candidate_category_counts_as_credit() -> None:
    assert is_sara_credit_line(None, "BERAS") is True
    assert is_sara_credit_line(False, "TELUR") is True


def test_unlisted_category_falls_to_cash() -> None:
    assert is_sara_credit_line(None, "LAUK") is False
    assert is_sara_credit_line(False, "SAYUR-SAYURAN") is False
    assert is_sara_credit_line(None, None) is False


def test_candidate_set_matches_official_list() -> None:
    assert len(SARA_CATEGORY_CANDIDATES) == 38
    # Multi-word and slash-joined categories stay verbatim
    assert "MEE / BIHUN / KUEY TEOW" in SARA_CATEGORY_CANDIDATES
    assert "MEE/KUETIAU" in SARA_CATEGORY_CANDIDATES
    assert "KRIMER DAN SUSU TEPUNG" in SARA_CATEGORY_CANDIDATES
    # Matching is exact and case-sensitive
    assert "beras" not in SARA_CATEGORY_CANDIDATES
