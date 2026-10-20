"""Generate the synthetic invoices used by demo 01, as PDF (input of the workflow) and PNG (preview for the README).

Both files come from the same layout, so the preview shows exactly what the PDF contains.
Every company, number and amount here is invented. Run from the repo root:
    python demo-01-invoice-to-sheet/make_samples.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

HERE = Path(__file__).parent
OUT = HERE / "samples"
PREVIEW = HERE / "example-output"

# vat_rate None = the invoice leaves the VAT line out, so the demo can flag it.
INVOICES = [
    {"file": "inv-2026-0141.pdf", "supplier": "Northwind Building Supplies Ltd", "number": "NW-2026-0141",
     "date": "2026-10-02", "lines": [("Cement bags 25 kg", 40, 6.20), ("Rebar 12 mm, 6 m", 25, 9.80)], "vat_rate": 21},
    {"file": "inv-2026-0142.pdf", "supplier": "Blue Harbor Electrical", "number": "BH-88213",
     "date": "2026-10-05", "lines": [("LED panel 60x60", 12, 24.50), ("Cable 3x2.5 mm, 100 m", 3, 71.00)], "vat_rate": 21},
    {"file": "inv-2026-0143.pdf", "supplier": "Copperline Plumbing Co", "number": "CP-5521",
     "date": "2026-10-09", "lines": [("PEX pipe 20 mm, 50 m", 4, 38.90), ("Ball valve 3/4", 15, 7.40)], "vat_rate": 10},
    {"file": "inv-2026-0144.pdf", "supplier": "Granite & Stone Depot", "number": "GSD-0907",
     "date": "2026-10-14", "lines": [("Porcelain tile 60x120, m2", 36, 18.75)], "vat_rate": None},
]

PAGE_W_MM, PAGE_H_MM = 210, 297


def money(x: float) -> str:
    return f"{x:,.2f} EUR"


def layout(inv: dict) -> list:
    """Text runs as (x_mm, y_mm_from_top, style, size_pt, text), styles regular/bold/italic,
    and rules as ("rule", x1_mm, y_mm, x2_mm)."""
    ops = []
    y = 25
    ops.append((20, y, "bold", 16, inv["supplier"]))
    ops.append((20, y + 5, "regular", 8, "Industrial Estate, Unit 4 · Sample City · VAT ID: XX-000000 (sample)"))
    ops.append(("rule", 20, y + 9, 190))
    y += 19
    for text in ("INVOICE", f"Invoice number: {inv['number']}", f"Invoice date: {inv['date']}",
                 "Bill to: Demo Renovations SL (sample data)"):
        ops.append((20, y, "regular", 10, text))
        y += 6 if text == "INVOICE" else 5
    y += 7
    for x, head in ((20, "Description"), (120, "Qty"), (140, "Unit"), (165, "Amount")):
        ops.append((x, y, "bold", 10, head))
    ops.append(("rule", 20, y + 2, 190))
    net = 0.0
    for desc, qty, unit in inv["lines"]:
        y += 6
        amount = qty * unit
        net += amount
        for x, text in ((20, desc), (120, str(qty)), (140, f"{unit:.2f}"), (165, f"{amount:.2f}")):
            ops.append((x, y, "regular", 10, text))
    ops.append(("rule", 20, y + 3, 190))
    y += 12
    ops.append((120, y, "regular", 10, f"Net amount: {money(net)}"))
    vat = 0.0
    if inv["vat_rate"] is not None:
        vat = round(net * inv["vat_rate"] / 100, 2)
        y += 5
        ops.append((120, y, "regular", 10, f"VAT {inv['vat_rate']}%: {money(vat)}"))
    y += 5
    ops.append((120, y, "bold", 10, f"Total: {money(net + vat)}"))
    ops.append((20, PAGE_H_MM - 15, "italic", 8,
                "Synthetic invoice for a portfolio demo. Not a real company or transaction."))
    return ops


def to_pdf(inv: dict, ops: list) -> None:
    fonts = {"regular": "Helvetica", "bold": "Helvetica-Bold", "italic": "Helvetica-Oblique"}
    c = canvas.Canvas(str(OUT / inv["file"]), pagesize=A4)
    c.setLineWidth(0.5)
    for op in ops:
        if op[0] == "rule":
            _, x1, y, x2 = op
            c.line(x1 * mm, (PAGE_H_MM - y) * mm, x2 * mm, (PAGE_H_MM - y) * mm)
            continue
        x, y, style, size, text = op
        c.setFont(fonts[style], size)
        c.drawString(x * mm, (PAGE_H_MM - y) * mm, text)
    c.save()


def to_png(inv: dict, ops: list, px_per_mm: float = 4.0) -> None:
    files = {"regular": "arial.ttf", "bold": "arialbd.ttf", "italic": "ariali.ttf"}
    img = Image.new("RGB", (round(PAGE_W_MM * px_per_mm), round(PAGE_H_MM * px_per_mm)), "white")
    draw = ImageDraw.Draw(img)
    cache = {}
    for op in ops:
        if op[0] == "rule":
            _, x1, y, x2 = op
            draw.line((x1 * px_per_mm, y * px_per_mm, x2 * px_per_mm, y * px_per_mm), fill="#1d1d1b", width=1)
            continue
        x, y, style, size, text = op
        px = round(size * 0.3528 * px_per_mm)  # points to pixels at this scale
        font = cache.setdefault((style, px), ImageFont.truetype(files[style], px))
        draw.text((x * px_per_mm, y * px_per_mm), text, font=font, fill="#1d1d1b", anchor="ls")
    img.save(PREVIEW / inv["file"].replace(".pdf", ".png"))


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    PREVIEW.mkdir(exist_ok=True)
    for inv in INVOICES:
        ops = layout(inv)
        to_pdf(inv, ops)
        to_png(inv, ops)
    print(f"{len(INVOICES)} invoices written to {OUT} (PDF) and {PREVIEW} (PNG preview)")
