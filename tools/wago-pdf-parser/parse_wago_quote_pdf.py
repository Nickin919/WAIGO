#!/usr/bin/env python3
"""
WAGO Pricing Quote PDF Parser (Simplified for INIT-style PDFs)

Based on working code for "INIT Sample PDF Price Contract.pdf".
Simpler, more direct approach using pdfplumber.extract_table().
"""

import re
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import pandas as pd
import pdfplumber

# Output columns
COL_PART_NUMBER = "Part Number"
COL_SERIES = "Series"
COL_DESCRIPTION = "Description"
COL_PRICE = "Price"
COL_DISCOUNT = "Discount"

OUTPUT_COLUMNS = [COL_PART_NUMBER, COL_SERIES, COL_DESCRIPTION, COL_PRICE, COL_DISCOUNT]

# Patterns
RE_QUOTE_NUMBER = re.compile(r"(?:quote|quotation|Q)\s*#?\s*:?\s*([A-Z0-9\-]+)", re.I)
RE_SERIES_DISCOUNT = re.compile(r"(\d{3})\s*Series.*?([\d.]+)%", re.I | re.DOTALL)


def extract_metadata(pdf) -> Dict[str, Optional[str]]:
    """Extract quote number from first page."""
    meta = {"quote_number": None}
    try:
        if pdf.pages:
            text = pdf.pages[0].extract_text() or ""
            m = RE_QUOTE_NUMBER.search(text)
            if m:
                meta["quote_number"] = m.group(1).strip()
    except Exception:
        pass
    return meta


def parse_pdf(pdf_path: str) -> Tuple[pd.DataFrame, Dict[str, Optional[str]]]:
    """
    Parse WAGO quote PDF (INIT-style with 3-column tables: Part #, Description, Price).
    
    Returns (DataFrame, metadata).
    DataFrame columns: Part Number, Series, Description, Price, Discount.
    """
    path = Path(pdf_path)
    if not path.exists():
        raise FileNotFoundError(f"PDF not found: {path}")
    
    all_rows = []
    metadata = {}
    
    with pdfplumber.open(path) as pdf:
        metadata = extract_metadata(pdf)
        
        for page in pdf.pages:
            table = page.extract_table()
            if not table:
                continue
            
            # Skip header row if present (first row contains "WAGO Part #" or similar)
            start_idx = 1 if (table and table[0] and any("part" in str(c).lower() for c in table[0] if c)) else 0
            
            for row in table[start_idx:]:
                if not row or len(row) < 3:
                    continue
                
                # Expect: [Part Number, Description, Price, ...]
                part_raw = row[0] or ""
                desc_raw = row[1] or ""
                price_raw = row[2] or ""
                
                # Skip rows without price (unless it's a series discount)
                if not price_raw.strip():
                    continue
                
                part = part_raw.strip().replace("\n", "/")
                desc = desc_raw.strip().replace("\n", "; ").replace("<br>", "; ")
                price = price_raw.strip()
                
                # Detect series discount: description contains "discount", "series", and "%"
                if "discount" in desc.lower() and "%" in desc:
                    m = RE_SERIES_DISCOUNT.search(desc)
                    if m:
                        series_num = m.group(1)
                        discount_pct = m.group(2)
                        # Clean description: remove series number and "Discount" text
                        clean_desc = desc.split("Discount")[0].replace(f"{series_num} Series", "").strip()
                        all_rows.append({
                            COL_PART_NUMBER: "",
                            COL_SERIES: series_num,
                            COL_DESCRIPTION: clean_desc,
                            COL_PRICE: "",
                            COL_DISCOUNT: f"{discount_pct}%",
                        })
                        continue
                
                # Regular product row
                all_rows.append({
                    COL_PART_NUMBER: part,
                    COL_SERIES: "",
                    COL_DESCRIPTION: desc,
                    COL_PRICE: price if price.startswith("$") else f"${price}",
                    COL_DISCOUNT: "",
                })
    
    if not all_rows:
        raise ValueError(f"No pricing rows extracted from {path}")
    
    df = pd.DataFrame(all_rows, columns=OUTPUT_COLUMNS)
    return df, metadata


def save_csv(df: pd.DataFrame, output_path: str) -> None:
    """Save DataFrame to CSV."""
    df.to_csv(output_path, index=False, encoding="utf-8")


def main() -> int:
    """CLI: parse PDF and save to quote_[number]_parsed.csv."""
    if len(sys.argv) < 2:
        print("Usage: python parse_wago_quote_pdf_v2.py <path_to_quote.pdf> [output_dir]", file=sys.stderr)
        return 1
    
    pdf_path = Path(sys.argv[1])
    output_dir = Path(sys.argv[2]) if len(sys.argv) > 2 else pdf_path.parent
    
    try:
        df, meta = parse_pdf(str(pdf_path))
    except (FileNotFoundError, ValueError) as e:
        print(e, file=sys.stderr)
        return 1
    except Exception as e:
        print(f"Parse error: {e}", file=sys.stderr)
        return 1
    
    quote_num = (meta.get("quote_number") or "unknown").replace("/", "-").replace(" ", "_")
    out_name = f"quote_{quote_num}_parsed.csv"
    out_path = output_dir / out_name
    save_csv(df, str(out_path))
    
    print(f"Rows: {len(df)}")
    print(f"Quote Number: {meta.get('quote_number')}")
    print(f"Saved: {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
