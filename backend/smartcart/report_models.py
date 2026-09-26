"""Strict request and response contracts for stateless report generation."""

from __future__ import annotations

from datetime import datetime, timezone
import math
import re
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from pydantic.alias_generators import to_camel

from .categories import BroadCategoryId, SpendingClass


ReportCadence = Literal["weekly", "monthly"]
ReportLocale = Literal["en", "ms"]
ReportCategoryId = BroadCategoryId | Literal["uncategorised"]
REPORT_MAX_TRIPS = 128
REPORT_MAX_LINES = 1_000
REPORT_MAX_ITEM_NAME_LENGTH = 200
REPORT_MAX_BODY_BYTES = 512 * 1024

_ISO_INSTANT = re.compile(
    r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$"
)


class ReportModel(BaseModel):
    """Report-only model base: exact external camelCase fields, no extras."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        extra="forbid",
        populate_by_name=False,
        validate_by_alias=True,
        validate_by_name=False,
    )

    @model_validator(mode="before")
    @classmethod
    def reject_non_camel_case_keys(cls, value: object) -> object:
        if isinstance(value, dict):
            allowed = {field.alias for field in cls.model_fields.values()}
            if any(key not in allowed for key in value):
                raise ValueError("unknown request field")
        return value


class ReportResponseModel(BaseModel):
    """Response models also accept Python field names during construction."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        extra="forbid",
        populate_by_name=True,
        validate_by_alias=True,
        validate_by_name=True,
    )


def parse_report_instant(value: object) -> datetime:
    """Parse the ISO instant format accepted by G3 analytics."""
    if not isinstance(value, str) or not _ISO_INSTANT.fullmatch(value):
        raise ValueError("invalid instant")
    try:
        parsed = datetime.fromisoformat(
            value[:-1] + "+00:00" if value.endswith("Z") else value
        )
        if parsed.tzinfo is None:
            raise ValueError("invalid instant")
        return parsed.astimezone(timezone.utc)
    except (OverflowError, ValueError) as error:
        raise ValueError("invalid instant") from error


def format_report_instant(value: datetime) -> str:
    """Return a canonical, millisecond-precision UTC instant."""
    return value.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace(
        "+00:00", "Z"
    )


def _finite_number(value: object) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError("must be a JSON number")
    try:
        result = float(value)
    except OverflowError as error:
        raise ValueError("must be finite") from error
    if not math.isfinite(result):
        raise ValueError("must be finite")
    return result


class ReportSavingsInput(ReportModel):
    store_choice_impact_rm: float | None
    item_change_impact_rm: float | None
    net_saving_rm: float | None

    @field_validator(
        "store_choice_impact_rm",
        "item_change_impact_rm",
        "net_saving_rm",
        mode="before",
    )
    @classmethod
    def validate_finite_signed_savings(cls, value: object) -> float | None:
        return None if value is None else _finite_number(value)


class ReportSourceCategoryInput(ReportModel):
    """Specific catalogue category snapshot, independent of broad analytics groups."""

    id: Annotated[str, Field(min_length=1, max_length=80)]
    label_en: Annotated[str, Field(min_length=1, max_length=80)]
    label_ms: Annotated[str, Field(min_length=1, max_length=80)]


class ReportBoughtLineInput(ReportModel):
    name: str = Field(max_length=REPORT_MAX_ITEM_NAME_LENGTH)
    category_id: BroadCategoryId | None
    source_category: ReportSourceCategoryInput | None = None
    quantity: Annotated[float, Field(gt=0, allow_inf_nan=False)]
    line_total_rm: Annotated[float | None, Field(ge=0, allow_inf_nan=False)]

    @field_validator("quantity", mode="before")
    @classmethod
    def validate_finite_quantity(cls, value: object) -> float:
        return _finite_number(value)

    @field_validator("line_total_rm", mode="before")
    @classmethod
    def validate_finite_line_total(cls, value: object) -> float | None:
        return None if value is None else _finite_number(value)


class ReportTripInput(ReportModel):
    recorded_at: str
    bought_lines: list[ReportBoughtLineInput]
    estimated_savings: ReportSavingsInput | None

    @field_validator("recorded_at")
    @classmethod
    def validate_recorded_at(cls, value: str) -> str:
        parse_report_instant(value)
        return value


class GenerateReportRequest(ReportModel):
    cadence: ReportCadence
    period_start: str
    period_end: str
    locale: ReportLocale
    time_zone: Literal["Asia/Kuala_Lumpur"]
    trips: list[ReportTripInput] = Field(max_length=REPORT_MAX_TRIPS)

    @field_validator("period_start", "period_end")
    @classmethod
    def validate_period_instant(cls, value: str) -> str:
        parse_report_instant(value)
        return value

    @model_validator(mode="after")
    def validate_total_line_count(self) -> GenerateReportRequest:
        if sum(len(trip.bought_lines) for trip in self.trips) > REPORT_MAX_LINES:
            raise ValueError("too many bought lines")
        return self


class ReportCategorySpending(ReportResponseModel):
    category_id: ReportCategoryId
    spending_class: SpendingClass
    amount_rm: Annotated[float, Field(ge=0, allow_inf_nan=False)]
    partial: bool


