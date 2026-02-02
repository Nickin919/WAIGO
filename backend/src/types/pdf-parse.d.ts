declare module 'pdf-parse' {
  interface PDFParseOptions {
    /** URL to PDF file */
    url?: string;
    /** Local file path (may not work in all versions) */
    file?: string;
    /** PDF data as Buffer or Uint8Array */
    data?: Buffer | Uint8Array;
  }

  interface GetTextResult {
    /** Extracted text content */
    text: string;
    /** Number of pages */
    pages?: Array<{ text: string }>;
  }

  interface GetInfoResult {
    info?: {
      Title?: string;
      Author?: string;
      Subject?: string;
      Keywords?: string;
      Creator?: string;
      Producer?: string;
      CreationDate?: string;
      ModDate?: string;
      [key: string]: any;
    };
    metadata?: any;
  }

  export class PDFParse {
    constructor(options: PDFParseOptions);
    getText(): Promise<GetTextResult>;
    getInfo(): Promise<GetInfoResult>;
    getTable(): Promise<any>;
  }
}
