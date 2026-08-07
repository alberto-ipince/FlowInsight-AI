from pathlib import Path

import pandas as pd

from app.services.etl_service import ETLService


class ETLPipelineService:
    """Servicio que ejecuta múltiples transformaciones del ETLService
    en secuencia sobre un DataFrame."""

    def run_pipeline(
        self, df: pd.DataFrame, steps: list[dict]
    ) -> pd.DataFrame:
        etl = ETLService()
        result = df.copy()

        for step in steps:
            operation = step.get("operation", "")
            params = step.get("params", {})

            if operation == "remove_duplicates":
                result = etl.remove_duplicates(result)
            elif operation == "remove_missing_values":
                result = etl.remove_missing_values(result)
            elif operation == "convert_column_types":
                result = etl.convert_column_types(
                    result, params.get("column_types", {})
                )
            elif operation == "normalize_text":
                result = etl.normalize_text(
                    result, params.get("columns", [])
                )
            elif operation == "rename_columns":
                result = etl.rename_columns(
                    result, params.get("column_mapping", {})
                )
            elif operation == "filter_rows":
                result = etl.filter_rows(
                    result, params.get("query", "")
                )

        return result

    def export_dataframe(
        self, df: pd.DataFrame, output_path: str
    ) -> None:
        extension = Path(output_path).suffix.lower()

        if extension == ".csv":
            df.to_csv(output_path, index=False)
        elif extension == ".xlsx":
            df.to_excel(output_path, index=False)
        else:
            raise ValueError(f"Unsupported export format: {extension}")