class ReportSpecificCategorySpending(ReportResponseModel):
    category_id: Annotated[str, Field(min_length=1, max_length=80)]
    label_en: Annotated[str, Field(min_length=1, max_length=80)]
    label_ms: Annotated[str, Field(min_length=1, max_length=80)]
    amount_rm: Annotated[float, Field(ge=0, allow_inf_nan=False)]
    partial: bool


def _validate_specific_category_order(
    rows: list[ReportSpecificCategorySpending],
) -> None:
    ids = [row.category_id for row in rows]
    if len(ids) != len(set(ids)):
        raise ValueError("duplicate specific category")
    if rows != sorted(rows, key=lambda row: (-row.amount_rm, row.category_id)):
        raise ValueError("invalid specific category order")


class ReportSpendingClassAmount(ReportResponseModel):
    spending_class: SpendingClass
    amount_rm: Annotated[float | None, Field(ge=0, allow_inf_nan=False)]


class ReportComparisonSnapshot(ReportResponseModel):
    period_start: str
    period_end: str
    trip_count: Annotated[int, Field(ge=1)]
    actual_spending_rm: Annotated[float | None, Field(ge=0, allow_inf_nan=False)]
    spending_incomplete: bool
    estimated_net_savings_rm: Annotated[float | None, Field(allow_inf_nan=False)]
    store_choice_impact_rm: Annotated[float | None, Field(allow_inf_nan=False)]
    item_change_impact_rm: Annotated[float | None, Field(allow_inf_nan=False)]
    savings_incomplete: bool
    category_spending: list[ReportCategorySpending]
    specific_category_spending: list[ReportSpecificCategorySpending]
    spending_class_breakdown: list[ReportSpendingClassAmount]

    @model_validator(mode="after")
    def validate_spending_class_order(self) -> ReportComparisonSnapshot:
        expected = ["essential", "discretionary", "mixed_or_unknown"]
        if [item.spending_class for item in self.spending_class_breakdown] != expected:
            raise ValueError("invalid spending class order")
        _validate_specific_category_order(self.specific_category_spending)
        return self


ReportSectionId = Literal["overview", "categories", "savings", "essentials"]
ReportVisualization = Literal[
    "overview-kpis",
    "category-pie",
    "savings-breakdown",
    "spending-class-bar",
]

_SECTION_BINDINGS: tuple[tuple[str, str], ...] = (
    ("overview", "overview-kpis"),
    ("categories", "category-pie"),
    ("savings", "savings-breakdown"),
    ("essentials", "spending-class-bar"),
)
_SPENDING_CLASS_ORDER = ["essential", "discretionary", "mixed_or_unknown"]


class ReportSection(ReportResponseModel):
    id: ReportSectionId
    heading: str
    observation: str
    visualization: ReportVisualization


class ReportNewsletterInsight(ReportResponseModel):
    heading: Annotated[str, Field(min_length=1, max_length=80)]
    body: Annotated[str, Field(min_length=1, max_length=600)]


class ReportNewsletter(ReportResponseModel):
    subject: Annotated[str, Field(min_length=1, max_length=120)]
    preview: Annotated[str, Field(min_length=1, max_length=220)]
    opening: Annotated[str, Field(min_length=1, max_length=1200)]
    insights: list[ReportNewsletterInsight] = Field(max_length=3)
    tip: Annotated[str, Field(max_length=500)] | None


class GeneratedReport(ReportResponseModel):
    id: str
    cadence: ReportCadence
    period_start: str
    period_end: str
    generated_at: str
    trip_count: Annotated[int, Field(ge=0)]
    actual_spending_rm: Annotated[float | None, Field(ge=0, allow_inf_nan=False)]
    spending_incomplete: bool
    estimated_net_savings_rm: Annotated[float | None, Field(allow_inf_nan=False)]
    store_choice_impact_rm: Annotated[float | None, Field(allow_inf_nan=False)]
    item_change_impact_rm: Annotated[float | None, Field(allow_inf_nan=False)]
    savings_incomplete: bool
    category_spending: list[ReportCategorySpending]
    specific_category_spending: list[ReportSpecificCategorySpending]
    spending_class_breakdown: list[ReportSpendingClassAmount]
    comparison: ReportComparisonSnapshot | None
    newsletter: ReportNewsletter
    sections: tuple[ReportSection, ReportSection, ReportSection, ReportSection]
    disclosures: list[str]
    generation_source: Literal["fallback", "llm"]

    @field_validator("period_start", "period_end", "generated_at")
    @classmethod
    def validate_response_instants(cls, value: str) -> str:
        parse_report_instant(value)
        return value

    @model_validator(mode="after")
    def validate_application_owned_sections(self) -> GeneratedReport:
        actual = tuple((section.id, section.visualization) for section in self.sections)
        if actual != _SECTION_BINDINGS:
            raise ValueError("invalid report section bindings")
        if [item.spending_class for item in self.spending_class_breakdown] != _SPENDING_CLASS_ORDER:
            raise ValueError("invalid spending class order")
        _validate_specific_category_order(self.specific_category_spending)
        return self
