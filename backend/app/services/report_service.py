import io
import json
from datetime import datetime
from pathlib import Path

import pandas as pd
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.services.ai_service import AIService, build_context
from app.services.dataset_reader_service import DatasetReaderService


REPORT_PROMPT = """Eres un analista senior de datos generando un reporte ejecutivo.
Recibirás un resumen estadístico de un dataset.
Debes responder EXCLUSIVAMENTE en formato JSON con esta estructura exacta:

{
  "executive_summary": "texto del resumen ejecutivo en 2-3 oraciones",
  "findings": ["hallazgo 1", "hallazgo 2", "..."],
  "risks": ["riesgo 1", "riesgo 2", "..."],
  "recommendations": ["recomendación 1", "recomendación 2", "..."],
  "conclusions": "texto de conclusiones en 2-3 oraciones"
}

NO inventes datos. Usa solo la información proporcionada. Responde en español. No incluyas texto fuera del JSON."""


def generate_pdf_report(dataset_id: int) -> io.BytesIO:
    """Genera un reporte PDF profesional para un dataset."""
    reader = DatasetReaderService()
    dataset_service = None
    try:
        from app.database.session import SessionLocal
        from app.models.dataset import Dataset
        session = SessionLocal()
        dataset = session.get(Dataset, dataset_id)
        session.close()
    except Exception:
        dataset = None

    if dataset is None:
        raise ValueError(f"Dataset {dataset_id} not found")

    df = reader.read(dataset.file_path)
    context = build_context(df)

    # Solicitar reporte a DeepSeek
    ai = AIService()
    try:
        report_data = ai._call(REPORT_PROMPT, json.dumps(context, ensure_ascii=False))
    except Exception:
        report_data = {
            "executive_summary": "No se pudo generar el análisis IA.",
            "findings": [],
            "risks": [],
            "recommendations": [],
            "conclusions": "",
        }

    # Construir PDF
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("Title", parent=styles["Title"], fontSize=22, spaceAfter=6)
    subtitle_style = ParagraphStyle("Subtitle", parent=styles["Heading2"], fontSize=14, spaceAfter=4, textColor=colors.HexColor("#1e40af"))
    heading_style = ParagraphStyle("Heading", parent=styles["Heading2"], fontSize=13, spaceBefore=12, spaceAfter=6, textColor=colors.HexColor("#1e3a5f"))
    body_style = styles["Normal"]
    body_style.fontSize = 10

    now = datetime.now()

    elements = []

    # ===== PORTADA =====
    elements.append(Spacer(1, 3 * cm))
    elements.append(Paragraph("FlowInsight AI", title_style))
    elements.append(Paragraph("Reporte Inteligente de Análisis de Datos", subtitle_style))
    elements.append(Spacer(1, 1 * cm))
    elements.append(Paragraph(f"<b>Dataset:</b> {dataset.original_filename}", body_style))
    elements.append(Paragraph(f"<b>Fecha:</b> {now.strftime('%d/%m/%Y')}", body_style))
    elements.append(Paragraph(f"<b>Hora:</b> {now.strftime('%H:%M')}", body_style))
    elements.append(Spacer(1, 2 * cm))

    # ===== RESUMEN DEL DATASET =====
    elements.append(Paragraph("Resumen del Dataset", heading_style))
    quality = reader.evaluate_quality(dataset.file_path)
    kpi_data = [
        ["Total de filas", str(context["total_rows"])],
        ["Total de columnas", str(context["total_columns"])],
        ["Quality Score", f'{quality["quality_score"]}/100'],
        ["Columnas numéricas", str(context["numeric_statistics"] and len(context["numeric_statistics"]) or 0)],
        ["Columnas categóricas", str(len(context.get("top_categories", {})))],
    ]
    kpi_table = Table(kpi_data, colWidths=[5 * cm, 5 * cm])
    kpi_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f0f4ff")),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("PADDING", (0, 0), (-1, -1), 6),
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ])
    )
    elements.append(kpi_table)
    elements.append(Spacer(1, 0.5 * cm))

    # ===== RESUMEN EJECUTIVO =====
    elements.append(Paragraph("Resumen Ejecutivo", heading_style))
    elements.append(Paragraph(report_data.get("executive_summary", ""), body_style))
    elements.append(Spacer(1, 0.3 * cm))

    # ===== HALLAZGOS =====
    elements.append(Paragraph("Hallazgos Principales", heading_style))
    for finding in report_data.get("findings", []):
        elements.append(Paragraph(f"• {finding}", body_style))
    elements.append(Spacer(1, 0.3 * cm))

    # ===== RIESGOS =====
    elements.append(Paragraph("Riesgos Detectados", heading_style))
    risks = report_data.get("risks", [])
    if risks:
        for risk in risks:
            elements.append(Paragraph(f"• {risk}", body_style))
    else:
        elements.append(Paragraph("No se detectaron riesgos significativos.", body_style))
    elements.append(Spacer(1, 0.3 * cm))

    # ===== RECOMENDACIONES =====
    elements.append(Paragraph("Recomendaciones", heading_style))
    recs = report_data.get("recommendations", [])
    if recs:
        for rec in recs:
            elements.append(Paragraph(f"• {rec}", body_style))
    else:
        elements.append(Paragraph("No se generaron recomendaciones.", body_style))
    elements.append(Spacer(1, 0.3 * cm))

    # ===== DASHBOARD RECOMENDADO =====
    elements.append(Paragraph("Dashboard Recomendado", heading_style))
    try:
        dashboard = ai.recommend_dashboard(context)
        charts = dashboard.get("charts", [])
        for chart in charts:
            title = chart.get("title", "Gráfico sin título")
            elements.append(Paragraph(f"• {title}", body_style))
    except Exception:
        elements.append(Paragraph("No se pudo generar el dashboard recomendado.", body_style))
    elements.append(Spacer(1, 0.3 * cm))

    # ===== CONCLUSIONES =====
    elements.append(Paragraph("Conclusiones", heading_style))
    elements.append(Paragraph(report_data.get("conclusions", ""), body_style))
    elements.append(Spacer(1, 1 * cm))

    # ===== PIE =====
    footer_style = ParagraphStyle("Footer", parent=body_style, fontSize=8, textColor=colors.gray)
    elements.append(Paragraph("_" * 70, footer_style))
    elements.append(Paragraph(
        f"Generado automáticamente por FlowInsight AI — {now.strftime('%d/%m/%Y %H:%M')}",
        footer_style,
    ))

    doc.build(elements)
    buffer.seek(0)
    return buffer