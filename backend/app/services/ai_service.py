import json
from typing import Any

import requests

from app.config.settings import DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL


SYSTEM_PROMPT = """Eres un analista senior de datos.
Recibirás un resumen estadístico de un dataset.
NO inventes información.
Analiza únicamente la información proporcionada.
Debes responder EXCLUSIVAMENTE en formato JSON con la siguiente estructura:
{
  "insights": ["observación 1", "observación 2", ...],
  "recommended_dashboard": ["gráfico recomendado 1", "gráfico recomendado 2", ...],
  "warnings": ["advertencia 1", "advertencia 2", ...]
}
No incluyas texto fuera del JSON."""


DASHBOARD_SYSTEM_PROMPT = """Eres un arquitecto experto en visualización de datos.
Recibirás el contexto de un dataset.
NO inventes columnas. Solo usa las que aparecen en "column_names".
Debes devolver EXCLUSIVAMENTE un JSON válido.
El dashboard debe estar optimizado para comprender rápidamente los datos.
Debes elegir únicamente gráficos compatibles con las columnas existentes.
Elige entre 2 y 8 gráficos.
Usa solo estos tipos: bar, line, scatter, histogram, pie.

Estructura EXACTA de respuesta:
{
  "charts": [
    {
      "type": "bar",
      "title": "título descriptivo",
      "x": "nombre_columna_categórica",
      "y": "nombre_columna_numérica",
      "aggregation": "sum"
    },
    {
      "type": "line",
      "title": "título descriptivo",
      "x": "nombre_columna_datetime",
      "y": "nombre_columna_numérica",
      "aggregation": "count"
    },
    {
      "type": "scatter",
      "title": "título descriptivo",
      "x": "nombre_columna_numérica",
      "y": "nombre_columna_numérica"
    },
    {
      "type": "histogram",
      "title": "título descriptivo",
      "column": "nombre_columna_numérica"
    },
    {
      "type": "pie",
      "title": "título descriptivo",
      "column": "nombre_columna_categórica"
    }
  ]
}"""


class AIService:
    """Servicio que encapsula toda la comunicación con DeepSeek."""

    def __init__(self) -> None:
        self.api_key = DEEPSEEK_API_KEY
        self.base_url = DEEPSEEK_BASE_URL.rstrip("/")
        self.model = DEEPSEEK_MODEL

    def _call(self, system_prompt: str, user_message: str) -> dict[str, Any]:
        """Llamada genérica a la API de DeepSeek."""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            "temperature": 0.3,
            "response_format": {"type": "json_object"},
        }

        response = requests.post(
            f"{self.base_url}/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=60,
        )
        response.raise_for_status()
        data = response.json()
        content = data["choices"][0]["message"]["content"]
        return json.loads(content)

    def analyze_dataset(self, context: dict[str, Any]) -> dict[str, Any]:
        """Analiza un dataset a partir de su contexto estadístico."""
        user_message = json.dumps(context, ensure_ascii=False)
        return self._call(SYSTEM_PROMPT, user_message)

    def chat_dataset(self, context: dict[str, Any], messages: list[dict[str, str]]) -> str:
        """Responde preguntas sobre el dataset usando el historial de conversación."""
        system_prompt = (
            "Eres un analista de datos experto. "
            "Responde preguntas sobre el dataset usando ÚNICAMENTE la información del contexto proporcionado. "
            "NO inventes datos. Si no tienes suficiente información, indícalo claramente. "
            "Sé conciso y directo. "
            "Responde en español."
        )

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": json.dumps(context, ensure_ascii=False)},
                *messages[-6:],
            ],
            "temperature": 0.5,
        }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        response = requests.post(
            f"{self.base_url}/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=60,
        )
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]

    def recommend_dashboard(self, context: dict[str, Any]) -> dict[str, Any]:
        """Genera un dashboard layout a partir del contexto del dataset."""
        user_message = json.dumps(context, ensure_ascii=False)
        return self._call(DASHBOARD_SYSTEM_PROMPT, user_message)


def build_context(df: "pd.DataFrame") -> dict[str, Any]:
    """Construye un JSON compacto de contexto a partir de un DataFrame."""
    import pandas as pd

    total_rows = len(df)

    # Tipos de columnas
    column_types = {col: str(dtype) for col, dtype in df.dtypes.items()}

    # Estadísticas numéricas
    numeric_cols = [col for col in df.columns if pd.api.types.is_numeric_dtype(df[col])]
    numeric_stats: dict[str, dict[str, float | None]] = {}
    for col in numeric_cols:
        series = df[col]
        numeric_stats[col] = {
            "mean": round(float(series.mean()), 2) if pd.notna(series.mean()) else None,
            "median": round(float(series.median()), 2) if pd.notna(series.median()) else None,
            "min": round(float(series.min()), 2) if pd.notna(series.min()) else None,
            "max": round(float(series.max()), 2) if pd.notna(series.max()) else None,
            "std": round(float(series.std()), 2) if pd.notna(series.std()) else None,
        }

    # Valores nulos
    null_counts = {col: int(df[col].isna().sum()) for col in df.columns}
    null_pct = {
        col: round(null_counts[col] / max(total_rows, 1) * 100, 2)
        for col in df.columns
    }

    # Correlaciones numéricas
    corr: dict[str, dict[str, float]] = {}
    if len(numeric_cols) >= 2:
        corr_df = df[numeric_cols].corr(numeric_only=True)
        corr = corr_df.to_dict()

    # Top categorías
    top_categories: dict[str, list[dict[str, Any]]] = {}
    categorical_cols = [
        col for col in df.columns
        if not pd.api.types.is_numeric_dtype(df[col])
        and not pd.api.types.is_datetime64_any_dtype(df[col])
    ]
    for col in categorical_cols:
        counts = df[col].value_counts(dropna=False).head(10)
        top_categories[col] = [
            {"label": str(label), "count": int(count)}
            for label, count in counts.items()
        ]

    # Muestra (primeras 20 filas)
    sample = df.head(20).to_dict(orient="records")
    clean_sample = []
    for rec in sample:
        clean_rec = {}
        for k, v in rec.items():
            if pd.isna(v):
                clean_rec[k] = None
            elif isinstance(v, (pd.Timestamp,)):
                clean_rec[k] = v.isoformat()
            elif hasattr(v, "item"):
                clean_rec[k] = v.item()
            else:
                clean_rec[k] = v
        clean_sample.append(clean_rec)

    return {
        "total_rows": total_rows,
        "total_columns": len(df.columns),
        "column_names": list(df.columns),
        "column_types": column_types,
        "numeric_statistics": numeric_stats,
        "null_counts": null_counts,
        "null_percentage": null_pct,
        "correlation_matrix": corr,
        "top_categories": top_categories,
        "sample": clean_sample,
    }