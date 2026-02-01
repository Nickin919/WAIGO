import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, CheckCircle, AlertCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

// ============================================================================
// Types
// ============================================================================

type ProductField =
  | 'partNumber'
  | 'series'
  | 'description'
  | 'englishDescription'
  | 'category'
  | 'price'
  | 'listPricePer100'
  | 'wagoIdent'
  | 'distributorDiscount'
  | 'minQty'
  | 'skip';

interface FieldDefinition {
  value: ProductField;
  label: string;
  required: boolean;
}

interface ParsedData {
  headers: string[];
  rows: string[][];
}

// ============================================================================
// Field Definitions
// ============================================================================

const PRODUCT_FIELDS: FieldDefinition[] = [
  { value: 'partNumber', label: 'Part Number', required: true },
  { value: 'series', label: 'Series', required: false },
  { value: 'price', label: 'List Price (Each)', required: true },
  { value: 'listPricePer100', label: 'List Price Per 100', required: false },
  { value: 'category', label: 'Category', required: true },
  { value: 'description', label: 'Description', required: false },
  { value: 'englishDescription', label: 'English Description', required: false },
  { value: 'wagoIdent', label: 'WAGO Ident #', required: false },
  { value: 'distributorDiscount', label: 'Discount (%)', required: false },
  { value: 'minQty', label: 'Min Qty (Order in Multiples of)', required: false },
  { value: 'skip', label: '-- Skip this column --', required: false },
];

// ============================================================================
// CSV Parser - Handles multi-line quoted fields, escaped quotes
// ============================================================================

const MAX_ROWS = 25_000; // Match backend limit, prevent freeze on huge files

function parseCSV(text: string): ParsedData {
  if (!text.trim()) return { headers: [], rows: [] };
  // Strip BOM (Excel and some editors add it)
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField.replace(/[\r\n]+/g, ' ').trim());
      currentField = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      currentRow.push(currentField.replace(/[\r\n]+/g, ' ').trim());
      if (currentRow.some((cell) => cell.length > 0)) rows.push(currentRow);
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.replace(/[\r\n]+/g, ' ').trim());
    if (currentRow.some((cell) => cell.length > 0)) rows.push(currentRow);
  }

  if (rows.length === 0) return { headers: [], rows: [] };
  const headers = rows[0];
  const dataRows = rows.slice(1);
  if (dataRows.length > MAX_ROWS) {
    console.warn(`CSV has ${dataRows.length} rows; limiting to ${MAX_ROWS}`);
  }
  return { headers, rows: dataRows.slice(0, MAX_ROWS) };
}

// ============================================================================
// Auto-detect field mapping from header name
// ============================================================================

function guessFieldMapping(header: string): ProductField {
  const h = header.toLowerCase().replace(/[\s_-]+/g, '');

  if (h.includes('partnumber') || h.includes('partno') || h.includes('itemno') || h.includes('productcode') || h.includes('sku'))
    return 'partNumber';
  if (h.includes('wagoident') || h.includes('internalident') || h.includes('wagointernal')) return 'wagoIdent';
  if (h === 'series' || h.includes('category') || h.includes('type') || h.includes('group') || h.includes('productline'))
    return 'category';
  if (h.includes('per100') || h.includes('priceper100') || (h.includes('listprice') && h.includes('100')))
    return 'listPricePer100';
  if (h.includes('priceeach') || h.includes('listpriceeach') || (h.includes('listprice') && h.includes('each')))
    return 'price';
  if ((h.includes('price') || h.includes('cost')) && !h.includes('100') && !h.includes('net')) return 'price';
  if (h.includes('englishdesc') || h.includes('engdesc') || h.includes('altdesc') || h.includes('americandesc'))
    return 'englishDescription';
  if (h.includes('desc') || h.includes('description')) return 'description';
  if ((h.includes('discount') || (h.includes('acp') && !h.includes('net') && !h.includes('price'))))
    return 'distributorDiscount';
  if (h.includes('orderinmultiples') || h.includes('multiples') || h.includes('minqty') || h.includes('box') || h.includes('pack'))
    return 'minQty';

  return 'skip';
}

// ============================================================================
// Validation
// ============================================================================

