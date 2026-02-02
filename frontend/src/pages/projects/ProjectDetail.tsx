import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useProjectStore, type ProjectItem } from '@/stores/projectStore';
import { projectApi } from '@/lib/api';
import { publicApi } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Upload,
  Search,
  Table2,
  Download,
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
} from 'lucide-react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type ColumnDef,
} from '@tanstack/react-table';

type TabId = 'upload' | 'finder' | 'table';

const DEBOUNCE_SAVE_MS = 2500;

const columnHelper = createColumnHelper<ProjectItem>();

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const {
    project,
    items,
    loading,
    error,
    setProject,
    setLoading,
    setError,
    updateItem,
    addItem,
    removeItem,
    reset,
  } = useProjectStore();

  const [activeTab, setActiveTab] = useState<TabId>('table');
  const [uploadReplace, setUploadReplace] = useState(true);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [finderQuery, setFinderQuery] = useState('');
  const [finderLoading, setFinderLoading] = useState(false);
  const [finderResults, setFinderResults] = useState<
    Array<{
      id: string;
      partNumber: string;
      description: string;
      category: string;
      catalogName: string;
    }>
  >([]);
  const [addingPartId, setAddingPartId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const pendingUpdates = useRef<Record<string, { quantity?: number; panelAccessory?: 'PANEL' | 'ACCESSORY' | null }>>({});
  const flushTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadProject = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await projectApi.getById(projectId);
      setProject(data);
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
        : 'Failed to load project';
      setError(msg || 'Failed to load project');
      toast.error(msg || 'Failed to load project');
    } finally {
      setLoading(false);
    }
  }, [projectId, setProject, setLoading, setError]);

  useEffect(() => {
    if (!projectId) return;
    loadProject();
    return () => {
      reset();
      if (flushTimeout.current) clearTimeout(flushTimeout.current);
    };
  }, [projectId, loadProject, reset]);

  const flushPendingUpdates = useCallback(async () => {
    if (!projectId || Object.keys(pendingUpdates.current).length === 0) {
      setSaveStatus('idle');
      return;
    }
    const map = { ...pendingUpdates.current };
    pendingUpdates.current = {};
    setSaveStatus('saving');
    try {
      for (const [itemId, patch] of Object.entries(map)) {
        await projectApi.updateItem(projectId, itemId, patch);
      }
      setSaveStatus('saved');
      toast.success('Saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('idle');
      toast.error('Failed to save changes');
      for (const [itemId, patch] of Object.entries(map)) {
        pendingUpdates.current[itemId] = { ...pendingUpdates.current[itemId], ...patch };
      }
    }
  }, [projectId]);

  const scheduleSave = useCallback(
    (itemId: string, patch: { quantity?: number; panelAccessory?: 'PANEL' | 'ACCESSORY' | null }) => {
      pendingUpdates.current[itemId] = { ...pendingUpdates.current[itemId], ...patch };
      if (flushTimeout.current) clearTimeout(flushTimeout.current);
      flushTimeout.current = setTimeout(flushPendingUpdates, DEBOUNCE_SAVE_MS);
    },
    [flushPendingUpdates]
  );

  const handleQtyChange = useCallback(
    (itemId: string, value: number) => {
      const qty = Math.max(1, Math.floor(value) || 1);
      updateItem(itemId, { quantity: qty });
      scheduleSave(itemId, { quantity: qty });
    },
    [updateItem, scheduleSave]
  );

  const handleClassificationChange = useCallback(
    (itemId: string, value: 'PANEL' | 'ACCESSORY' | null) => {
      updateItem(itemId, { panelAccessory: value });
      scheduleSave(itemId, { panelAccessory: value });
    },
    [updateItem, scheduleSave]
  );

  const handleRemoveItem = useCallback(
    async (itemId: string) => {
      if (!projectId) return;
      try {
        await projectApi.deleteItem(projectId, itemId);
        removeItem(itemId);
        toast.success('Item removed');
      } catch {
        toast.error('Failed to remove item');
      }
    },
    [projectId, removeItem]
  );

  const handleUpload = async () => {
    if (!projectId || !uploadFile) {
      toast.error('Select a CSV file');
      return;
    }
    setUploading(true);
    try {
      await projectApi.uploadBOM(projectId, uploadFile, uploadReplace);
      toast.success('BOM uploaded');
      setUploadFile(null);
      await loadProject();
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
        : 'Upload failed';
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadSample = async () => {
    try {
      const { data } = await projectApi.getBOMSample();
      const url = URL.createObjectURL(data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bom-sample.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download sample');
    }
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
      setFinderResults(res.results || []);
    } catch {
      toast.error('Search failed');
      setFinderResults([]);
    } finally {
      setFinderLoading(false);
    }
  };

  const handleAddToBOM = async (r: (typeof finderResults)[0]) => {
    if (!projectId) return;
    setAddingPartId(r.id);
    try {
      const { data } = await projectApi.addItem(projectId, {
        partId: r.id,
        partNumber: r.partNumber,
        description: r.description,
        quantity: 1,
      });
      addItem(data);
      toast.success(`Added ${r.partNumber}`);
    } catch {
      toast.error('Failed to add to BOM');
    } finally {
      setAddingPartId(null);
    }
  };

  const bomColumns: ColumnDef<ProjectItem, unknown>[] = [
    columnHelper.accessor('partNumber', {
      header: 'Part #',
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor('manufacturer', {
      header: 'Manufacturer',
      cell: (info) => info.getValue() ?? '—',
    }),
    columnHelper.accessor('description', {
      header: 'Description',
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor('quantity', {
      header: 'Qty',
      cell: ({ row }) => (
        <input
          type="number"
          min={1}
          value={row.original.quantity}
          onChange={(e) => handleQtyChange(row.original.id, Number(e.target.value))}
          className="input w-20 py-1 text-center"
        />
      ),
    }),
    columnHelper.accessor('panelAccessory', {
      header: 'Classification',
      cell: ({ row }) => (
        <select
          value={row.original.panelAccessory ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            handleClassificationChange(row.original.id, v === '' ? null : (v as 'PANEL' | 'ACCESSORY'));
          }}
          className="input py-1 text-sm"
        >
          <option value="">—</option>
          <option value="PANEL">Panel</option>
          <option value="ACCESSORY">Accessory</option>
        </select>
      ),
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => handleRemoveItem(row.original.id)}
          className="p-2 text-red-600 hover:bg-red-50 rounded"
          title="Remove"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      ),
    }),
  ];

  const table = useReactTable({
    data: items,
    columns: bomColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (!projectId) {
    return (
      <div className="container-custom py-6">
        <p className="text-gray-600">Invalid project.</p>
      </div>
    );
  }

  if (loading && !project) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-10 h-10 text-wago-green animate-spin" />
      </div>
    );
  }

  if (error && !project) {
    return (
      <div className="container-custom py-6">
        <p className="text-red-600">{error}</p>
        <Link to="/projects" className="btn btn-secondary mt-4">
          Back to Projects
        </Link>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'upload', label: 'Upload', icon: <Upload className="w-4 h-4" /> },
    { id: 'finder', label: 'Product Finder', icon: <Search className="w-4 h-4" /> },
    { id: 'table', label: 'BOM Table', icon: <Table2 className="w-4 h-4" /> },
  ];

  return (
    <div className="container-custom py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            to="/projects"
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
            aria-label="Back to projects"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            {project.description && (
              <p className="text-gray-600 text-sm mt-0.5">{project.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          {saveStatus === 'saving' && (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving…</span>
            </>
          )}
          {saveStatus === 'saved' && <span className="text-green-600">Saved</span>}
        </div>
      </div>

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
            Upload a CSV with columns: manufacturer, partNumber, description, quantity (optional: unitPrice).
            Replace replaces all current items; Append adds to existing.
          </p>
          <div className="flex flex-wrap gap-4 mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="mode"
                checked={uploadReplace}
                onChange={() => setUploadReplace(true)}
              />
              Replace existing
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="mode"
                checked={!uploadReplace}
                onChange={() => setUploadReplace(false)}
              />
              Append
            </label>
          </div>
          <div className="mb-4">
            <button
              type="button"
              onClick={handleDownloadSample}
              className="btn btn-secondary flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download sample CSV
            </button>
          </div>
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center mb-4 cursor-pointer hover:border-wago-green/50 transition-colors"
            onClick={() => document.getElementById('bom-file-input')?.click()}
          >
            <input
              id="bom-file-input"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
            />
            {uploadFile ? (
              <p className="text-gray-700 font-medium">{uploadFile.name}</p>
            ) : (
              <p className="text-gray-500">Click or drop a CSV file here</p>
            )}
          </div>
          <button
            type="button"
            onClick={handleUpload}
            disabled={!uploadFile || uploading}
            className="btn btn-primary flex items-center gap-2"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Upload
              </>
            )}
          </button>
        </div>
      )}

      {activeTab === 'finder' && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Product Finder</h2>
          <p className="text-gray-600 mb-4">
            Search public catalogs and add parts to this project BOM.
          </p>
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
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Catalog</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700 w-28">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {finderResults.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{r.partNumber}</td>
                      <td className="px-4 py-3 text-gray-600">{r.description}</td>
                      <td className="px-4 py-3 text-gray-600">{r.category}</td>
                      <td className="px-4 py-3 text-gray-600">{r.catalogName}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleAddToBOM(r)}
                          disabled={addingPartId === r.id}
                          className="btn btn-secondary text-sm flex items-center gap-1"
                        >
                          {addingPartId === r.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Plus className="w-4 h-4" />
                          )}
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
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">BOM Table</h2>
            <span className="text-sm text-gray-500">{items.length} item(s)</span>
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
                  {table.getHeaderGroups().map((hg) => (
                    <tr key={hg.id}>
                      {hg.headers.map((h) => (
                        <th key={h.id} className="px-4 py-3 text-left font-medium text-gray-700">
                          {flexRender(h.column.columnDef.header, h.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {table.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50">
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-4 py-2">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
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
