#!/usr/bin/env python3
"""
WAGO Pricing Quote PDF Parser

Extracts product pricing tables and series discounts from WAGO quote PDFs into a
Pandas DataFrame with columns: Part Number, Series, Description, Price, Discount.
Optionally extracts metadata: Quote Number, Date, Expiration Date, Customer.

Designed for digital PDFs; scanned PDFs may require OCR (not included).
"""

import re
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Union

import pandas as pd

# -----------------------------------------------------------------------------
# Primary: pdfplumber (reliable for most digital PDFs)
# -----------------------------------------------------------------------------
try:
    import pdfplumber
    HAS_PDFPLUMBER = True
except ImportError:
    HAS_PDFPLUMBER = False

# Optional fallback for heavily lined tables (uncomment in requirements if needed)
# try:
#     import camelot
#     HAS_CAMELOT = True
# except ImportError:
#     HAS_CAMELOT = False
HAS_CAMELOT = False

# -----------------------------------------------------------------------------
# Output column names (exact spec)
# -----------------------------------------------------------------------------
COL_PART_NUMBER = "Part Number"
COL_SERIES = "Series"
COL_DESCRIPTION = "Description"
COL_PRICE = "Price"
COL_DISCOUNT = "Discount"

OUTPUT_COLUMNS = [COL_PART_NUMBER, COL_SERIES, COL_DESCRIPTION, COL_PRICE, COL_DISCOUNT]

# Patterns for metadata and row classification
RE_QUOTE_NUMBER = re.compile(r"(?:quote|quotation)\s*#?\s*:?\s*([A-Z0-9\-]+)", re.I)
RE_DATE = re.compile(r"(?:date|issued)\s*:?\s*(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})", re.I)
RE_EXPIRATION = re.compile(r"(?:valid|expir|expires?)\s*:?\s*(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})", re.I)
RE_CUSTOMER = re.compile(r"(?:customer|sold\s*to|bill\s*to)\s*:?\s*(.+?)(?:\n|$)", re.I | re.DOTALL)

# Price: optional $, digits, optional .xx
RE_PRICE = re.compile(r"\$\s*([\d,]+(?:\.\d{2})?)")
# Discount: number + %
RE_DISCOUNT = re.compile(r"(\d+(?:\.\d+)?)\s*%")
# Series: numeric only (e.g. 281, 221)
RE_SERIES_NUM = re.compile(r"^\s*(\d{2,4})\s*$")


def _clean_text(s: str) -> str:
    """Replace line breaks with '; ', collapse whitespace."""
    if not s or not isinstance(s, str):
        return ""
    s = str(s).replace("\n", "; ").replace("\r", " ")
    return " ".join(s.split()).strip()


def _clean_part_number(s: str) -> str:
    """Clean part number: preserve '/' and content in parentheses as variant (e.g. 221-412/K194-4045)."""
    if not s or not isinstance(s, str):
        return ""
    s = str(s).strip()
    # Remove only excess internal whitespace; keep / and ()
    s = " ".join(s.split())
    return s


def _extract_price_from_cell(val) -> Optional[str]:
    """Extract price string with $ from cell value (number or string)."""
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    if isinstance(val, (int, float)):
        try:
            return f"{float(val):,.2f}" if float(val) == float(val) else None  # exclude NaN
        except (TypeError, ValueError):
            return None
    s = str(val).strip()
    m = RE_PRICE.search(s)
    if m:
        try:
            n = float(m.group(1).replace(",", ""))
            return f"${n:,.2f}"
        except ValueError:
            return f"${m.group(1)}"
    try:
        n = float(s.replace(",", "").replace("$", "").strip())
        return f"${n:,.2f}"
    except ValueError:
        pass
    return None


def _extract_discount_from_cell(val) -> Optional[str]:
    """Extract discount as 'XX.X%' from cell value."""
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    s = str(val).strip()
    m = RE_DISCOUNT.search(s)
    if m:
        return f"{m.group(1)}%"
    try:
        n = float(s.replace("%", "").replace(",", "").strip())
        return f"{n}%"
    except ValueError:
        pass
    return None


def _series_numeric_only(s: str) -> str:
    """Return numeric-only series (e.g. 281); blank for non-match."""
    if not s or not isinstance(s, str):
        return ""
    s = str(s).strip()
    m = RE_SERIES_NUM.match(s)
    if m:
        return m.group(1)
    # Allow single number from a string like "Series 281"
    digits = re.sub(r"[^\d]", "", s)
    return digits if digits else ""


def _extract_metadata(pdf) -> Dict[str, Optional[str]]:
    """Extract optional metadata from first and last pages (text)."""
    meta = {"quote_number": None, "date": None, "expiration_date": None, "customer": None}
    if not HAS_PDFPLUMBER or pdf is None:
        return meta
    texts = []
    try:
        for i in [0, len(pdf.pages) - 1]:
            if i < len(pdf.pages):
                p = pdf.pages[i]
                t = p.extract_text()
                if t:
                    texts.append(t)
    except Exception:
        pass
    full = "\n".join(texts)
    m = RE_QUOTE_NUMBER.search(full)
    if m:
        meta["quote_number"] = m.group(1).strip()
    m = RE_DATE.search(full)
    if m:
        meta["date"] = m.group(1).strip()
    m = RE_EXPIRATION.search(full)
    if m:
        meta["expiration_date"] = m.group(1).strip()
    m = RE_CUSTOMER.search(full)
    if m:
        meta["customer"] = _clean_text(m.group(1))
    return meta


