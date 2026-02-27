import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Upload, CheckCircle, Download, Package, Link2, Database } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { catalogApi, adminApi } from '@/lib/api';
import { parseCSV, buildCSVFromRows, MAX_IMPORT_ROWS } from '@/utils/csvParser';
import { StepIndicator } from '@/components/admin/StepIndicator';

// ============================================================================
// Types
// ============================================================================

type TabId = 'master' | 'crossref' | 'nonwago';

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
  | 'gridLevelNumber'
  | 'gridLevelName'
  | 'gridSublevelNumber'
  | 'gridSublevelName'
  | 'priceDate'
  | 'skip';

type CrossReferenceField =
  | 'partNumberA'
  | 'partNumberB'
  | 'manufactureName'
  | 'activeItem'
  | 'estimatedPrice'
  | 'wagoCrossA'
  | 'wagoCrossB'
  | 'notesA'
  | 'notesB'
  | 'author'
  | 'lastDateModified'
  | 'skip';

type NonWagoField = 'manufacturer' | 'partNumber' | 'description' | 'category' | 'skip';

interface FieldDef {
  value: string;
  label: string;
  required: boolean;
}

type Step = 'upload' | 'mapping' | 'preview' | 'importing' | 'complete';

// ============================================================================
// Field definitions
// ============================================================================

const PRODUCT_FIELDS: FieldDef[] = [
  { value: 'partNumber', label: 'Part Number', required: true },
  { value: 'series', label: 'Series', required: false },
  { value: 'price', label: 'List Price (Each)', required: true },
  { value: 'listPricePer100', label: 'List Price Per 100', required: false },
  { value: 'category', label: 'Category', required: true },
  { value: 'description', label: 'Description', required: false },
  { value: 'englishDescription', label: 'English Description', required: false },
  { value: 'wagoIdent', label: 'WAGO Ident #', required: false },
  { value: 'distributorDiscount', label: 'Discount (%)', required: false },
  { value: 'minQty', label: 'Min Qty', required: false },
  { value: 'gridLevelNumber', label: 'Grid Level Number', required: false },
  { value: 'gridLevelName', label: 'Grid Level Name', required: false },
  { value: 'gridSublevelNumber', label: 'Grid Sublevel Number', required: false },
  { value: 'gridSublevelName', label: 'Grid Sublevel Name', required: false },
  { value: 'priceDate', label: 'Price Date', required: false },
  { value: 'skip', label: '-- Skip --', required: false },
];

const CROSS_REF_FIELDS: FieldDef[] = [
  { value: 'partNumberA', label: 'Part Number A', required: true },
  { value: 'partNumberB', label: 'Part Number B', required: false },
  { value: 'manufactureName', label: 'Manufacture Name', required: true },
  { value: 'activeItem', label: 'Active Item', required: false },
  { value: 'estimatedPrice', label: 'Estimated Price', required: false },
  { value: 'wagoCrossA', label: 'WAGO Cross A', required: true },
  { value: 'wagoCrossB', label: 'WAGO Cross B', required: false },
  { value: 'notesA', label: 'Notes A', required: false },
  { value: 'notesB', label: 'Notes B', required: false },
  { value: 'author', label: 'Author', required: false },
  { value: 'lastDateModified', label: 'Last Date Modified', required: false },
  { value: 'skip', label: '-- Skip --', required: false },
];

const NON_WAGO_FIELDS: FieldDef[] = [
  { value: 'manufacturer', label: 'Manufacturer', required: true },
  { value: 'partNumber', label: 'Part Number', required: true },
  { value: 'description', label: 'Description', required: false },
  { value: 'category', label: 'Category', required: false },
  { value: 'skip', label: '-- Skip --', required: false },
];

// ============================================================================
// Auto-mapping helpers
// ============================================================================

