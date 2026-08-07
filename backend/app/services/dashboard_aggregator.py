import pandas as pd


def prepare_chart_data(df: pd.DataFrame, chart: dict) -> dict | None:
    """Prepara los datos agregados para un gráfico recomendado por la IA."""
    chart_type = chart.get("type", "")
    title = chart.get("title", "")
    x = chart.get("x")
    y = chart.get("y")
    column = chart.get("column")
    aggregation = chart.get("aggregation", "")

    try:
        if chart_type == "bar" and x and y:
            if aggregation in ("mean", "sum", "min", "max", "median"):
                grouped = df.groupby(x)[y].agg(aggregation).reset_index()
            else:
                grouped = df.groupby(x)[y].sum().reset_index()
            grouped.columns = ["label", "value"]
            return {
                "type": chart_type,
                "title": title,
                "data": grouped.to_dict(orient="records"),
            }

        if chart_type == "line" and x and y:
            if aggregation in ("mean", "sum", "min", "max", "median"):
                grouped = df.groupby(x)[y].agg(aggregation).reset_index()
            else:
                grouped = df.groupby(x)[y].sum().reset_index()
            grouped.columns = ["label", "value"]
            return {
                "type": chart_type,
                "title": title,
                "data": grouped.to_dict(orient="records"),
            }

        if chart_type == "pie" and column:
            counts = df[column].value_counts(dropna=False).reset_index()
            counts.columns = ["name", "value"]
            return {
                "type": chart_type,
                "title": title,
                "data": counts.to_dict(orient="records"),
            }

        if chart_type == "scatter" and x and y:
            subset = df[[x, y]].dropna()
            return {
                "type": chart_type,
                "title": title,
                "data": [{"x": float(row[x]), "y": float(row[y])} for _, row in subset.iterrows()],
            }

        if chart_type == "histogram" and column:
            series = df[column].dropna()
            if len(series) == 0:
                return None
            cut = pd.cut(series, bins=10, retbins=True)
            counts = cut[0].value_counts().sort_index()
            bins = [f"{cut[1][i]:.2f}-{cut[1][i+1]:.2f}" for i in range(len(cut[1]) - 1)]
            return {
                "type": chart_type,
                "title": title,
                "data": [{"bin": b, "count": int(c)} for b, c in zip(bins, counts.values)],
            }

    except (KeyError, ValueError, TypeError):
        return None

    return None


def prepare_all_charts(df: pd.DataFrame, charts: list[dict]) -> list[dict]:
    """Prepara todos los gráficos del dashboard IA."""
    results: list[dict] = []
    for chart in charts:
        prepared = prepare_chart_data(df, chart)
        if prepared is not None:
            results.append(prepared)
        else:
            results.append({
                "type": chart.get("type", "unknown"),
                "title": chart.get("title", "Gráfico no disponible"),
                "data": [],
                "error": "Este gráfico no pudo generarse porque las columnas recomendadas no existen.",
            })
    return results