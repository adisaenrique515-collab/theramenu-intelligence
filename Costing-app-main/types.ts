
export interface Ingredient {
  itemCode?: string;
  name: string;
  preparation?: string;
  unit: string;
  qty: number;
  unitCost?: number;
  totalCost?: number;
  marketSource?: string; // URL or name of the supplier found
}

export interface RecipeAnalysis {
  structuralStability: {
    fsdi: number;
    acidBalance: number;
    fragilityRisk: string;
  };
  yieldConversion: {
    rawToTrimCookRatio: string;
    portionScalingFactor: number;
    costFactor: number; // Ratio of cost per servable pound to purchase price per pound
    portionMultiplier: number; // Cost factor adjusted for portion size
  };
  costIntelligence: {
    costPerPortion: number;
    contributionMargin: number;
    foodCostPercentage: number;
    potentialVsActualVariance: string; // Expected variance based on industry standards
    breakEvenPointCovers: number; // Number of covers needed to break even on this item's fixed cost allocation
  };
  inventoryIntelligence: {
    recommendedTurnoverRatio: number;
    targetAverageAgeDays: number;
    parLevelGuidance: string;
  };
  menuEngineering: {
    classification: 'Star' | 'Puzzle' | 'Plowhorse' | 'Dog';
    popularityIndex: number; // Predicted popularity based on menu design principles
    contributionRank: number;
  };
  procurementForecast: string;
  controlProtocols: string[]; // Specific SOPs from the book (e.g., "Bottle-for-bottle exchange", "Blind taste test")
}

export interface UnitEconomics {
  overhead_monthly: number;
  overhead_per_plate: number | null;
  allocation_method: "plates_per_month" | "plates_per_hour" | "none";
  direct_cost_per_plate: number;
  labor: {
    weekday_rate_per_hour: number;
    weekend_rate_per_hour: number;
    weekday_minutes_per_plate: number;
    weekend_minutes_per_plate: number;
    weekday_labor_cost: number;
    weekend_labor_cost: number;
  };
  true_cost_per_plate: { weekday: number | null; weekend: number | null };
  profit_per_plate: { weekday: number | null; weekend: number | null };
  profit_margin_pct: { weekday: number | null; weekend: number | null };
  overhead_absorption: { monthly_units_projection: number | null; overhead_absorbed_monthly: number | null };
  assumptions: string[];
}

export interface NutritionTotals { energy_kcal_per_portion?: number; protein_g_per_portion?: number; fat_g_per_portion?: number; carbs_g_per_portion?: number; fiber_g_per_portion?: number; sugar_g_per_portion?: number; sodium_mg_per_portion?: number; satfat_g_per_portion?: number; potassium_mg_per_portion?: number; phosphorus_mg_per_portion?: number; }

export interface RecipeData {
  recipeName: string;
  recipeId: string;
  protocolVersion: string;
  timestamp: string;
  yield: string;
  portions: number;
  prepTime: string;
  cookingTime: string;
  ingredients: Ingredient[];
  instructions: string[];
  chefName: string;
  storageInstructions?: string;
  allergens?: string[];
  ccp?: string;
  proposedSellingPrice?: number;
  estimatedCostPercentage?: number;
  currency?: string; // Defaulting to AUD
  sourceUrls?: { uri: string; title: string }[]; // Grounding sources
  analysis?: RecipeAnalysis;
  totals?: NutritionTotals;
  unit_economics?: UnitEconomics;
}

export enum ViewMode {
  SYNTHESIS = 'SYNTHESIS',
  SPREADSHEET = 'SPREADSHEET',
  PROTOCOLS = 'PROTOCOLS'
}






