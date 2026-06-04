import "dotenv/config";
import express from "express";
import cors from "cors";
import { GoogleGenAI, Type } from "@google/genai";
import { getMockRecipeData } from "./mockData.js";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const USE_MOCKS = String(process.env.USE_MOCKS || "").toLowerCase() === "true";

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Health
app.get("/health", (_req, res) => res.json({ ok: true }));

// Extract via Gemini (or mock)
app.post("/api/extract", async (req, res) => {
  try {
    const { dataBase64, mimeType } = req.body || {};
    if (!dataBase64 || !mimeType) {
      return res.status(400).json({ error: "dataBase64 and mimeType are required" });
    }

    if (USE_MOCKS) {
      const data = getMockRecipeData(mimeType);
      return res.json(data);
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Server missing GEMINI_API_KEY" });
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: String(dataBase64).includes(",") ? String(dataBase64).split(",")[1] : dataBase64,
            },
          },
          {
            text: `Perform a deep technical and financial analysis of this recipe. Use AUD. Output JSON exactly matching the expected schema.`,
          },
        ],
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
                  marketSource: { type: Type.STRING },
                },
                required: ["name", "unit", "qty"],
              },
            },
            instructions: { type: Type.ARRAY, items: { type: Type.STRING } },
            ccp: { type: Type.STRING },
            storageInstructions: { type: Type.STRING },
            allergens: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
        },
      },
    });

    const parsed = JSON.parse(response.text());
    return res.json(parsed);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to analyze recipe", detail: String((err && err.message) || err) });
  }
});

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});
