declare module 'pdf-parse' {
  interface PDFInfo {
    PDFFormatVersion?: string;
    IsAcroFormPresent?: boolean;
    IsXFAPresent?: boolean;
    Title?: string;
    Author?: string;
    Subject?: string;
    Keywords?: string;
    Creator?: string;
    Producer?: string;
    CreationDate?: string;
    ModDate?: string;
    [key: string]: any;
  }

  interface PDFMetadata {
    _metadata?: {
      [key: string]: string;
    };
  }

  interface PDFData {
    /** Number of pages in the PDF */
    numpages: number;
    /** Number of rendered pages */
    numrender: number;
    /** PDF info object */
    info: PDFInfo;
    /** PDF metadata */
    metadata: PDFMetadata | null;
    /** PDF version */
    version: string;
    /** Extracted text content */
    text: string;
  }

  interface PDFOptions {
    /** First page to parse (default: 1) */
    pagerender?: (pageData: any) => Promise<string>;
    /** Maximum number of pages to parse */
    max?: number;
    /** PDF version */
    version?: string;
  }

  function pdf(dataBuffer: Buffer, options?: PDFOptions): Promise<PDFData>;
  
  export = pdf;
}
