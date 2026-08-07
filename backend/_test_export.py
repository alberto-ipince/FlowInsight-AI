import pandas as pd
from app.services.etl_pipeline_service import ETLPipelineService
import os, glob

df = pd.DataFrame({"name": ["Alice", "Bob"], "age": [25, 30]})

pipeline = ETLPipelineService()

# Export CSV
csv_path = "test_output.csv"
pipeline.export_dataframe(df, csv_path)
print("CSV exists:", os.path.exists(csv_path))
df_csv = pd.read_csv(csv_path)
print("CSV shape:", df_csv.shape)
print("CSV columns:", list(df_csv.columns))

# Export XLSX
xlsx_path = "test_output.xlsx"
pipeline.export_dataframe(df, xlsx_path)
print("XLSX exists:", os.path.exists(xlsx_path))
df_xlsx = pd.read_excel(xlsx_path)
print("XLSX shape:", df_xlsx.shape)
print("XLSX columns:", list(df_xlsx.columns))

# Cleanup
os.unlink(csv_path)
os.unlink(xlsx_path)
print("Files cleaned up")