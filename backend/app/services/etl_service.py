import pandas as pd


class ETLService:
    """Servicio responsable de ejecutar transformaciones sobre DataFrames
    utilizando Pandas como parte del pipeline ETL de FlowInsight AI."""

    def remove_duplicates(self, df: pd.DataFrame) -> pd.DataFrame:
        return df.drop_duplicates()

    def remove_missing_values(self, df: pd.DataFrame) -> pd.DataFrame:
        return df.dropna()

    def convert_column_types(
        self, df: pd.DataFrame, column_types: dict[str, str]
    ) -> pd.DataFrame:
        result = df.copy()
        for col, target_type in column_types.items():
            if col not in result.columns:
                continue
            if target_type == "datetime64[ns]":
                result[col] = pd.to_datetime(result[col])
            else:
                result[col] = result[col].astype(target_type)
        return result

    def normalize_text(
        self, df: pd.DataFrame, columns: list[str]
    ) -> pd.DataFrame:
        result = df.copy()
        for col in columns:
            if col not in result.columns:
                continue
            result[col] = (
                result[col].astype(str).str.strip().str.title()
            )
        return result

    def rename_columns(
        self, df: pd.DataFrame, column_mapping: dict[str, str]
    ) -> pd.DataFrame:
        result = df.copy()
        result.rename(columns=column_mapping, inplace=True)
        return result

    def filter_rows(
        self, df: pd.DataFrame, query: str
    ) -> pd.DataFrame:
        result = df.copy()
        return result.query(query)
