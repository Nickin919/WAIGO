import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, CheckCircle, ArrowRight, ArrowLeft, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { catalogApi } from '@/lib/api';
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

const SAMPLE_CSV = `Part Number,Category,Price,Description
TEST-001,Connectors,1.25,Test product 1
TEST-002,Terminals,2.50,Test product 2`;

// ============================================================================
// CSV Parser
// ============================================================================

const MAX_ROWS = 25_000;

function parseCSV(text: string): ParsedData {
  if (!text.trim()) return { headers: [], rows: [] };
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
  return { headers, rows: dataRows.slice(0, MAX_ROWS) };
}

function guessFieldMapping(header: string): ProductField {
  const h = header.toLowerCase().replace(/[\s_-]+/g, '');
  if (h.includes('partnumber') || h.includes('partno') || h.includes('itemno') || h.includes('productcode') || h.includes('sku')) return 'partNumber';
  if (h.includes('wagoident') || h.includes('internalident') || h.includes('wagointernal')) return 'wagoIdent';
  if (h === 'series' || h.includes('category') || h.includes('type') || h.includes('group') || h.includes('productline')) return 'category';
  if (h.includes('per100') || h.includes('priceper100') || (h.includes('listprice') && h.includes('100'))) return 'listPricePer100';
  if (h.includes('priceeach') || h.includes('listpriceeach') || (h.includes('listprice') && h.includes('each'))) return 'price';
  if ((h.includes('price') || h.includes('cost')) && !h.includes('100') && !h.includes('net')) return 'price';
  if (h.includes('englishdesc') || h.includes('engdesc') || h.includes('altdesc') || h.includes('americandesc')) return 'englishDescription';
  if (h.includes('desc') || h.includes('description')) return 'description';
  if ((h.includes('discount') || (h.includes('acp') && !h.includes('net') && !h.includes('price')))) return 'distributorDiscount';
  if (h.includes('orderinmultiples') || h.includes('multiples') || h.includes('minqty') || h.includes('box') || h.includes('pack')) return 'minQty';
  return 'skip';
}

