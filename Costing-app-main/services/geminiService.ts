
import { GoogleGenAI, Type } from "@google/genai";
import { RecipeData } from "../types";
import { getMockRecipeData } from './mockData';
const _getViteEnv = () => (typeof import.meta !== 'undefined' ? (import.meta as any).env : {} as any);
const _useMocks = (_getViteEnv()?.VITE_USE_MOCKS === 'true');
const _useNode = (_getViteEnv()?.VITE_USE_NODE !== 'false');
const _apiBase = _getViteEnv()?.VITE_API_BASE || '';

export const extractRecipeData = async (dataBase64: string, mimeType: string): Promise<RecipeData> => {
  const apiKey = (process.env.API_KEY || process.env.GEMINI_API_KEY || '') as string;
  if (_useNode) {
    const resp = await fetch(`${_apiBase}/api/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataBase64, mimeType })
    });
    if (!resp.ok) {
      let msg = `API error: ${resp.status}`;
      try { const j = await resp.json(); if (j && j.error) msg = j.error; } catch {}
      throw new Error(msg);
    }
    return await resp.json();
  }
  if (_useMocks) {
    return getMockRecipeData(mimeType);
  }
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY. Create .env.local in the project root with GEMINI_API_KEY=your_key');
  }
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: mimeType,
            data: dataBase64.split(',')[1] || dataBase64
          }
        },
        {
          text: `Perform a deep technical and financial analysis of this recipe. 
          
          TASK:
          1. Extract ingredient details (name, qty, unit).
             - Handle variations in units and quantities robustly (e.g., 'bunch of cilantro' -> qty: 1, unit: 'bunch', name: 'cilantro').
             - If quantity is a fraction (e.g., '1/2'), convert it to a decimal (0.5).
             - If quantity is a range (e.g., '1-2'), use the average (1.5).
             - If quantity is missing but implied (e.g., 'salt to taste'), set qty to 0 and unit to 'to taste'.
             - Separate the numeric quantity from the unit (e.g., '250g' -> qty: 250, unit: 'g').
             - STRICT FORMATTING RULES: NEVER output raw string arrays, brackets, or isolated quotation marks (e.g., do not output " fresh cassava ","1 kilogram "). Clean up the ingredient names so they are natural and readable.
          2. Use GOOGLE SEARCH to find current real-time market prices in AUSTRALIAN DOLLARS (AUD) for each ingredient.
          3. Focus search on major Australian suppliers: Woolworths, Coles, PFD Food Services, Auxico, CWB, and Greenlands.
          4. Map the 'unitCost' to the current AUD market price found per unit (e.g., per KG or per Liter).
          5. Identify the "PORTION" or "PAX" count (e.g., if it says PORTION 10.00, portions is 10).
          6. Set the 'currency' field strictly to 'AUD'.
          7. The goal is to determine the EXACT COST PER PLATE sold.
          8. AUTOMATICALLY COMPUTE and append structured backend analysis based on the concepts in "Practical Food & Beverage Cost Control" by Clement Ojugo:
             - structural stability (FSDI, acid balance score, fragility risk)
             - yield conversion (raw→trim→cook %, portion scaling, cost factor, portion multiplier)
             - cost intelligence (cost per portion, contribution margin, food cost %, potential vs actual variance, break-even point in covers)
             - inventory intelligence (recommended turnover ratio, target average age in days, par level guidance)
             - menu engineering (classification: Star/Puzzle/Plowhorse/Dog, popularity index, contribution rank)
             - procurement forecast
             - control protocols (specific SOPs like "Blind taste test", "Butcher test", "FIFO rotation", "Bottle-for-bottle exchange" if beverage)
          
          Provide the output in the specified JSON format. Ensure all costs are in AUD.`
        }
      ]
    },
    config: {
      tools: [{ googleSearch: {} }],
      thinkingConfig: { thinkingBudget: 32768 },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          recipeName: { type: Type.STRING },
          recipeId: { type: Type.STRING },
          protocolVersion: { type: Type.STRING },
          timestamp: { type: Type.STRING },
          yield: { type: Type.STRING },
          portions: { type: Type.NUMBER },
          prepTime: { type: Type.STRING },
          cookingTime: { type: Type.STRING },
          chefName: { type: Type.STRING },
          proposedSellingPrice: { type: Type.NUMBER },
          currency: { type: Type.STRING },
          ingredients: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                itemCode: { type: Type.STRING },
                name: { type: Type.STRING },
                unit: { type: Type.STRING },
                qty: { type: Type.NUMBER },
                unitCost: { type: Type.NUMBER },
                marketSource: { type: Type.STRING }
              },
              required: ["name", "unit", "qty"]
            }
          },
          instructions: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          ccp: { type: Type.STRING },
          storageInstructions: { type: Type.STRING },
          allergens: { type: Type.ARRAY, items: { type: Type.STRING } },
          analysis: {
            type: Type.OBJECT,
            properties: {
              structuralStability: {
                type: Type.OBJECT,
                properties: {
                  fsdi: { type: Type.NUMBER },
                  acidBalance: { type: Type.NUMBER },
                  fragilityRisk: { type: Type.STRING }
                }
              },
              yieldConversion: {
                type: Type.OBJECT,
                properties: {
                  rawToTrimCookRatio: { type: Type.STRING },
                  portionScalingFactor: { type: Type.NUMBER },
                  costFactor: { type: Type.NUMBER },
                  portionMultiplier: { type: Type.NUMBER }
                }
              },
              costIntelligence: {
                type: Type.OBJECT,
                properties: {
                  costPerPortion: { type: Type.NUMBER },
                  contributionMargin: { type: Type.NUMBER },
                  foodCostPercentage: { type: Type.NUMBER },
                  potentialVsActualVariance: { type: Type.STRING },
                  breakEvenPointCovers: { type: Type.NUMBER }
                }
              },
              inventoryIntelligence: {
                type: Type.OBJECT,
                properties: {
                  recommendedTurnoverRatio: { type: Type.NUMBER },
                  targetAverageAgeDays: { type: Type.NUMBER },
                  parLevelGuidance: { type: Type.STRING }
                }
              },
              menuEngineering: {
                type: Type.OBJECT,
                properties: {
                  classification: { type: Type.STRING },
                  popularityIndex: { type: Type.NUMBER },
                  contributionRank: { type: Type.NUMBER }
                }
              },
              procurementForecast: { type: Type.STRING },
              controlProtocols: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
          }
        },
        required: ["recipeName", "ingredients", "portions", "currency"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("Intelligence engine returned no data.");
  
  const parsedData = JSON.parse(text) as RecipeData;

  // Extract grounding URLs if present
  const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (groundingChunks) {
    parsedData.sourceUrls = groundingChunks
      .filter((chunk: any) => chunk.web)
      .map((chunk: any) => ({
        uri: chunk.web.uri,
        title: chunk.web.title
      }));
  }

  // Compute Unit Economics
  parsedData.unit_economics = computeUnitEconomics(parsedData);

  return parsedData;
};

const computeUnitEconomics = (data: RecipeData): any => {
  const rent_monthly = 4000;
  const insurance_quarterly = 8000;
  const admin_monthly = 500;
  const electricity_monthly = 500;
  const water_monthly = 400;
  const gas_monthly = 600;
  const logistics_monthly = 800;
  const delivery_monthly = 400;
  const wage_weekday_per_hour_including_super = 55;
  const wage_weekend_per_hour_including_super = 75;

  const insurance_monthly = insurance_quarterly / 3;
  const overhead_monthly = rent_monthly + insurance_monthly + admin_monthly + electricity_monthly + water_monthly + gas_monthly + logistics_monthly + delivery_monthly;
  
  // Volume assumptions (defaults to null if not provided)
  // In this app, we don't have a global settings object yet, so we use nulls for now as requested for fail-open
  const projected_total_plates_per_month = null; 
  const operating_days_per_month = null;
  const operating_hours_per_day = null;
  const avg_plates_per_hour = null;

  let overhead_per_plate: number | null = null;
  let allocation_method: "plates_per_month" | "plates_per_hour" | "none" = "none";

  if (projected_total_plates_per_month && projected_total_plates_per_month > 0) {
    overhead_per_plate = overhead_monthly / projected_total_plates_per_month;
    allocation_method = "plates_per_month";
  } else if (operating_days_per_month && operating_hours_per_day && avg_plates_per_hour && 
             operating_days_per_month > 0 && operating_hours_per_day > 0 && avg_plates_per_hour > 0) {
    const operating_hours_monthly = operating_days_per_month * operating_hours_per_day;
    const overhead_per_hour = overhead_monthly / operating_hours_monthly;
    overhead_per_plate = overhead_per_hour / avg_plates_per_hour;
    allocation_method = "plates_per_hour";
  }

  // Per-item inputs
  const totalBatchCost = data.ingredients.reduce((acc, ing) => acc + (ing.qty * (ing.unitCost || 0)), 0);
  const cogs_food_per_plate = totalBatchCost / (data.portions || 1);
  const packaging_per_plate = 0; // Default
  const labor_minutes_per_plate_weekday = 0; // Default
  const labor_minutes_per_plate_weekend = 0; // Default
  const selling_price = data.proposedSellingPrice || 0;
  const monthly_units_projection = null;

  const weekday_rate_per_min = wage_weekday_per_hour_including_super / 60;
  const weekend_rate_per_min = wage_weekend_per_hour_including_super / 60;
  const weekday_labor_cost = labor_minutes_per_plate_weekday * weekday_rate_per_min;
  const weekend_labor_cost = labor_minutes_per_plate_weekend * weekend_rate_per_min;

  const direct_cost_per_plate = cogs_food_per_plate + packaging_per_plate;

  const true_cost_weekday = overhead_per_plate !== null ? direct_cost_per_plate + weekday_labor_cost + overhead_per_plate : null;
  const true_cost_weekend = overhead_per_plate !== null ? direct_cost_per_plate + weekend_labor_cost + overhead_per_plate : null;

  let profit_weekday = null;
  let profit_weekend = null;
  let profit_margin_weekday_pct = null;
  let profit_margin_weekend_pct = null;

  if (selling_price > 0 && true_cost_weekday !== null && true_cost_weekend !== null) {
    profit_weekday = selling_price - true_cost_weekday;
    profit_weekend = selling_price - true_cost_weekend;
    profit_margin_weekday_pct = profit_weekday / selling_price;
    profit_margin_weekend_pct = profit_weekend / selling_price;
  }

  const overhead_absorbed_monthly = (monthly_units_projection && overhead_per_plate !== null) ? overhead_per_plate * monthly_units_projection : null;

  const unit_economics = {
    overhead_monthly,
    overhead_per_plate,
    allocation_method,
    direct_cost_per_plate,
    labor: {
      weekday_rate_per_hour: wage_weekday_per_hour_including_super,
      weekend_rate_per_hour: wage_weekend_per_hour_including_super,
      weekday_minutes_per_plate: labor_minutes_per_plate_weekday,
      weekend_minutes_per_plate: labor_minutes_per_plate_weekend,
      weekday_labor_cost,
      weekend_labor_cost
    },
    true_cost_per_plate: { weekday: true_cost_weekday, weekend: true_cost_weekend },
    profit_per_plate: { weekday: profit_weekday, weekend: profit_weekend },
    profit_margin_pct: { weekday: profit_margin_weekday_pct, weekend: profit_margin_weekend_pct },
    overhead_absorption: { monthly_units_projection, overhead_absorbed_monthly },
    assumptions: [
      "insurance_monthly = insurance_quarterly/3",
      "overhead includes rent, insurance, admin, electricity, water, gas, logistics, delivery",
      "overhead allocation uses projected_total_plates_per_month when available"
    ]
  };

  // Minimal tests as requested
  console.assert(Math.abs(overhead_monthly - 9866.666) < 1, "Overhead monthly calculation mismatch");
  
  return unit_economics;
};