def _tables_with_pdfplumber(pdf, page_indices: List[int]) -> List[List[List]]:
    """Extract tables from given pages using pdfplumber. Returns list of tables per page."""
    all_tables = []
    for i in page_indices:
        if i >= len(pdf.pages):
            continue
        try:
            page = pdf.pages[i]
            tables = page.extract_tables()
            if tables:
                all_tables.extend(tables)
        except Exception:
            continue
    return all_tables


def _infer_column_indices(header_row: List) -> Dict[str, Optional[int]]:
    """
    Infer column indices for Part Number, Series, Description, Price, Discount
    from a header row (case-insensitive partial match).
    """
    h = [str(c).lower().strip() if c is not None else "" for c in header_row]
    indices = {
        "part": None,
        "series": None,
        "description": None,
        "price": None,
        "discount": None,
    }
    for i, cell in enumerate(h):
        if "part" in cell and ("number" in cell or "no" in cell or "nr" in cell):
            indices["part"] = i
        elif "series" in cell:
            indices["series"] = i
        elif "desc" in cell or "product" in cell:
            indices["description"] = i
        elif "price" in cell or "unit" in cell and "price" in " ".join(h):
            indices["price"] = i
        elif "discount" in cell or "disc" in cell:
            indices["discount"] = i
    # Fallback: assume common order Part, Series, Description, Price, Discount
    if indices["price"] is None and len(h) >= 4:
        indices["price"] = len(h) - 2  # often second-to-last
    if indices["discount"] is None and len(h) >= 5:
        indices["discount"] = len(h) - 1
    return indices


def _infer_column_indices_from_rows(rows: List[List]) -> Dict[str, Optional[int]]:
    """Infer column indices by scanning rows for price/discount patterns when no header."""
    if not rows:
        return {"part": 0, "series": 1, "description": 2, "price": 3, "discount": 4}
    ncols = max(len(r) for r in rows)
    if ncols < 3:
        return {"part": 0, "series": None, "description": 1, "price": 2, "discount": None}
    # Find column that most often has a price ($ or numeric)
    price_counts = [0] * ncols
    discount_counts = [0] * ncols
    for row in rows:
        for i, cell in enumerate(row):
            if i >= ncols:
                break
            v = str(cell).strip() if cell is not None else ""
            if _extract_price_from_cell(cell) is not None or (v and RE_PRICE.search(v)):
                price_counts[i] += 1
            if _extract_discount_from_cell(cell) is not None or (v and RE_DISCOUNT.search(v)):
                discount_counts[i] += 1
    price_idx = max(range(ncols), key=lambda i: price_counts[i]) if max(price_counts) > 0 else ncols - 2
    discount_idx = max(range(ncols), key=lambda i: discount_counts[i]) if max(discount_counts) > 0 else ncols - 1
    return {
        "part": 0,
        "series": 1 if ncols >= 2 else None,
        "description": 2 if ncols >= 3 else 1,
        "price": price_idx,
        "discount": discount_idx,
    }


def _row_has_price(row: List, price_idx: Optional[int]) -> bool:
    """True if row has a non-empty price in the price column."""
    if price_idx is None or price_idx >= len(row):
        return False
    val = row[price_idx]
    return _extract_price_from_cell(val) is not None


def _row_looks_like_series_discount(row: List, indices: Dict[str, Optional[int]]) -> bool:
    """True if row has discount and no price (series discount line)."""
    has_disc = indices.get("discount") is not None and _extract_discount_from_cell(
        row[indices["discount"]] if indices["discount"] < len(row) else None
    ) is not None
    has_price = indices.get("price") is not None and _extract_price_from_cell(
        row[indices["price"]] if indices["price"] < len(row) else None
    ) is not None
    return has_disc and not has_price


def _normalize_row(
    row: List,
    indices: Dict[str, Optional[int]],
    is_series_discount: bool,
) -> Optional[Dict[str, str]]:
    """Convert a table row to one record (dict) for the output DataFrame."""
    def get(i: int, default=""):
        if i is None or i >= len(row):
            return default
        v = row[i]
        return "" if v is None or (isinstance(v, float) and pd.isna(v)) else str(v).strip()

    part = _clean_part_number(get(indices.get("part")))
    series = _series_numeric_only(get(indices.get("series")))
    desc = _clean_text(get(indices.get("description")))
    price_str = None if is_series_discount else _extract_price_from_cell(
        row[indices["price"]] if indices.get("price") is not None and indices["price"] < len(row) else None
    )
    discount_str = _extract_discount_from_cell(
        row[indices["discount"]] if indices.get("discount") is not None and indices["discount"] < len(row) else None
    )

    if is_series_discount:
        # Series discount: Series and Discount filled; Part Number blank, Price blank
        return {
            COL_PART_NUMBER: "",
            COL_SERIES: series or _series_numeric_only(part) or _series_numeric_only(desc),
            COL_DESCRIPTION: desc,
            COL_PRICE: "",
            COL_DISCOUNT: discount_str or "",
        }
    # Product row: must have price (caller should skip rows without price)
    if not price_str:
        return None
    return {
        COL_PART_NUMBER: part,
        COL_SERIES: series,
        COL_DESCRIPTION: desc,
        COL_PRICE: price_str,
        COL_DISCOUNT: discount_str or "",
    }


