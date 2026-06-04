#!/usr/bin/env python
from __future__ import annotations

import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "niche_pack" / "Safari_Lounge_Commercial_Fusion_Niche_Pack.md"
OUTPUT = ROOT / "niche_pack" / "Safari_Lounge_Commercial_Fusion_Niche_Pack.pdf"


def esc(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("**", "")
        .strip()
    )


def parse_table(lines: list[str], start: int) -> tuple[list[list[str]], int]:
    rows: list[list[str]] = []
    i = start
    while i < len(lines) and lines[i].strip().startswith("|"):
        line = lines[i].strip()
        cells = [esc(cell) for cell in line.strip("|").split("|")]
        if not all(re.fullmatch(r":?-{3,}:?", cell.strip()) for cell in cells):
            rows.append(cells)
        i += 1
    return rows, i


def build_story() -> list:
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="TitleLarge",
            parent=styles["Title"],
            fontName="Helvetica-Bold",
            fontSize=22,
            leading=27,
            spaceAfter=12,
            textColor=colors.HexColor("#1d2a22"),
        )
    )
    styles.add(
        ParagraphStyle(
            name="ModuleHeading",
            parent=styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=16,
            leading=20,
            spaceBefore=14,
            spaceAfter=8,
            textColor=colors.HexColor("#264f3a"),
        )
    )
    styles.add(
        ParagraphStyle(
            name="ItemHeading",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=13,
            leading=16,
            spaceBefore=10,
            spaceAfter=6,
            textColor=colors.HexColor("#5a2e14"),
        )
    )
    styles.add(
        ParagraphStyle(
            name="BodyTight",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=10.2,
            leading=14,
            spaceAfter=7,
        )
    )
    styles.add(
        ParagraphStyle(
            name="BulletTight",
            parent=styles["BodyText"],
            leftIndent=12,
            firstLineIndent=-8,
            fontSize=10.0,
            leading=13.5,
            spaceAfter=4,
        )
    )

    lines = SOURCE.read_text(encoding="utf-8").splitlines()
    story: list = []
    i = 0
    while i < len(lines):
        raw = lines[i]
        line = raw.strip()
        if not line:
            i += 1
            continue

        if line.startswith("|"):
            data, i = parse_table(lines, i)
            if data:
                table_data = [[Paragraph(cell, styles["BodyTight"]) for cell in row] for row in data]
                table = Table(table_data, repeatRows=1, hAlign="LEFT")
                table.setStyle(
                    TableStyle(
                        [
                            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e8efe9")),
                            ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#1d2a22")),
                            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                            ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#c4cec6")),
                            ("VALIGN", (0, 0), (-1, -1), "TOP"),
                            ("LEFTPADDING", (0, 0), (-1, -1), 4),
                            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                            ("TOPPADDING", (0, 0), (-1, -1), 3),
                            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                        ]
                    )
                )
                story.append(table)
                story.append(Spacer(1, 6))
            continue

        if line.startswith("# "):
            story.append(Paragraph(esc(line[2:]), styles["TitleLarge"]))
        elif line.startswith("## Module "):
            if story:
                story.append(PageBreak())
            story.append(Paragraph(esc(line[3:]), styles["ModuleHeading"]))
        elif line.startswith("## Appendix "):
            if story:
                story.append(PageBreak())
            story.append(Paragraph(esc(line[3:]), styles["ModuleHeading"]))
        elif line.startswith("## "):
            story.append(Paragraph(esc(line[3:]), styles["ModuleHeading"]))
        elif line.startswith("### "):
            if story:
                story.append(PageBreak())
            story.append(Paragraph(esc(line[4:]), styles["ItemHeading"]))
        elif re.match(r"^\d+\.\s", line):
            story.append(Paragraph(esc(line), styles["BulletTight"]))
        elif line.startswith("- "):
            story.append(Paragraph("• " + esc(line[2:]), styles["BulletTight"]))
        else:
            line = re.sub(r"\*\*(.*?)\*\*", r"<b>\1</b>", line)
            story.append(Paragraph(line.replace("&", "&amp;"), styles["BodyTight"]))
        i += 1
    return story


def footer(canvas, doc) -> None:
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#66736a"))
    canvas.drawString(18 * mm, 12 * mm, "Safari Lounge Commercial Fusion Niche Pack")
    canvas.drawRightString(192 * mm, 12 * mm, f"Page {doc.page}")
    canvas.restoreState()


def main() -> int:
    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        rightMargin=15 * mm,
        leftMargin=15 * mm,
        topMargin=16 * mm,
        bottomMargin=18 * mm,
        title="Safari Lounge Commercial Fusion Niche Pack",
        author="Culinary Monetization Intelligence",
    )
    doc.build(build_story(), onFirstPage=footer, onLaterPages=footer)
    print(f"pdf={OUTPUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
