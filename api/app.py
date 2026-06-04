from __future__ import annotations

from fastapi import FastAPI

from api.routes import analytics, audits, concepts, exports, ingredients, recipes, recommendations, scores


app = FastAPI(
    title="Recipe Intelligence API",
    description="Commercial metadata API for recipe intelligence, monetization tags, and derived culinary concepts.",
    version="0.1.0",
)

app.include_router(recipes.router)
app.include_router(ingredients.router)
app.include_router(scores.router)
app.include_router(concepts.router)
app.include_router(recommendations.router)
app.include_router(analytics.router)
app.include_router(exports.router)
app.include_router(audits.router)


@app.get("/")
def root() -> dict:
    return {
        "service": "Recipe Intelligence API",
        "status": "ok",
        "docs": "/docs",
        "endpoints": [
            "/recipes",
            "/recipes/{id}",
            "/recipes/search",
            "/ingredients",
            "/scores/top-commercial",
            "/scores/top-catering",
            "/scores/top-ghost-kitchen",
            "/scores/top-productization",
            "/concepts",
            "/concepts/safari-lounge",
            "/concepts/scarcity-drops",
            "/recommendations/menu",
            "/recommendations/catering",
            "/recommendations/ghost-kitchen",
            "/recommendations/scarcity-drops",
            "/recommendations/safari-lounge",
            "/analytics/cross-utilisation",
            "/exports/notebooklm-pack",
            "/exports/brief",
            "/audits/menu-leak",
            "/audits/white-label-offer",
            "/audits/export",
        ],
    }
