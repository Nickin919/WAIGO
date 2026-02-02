import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Upload, Search, Table2, Download, Plus, Loader2, UserPlus } from 'lucide-react';
import Papa from 'papaparse';
import toast from 'react-hot-toast';
import { publicApi } from '@/lib/api';
import { useAuthStore, isGuestUser } from '@/stores/authStore';

const SAMPLE_CSV = 'manufacturer,partNumber,description,quantity\nWAGO,221-413,PCB terminal block 2.5mm,10\nPhoenix Contact,1234567,Competitor terminal,5\n';

type GuestBomItem = {
  id: string;
  manufacturer: string;
  partNumber: string;
  description: string;
  quantity: number;
  wagoEquivalent?: {
    partNumber: string;
    description: string;
    compatibilityScore: number;
    notes?: string | null;
    minQty?: number | null;
    packageQty?: number | null;
  } | null;
};

type TabId = 'upload' | 'finder' | 'table';

function generateId() {
  return `guest-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function BomAnalyzer() {
  const guest = useAuthStore(isGuestUser);
  const [activeTab, setActiveTab] = useState<TabId>('table');
  const [items, setItems] = useState<GuestBomItem[]>([]);
  const [uploadReplace, setUploadReplace] = useState(true);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [finderQuery, setFinderQuery] = useState('');
  const [finderLoading, setFinderLoading] = useState(false);
  const [finderResults, setFinderResults] = useState<
    Array<{ id: string; partNumber: string; description: string; category: string; catalogName: string }>
  >([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  const handleDownloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bom-sample.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Sample CSV downloaded');
  };

  const handleUpload = () => {
    if (!uploadFile) {
      toast.error('Select a CSV file');
      return;
    }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = Papa.parse<Record<string, string>>(reader.result as string, {
          header: true,
          skipEmptyLines: true
        });
        const rows = (parsed.data ?? []).filter((r) => r.partNumber?.trim());
        if (rows.length === 0) {
          toast.error('No valid rows (need partNumber column)');
          setUploading(false);
          return;
        }
        const newItems: GuestBomItem[] = rows.map((row) => ({
          id: generateId(),
          manufacturer: row.manufacturer?.trim() || '',
          partNumber: row.partNumber.trim(),
          description: row.description?.trim() || row.partNumber.trim(),
          quantity: Math.max(1, parseInt(row.quantity, 10) || 1)
        }));
        setItems((prev) => (uploadReplace ? newItems : [...prev, ...newItems]));
        setUploadFile(null);
        toast.success(`Added ${newItems.length} item(s)`);
      } catch {
        toast.error('Failed to parse CSV');
      } finally {
        setUploading(false);
      }
    };
    reader.readAsText(uploadFile);
  };

  const handleFinderSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = finderQuery.trim();
    if (q.length < 2) {
      toast.error('Enter at least 2 characters');
      return;
    }
    setFinderLoading(true);
    try {
      const { data } = await publicApi.searchParts(q, { limit: 50 });
      const res = data as { results?: typeof finderResults };
      setFinderResults(res.results ?? []);
    } catch {
      toast.error('Search failed');
      setFinderResults([]);
    } finally {
      setFinderLoading(false);
    }
  };

  const handleAddToBOM = (r: (typeof finderResults)[0]) => {
    setItems((prev) => [
      ...prev,
      {
        id: generateId(),
        manufacturer: 'WAGO',
        partNumber: r.partNumber,
        description: r.description,
        quantity: 1
      }
    ]);
    toast.success(`Added ${r.partNumber}`);
  };

  const handleGetSuggestions = async () => {
    if (items.length === 0) {
      toast.error('Add items first (Upload or Product Finder)');
      return;
    }
    setSuggestionsLoading(true);
    try {
      const payload = items.map((i) => ({
        manufacturer: i.manufacturer || 'Unknown',
        partNumber: i.partNumber,
        quantity: i.quantity,
        description: i.description
      }));
      const { data } = await publicApi.crossReferenceBulk(payload);
      type BulkResult = { original: { manufacturer: string; partNumber: string }; wagoEquivalent: GuestBomItem['wagoEquivalent'] | null };
      const bulkResults: BulkResult[] = (data as { results?: BulkResult[] }).results ?? [];
      setItems((prev) =>
        prev.map((item, idx) => ({
          ...item,
          wagoEquivalent: bulkResults[idx]?.wagoEquivalent ?? undefined
        }))
      );
      const matchCount = bulkResults.filter((r) => r.wagoEquivalent).length;
      toast.success(`${matchCount} of ${items.length} WAGO suggestion(s) found`);
    } catch {
      toast.error('Failed to get suggestions');
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'upload', label: 'Upload', icon: <Upload className="w-4 h-4" /> },
    { id: 'finder', label: 'Product Finder', icon: <Search className="w-4 h-4" /> },
    { id: 'table', label: 'BOM Table', icon: <Table2 className="w-4 h-4" /> }
  ];

  return (
    <div className="container-custom py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">BOM Analyzer</h1>
      <p className="text-gray-600 mb-6">
        Build a BOM with Upload or Product Finder, then get WAGO equivalents. No sign-in required. Sign up to save as a project.
      </p>

      {guest && (
        <div className="mb-6 p-4 rounded-lg bg-green-50 border border-green-200 flex flex-wrap items-center justify-between gap-4">
          <p className="text-green-800 text-sm">
            You're browsing as a guest. Sign up to save this BOM as a project and access full features.
          </p>
          <Link
            to="/register"
            className="btn btn-primary flex items-center gap-2 shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            Sign up to save
          </Link>
        </div>
      )}

      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-1" aria-label="Tabs">
          {tabs.map(({ id, label, icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors ${
                activeTab === id
                  ? 'border-wago-green text-wago-green'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'upload' && (
        <div className="card p-6 max-w-2xl">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload BOM CSV</h2>
          <p className="text-gray-600 mb-4">
            CSV columns: manufacturer, partNumber, description, quantity. Replace clears current list; Append adds to it.
          </p>
          <div className="flex flex-wrap gap-4 mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="mode" checked={uploadReplace} onChange={() => setUploadReplace(true)} />
              Replace
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="mode" checked={!uploadReplace} onChange={() => setUploadReplace(false)} />
              Append
            </label>
          </div>
          <div className="mb-4">
            <button type="button" onClick={handleDownloadSample} className="btn btn-secondary flex items-center gap-2">
              <Download className="w-4 h-4" />
              Download sample CSV
            </button>
          </div>
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center mb-4 cursor-pointer hover:border-wago-green/50"
            onClick={() => document.getElementById('guest-bom-file')?.click()}
          >
            <input
              id="guest-bom-file"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
            />
            {uploadFile ? <p className="font-medium text-gray-700">{uploadFile.name}</p> : <p className="text-gray-500">Click to select CSV</p>}
          </div>
          <button type="button" onClick={handleUpload} disabled={!uploadFile || uploading} className="btn btn-primary flex items-center gap-2">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? 'Processing…' : 'Upload'}
          </button>
        </div>
      )}

      {activeTab === 'finder' && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Product Finder</h2>
          <p className="text-gray-600 mb-4">Search and add WAGO parts to your BOM.</p>
          <form onSubmit={handleFinderSearch} className="flex gap-2 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={finderQuery}
                onChange={(e) => setFinderQuery(e.target.value)}
                placeholder="Part number or description..."
                className="input w-full pl-10"
              />
            </div>
            <button type="submit" disabled={finderLoading} className="btn btn-primary">
              {finderLoading ? 'Searching…' : 'Search'}
            </button>
          </form>
          {finderResults.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Part Number</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Description</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Category</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700 w-28">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {finderResults.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{r.partNumber}</td>
                      <td className="px-4 py-3 text-gray-600">{r.description}</td>
                      <td className="px-4 py-3 text-gray-600">{r.category}</td>
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => handleAddToBOM(r)} className="btn btn-secondary text-sm flex items-center gap-1">
                          <Plus className="w-4 h-4" />
                          Add to BOM
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'table' && (
        <div className="card overflow-hidden">
          <div className="px-6 py-3 border-b border-gray-200 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-gray-900">BOM Table ({items.length} items)</h2>
            <button
              type="button"
              onClick={handleGetSuggestions}
              disabled={items.length === 0 || suggestionsLoading}
              className="btn btn-primary flex items-center gap-2"
            >
              {suggestionsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {suggestionsLoading ? 'Getting suggestions…' : 'Get WAGO suggestions'}
            </button>
          </div>
          {items.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Table2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No items yet. Use Upload or Product Finder to add parts.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Part #</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Manufacturer</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Description</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-700">Qty</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">WAGO suggestion</th>
                    <th className="px-4 py-3 w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{item.partNumber}</td>
                      <td className="px-4 py-3 text-gray-600">{item.manufacturer || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{item.description}</td>
                      <td className="px-4 py-3 text-right">{item.quantity}</td>
                      <td className="px-4 py-3">
                        {item.wagoEquivalent ? (
                          <div>
                            <span className="font-medium text-green-700">{item.wagoEquivalent.partNumber}</span>
                            <p className="text-xs text-gray-600">{item.wagoEquivalent.description}</p>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="text-red-600 hover:text-red-700 text-xs"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