function guessProductField(header: string): ProductField {
  const h = header.toLowerCase().replace(/[\s_-]+/g, '');
  if (h.includes('partnumber') || h.includes('partno') || h.includes('itemno') || h.includes('sku')) return 'partNumber';
  if (h.includes('wagoident') || h.includes('internalident')) return 'wagoIdent';
  if (h === 'series' || h.includes('category') || h.includes('type') || h.includes('group')) return 'category';
  if (h.includes('per100') || h.includes('priceper100')) return 'listPricePer100';
  if (h.includes('priceeach') || h.includes('listpriceeach') || (h.includes('price') && !h.includes('100'))) return 'price';
  if (h.includes('englishdesc') || h.includes('engdesc')) return 'englishDescription';
  if (h.includes('desc')) return 'description';
  if (h.includes('discount') || h.includes('acp')) return 'distributorDiscount';
  if (h.includes('minqty') || h.includes('multiples') || h.includes('box') || h.includes('pack')) return 'minQty';
  if (h.includes('gridlevel') && h.includes('number')) return 'gridLevelNumber';
  if (h.includes('gridlevel') && h.includes('name')) return 'gridLevelName';
  if (h.includes('gridsublevel') && h.includes('number')) return 'gridSublevelNumber';
  if (h.includes('gridsublevel') && h.includes('name')) return 'gridSublevelName';
  if (h.includes('pricedate')) return 'priceDate';
  return 'skip';
}

function guessCrossRefField(header: string): CrossReferenceField {
  const h = header.toLowerCase().replace(/[\s_-]+/g, '');
  if (h.includes('partnumbera') || (h.includes('part') && h.includes('a') && h.length < 12)) return 'partNumberA';
  if (h.includes('partnumberb') || (h.includes('part') && h.includes('b') && h.length < 12)) return 'partNumberB';
  if (h.includes('manufactur') || h.includes('manu') || h.includes('mfr')) return 'manufactureName';
  if (h.includes('active')) return 'activeItem';
  if (h.includes('estimated') && h.includes('price')) return 'estimatedPrice';
  if (h.includes('wago') && h.includes('a')) return 'wagoCrossA';
  if (h.includes('wago') && h.includes('b')) return 'wagoCrossB';
  if (h.includes('notesa') || (h.includes('notes') && h.includes('a'))) return 'notesA';
  if (h.includes('notesb') || (h.includes('notes') && h.includes('b'))) return 'notesB';
  if (h.includes('author')) return 'author';
  if (h.includes('lastdate') || (h.includes('last') && h.includes('modified'))) return 'lastDateModified';
  return 'skip';
}

function guessNonWagoField(header: string): NonWagoField {
  const h = header.toLowerCase().replace(/[\s_-]+/g, '');
  if (h.includes('manufactur') || h.includes('manu') || h.includes('mfr') || h.includes('vendor')) return 'manufacturer';
  if (h.includes('partnumber') || h.includes('partno') || h.includes('part_number') || h.includes('item') || h.includes('sku')) return 'partNumber';
  if (h.includes('desc')) return 'description';
  if (h.includes('category') || h.includes('type') || h.includes('group')) return 'category';
  return 'skip';
}

// ============================================================================
// Sample CSV content
// ============================================================================

const SAMPLE_MASTER = `Part Number,Category,Price,Description
TEST-001,Connectors,1.25,Test product 1
TEST-002,Terminals,2.50,Test product 2`;

const SAMPLE_CROSSREF = `Part Number A,Part Number B,Manufacture Name,Active Item,Estimated Price,WAGO Cross A,WAGO Cross B,Notes A,Notes B,Author,Last Date Modified
ABC-123,,Acme Corp,Yes,1.25,221-413,221-414,Note for A,,admin,2025-02-15`;

const SAMPLE_NONWAGO = `manufacturer,partNumber,description,category
Phoenix Contact,1234567,Terminal block 2.5mm,Terminals`;

// ============================================================================
// Main component
// ============================================================================

