from __future__ import annotations

from pydantic import BaseModel


class Ingredient(BaseModel):
    id: int
    name: str
    category: str | None = None
    allergen_flag: bool


class Method(BaseModel):
    cooking_method: str | None = None
    equipment: str | None = None
    prep_complexity: int | None = None
    labour_intensity: int | None = None


class CommercialScores(BaseModel):
    customer_familiarity: int | None = None
    premium_pricing: int | None = None
    batch_suitability: int | None = None
    holding_reheat: int | None = None
    delivery_suitability: int | None = None
    waste_risk: int | None = None
    cross_utilisation: int | None = None
    commercial_deployability_score: int | None = None


class MonetizationTags(BaseModel):
    ghost_kitchen_fit: int | None = None
    catering_fit: int | None = None
    productization_fit: int | None = None
    safari_lounge_fit: int | None = None
    scarcity_drop_fit: int | None = None
    saas_dataset_fit: int | None = None


class RecipeSummary(BaseModel):
    id: str
    title: str
    source_file: str
    cuisine_family: str | None = None
    dish_category: str | None = None
    summary: str | None = None
    created_at: str
    commercial_deployability_score: int | None = None
    catering_fit: int | None = None
    ghost_kitchen_fit: int | None = None
    productization_fit: int | None = None
    safari_lounge_fit: int | None = None
    scarcity_drop_fit: int | None = None


class RecipeDetail(RecipeSummary):
    ingredients: list[Ingredient] = []
    method: Method | None = None
    scores: CommercialScores | None = None
    monetization: MonetizationTags | None = None
    derived_concepts: list["DerivedConcept"] = []


class DerivedConcept(BaseModel):
    id: int
    recipe_id: str
    recipe_title: str | None = None
    concept_title: str
    concept_type: str | None = None
    original_derivative_description: str | None = None
    business_model: str | None = None
    notes: str | None = None


RecipeDetail.model_rebuild()

