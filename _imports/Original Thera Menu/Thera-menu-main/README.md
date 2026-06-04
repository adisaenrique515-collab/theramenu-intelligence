<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# TheraMenu local development

This app can now run in two modes:

- **Mock mode** for local UI and API-contract development without Gemini
- **Live Gemini mode** for real inference

## 1) Install

```bash
npm install
```

## 2) Create `.env.local`

### Mock mode
```env
VITE_USE_MOCK_DATA=true
VITE_USDA_FDC_API_KEY=your_usda_fooddata_central_key_here
```

### Live Gemini mode
```env
GEMINI_API_KEY=your_key_here
VITE_USE_MOCK_DATA=false
VITE_USDA_FDC_API_KEY=your_usda_fooddata_central_key_here
```

## 3) Run locally

```bash
npm run dev
```

Open the app at `http://localhost:3000`.

## Notes

- In mock mode, the app uses the deterministic clinical engine to build a contract-safe weekly plan.
- Chatbot responses also fall back to a local stub in mock mode.
- Weekly protocols are post-enriched with USDA FoodData Central nutrient data when `VITE_USDA_FDC_API_KEY` is present.
- This is enough to finish front-end flows, mock APIs, and UI validation before wiring live Gemini.

## Build

```bash
npm run build
```

## Type check

```bash
npm run lint
```

## Hospital production readiness

Clinical source-derived readiness requirements and current gaps are documented in:

- `C:\Users\erick\Downloads\Thera-menu-main-patched\Thera-menu-main\docs\hospital-production-readiness.md`
