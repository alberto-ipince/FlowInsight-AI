from pathlib import Path

import pandas as pd


class DatasetReaderService:
    def read(self, file_path: str) -> pd.DataFrame:
        extension = Path(file_path).suffix.lower()

        if extension == ".csv":
            df = pd.read_csv(file_path)
        elif extension == ".xlsx":
            df = pd.read_excel(file_path)
        else:
            raise ValueError(f"Unsupported file type: {extension}")

        # Auto-detect date columns
        for col in df.columns:
            if df[col].dtype != object:
                continue
            try:
                converted = pd.to_datetime(df[col], errors="coerce")
                valid_ratio = converted.notna().sum() / max(len(df), 1)
                if valid_ratio >= 0.8:
                    df[col] = converted
            except (ValueError, TypeError):
                continue

        return df

    def profile(self, file_path: str) -> dict:
        df = self.read(file_path)

        column_types = {col: str(dtype) for col, dtype in df.dtypes.items()}
        missing_values = {col: int(df[col].isna().sum()) for col in df.columns}

        return {
            "total_rows": len(df),
            "total_columns": len(df.columns),
            "column_names": list(df.columns),
            "column_types": column_types,
            "missing_values": missing_values,
            "duplicated_rows": int(df.duplicated().sum()),
            "memory_usage_bytes": int(df.memory_usage(deep=True).sum()),
            "preview": df.head(5).to_dict(orient="records"),
        }

    def evaluate_quality(self, file_path: str) -> dict:
        df = self.read(file_path)

        total_rows = max(len(df), 1)
        total_missing = int(df.isna().sum().sum())
        duplicated_rows = int(df.duplicated().sum())

        total_cells = total_rows * len(df.columns)
        missing_pct = (total_missing / total_cells * 100) if total_cells else 0
        duplicated_pct = (duplicated_rows / total_rows * 100) if total_rows else 0

        columns_with_missing = [
            col for col in df.columns if df[col].isna().any()
        ]

        empty_columns = [col for col in df.columns if df[col].isna().all()]

        quality_score = round(
            max(0, 100 - (missing_pct * 1.5) - (duplicated_pct * 1.0)), 1
        )

        return {
            "total_missing_values": total_missing,
            "duplicated_rows": duplicated_rows,
            "duplicated_percentage": round(duplicated_pct, 2),
            "columns_with_missing_values": columns_with_missing,
            "empty_columns": empty_columns,
            "quality_score": quality_score,
        }