def _is_header_row(row: List) -> bool:
    """Heuristic: row looks like a header (contains 'part', 'price', etc.)."""
    if not row:
        return False
    combined = " ".join(str(c).lower() for c in row if c)
    return "part" in combined and ("price" in combined or "description" in combined)


def parse_pdf(path: Union[str, Path]) -> Tuple[pd.DataFrame, Dict[str, Optional[str]]]:
    """
    Parse a WAGO quote PDF and return (DataFrame, metadata).

    - Handles multi-page tables (typical quote tables on pages 2–8).
    - Skips rows without a price (for product rows).
    - Preserves tiered/MOQ as separate rows (same Part Number, MOQ in Description).
    - Detects series discount lines (discount %, no price) and outputs them with
      Part Number blank, Series and Discount filled.
    - Output columns: Part Number, Series, Description, Price, Discount.

    Raises FileNotFoundError if path does not exist, and ValueError if PDF
    cannot be opened or no tables found.
    """
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"PDF not found: {path}")
    if not path.suffix.lower() == ".pdf":
        raise ValueError(f"Not a PDF file: {path}")

    if not HAS_PDFPLUMBER:
        raise ImportError("pdfplumber is required. Install with: pip install pdfplumber")

    metadata = {}
    records = []

    with pdfplumber.open(path) as pdf:
        metadata = _extract_metadata(pdf)
        num_pages = len(pdf.pages)
        # Typical quote: cover page 0, tables on 1..num_pages-1; include last for series discounts
        page_indices = list(range(1, min(9, num_pages))) if num_pages > 1 else [0]
        if num_pages > 1 and num_pages - 1 not in page_indices:
            page_indices.append(num_pages - 1)

        tables = _tables_with_pdfplumber(pdf, page_indices)
        if not tables:
            # Fallback: try all pages
            tables = _tables_with_pdfplumber(pdf, list(range(num_pages)))

        indices = None
        for table in tables:
            if not table or len(table) < 2:
                continue
            for r_idx, row in enumerate(table):
                if not row:
                    continue
                # Normalize row length
                row = list(row) if isinstance(row, (list, tuple)) else [row]
                while len(row) < 5:
                    row.append("")
                # Detect header and infer column indices
                if _is_header_row(row) and indices is None:
                    indices = _infer_column_indices(row)
                    if indices.get("price") is None:
                        indices["price"] = len(row) - 2
                    if indices.get("discount") is None:
                        indices["discount"] = len(row) - 1
                    continue
                if indices is None:
                    indices = _infer_column_indices(row)
                    if indices.get("price") is None:
                        indices["price"] = max(0, len(row) - 2)
                    if indices.get("discount") is None:
                        indices["discount"] = max(0, len(row) - 1)
                # Skip header-like rows after first
                if _is_header_row(row):
                    continue
                is_series_discount = _row_looks_like_series_discount(row, indices)
                if not is_series_discount and not _row_has_price(row, indices.get("price")):
                    continue
                rec = _normalize_row(row, indices, is_series_discount)
                if rec:
                    records.append(rec)

    if not records:
        raise ValueError(f"No pricing rows extracted from {path}. Check PDF layout or try different pages.")

    df = pd.DataFrame(records, columns=OUTPUT_COLUMNS)
    return df, metadata


def save_csv(df: pd.DataFrame, output_path: Union[str, Path]) -> None:
    """Save DataFrame to CSV with expected columns."""
    df.to_csv(output_path, index=False, encoding="utf-8")


def main() -> int:
    """CLI: parse PDF and save to quote_[number]_parsed.csv."""
    if len(sys.argv) < 2:
        print("Usage: python parse_wago_quote_pdf.py <path_to_quote.pdf> [output_dir]", file=sys.stderr)
        return 1
    pdf_path = Path(sys.argv[1])
    output_dir = Path(sys.argv[2]) if len(sys.argv) > 2 else pdf_path.parent

    try:
        df, meta = parse_pdf(pdf_path)
    except FileNotFoundError as e:
        print(e, file=sys.stderr)
        return 1
    except ValueError as e:
        print(e, file=sys.stderr)
        return 1
    except Exception as e:
        print(f"Parse error: {e}", file=sys.stderr)
        return 1

    quote_num = (meta.get("quote_number") or "unknown").replace("/", "-").replace(" ", "_")
    out_name = f"quote_{quote_num}_parsed.csv"
    out_path = output_dir / out_name
    save_csv(df, out_path)
    print(f"Rows: {len(df)}")
    print(f"Metadata: {meta}")
    print(f"Saved: {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
