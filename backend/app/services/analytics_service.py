import pandas as pd

from app.services.dataset_reader_service import DatasetReaderService


class AnalyticsService:
    def _classify_columns(self, df: pd.DataFrame) -> tuple[list[str], list[str]]:
        categorical_cols: list[str] = []
        for col in df.columns:
            if pd.api.types.is_bool_dtype(df[col]):
                continue
            if pd.api.types.is_datetime64_any_dtype(df[col]):
                continue
            if pd.api.types.is_numeric_dtype(df[col]):
                continue
            categorical_cols.append(col)
        return categorical_cols, categorical_cols

    def analyze(self, file_path: str) -> dict:
        reader = DatasetReaderService()
        df = reader.read(file_path)

        numeric_cols: list[str] = []
        categorical_cols: list[str] = []
        datetime_cols: list[str] = []
        boolean_cols: list[str] = []

        for col in df.columns:
            if pd.api.types.is_bool_dtype(df[col]):
                boolean_cols.append(col)
            elif pd.api.types.is_datetime64_any_dtype(df[col]):
                datetime_cols.append(col)
            elif pd.api.types.is_numeric_dtype(df[col]):
                numeric_cols.append(col)
            else:
                categorical_cols.append(col)

        cat_stats = self.categorical_statistics(df, categorical_cols)
        num_stats = self.numeric_statistics(df, numeric_cols)
        corr = self.correlation_matrix(df, numeric_cols)
        dt_stats = self.datetime_statistics(df, datetime_cols)
        summary = self.dataset_summary(
            df, file_path, numeric_cols, categorical_cols, datetime_cols, boolean_cols
        )

        return {
            "numeric_columns": numeric_cols,
            "categorical_columns": categorical_cols,
            "datetime_columns": datetime_cols,
            "boolean_columns": boolean_cols,
            "total_numeric": len(numeric_cols),
            "total_categorical": len(categorical_cols),
            "total_datetime": len(datetime_cols),
            "total_boolean": len(boolean_cols),
            "categorical_statistics": cat_stats,
            "numeric_statistics": num_stats,
            "correlation_matrix": corr,
            "datetime_statistics": dt_stats,
            "dataset_summary": summary,
        }

    def categorical_statistics(
        self, df: pd.DataFrame, categorical_cols: list[str]
    ) -> list[dict]:
        stats: list[dict] = []

        for col in categorical_cols:
            counts = df[col].value_counts(dropna=False)
            values = [
                {"label": str(label), "count": int(count)}
                for label, count in counts.items()
            ]
            stats.append({"column": col, "values": values})

        return stats

    def numeric_statistics(
        self, df: pd.DataFrame, numeric_cols: list[str]
    ) -> list[dict]:
        stats: list[dict] = []

        for col in numeric_cols:
            series = df[col]
            q1 = series.quantile(0.25)
            q3 = series.quantile(0.75)

            stats.append({
                "column": col,
                "count": int(series.count()),
                "min": float(series.min()) if pd.notna(series.min()) else None,
                "max": float(series.max()) if pd.notna(series.max()) else None,
                "mean": round(float(series.mean()), 2) if pd.notna(series.mean()) else None,
                "median": float(series.median()) if pd.notna(series.median()) else None,
                "std": round(float(series.std()), 2) if pd.notna(series.std()) else None,
                "q1": float(q1) if pd.notna(q1) else None,
                "q3": float(q3) if pd.notna(q3) else None,
            })

        return stats

    def correlation_matrix(
        self, df: pd.DataFrame, numeric_cols: list[str]
    ) -> dict:
        if len(numeric_cols) < 2:
            return {}

        corr_df = df[numeric_cols].corr(numeric_only=True)
        return corr_df.to_dict()

    def datetime_statistics(
        self, df: pd.DataFrame, datetime_cols: list[str]
    ) -> list[dict]:
        stats: list[dict] = []

        for col in datetime_cols:
            series = df[col]
            stats.append({
                "column": col,
                "min_date": str(series.min()) if pd.notna(series.min()) else None,
                "max_date": str(series.max()) if pd.notna(series.max()) else None,
                "total_records": int(series.count()),
                "unique_dates": int(series.nunique()),
            })

        return stats

    def dataset_summary(
        self,
        df: pd.DataFrame,
        file_path: str,
        numeric_cols: list[str],
        categorical_cols: list[str],
        datetime_cols: list[str],
        boolean_cols: list[str],
    ) -> dict:
        reader = DatasetReaderService()
        quality = reader.evaluate_quality(file_path)

        return {
            "total_columns": len(df.columns),
            "numeric_columns": len(numeric_cols),
            "categorical_columns": len(categorical_cols),
            "datetime_columns": len(datetime_cols),
            "boolean_columns": len(boolean_cols),
            "has_missing_values": bool(df.isna().any().any()),
            "has_duplicates": bool(df.duplicated().any()),
            "quality_score": quality["quality_score"],
        }