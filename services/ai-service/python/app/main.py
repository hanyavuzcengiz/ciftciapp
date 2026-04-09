from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="agromarket-ai-service")


class PriceRequest(BaseModel):
    category: str
    region: str
    season: str


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/price-suggestion")
def price_suggestion(payload: PriceRequest):
    return {"min": 1000, "max": 1500, "currency": "TRY", "context": payload.model_dump()}


@app.post("/moderate-content")
def moderate_content():
    return {"score": 72, "action": "manual_review"}