export default function DataImports() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('master');

  // Master catalog ID (fetch once)
  const [masterCatalogId, setMasterCatalogId] = useState<string | null>(null);
  useEffect(() => {
    catalogApi.getAll().then((res) => {
      const list = Array.isArray(res.data) ? res.data : [];
      const master = list.find((c: { isMaster?: boolean }) => c.isMaster);
      if (master) setMasterCatalogId(master.id);
    }).catch(() => {});
  }, []);

  // Shared wizard state
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawData, setRawData] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<number, string>>({});
  const [replace, setReplace] = useState(false);
  const [updateOnly, setUpdateOnly] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [parsing, setParsing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getFields = () => {
    if (activeTab === 'master') return PRODUCT_FIELDS;
    if (activeTab === 'crossref') return CROSS_REF_FIELDS;
    return NON_WAGO_FIELDS;
  };

  const guessMapping = (header: string): string => {
    if (activeTab === 'master') return guessProductField(header);
    if (activeTab === 'crossref') return guessCrossRefField(header);
    return guessNonWagoField(header);
  };

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
          const autoMapping: Record<number, string> = {};
          data.headers.forEach((header, index) => {
            autoMapping[index] = guessMapping(header);
          });
          setColumnMapping(autoMapping);
          setStep('mapping');
          const truncated = data.rows.length >= MAX_IMPORT_ROWS ? ` (max ${MAX_IMPORT_ROWS})` : '';
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

  const validateMappings = (): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    const mapped = Object.values(columnMapping).filter((f) => f !== 'skip');
    const fields = getFields();
    if (activeTab === 'master') {
      const required = updateOnly ? ['partNumber'] : fields.filter((f) => f.required).map((f) => f.value);
      required.forEach((field) => {
        if (!mapped.includes(field)) {
          const def = fields.find((f) => f.value === field);
          errors.push(`Required: ${def?.label ?? field}`);
        }
      });
    } else if (activeTab === 'crossref') {
      const hasPart = mapped.includes('partNumberA') || mapped.includes('partNumberB');
      if (!hasPart) errors.push('At least one of Part Number A or B must be mapped');
      if (!mapped.includes('manufactureName')) errors.push('Manufacture Name is required');
      const hasWago = mapped.includes('wagoCrossA') || mapped.includes('wagoCrossB');
      if (!hasWago) errors.push('At least one of WAGO Cross A or B must be mapped');
    } else {
      if (!mapped.includes('manufacturer')) errors.push('Manufacturer is required');
      if (!mapped.includes('partNumber')) errors.push('Part Number is required');
    }
    if (new Set(mapped).size !== mapped.length) errors.push('Each field can only be mapped once');
    return { valid: errors.length === 0, errors };
  };

  const validation = step === 'mapping' ? validateMappings() : { valid: true, errors: [] as string[] };

  const transformMaster = (): Record<string, string | number | null>[] => {
    return rawData.map((row) => {
      const product: Record<string, string | number | null> = {};
      Object.entries(columnMapping).forEach(([indexStr, targetField]) => {
        if (targetField === 'skip') return;
        const index = parseInt(indexStr, 10);
        const value = row[index];
        if (value === undefined) return;
        if (['price', 'distributorDiscount', 'listPricePer100'].includes(targetField)) {
          product[targetField] = parseFloat(String(value).replace(/[^0-9.-]/g, '')) || 0;
        } else if (['minQty', 'gridLevelNumber', 'gridSublevelNumber'].includes(targetField)) {
          const parsed = parseInt(String(value).replace(/[^0-9]/g, ''), 10);
          product[targetField] = isNaN(parsed) ? null : parsed;
        } else {
          product[targetField] = value?.trim() || null;
        }
      });
      return product;
    });
  };

  const transformCrossRef = (): Record<string, string | number | boolean | null>[] => {
    return rawData.map((row) => {
      const out: Record<string, string | number | boolean | null> = {};
      Object.entries(columnMapping).forEach(([indexStr, targetField]) => {
        if (targetField === 'skip') return;
        const index = parseInt(indexStr, 10);
        const value = row[index]?.trim() ?? '';
        if (targetField === 'estimatedPrice') {
          const n = parseFloat(value.replace(/[^0-9.-]/g, ''));
          out[targetField] = Number.isNaN(n) ? null : n;
        } else if (targetField === 'activeItem') {
          const lower = value.toLowerCase();
          out[targetField] = lower === '1' || lower === 'true' || lower === 'yes';
        } else {
          out[targetField] = value || null;
        }
      });
      return out;
    });
  };

  const transformNonWago = (): Record<string, string | null>[] => {
    return rawData.map((row) => {
      const out: Record<string, string | null> = {};
      Object.entries(columnMapping).forEach(([indexStr, targetField]) => {
        if (targetField === 'skip') return;
        const index = parseInt(indexStr, 10);
        out[targetField] = row[index]?.trim() || null;
      });
      return out;
    });
  };

  const handleProceedToPreview = () => {
    if (!validation.valid) {
      toast.error(validation.errors[0]);
      return;
    }
    setStep('preview');
  };

  const handleImportMaster = async () => {
    if (!masterCatalogId) {
      toast.error('Master Catalog not found. Please ensure a Master Catalog exists.');
      return;
    }
    setImporting(true);
    setStep('importing');
    try {
      const products = transformMaster();
      const response = await api.post('/admin/products/import', {
        products,
        updateOnly,
        catalogId: masterCatalogId,
      });
      setImportResult(response.data);
      setStep('complete');
      toast.success('Import completed!');
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Import failed');
      setStep('preview');
    } finally {
      setImporting(false);
    }
  };

  const handleImportCrossRef = async () => {
    setImporting(true);
    setStep('importing');
    try {
      const rows = transformCrossRef();
      const response = await adminApi.importCrossReferencesMaster(rows, replace);
      setImportResult(response.data);
      setStep('complete');
      toast.success('Import completed!');
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Import failed');
      setStep('preview');
    } finally {
      setImporting(false);
    }
  };

  const handleImportNonWago = async () => {
    setImporting(true);
    setStep('importing');
    try {
      const rows = transformNonWago().filter((r) => r.manufacturer && r.partNumber);
      const csv = buildCSVFromRows(rows, ['manufacturer', 'partNumber', 'description', 'category']);
      const blob = new Blob([csv], { type: 'text/csv' });
      const f = new File([blob], 'non-wago-import.csv', { type: 'text/csv' });
      const { data } = await adminApi.importNonWagoProducts(f, replace);
      setImportResult(data);
      setStep('complete');
      toast.success('Import completed!');
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Import failed');
      setStep('preview');
    } finally {
      setImporting(false);
    }
  };

  const handleImport = () => {
    if (activeTab === 'master') handleImportMaster();
    else if (activeTab === 'crossref') handleImportCrossRef();
    else handleImportNonWago();
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
    let csv: string;
    let name: string;
    if (activeTab === 'master') {
      csv = SAMPLE_MASTER;
      name = 'master-catalog-template.csv';
    } else if (activeTab === 'crossref') {
      csv = SAMPLE_CROSSREF;
      name = 'cross-reference-template.csv';
    } else {
      csv = SAMPLE_NONWAGO;
      name = 'non-wago-database-template.csv';
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const previewData = () => {
    if (activeTab === 'master') return transformMaster();
    if (activeTab === 'crossref') return transformCrossRef();
    return transformNonWago();
  };

  const data = previewData();
  const mappedCols = headers.map((h, i) => ({ header: h, field: columnMapping[i], index: i })).filter((c) => c.field && c.field !== 'skip');
  const fields = getFields();

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <Link to="/admin" className="flex items-center text-green-600 hover:underline mb-2">
          ← Back to Admin
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Data Imports</h1>
        <p className="text-gray-600">
          Import Master Catalog (WAGO parts), Cross Reference (competitor → WAGO), or Non-WAGO Database. Project Books are not catalogs—they are built from the Master Catalog.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab('master')}
          className={`px-4 py-2 font-medium rounded-t-lg flex items-center gap-2 ${
            activeTab === 'master' ? 'bg-green-50 text-green-800 border border-b-0 border-green-200' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Package className="w-5 h-5" />
          Master Catalog
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('crossref')}
          className={`px-4 py-2 font-medium rounded-t-lg flex items-center gap-2 ${
            activeTab === 'crossref' ? 'bg-green-50 text-green-800 border border-b-0 border-green-200' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Link2 className="w-5 h-5" />
          Cross Reference
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('nonwago')}
          className={`px-4 py-2 font-medium rounded-t-lg flex items-center gap-2 ${
            activeTab === 'nonwago' ? 'bg-green-50 text-green-800 border border-b-0 border-green-200' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Database className="w-5 h-5" />
          Non-WAGO Database
        </button>
      </div>

      {/* Tab description */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        {activeTab === 'master' && (
          <p className="text-sm text-gray-700">
            <strong>Master Catalog</strong> is the single source of truth for WAGO parts. Upload a CSV to add or update products. Only the Master Catalog accepts product imports; Project Books are built from it and cannot be imported into.
          </p>
        )}
        {activeTab === 'crossref' && (
          <p className="text-sm text-gray-700">
            <strong>Cross Reference</strong> maps competitor manufacturer + part number to WAGO part numbers. Use this to link competitor parts to WAGO equivalents.
          </p>
        )}
        {activeTab === 'nonwago' && (
          <p className="text-sm text-gray-700">
            <strong>Non-WAGO Database</strong> tracks known competitor parts that may not yet have a WAGO cross-reference. Use Replace to wipe and reload, or leave unchecked to append/update.
          </p>
        )}
      </div>

      {/* Step indicator */}
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
            {activeTab === 'master' && !masterCatalogId && (
              <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-4 max-w-md mx-auto text-sm">
                No Master Catalog found. Create or set a Project Book as Master in the system first.
              </p>
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
              <p className="text-sm text-gray-500">Up to 25,000 rows</p>
            </div>
            <button type="button" onClick={downloadSample} className="mt-4 text-sm text-green-600 hover:underline inline-flex items-center gap-1">
              <Download className="w-4 h-4" /> Download sample template
            </button>
          </div>
        )}

        {step === 'mapping' && (
          <div>
            <h2 className="text-xl font-bold mb-4">Map Columns</h2>
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div>
                  {activeTab === 'master' && (
                    <>
                      <label className="font-medium block mb-1">Update-Only Mode</label>
                      <p className="text-sm text-gray-600">Only update existing products (no new rows created)</p>
                    </>
                  )}
                  {(activeTab === 'crossref' || activeTab === 'nonwago') && (
                    <>
                      <label className="font-medium block mb-1">Replace all</label>
                      <p className="text-sm text-gray-600">
                        {activeTab === 'crossref'
                          ? 'Wipe all cross-references and load only this file. Uncheck to add/merge.'
                          : 'Wipe all non-WAGO records and load only this file. Uncheck to append/update.'}
                      </p>
                    </>
                  )}
                </div>
                {activeTab === 'master' && (
                  <input type="checkbox" checked={updateOnly} onChange={(e) => setUpdateOnly(e.target.checked)} className="w-4 h-4 rounded text-green-600" />
                )}
                {(activeTab === 'crossref' || activeTab === 'nonwago') && (
                  <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} className="w-4 h-4 rounded text-green-600" />
                )}
              </div>
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
                          onChange={(e) => setColumnMapping({ ...columnMapping, [i]: e.target.value })}
                          className="input py-1.5 text-sm max-w-xs"
                        >
                          {fields.map((f) => (
                            <option key={f.value} value={f.value}>{f.label} {f.required ? '*' : ''}</option>
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
              <button type="button" onClick={() => setStep('upload')} className="btn bg-gray-200 hover:bg-gray-300 text-gray-800">Back</button>
              <button type="button" onClick={handleProceedToPreview} disabled={!validation.valid} className="btn btn-primary">Continue to Preview</button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div>
            <h2 className="text-xl font-bold mb-4">Preview ({data.length} rows)</h2>
            <div className="mb-6 grid grid-cols-4 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg text-center"><div className="text-2xl font-bold text-blue-900">{data.length}</div><div className="text-sm">Rows</div></div>
              <div className="p-4 bg-green-50 rounded-lg text-center"><div className="text-2xl font-bold text-green-900">{mappedCols.length}</div><div className="text-sm">Columns</div></div>
              <div className="p-4 bg-purple-50 rounded-lg text-center">
                <div className="font-bold text-purple-900">
                  {activeTab === 'master' ? (updateOnly ? 'Update' : 'Upsert') : replace ? 'Replace all' : 'Add/Merge'}
                </div>
                <div className="text-sm">Mode</div>
              </div>
            </div>
            <div className="overflow-x-auto mb-6 border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">#</th>
                    {mappedCols.map((c) => (
                      <th key={c.index} className="px-3 py-2 text-left">{fields.find((f) => f.value === c.field)?.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.slice(0, 10).map((row, ri) => (
                    <tr key={ri} className="border-t">
                      <td className="px-3 py-2 text-gray-500">{ri + 1}</td>
                      {mappedCols.map((c) => (
                        <td key={c.index} className="px-3 py-2">{String((row as Record<string, unknown>)[c.field!] ?? '—')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between">
              <button type="button" onClick={() => setStep('mapping')} className="btn bg-gray-200 hover:bg-gray-300 text-gray-800">Back</button>
              <button type="button" onClick={handleImport} disabled={importing} className="btn btn-primary">
                {activeTab === 'master' && `Import ${data.length} Products`}
                {activeTab === 'crossref' && (replace ? `Replace all & import ${data.length} rows` : `Add/merge ${data.length} rows`)}
                {activeTab === 'nonwago' && (replace ? `Replace all & import ${data.length} rows` : `Append/update ${data.length} rows`)}
              </button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Importing...</p>
          </div>
        )}

        {step === 'complete' && importResult && (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-4">Import Complete!</h2>
            <div className="grid grid-cols-4 gap-4 mb-6 max-w-2xl mx-auto">
              {activeTab === 'master' && (
                <>
                  <div className="p-4 bg-green-50 rounded-lg"><div className="text-2xl font-bold text-green-900">{importResult.created}</div><div className="text-sm">Created</div></div>
                  <div className="p-4 bg-blue-50 rounded-lg"><div className="text-2xl font-bold text-blue-900">{importResult.updated}</div><div className="text-sm">Updated</div></div>
                  <div className="p-4 bg-purple-50 rounded-lg"><div className="text-2xl font-bold text-purple-900">{importResult.priceChanges ?? 0}</div><div className="text-sm">Price changes</div></div>
                  <div className="p-4 bg-orange-50 rounded-lg"><div className="text-2xl font-bold text-orange-900">{importResult.errors?.length ?? 0}</div><div className="text-sm">Errors</div></div>
                </>
              )}
              {(activeTab === 'crossref' || activeTab === 'nonwago') && (
                <>
                  <div className="p-4 bg-green-50 rounded-lg"><div className="text-2xl font-bold text-green-900">{importResult.created}</div><div className="text-sm">Created</div></div>
                  <div className="p-4 bg-blue-50 rounded-lg"><div className="text-2xl font-bold text-blue-900">{importResult.updated ?? 0}</div><div className="text-sm">Updated</div></div>
                  <div className="p-4 bg-orange-50 rounded-lg"><div className="text-2xl font-bold text-orange-900">{importResult.errors?.length ?? 0}</div><div className="text-sm">Errors</div></div>
                </>
              )}
            </div>
            {activeTab === 'master' && importResult.notFound?.length > 0 && (
              <div className="mb-6 p-4 bg-yellow-50 rounded-lg text-left max-w-2xl mx-auto">
                <h4 className="font-semibold mb-2">Not found: {importResult.notFound.length}</h4>
                <p className="text-sm text-yellow-800 break-all">{importResult.notFound.slice(0, 10).join(', ')}{importResult.notFound.length > 10 ? '...' : ''}</p>
              </div>
            )}
            {importResult.errors?.length > 0 && (
              <div className="mb-6 p-4 bg-red-50 rounded-lg text-left max-w-2xl mx-auto">
                <h4 className="font-semibold mb-2">Errors</h4>
                {importResult.errors.slice(0, 10).map((e: string, i: number) => (
                  <p key={i} className="text-sm text-red-800">• {e}</p>
                ))}
              </div>
            )}
            <div className="flex gap-4 justify-center">
              {activeTab === 'master' && <button type="button" onClick={() => navigate('/catalog-list')} className="btn btn-primary">View Project Books</button>}
              {activeTab === 'crossref' && <button type="button" onClick={() => navigate('/bom-cross-reference')} className="btn btn-primary">BOM Cross-Reference</button>}
              <button type="button" onClick={handleNewImport} className="btn bg-gray-200 hover:bg-gray-300 text-gray-800">Import Another</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
