import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, CheckCircle, ArrowLeft, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { adminApi } from '@/lib/api';

// ============================================================================
// Types
// ============================================================================

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

interface FieldDefinition {
  value: CrossReferenceField;
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

const CROSS_REF_FIELDS: FieldDefinition[] = [
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
  { value: 'skip', label: '-- Skip this column --', required: false },
];

const SAMPLE_CSV = `Part Number A,Part Number B,Manufacture Name,Active Item,Estimated Price,WAGO Cross A,WAGO Cross B,Notes A,Notes B,Author,Last Date Modified
ABC-123,,Acme Corp,Yes,1.25,221-413,221-414,Note for A,Note for B,admin,2025-02-15
XYZ-456,DEF-789,Phoenix Contact,,2.50,221-415,,Cross ref note,,,import,`;

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

function guessFieldMapping(header: string): CrossReferenceField {
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
  if (h.includes('lastdate') || h.includes('last') && h.includes('modified') || h.includes('modified')) return 'lastDateModified';
  return 'skip';
}

function validateMappings(columnMapping: Record<number, CrossReferenceField>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const mappedFields = Object.values(columnMapping).filter((f) => f !== 'skip');

  const hasPartNumber = mappedFields.includes('partNumberA') || mappedFields.includes('partNumberB');
  if (!hasPartNumber) {
    errors.push('At least one of Part Number A or Part Number B must be mapped');
  }

  if (!mappedFields.includes('manufactureName')) {
    errors.push('Manufacture Name is required');
  }

  const hasWago = mappedFields.includes('wagoCrossA') || mappedFields.includes('wagoCrossB');
  if (!hasWago) {
    errors.push('At least one of WAGO Cross A or WAGO Cross B must be mapped');
  }

  // Check for duplicate field mappings (mappedFields already excludes 'skip')
  if (new Set(mappedFields).size !== mappedFields.length) {
    errors.push('Each field can only be mapped once');
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// Main Component
// ============================================================================

type Step = 'upload' | 'mapping' | 'preview' | 'importing' | 'complete';

export default function CrossReferenceImport() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawData, setRawData] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<number, CrossReferenceField>>({});
  const [replace, setReplace] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; updated: number; totalRows: number; errors?: string[]; importBatchId?: string } | null>(null);
  const [parsing, setParsing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          const autoMapping: Record<number, CrossReferenceField> = {};
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
    const f = e.dataTransfer.files?.[0];
    if (f) processFile(f);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => setDragActive(false);

  const transformDataForImport = (): Record<string, string | number | boolean | null>[] => {
    return rawData.map((row) => {
      const out: Record<string, string | number | boolean | null> = {};
      Object.entries(columnMapping).forEach(([indexStr, targetField]) => {
        if (targetField === 'skip') return;
        const index = parseInt(indexStr, 10);
        const value = row[index];
        if (value === undefined) return;
        const trimmed = value?.trim() ?? '';
        if (targetField === 'estimatedPrice') {
          const n = parseFloat(trimmed.replace(/[^0-9.-]/g, ''));
          out[targetField] = Number.isNaN(n) ? null : n;
        } else if (targetField === 'activeItem') {
          const lower = trimmed.toLowerCase();
          out[targetField] = lower === '1' || lower === 'true' || lower === 'yes';
        } else {
          out[targetField] = trimmed || null;
        }
      });
      return out;
    });
  };

  const handleProceedToPreview = () => {
    const validation = validateMappings(columnMapping);
    if (!validation.valid) {
      toast.error(validation.errors[0]);
      return;
    }
    setStep('preview');
  };

  const handleImport = async () => {
    setImporting(true);
    setStep('importing');
    try {
      const rows = transformDataForImport();
      const response = await adminApi.importCrossReferencesMaster(rows, replace);
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
    a.download = 'cross-reference-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const validation = step === 'mapping' ? validateMappings(columnMapping) : { valid: true, errors: [] as string[] };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <button onClick={() => navigate('/admin')} className="flex items-center text-green-600 hover:underline mb-2">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Administration
        </button>
        <p className="text-sm text-gray-500 mb-1">Administration &gt; Cross Reference Import</p>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">MASTER Cross Reference Import</h1>
        <p className="text-gray-600">Import cross-reference data from CSV. Map columns, then choose Replace entire table or Add/merge, and import.</p>
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
          </div>
        )}

        {step === 'mapping' && (
          <div>
            <h2 className="text-xl font-bold mb-4">Map Columns</h2>
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <label className="font-medium block mb-1">Replace entire table</label>
                  <p className="text-sm text-gray-600">Check to wipe all cross-references and load only this file (e.g. first MASTER load). Uncheck to add/merge with existing data.</p>
                </div>
                <input
                  type="checkbox"
                  id="replace-check"
                  checked={replace}
                  onChange={(e) => setReplace(e.target.checked)}
                  className="w-4 h-4 rounded text-green-600"
                />
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
                          onChange={(e) => setColumnMapping({ ...columnMapping, [i]: e.target.value as CrossReferenceField })}
                          className="input py-1.5 text-sm max-w-xs"
                        >
                          {CROSS_REF_FIELDS.map((f) => (
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
              <button onClick={() => setStep('upload')} className="btn bg-gray-200 hover:bg-gray-300 text-gray-800">Back</button>
              <button onClick={handleProceedToPreview} disabled={!validation.valid} className="btn btn-primary">Continue to Preview</button>
            </div>
          </div>
        )}

        {step === 'preview' && (() => {
          const data = transformDataForImport();
          const mappedCols = headers.map((h, i) => ({ header: h, field: columnMapping[i], index: i })).filter((c) => c.field && c.field !== 'skip');
          return (
            <div>
              <h2 className="text-xl font-bold mb-4">Preview ({data.length} rows)</h2>
              <div className="mb-6 grid grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg text-center"><div className="text-2xl font-bold text-blue-900">{data.length}</div><div className="text-sm">Rows</div></div>
                <div className="p-4 bg-green-50 rounded-lg text-center"><div className="text-2xl font-bold text-green-900">{mappedCols.length}</div><div className="text-sm">Columns</div></div>
                <div className="p-4 bg-purple-50 rounded-lg text-center"><div className="font-bold text-purple-900">{replace ? 'Replace all' : 'Add / Merge'}</div><div className="text-sm">Mode</div></div>
              </div>
              <div className="overflow-x-auto mb-6 border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      {mappedCols.map((c) => (
                        <th key={c.index} className="px-3 py-2 text-left">{CROSS_REF_FIELDS.find((f) => f.value === c.field)?.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.slice(0, 5).map((row, ri) => (
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
                <button onClick={() => setStep('mapping')} className="btn bg-gray-200 hover:bg-gray-300 text-gray-800">Back</button>
                <button onClick={handleImport} disabled={importing} className="btn btn-primary">
                  {replace ? `Replace all & import ${data.length} rows` : `Add/merge ${data.length} rows`}
                </button>
              </div>
            </div>
          );
        })()}

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
            <div className="grid grid-cols-3 gap-4 mb-6 max-w-2xl mx-auto">
              <div className="p-4 bg-green-50 rounded-lg"><div className="text-2xl font-bold text-green-900">{importResult.created}</div><div className="text-sm">Created</div></div>
              <div className="p-4 bg-blue-50 rounded-lg"><div className="text-2xl font-bold text-blue-900">{importResult.updated}</div><div className="text-sm">Updated</div></div>
              <div className="p-4 bg-orange-50 rounded-lg"><div className="text-2xl font-bold text-orange-900">{importResult.errors?.length ?? 0}</div><div className="text-sm">Errors</div></div>
            </div>
            {importResult.errors?.length ? (
              <div className="mb-6 p-4 bg-red-50 rounded-lg text-left max-w-2xl mx-auto">
                <h4 className="font-semibold mb-2">Errors</h4>
                {importResult.errors.slice(0, 10).map((e: string, i: number) => (
                  <p key={i} className="text-sm text-red-800">• {e}</p>
                ))}
                {importResult.errors.length > 10 && <p className="text-sm text-red-600 mt-1">... and {importResult.errors.length - 10} more</p>}
              </div>
            ) : null}
            <div className="flex gap-4 justify-center">
              <button onClick={() => navigate('/bom-cross-reference')} className="btn btn-primary">BOM Cross-Reference</button>
              <button onClick={handleNewImport} className="btn bg-gray-200 hover:bg-gray-300 text-gray-800">Import Another</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StepIndicator({ number, label, active, completed }: { number: number; label: string; active: boolean; completed: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${completed ? 'bg-green-600 text-white' : active ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
        {completed ? <CheckCircle className="w-6 h-6" /> : number}
      </div>
      <span className="text-sm font-medium text-gray-700 mt-1">{label}</span>
    </div>
  );
}
