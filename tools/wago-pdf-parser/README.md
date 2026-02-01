# WAGO Quote PDF Parser

Python tool to extract product pricing tables and series discounts from WAGO pricing quote PDFs into a structured CSV suitable for import into the WAIGO price-contract flow.

## Implementation

- **`parse_wago_quote_pdf.py`** – Main parser optimized for INIT-style 3-column tables (Part #, Description, Price). Proven to work with real WAGO quote PDFs.
- **`parse_wago_quote_pdf_v1_original.py`** – Original full-featured parser with complex column detection. Available for PDFs with unusual layouts.

## Output

- **DataFrame / CSV** with exactly these columns:
  - **Part Number** – primary WAGO part (including variants like `221-412/K194-4045`); blank for series discounts
  - **Series** – numeric only (e.g. `281`); blank for product rows
  - **Description** – cleaned text (line breaks → `"; "`, excess whitespace removed)
  - **Price** – includes `$`; blank for discount-only rows
  - **Discount** – e.g. `41.5%`; blank for product rows

- **Optional metadata** (when detected on first/last page):
  - Quote Number, Date, Expiration Date, Customer

- **File name:** `quote_<number>_parsed.csv` (or `quote_unknown_parsed.csv` if no quote number found)

## Requirements

- Python 3.8+
- `pdfplumber` (primary), `pandas`

```bash
pip install -r requirements.txt
```

## Usage

### Command line

```bash
python parse_wago_quote_pdf.py path/to/quote.pdf
# Writes quote_<number>_parsed.csv in the same directory as the PDF.

python parse_wago_quote_pdf.py path/to/quote.pdf path/to/output_dir
# Writes quote_<number>_parsed.csv into the given directory.
```

### From Python

```python
from parse_wago_quote_pdf import parse_pdf, save_csv, OUTPUT_COLUMNS

df, metadata = parse_pdf("path/to/quote.pdf")
print(metadata)  # quote_number, date, expiration_date, customer
save_csv(df, "quote_123_parsed.csv")
```

## Behavior

- **Multi-page tables** – Tables on pages 2–8 (and last page for series discounts) are extracted; first page is used for metadata only.
- **Skip rows without price** – Product rows without a detectable price are skipped.
- **Tiered / MOQ pricing** – Kept as separate rows (same Part Number; MOQ or tier can appear in Description).
- **Series discounts** – Lines with a discount % and no price are output as separate rows with Part Number blank, Series and Discount filled.
- **Part numbers** – `/` and parentheses are preserved (e.g. `221-412/K194-4045`). Excess whitespace is cleaned.
- **Description** – Line breaks replaced with `"; "`; whitespace collapsed.

## Layout assumptions

- Quote PDFs are **digital** (not scanned). Scanned PDFs would need OCR; this tool does not perform OCR.
- Tables have a header row containing words like "Part", "Price", "Description". If no header is found, column indices are inferred from content (price/discount patterns).
- Series discount blocks usually appear on the last page; they are detected by presence of discount % and absence of price.

## Error handling

- Missing file → `FileNotFoundError`
- Not a PDF or unreadable → `ValueError` or exception from pdfplumber
- No pricing rows extracted → `ValueError` with message
- Missing `pdfplumber` → `ImportError` with install hint

## Optional: Camelot fallback

For heavily lined tables, you can add `camelot-py[cv]` to `requirements.txt` and enable the camelot fallback in the script (see commented blocks). Camelot requires system dependencies (e.g. Ghostscript, Tk, OpenCV).
