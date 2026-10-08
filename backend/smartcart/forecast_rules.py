"""Shared offline/runtime forecast eligibility. Defaults are conservative pilot rules."""
from datetime import date
from math import isfinite

DEFAULT_RULES = dict(min_weeks=104, min_recent_coverage=.9, min_stores=5,
                     max_age_days=21, max_relative_mae=.10, max_composition_rm=.5,
                     max_baseline_mae_ratio=1.0)

def eligibility(coverage, latest, today, rules=None):
    rules = {**DEFAULT_RULES, **(rules or {})}
    if not latest:
        return 'no_history', ['No historical observations for this item and region.']
    if coverage['history_weeks'] < rules['min_weeks']:
        return 'insufficient', ['At least 104 observed weeks are required.']
    reasons = []
    if coverage['recent_coverage'] < rules['min_recent_coverage']: reasons.append('Recent weeks have too many gaps.')
    if coverage['recent_stores'] < rules['min_stores']: reasons.append('Too few recently surveyed stores.')
    if (today-date.fromisoformat(latest)).days > rules['max_age_days']: reasons.append('Historical observations are too old.')
    if not coverage['definition_consistent']: reasons.append('Mixed-brand definition cannot establish a consistent exact package.')
    if coverage['test_paths'] < 3 or coverage['test_relative_mae'] is None or coverage.get('test_complete_paths', 0) < 3: reasons.append('Insufficient chronological backtesting evidence across 4, 8 and 12 weeks.')
    elif coverage['test_relative_mae'] > rules['max_relative_mae']: reasons.append('Held-out forecast errors exceed the quality limit.')
    baseline_ratio = coverage.get('test_baseline_mae_ratio')
    if baseline_ratio is None or baseline_ratio > rules['max_baseline_mae_ratio']:
        reasons.append('Forecasts must perform at least as well as keeping the latest price across every tested horizon.')
    if coverage['composition_shift_rm'] is None: reasons.append('Surveyed-store composition has not been verified.')
    elif coverage['composition_shift_rm'] > rules['max_composition_rm']: reasons.append('Surveyed-store composition is unstable.')
    if coverage.get('require_annual_validation') or rules.get('require_annual_validation'):
        annual_error=coverage.get('test_annual_relative_mae')
        annual_ratio=coverage.get('test_annual_baseline_mae_ratio')
        annual_paths=coverage.get('test_annual_paths')
        if not isinstance(annual_paths,int) or isinstance(annual_paths,bool) or annual_paths<1:
            reasons.append('A complete chronological annual backtest is required.')
        if not isinstance(annual_error,(int,float)) or isinstance(annual_error,bool) or not isfinite(annual_error) or annual_error<0 or annual_error>rules['max_relative_mae']:
            reasons.append('Annual forecast errors must meet the quality limit.')
        if not isinstance(annual_ratio,(int,float)) or isinstance(annual_ratio,bool) or not isfinite(annual_ratio) or annual_ratio<0 or annual_ratio>rules['max_baseline_mae_ratio']:
            reasons.append('Annual forecasts must perform at least as well as keeping the latest price.')
        if coverage.get('test_annual_shape_pass') is not True:
            reasons.append('The annual backtest does not support a repeatable price pattern or stable level.')
    if coverage.get('require_current_shape') or rules.get('require_current_shape'):
        if coverage.get('current_forecast_shape_pass') is not True:
            reasons.append('The current forecast does not preserve the identified price movement or stable level.')
    return ('rejected', reasons) if reasons else ('available', [])