function validateMappings(
  columnMapping: Record<number, ProductField>,
  updateOnly: boolean
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const mappedFields = Object.values(columnMapping);

  const requiredFields = updateOnly
    ? ['partNumber']
    : PRODUCT_FIELDS.filter((f) => f.required).map((f) => f.value);

  requiredFields.forEach((field) => {
    if (!mappedFields.includes(field as ProductField)) {
      const fieldDef = PRODUCT_FIELDS.find((f) => f.value === field);
      errors.push(`Required field "${fieldDef?.label}" is not mapped`);
    }
  });

  const nonSkippedFields = mappedFields.filter((f) => f !== 'skip');
  const uniqueFields = new Set(nonSkippedFields);
  if (uniqueFields.size !== nonSkippedFields.length) {
    errors.push('Each field can only be mapped once');
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// Main Component
// ============================================================================

type Step = 'upload' | 'mapping' | 'preview' | 'importing' | 'complete';

const ProductImport = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawData, setRawData] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<number, ProductField>>({});
  const [updateOnly, setUpdateOnly] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [clearing, setClearing] = useState(false);
  const [parsing, setParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clear all products
  const handleClearProducts = async () => {
    if (!window.confirm('Clear ALL products from the database? This cannot be undone.')) return;
    setClearing(true);
    try {
      await api.delete('/admin/products/clear');
      toast.success('All products cleared');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to clear products');
    } finally {
      setClearing(false);
    }
  };

  // Handle file upload - FileReader + custom parseCSV (async, non-blocking)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    if (!uploadedFile.name.toLowerCase().endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      e.target.value = '';
      return;
    }

    setParsing(true);
    setFile(uploadedFile);

    const reader = new FileReader();
    reader.onload = (event) => {
      // Defer parsing to next tick so "Parsing..." can render and avoid blocking
      setTimeout(() => {
        try {
          const text = (event.target?.result as string) || '';
          if (!text.trim()) {
            toast.error('File is empty');
            setParsing(false);
            return;
          }

          const data = parseCSV(text);
        if (data.headers.length === 0) {
          toast.error('No valid data found in file');
          setParsing(false);
          return;
        }

        setHeaders(data.headers);
        setRawData(data.rows);

        const autoMapping: Record<number, ProductField> = {};
        data.headers.forEach((header, index) => {
          autoMapping[index] = guessFieldMapping(header);
        });
        setColumnMapping(autoMapping);

          setStep('mapping');
          const truncated = data.rows.length >= MAX_ROWS ? ` (max ${MAX_ROWS} rows)` : '';
          toast.success(`Loaded ${data.rows.length} rows${truncated}`);
        } catch (err) {
          toast.error(`Failed to parse CSV: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
          setParsing(false);
        }
      }, 0);
    };
    reader.onerror = () => {
      toast.error('Failed to read file');
      setParsing(false);
    };
    reader.readAsText(uploadedFile, 'UTF-8');

    e.target.value = '';
  };

  // Transform data for import - proper numeric parsing
  const transformDataForImport = () => {
    return rawData.map((row) => {
      const product: Record<string, string | number | null> = {};

      Object.entries(columnMapping).forEach(([indexStr, targetField]) => {
        if (targetField === 'skip') return;
        const index = parseInt(indexStr, 10);
        const value = row[index];

        if (value === undefined) return;

        if (
          targetField === 'price' ||
          targetField === 'distributorDiscount' ||
          targetField === 'listPricePer100'
        ) {
          product[targetField] = parseFloat(String(value).replace(/[^0-9.-]/g, '')) || 0;
        } else if (targetField === 'minQty') {
          const parsed = parseInt(String(value).replace(/[^0-9]/g, ''), 10);
          product[targetField] = isNaN(parsed) ? null : parsed;
        } else {
          product[targetField] = value?.trim() || null;
        }
      });

      return product;
    });
  };

  const handleProceedToPreview = () => {
    const validation = validateMappings(columnMapping, updateOnly);
    if (!validation.valid) {
      toast.error(validation.errors[0]);
      return;
    }
    setStep('preview');
  };

  const handleImport = async () => {
    if (!user?.catalogId) {
      toast.error('No catalog selected');
      return;
    }

    setImporting(true);
    setStep('importing');

    try {
      const products = transformDataForImport();

      const response = await api.post('/admin/products/import', {
        products,
        updateOnly,
        catalogId: user.catalogId,
      });

      setImportResult(response.data);
      setStep('complete');
      toast.success('Import completed successfully!');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Import failed');
      setStep('preview');
    } finally {
      setImporting(false);
    }
  };

  const handleNewImport = () => {
    setStep('upload');
    setFile(null);
    setHeaders([]);
    setRawData([]);
    setColumnMapping({});
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Render
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <button
          onClick={() => navigate('/admin')}
          className="flex items-center text-green-600 hover:underline mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Admin Dashboard
        </button>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Product Import</h1>
        <p className="text-gray-600">Import products from CSV with intelligent column mapping</p>
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between max-w-3xl">
          <StepIndicator
            number={1}
            label="Upload"
            active={step === 'upload'}
            completed={['mapping', 'preview', 'importing', 'complete'].includes(step)}
          />
          <div className="flex-1 h-px bg-gray-300" />
          <StepIndicator
            number={2}
            label="Map Columns"
            active={step === 'mapping'}
            completed={['preview', 'importing', 'complete'].includes(step)}
          />
          <div className="flex-1 h-px bg-gray-300" />
          <StepIndicator
            number={3}
            label="Preview"
            active={step === 'preview'}
            completed={['importing', 'complete'].includes(step)}
          />
          <div className="flex-1 h-px bg-gray-300" />
          <StepIndicator
            number={4}
            label="Import"
            active={step === 'importing' || step === 'complete'}
            completed={step === 'complete'}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        {step === 'upload' && (
          <UploadStep
            onFileUpload={handleFileUpload}
            file={file}
            parsing={parsing}
            onClearProducts={handleClearProducts}
            clearing={clearing}
            fileInputRef={fileInputRef}
          />
        )}

        {step === 'mapping' && (
          <MappingStep
            headers={headers}
            rawData={rawData}
            columnMapping={columnMapping}
            setColumnMapping={setColumnMapping}
            updateOnly={updateOnly}
            setUpdateOnly={setUpdateOnly}
            onProceed={handleProceedToPreview}
            onBack={() => setStep('upload')}
          />
        )}

        {step === 'preview' && (
          <PreviewStep
            headers={headers}
            rawData={rawData}
            columnMapping={columnMapping}
            transformDataForImport={transformDataForImport}
            updateOnly={updateOnly}
            onImport={handleImport}
            onBack={() => setStep('mapping')}
          />
        )}

        {step === 'importing' && <ImportingStep />}

        {step === 'complete' && importResult && (
          <CompleteStep
            result={importResult}
            onViewProducts={() => navigate('/catalog')}
            onNewImport={handleNewImport}
          />
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Step Components
// ============================================================================

const StepIndicator = ({
  number,
  label,
  active,
  completed,
}: {
  number: number;
  label: string;
  active: boolean;
  completed: boolean;
}) => (
  <div className="flex flex-col items-center">
    <div
      className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold mb-2 ${
        completed ? 'bg-green-600 text-white' : active ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
      }`}
    >
      {completed ? <CheckCircle className="w-6 h-6" /> : number}
    </div>
    <span className="text-sm font-medium text-gray-700">{label}</span>
  </div>
);

const UploadStep = ({
  onFileUpload,
  file,
  parsing,
  onClearProducts,
  clearing,
  fileInputRef,
}: {
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  file: File | null;
  parsing: boolean;
  onClearProducts: () => void;
  clearing: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}) => (
  <div className="text-center py-12">
    <div className="mb-6">
      <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload CSV File</h2>
      <p className="text-gray-600">
        Upload your product catalog CSV file. We'll intelligently map the columns for you.
      </p>
    </div>

    <div className="max-w-md mx-auto flex flex-col items-center gap-4">
      <div className="relative inline-block">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv,application/csv"
          onChange={onFileUpload}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          disabled={parsing}
          aria-label="Select CSV file"
        />
        <div className="btn btn-primary inline-flex items-center space-x-2 pointer-events-none">
          <FileText className="w-5 h-5" />
          <span>{parsing ? 'Parsing...' : file ? file.name : 'Browse CSV File'}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={onClearProducts}
        disabled={clearing}
        className="text-sm text-amber-600 hover:text-amber-800 hover:underline disabled:opacity-50"
      >
        {clearing ? 'Clearing...' : 'Clear all products from database'}
      </button>

      <div className="mt-8 text-left bg-blue-50 border border-blue-200 rounded-lg p-4 w-full">
        <h4 className="font-semibold text-blue-900 mb-2">Expected Columns:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>Part Number</strong> (required)</li>
          <li>• <strong>Category</strong> (required for new products)</li>
          <li>• <strong>Price</strong> (required for new products)</li>
          <li>• Series, Description, WAGO Ident, Discount, Min Qty (optional)</li>
        </ul>
      </div>
    </div>
  </div>
);

const MappingStep = ({
  headers,
  rawData,
  columnMapping,
  setColumnMapping,
  updateOnly,
  setUpdateOnly,
  onProceed,
  onBack,
}: {
  headers: string[];
  rawData: string[][];
  columnMapping: Record<number, ProductField>;
  setColumnMapping: (m: Record<number, ProductField>) => void;
  updateOnly: boolean;
  setUpdateOnly: (v: boolean) => void;
  onProceed: () => void;
  onBack: () => void;
}) => {
  const handleMappingChange = (index: number, value: ProductField) => {
    setColumnMapping({ ...columnMapping, [index]: value });
  };

  const validation = validateMappings(columnMapping, updateOnly);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Map Columns</h2>
        <p className="text-gray-600">
          Map your CSV columns to product fields. We've auto-detected the mappings for you.
        </p>
      </div>

      <div className="mb-6 p-4 bg-gray-50 rounded-lg flex items-center justify-between">
        <div>
          <label htmlFor="switch-update-only" className="font-medium text-gray-900 block mb-1">
            Update-Only Mode
          </label>
          <p className="text-sm text-gray-600">
            Only update existing products. Report not-found part numbers instead of creating new ones.
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            id="switch-update-only"
            checked={updateOnly}
            onChange={(e) => setUpdateOnly(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
        </label>
      </div>

      <div className="mb-6 overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Your Column Header</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Sample Data</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Maps To</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {headers.map((header, index) => (
              <tr key={index}>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{header}</td>
                <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                  {rawData[0]?.[index] ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={columnMapping[index] ?? 'skip'}
                    onChange={(e) => handleMappingChange(index, e.target.value as ProductField)}
                    className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    data-testid={`select-mapping-${index}`}
                  >
                    {PRODUCT_FIELDS.map((field) => (
                      <option key={field.value} value={field.value}>
                        {field.label} {field.required && !updateOnly ? '*' : ''}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {validation.errors.length > 0 && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-red-900 mb-2">Mapping Errors:</h4>
              <ul className="text-sm text-red-800 space-y-1">
                {validation.errors.map((error, i) => (
                  <li key={i}>• {error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <button onClick={onBack} className="btn bg-gray-200 hover:bg-gray-300 text-gray-800">
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back
        </button>
        <button
          onClick={onProceed}
          disabled={!validation.valid}
          className="btn btn-primary"
          id="button-continue-to-preview"
        >
          Continue to Preview
          <ArrowRight className="w-5 h-5 ml-2" />
        </button>
      </div>
    </div>
  );
};

const PreviewStep = ({
  headers,
  rawData,
  columnMapping,
  transformDataForImport,
  updateOnly,
  onImport,
  onBack,
}: {
  headers: string[];
  rawData: string[][];
  columnMapping: Record<number, ProductField>;
  transformDataForImport: () => Record<string, string | number | null>[];
  updateOnly: boolean;
  onImport: () => void;
  onBack: () => void;
}) => {
  const transformedData = transformDataForImport();
  const preview = transformedData.slice(0, 10);

  const mappedColumns = headers
    .map((header, index) => ({ header, field: columnMapping[index], index }))
    .filter((col) => col.field && col.field !== 'skip');

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Preview Import</h2>
        <p className="text-gray-600">
          Review the first 10 rows before importing {transformedData.length} total products
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-blue-900">{transformedData.length}</div>
          <div className="text-sm text-blue-700">Total Rows</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-green-900">{mappedColumns.length}</div>
          <div className="text-sm text-green-700">Mapped Columns</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="text-lg font-bold text-purple-900">{updateOnly ? 'UPDATE' : 'UPSERT'}</div>
          <div className="text-sm text-purple-700">Import Mode</div>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg">
          <div className="text-sm font-semibold text-orange-900">Ready</div>
          <div className="text-sm text-orange-700">Status</div>
        </div>
      </div>

      <div className="mb-6 overflow-x-auto">
        <table className="w-full border border-gray-200 rounded-lg">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">#</th>
              {mappedColumns.map((col) => (
                <th key={col.index} className="px-3 py-2 text-left text-xs font-semibold text-gray-700">
                  {PRODUCT_FIELDS.find((f) => f.value === col.field)?.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {preview.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <td className="px-3 py-2 text-xs text-gray-500">{rowIndex + 1}</td>
                {mappedColumns.map((col) => (
                  <td key={col.index} className="px-3 py-2 text-sm text-gray-900">
                    {row[col.field!] ?? <span className="text-gray-400">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <button onClick={onBack} className="btn bg-gray-200 hover:bg-gray-300 text-gray-800">
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Mapping
        </button>
        <button onClick={onImport} className="btn btn-primary" id="button-import">
          Import {transformedData.length} Products
          <CheckCircle className="w-5 h-5 ml-2" />
        </button>
      </div>
    </div>
  );
};

const ImportingStep = () => (
  <div className="text-center py-12">
    <div className="w-16 h-16 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
    <h2 className="text-2xl font-bold text-gray-900 mb-2">Importing Products...</h2>
    <p className="text-gray-600">Please wait while we process your data</p>
  </div>
);

const CompleteStep = ({
  result,
  onViewProducts,
  onNewImport,
}: {
  result: any;
  onViewProducts: () => void;
  onNewImport: () => void;
}) => (
  <div>
    <div className="text-center mb-8">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <CheckCircle className="w-10 h-10 text-green-600" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Import Complete!</h2>
      <p className="text-gray-600">Your products have been successfully imported</p>
    </div>

    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-green-50 p-4 rounded-lg text-center">
        <div className="text-3xl font-bold text-green-900">{result.created}</div>
        <div className="text-sm text-green-700">Created</div>
      </div>
      <div className="bg-blue-50 p-4 rounded-lg text-center">
        <div className="text-3xl font-bold text-blue-900">{result.updated}</div>
        <div className="text-sm text-blue-700">Updated</div>
      </div>
      <div className="bg-purple-50 p-4 rounded-lg text-center">
        <div className="text-3xl font-bold text-purple-900">{result.priceChanges}</div>
        <div className="text-sm text-purple-700">Price Changes</div>
      </div>
      <div className="bg-orange-50 p-4 rounded-lg text-center">
        <div className="text-3xl font-bold text-orange-900">{result.errors?.length ?? 0}</div>
        <div className="text-sm text-orange-700">Errors</div>
      </div>
    </div>

    {result.notFound?.length > 0 && (
      <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="font-semibold text-yellow-900 mb-2">Not Found ({result.notFound.length} items)</h4>
        <p className="text-sm text-yellow-800 mb-2">These part numbers don't exist in the catalog (update-only mode):</p>
        <div className="max-h-40 overflow-y-auto">
          <div className="text-sm text-yellow-800 space-y-1">
            {result.notFound.map((pn: string, i: number) => (
              <div key={i}>• {pn}</div>
            ))}
          </div>
        </div>
      </div>
    )}

    {result.errors?.length > 0 && (
      <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
        <h4 className="font-semibold text-red-900 mb-2">Errors ({result.errors.length})</h4>
        <div className="max-h-40 overflow-y-auto">
          <div className="text-sm text-red-800 space-y-1">
            {result.errors.map((error: string, i: number) => (
              <div key={i}>• {error}</div>
            ))}
          </div>
        </div>
      </div>
    )}

    <div className="flex items-center justify-center space-x-4">
      <button onClick={onViewProducts} className="btn btn-primary" id="button-view-products">
        View Products
      </button>
      <button onClick={onNewImport} className="btn bg-gray-200 hover:bg-gray-300 text-gray-800">
        Import Another File
      </button>
    </div>
  </div>
);

export default ProductImport;