function validateMappings(
  columnMapping: Record<number, ProductField>,
  updateOnly: boolean
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const mappedFields = Object.values(columnMapping);
  const requiredFields = updateOnly ? ['partNumber'] : PRODUCT_FIELDS.filter((f) => f.required).map((f) => f.value);
  requiredFields.forEach((field) => {
    if (!mappedFields.includes(field as ProductField)) {
      const fieldDef = PRODUCT_FIELDS.find((f) => f.value === field);
      errors.push(`Required field "${fieldDef?.label}" is not mapped`);
    }
  });
  const nonSkippedFields = mappedFields.filter((f) => f !== 'skip');
  if (new Set(nonSkippedFields).size !== nonSkippedFields.length) {
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
  const [catalogs, setCatalogs] = useState<{ id: string; name: string }[]>([]);
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const effectiveCatalogId = selectedCatalogId || user?.catalogId || '';

  useEffect(() => {
    catalogApi.getAll().then((res) => {
      const list = Array.isArray(res.data) ? res.data : [];
      setCatalogs(list.map((c: any) => ({ id: c.id, name: c.name || 'Unnamed' })));
      if (list.length > 0) {
        const userCat = user?.catalogId;
        const match = userCat && list.some((c: any) => c.id === userCat);
        setSelectedCatalogId(match ? userCat! : list[0].id);
      }
    }).catch(() => {});
  }, [user?.catalogId]);

  const processFile = (uploadedFile: File) => {
    if (!uploadedFile.name.toLowerCase().endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }
    setParsing(true);
    setFile(uploadedFile);
    const reader = new FileReader();
    reader.onload = (event) => {
      setTimeout(() => {
        try {
          const text = ((event.target as FileReader)?.result as string) || '';
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
          const truncated = data.rows.length >= MAX_ROWS ? ` (max ${MAX_ROWS})` : '';
          toast.success(`Loaded ${data.rows.length} rows${truncated}`);
        } catch (err) {
          toast.error(`Parse error: ${err instanceof Error ? err.message : 'Unknown'}`);
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
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (parsing) return;
    const f = e.dataTransfer.files?.[0];
    if (f) processFile(f);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => setDragActive(false);

  const handleClearProducts = async () => {
    if (!window.confirm('Clear ALL products? This cannot be undone.')) return;
    setClearing(true);
    try {
      await api.delete('/admin/products/clear');
      toast.success('All products cleared');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to clear');
    } finally {
      setClearing(false);
    }
  };

  const transformDataForImport = () => {
    return rawData.map((row) => {
      const product: Record<string, string | number | null> = {};
      Object.entries(columnMapping).forEach(([indexStr, targetField]) => {
        if (targetField === 'skip') return;
        const index = parseInt(indexStr, 10);
        const value = row[index];
        if (value === undefined) return;
        if (targetField === 'price' || targetField === 'distributorDiscount' || targetField === 'listPricePer100') {
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
    if (!effectiveCatalogId) {
      toast.error('Please select a catalog to import into');
      return;
    }
    setImporting(true);
    setStep('importing');
    try {
      const products = transformDataForImport();
      const response = await api.post('/admin/products/import', {
        products,
        updateOnly,
        catalogId: effectiveCatalogId,
      });
      setImportResult(response.data);
      setStep('complete');
      toast.success('Import completed!');
    } catch (error: any) {
      const msg = error.response?.data?.error || error.message || 'Import failed';
      toast.error(msg);
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

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'product-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <button onClick={() => navigate('/admin')} className="flex items-center text-green-600 hover:underline mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Admin
        </button>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Product Import</h1>
        <p className="text-gray-600">Import products from CSV with column mapping</p>
      </div>

      <div className="mb-8 flex items-center justify-between max-w-3xl">
        <StepIndicator number={1} label="Upload" active={step === 'upload'} completed={['mapping', 'preview', 'importing', 'complete'].includes(step)} />
        <div className="flex-1 h-px bg-gray-300 mx-2" />
        <StepIndicator number={2} label="Map" active={step === 'mapping'} completed={['preview', 'importing', 'complete'].includes(step)} />
        <div className="flex-1 h-px bg-gray-300 mx-2" />
        <StepIndicator number={3} label="Preview" active={step === 'preview'} completed={['importing', 'complete'].includes(step)} />
        <div className="flex-1 h-px bg-gray-300 mx-2" />
        <StepIndicator number={4} label="Import" active={step === 'importing' || step === 'complete'} completed={step === 'complete'} />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        {step === 'upload' && (
          <div className="text-center py-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Upload CSV File</h2>

            {catalogs.length > 0 && (
              <div className="mb-6 text-left max-w-md mx-auto">
                <label className="block text-sm font-medium text-gray-700 mb-2">Import into catalog</label>
                <select
                  value={effectiveCatalogId}
                  onChange={(e) => setSelectedCatalogId(e.target.value)}
                  className="input w-full"
                >
                  {catalogs.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-12 max-w-md mx-auto cursor-pointer transition-colors ${
                dragActive ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-green-400 hover:bg-gray-50'
              } ${parsing ? 'pointer-events-none opacity-70' : ''}`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv,application/csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="font-medium text-gray-900 mb-1">
                {parsing ? 'Parsing...' : file ? file.name : 'Drop CSV here or click to browse'}
              </p>
              <p className="text-sm text-gray-500">Supports .csv files up to 25,000 rows</p>
            </div>

            <button type="button" onClick={downloadSample} className="mt-4 text-sm text-green-600 hover:underline inline-flex items-center gap-1">
              <Download className="w-4 h-4" /> Download sample template
            </button>

            <button type="button" onClick={handleClearProducts} disabled={clearing} className="mt-6 block mx-auto text-sm text-amber-600 hover:underline disabled:opacity-50">
              {clearing ? 'Clearing...' : 'Clear all products from database'}
            </button>
          </div>
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

        {step === 'importing' && (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Importing...</p>
          </div>
        )}

        {step === 'complete' && importResult && (
          <CompleteStep result={importResult} onViewProducts={() => navigate('/catalog')} onNewImport={handleNewImport} />
        )}
      </div>
    </div>
  );
};

const StepIndicator = ({ number, label, active, completed }: { number: number; label: string; active: boolean; completed: boolean }) => (
  <div className="flex flex-col items-center">
    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${completed ? 'bg-green-600 text-white' : active ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
      {completed ? <CheckCircle className="w-6 h-6" /> : number}
    </div>
    <span className="text-sm font-medium text-gray-700 mt-1">{label}</span>
  </div>
);

const MappingStep = ({ headers, rawData, columnMapping, setColumnMapping, updateOnly, setUpdateOnly, onProceed, onBack }: any) => {
  const validation = validateMappings(columnMapping, updateOnly);
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Map Columns</h2>
      <div className="mb-6 p-4 bg-gray-50 rounded-lg flex items-center justify-between">
        <div>
          <label className="font-medium block mb-1">Update-Only Mode</label>
          <p className="text-sm text-gray-600">Only update existing products</p>
        </div>
        <input
          type="checkbox"
          id="update-only-check"
          checked={updateOnly}
          onChange={(e) => setUpdateOnly(e.target.checked)}
          className="w-4 h-4 rounded text-green-600"
        />
      </div>
      <div className="overflow-x-auto mb-6">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-semibold">Column</th>
              <th className="px-4 py-2 text-left text-sm font-semibold">Sample</th>
              <th className="px-4 py-2 text-left text-sm font-semibold">Maps To</th>
            </tr>
          </thead>
          <tbody>
            {headers.map((header, i) => (
              <tr key={i} className="border-t">
                <td className="px-4 py-2 text-sm">{header}</td>
                <td className="px-4 py-2 text-sm text-gray-500 max-w-xs truncate">{rawData[0]?.[i] ?? '—'}</td>
                <td className="px-4 py-2">
                  <select
                    value={columnMapping[i] ?? 'skip'}
                    onChange={(e) => setColumnMapping({ ...columnMapping, [i]: e.target.value as ProductField })}
                    className="input py-1.5 text-sm max-w-xs"
                  >
                    {PRODUCT_FIELDS.map((f) => (
                      <option key={f.value} value={f.value}>{f.label} {f.required && !updateOnly ? '*' : ''}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {validation.errors.length > 0 && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          {validation.errors.map((e, i) => (
            <p key={i} className="text-red-800 text-sm">• {e}</p>
          ))}
        </div>
      )}
      <div className="flex justify-between">
        <button onClick={onBack} className="btn bg-gray-200 hover:bg-gray-300 text-gray-800">Back</button>
        <button onClick={onProceed} disabled={!validation.valid} className="btn btn-primary">Continue to Preview</button>
      </div>
    </div>
  );
};

const PreviewStep = ({ headers, rawData, columnMapping, transformDataForImport, updateOnly, onImport, onBack }: any) => {
  const data = transformDataForImport();
  const mappedCols = headers.map((h, i) => ({ header: h, field: columnMapping[i], index: i })).filter((c) => c.field && c.field !== 'skip');
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Preview ({data.length} rows)</h2>
      <div className="mb-6 grid grid-cols-4 gap-4">
        <div className="p-4 bg-blue-50 rounded-lg text-center"><div className="text-2xl font-bold text-blue-900">{data.length}</div><div className="text-sm">Rows</div></div>
        <div className="p-4 bg-green-50 rounded-lg text-center"><div className="text-2xl font-bold text-green-900">{mappedCols.length}</div><div className="text-sm">Columns</div></div>
        <div className="p-4 bg-purple-50 rounded-lg text-center"><div className="font-bold text-purple-900">{updateOnly ? 'Update' : 'Upsert'}</div><div className="text-sm">Mode</div></div>
      </div>
      <div className="overflow-x-auto mb-6 border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">#</th>
              {mappedCols.map((c) => (
                <th key={c.index} className="px-3 py-2 text-left">{PRODUCT_FIELDS.find((f) => f.value === c.field)?.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 5).map((row, ri) => (
              <tr key={ri} className="border-t">
                <td className="px-3 py-2 text-gray-500">{ri + 1}</td>
                {mappedCols.map((c) => (
                  <td key={c.index} className="px-3 py-2">{String(row[c.field!] ?? '—')}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between">
        <button onClick={onBack} className="btn bg-gray-200 hover:bg-gray-300 text-gray-800">Back</button>
        <button onClick={onImport} className="btn btn-primary">Import {data.length} Products</button>
      </div>
    </div>
  );
};

const CompleteStep = ({ result, onViewProducts, onNewImport }: { result: any; onViewProducts: () => void; onNewImport: () => void }) => (
  <div className="text-center">
    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
      <CheckCircle className="w-10 h-10 text-green-600" />
    </div>
    <h2 className="text-2xl font-bold mb-4">Import Complete!</h2>
    <div className="grid grid-cols-4 gap-4 mb-6 max-w-2xl mx-auto">
      <div className="p-4 bg-green-50 rounded-lg"><div className="text-2xl font-bold text-green-900">{result.created}</div><div className="text-sm">Created</div></div>
      <div className="p-4 bg-blue-50 rounded-lg"><div className="text-2xl font-bold text-blue-900">{result.updated}</div><div className="text-sm">Updated</div></div>
      <div className="p-4 bg-purple-50 rounded-lg"><div className="text-2xl font-bold text-purple-900">{result.priceChanges}</div><div className="text-sm">Price changes</div></div>
      <div className="p-4 bg-orange-50 rounded-lg"><div className="text-2xl font-bold text-orange-900">{result.errors?.length ?? 0}</div><div className="text-sm">Errors</div></div>
    </div>
    {result.notFound?.length > 0 && (
      <div className="mb-6 p-4 bg-yellow-50 rounded-lg text-left max-w-2xl mx-auto">
        <h4 className="font-semibold mb-2">Not found: {result.notFound.length}</h4>
        <p className="text-sm text-yellow-800 break-all">{result.notFound.slice(0, 10).join(', ')}{result.notFound.length > 10 ? '...' : ''}</p>
      </div>
    )}
    {result.errors?.length > 0 && (
      <div className="mb-6 p-4 bg-red-50 rounded-lg text-left max-w-2xl mx-auto">
        <h4 className="font-semibold mb-2">Errors</h4>
        {result.errors.slice(0, 5).map((e: string, i: number) => (
          <p key={i} className="text-sm text-red-800">• {e}</p>
        ))}
      </div>
    )}
    <div className="flex gap-4 justify-center">
      <button onClick={onViewProducts} className="btn btn-primary">View Products</button>
      <button onClick={onNewImport} className="btn bg-gray-200 hover:bg-gray-300 text-gray-800">Import Another</button>
    </div>
  </div>
);

export default ProductImport;
