import pandas as pd

from app.services.dataset_reader_service import DatasetReaderService


class DataService:
    def get_data(
        self,
        file_path: str,
        page: int = 1,
        page_size: int = 50,
        sort_col: str | None = None,
        sort_dir: str = "asc",
        search: str = "",
    ) -> dict:
        reader = DatasetReaderService()
        df = reader.read(file_path)
        total_rows = len(df)

        # Global search across all string columns
        if search and len(df) > 0:
            mask = pd.Series(False, index=df.index)
            for col in df.columns:
                if df[col].dtype == object:
                    mask |= df[col].astype(str).str.contains(search, case=False, na=False)
            df = df[mask]

        filtered_rows = len(df)

        # Sort
        if sort_col and sort_col in df.columns:
            ascending = sort_dir.lower() != "desc"
            df = df.sort_values(by=sort_col, ascending=ascending)

        # Paginate
        start = (page - 1) * page_size
        end = start + page_size
        page_df = df.iloc[start:end]

        records = page_df.to_dict(orient="records")
        # Convert numpy types to Python native types
        clean_records = []
        for rec in records:
            clean_rec = {}
            for k, v in rec.items():
                if pd.isna(v):
                    clean_rec[k] = None
                elif isinstance(v, (pd.Timestamp,)):
                    clean_rec[k] = v.isoformat()
                elif hasattr(v, "item"):  # numpy scalars
                    clean_rec[k] = v.item()
                else:
                    clean_rec[k] = v
            clean_records.append(clean_rec)

        return {
            "records": clean_records,
            "total_rows": total_rows,
            "filtered_rows": filtered_rows,
            "page": page,
            "page_size": page_size,
            "total_pages": max(1, (filtered_rows + page_size - 1) // page_size),
        }