import { RecipeData } from "../types";

export const getMockRecipeData = (mimeType: string): RecipeData => {
  const now = new Date().toISOString();

  const ingredients = [
    { name: "Chicken breast", unit: "kg", qty: 1.5, unitCost: 11.99, marketSource: "Coles AU" },
    { name: "Eggs", unit: "each", qty: 6, unitCost: 0.40, marketSource: "Woolworths AU" },
    { name: "Breadcrumbs", unit: "kg", qty: 0.5, unitCost: 5.50, marketSource: "Coles AU" },
    { name: "Parmesan cheese", unit: "kg", qty: 0.3, unitCost: 24.00, marketSource: "Woolworths AU" },
    { name: "Mozzarella", unit: "kg", qty: 0.7, unitCost: 12.00, marketSource: "Woolworths AU" },
    { name: "Tomato passata", unit: "L", qty: 1.2, unitCost: 3.50, marketSource: "Coles AU" },
    { name: "Plain flour", unit: "kg", qty: 0.4, unitCost: 1.80, marketSource: "Coles AU" },
    { name: "Frying oil", unit: "L", qty: 0.6, unitCost: 3.20, marketSource: "PFD AU" },
    { name: "Fresh basil", unit: "bunch", qty: 1, unitCost: 2.00, marketSource: "Woolworths AU" },
    { name: "Salt", unit: "g", qty: 30, unitCost: 0.01, marketSource: "Generic" },
  ];

  const totalBatch = ingredients.reduce((acc, i) => acc + (i.qty * (i.unitCost || 0)), 0);
  const portions = 12;
  const costPerPortion = totalBatch / portions;
  const proposedPrice = 26;

  const data: RecipeData = {
    recipeName: "Chicken Parmigiana",
    recipeId: "MOCK-CP-001",
    protocolVersion: "1.0.0",
    timestamp: now,
    yield: `${portions} portions`,
    portions,
    prepTime: "20m",
    cookingTime: "30m",
    chefName: "Mock Chef",
    proposedSellingPrice: proposedPrice,
    currency: "AUD",
    ingredients,
    instructions: [
      "Butterfly and crumb chicken (flour ? egg ? crumbs)",
      "Shallow-fry until golden; finish in oven",
      "Top with passata, mozzarella, parmesan; bake until bubbling",
      "Garnish with basil and serve"
    ],
    ccp: "Cook chicken to =75°C core temperature",
    storageInstructions: "Hold hot =60°C, or cool rapidly to =5°C within 6h",
    allergens: ["egg", "milk", "gluten"],
    sourceUrls: [
      { uri: "https://www.coles.com.au/", title: "Coles Australia" },
      { uri: "https://www.woolworths.com.au/", title: "Woolworths Australia" },
      { uri: "https://www.pfdfoods.com.au/", title: "PFD Food Services" }
    ],
    analysis: {
      structuralStability: {
        fsdi: 0.82,
        acidBalance: 0.55,
        fragilityRisk: "Medium"
      },
      yieldConversion: {
        rawToTrimCookRatio: "100?95?90%",
        portionScalingFactor: 1.0,
        costFactor: 0.35,
        portionMultiplier: 1.1
      },
      costIntelligence: {
        costPerPortion: parseFloat(costPerPortion.toFixed(2)),
        contributionMargin: parseFloat((proposedPrice - costPerPortion).toFixed(2)),
        foodCostPercentage: parseFloat(((costPerPortion / proposedPrice) * 100).toFixed(2)),
        potentialVsActualVariance: "Within ±2%",
        breakEvenPointCovers: 120
      },
      inventoryIntelligence: {
        recommendedTurnoverRatio: 4.5,
        targetAverageAgeDays: 6,
        parLevelGuidance: "Maintain 2× daily usage for key perishables"
      },
      menuEngineering: {
        classification: 'Star',
        popularityIndex: 74,
        contributionRank: 1
      },
      procurementForecast: "Order ~10kg chicken and 6kg cheese weekly at current volumes.",
      controlProtocols: [
        "Blind taste test for sauce weekly",
        "FIFO rotation",
        "Butcher test for yield",
        "Oil change schedule"
      ]
    }
  };

  return data;
};
