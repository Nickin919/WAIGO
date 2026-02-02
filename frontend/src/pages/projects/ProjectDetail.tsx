import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useProjectStore, type ProjectItem } from '@/stores/projectStore';
import { projectApi } from '@/lib/api';
import { publicApi } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  useProjectQuery,
  useSubmitProjectMutation,
  useFinalizeProjectMutation,
  useAddItemMutation,
  useDeleteItemMutation,
  useUploadBOMMutation,
  useApplyUpgradeMutation,
  projectKeys,
} from '@/hooks/useProjectQueries';
import {
  Upload,
  Search,
  Table2,
  Download,
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  Send,
  CheckCircle,
  FileText,
} from 'lucide-react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type ColumnDef,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';

type TabId = 'upload' | 'finder' | 'table';

const DEBOUNCE_SAVE_MS = 2500;
const VIRTUAL_THRESHOLD = 100;
const ROW_HEIGHT = 52;

const columnHelper = createColumnHelper<ProjectItem>();

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const projectQuery = useProjectQuery(projectId);
  const submitMutation = useSubmitProjectMutation(projectId);
  const finalizeMutation = useFinalizeProjectMutation(projectId);
  const addItemMutation = useAddItemMutation(projectId);
  const deleteItemMutation = useDeleteItemMutation(projectId);
  const uploadBOMMutation = useUploadBOMMutation(projectId);
  const applyUpgradeMutation = useApplyUpgradeMutation(projectId);

  const {
    project,
    items,
    setProject,
    updateItem,
    addItem,
    removeItem,
    reset,
  } = useProjectStore();

  const loading = projectQuery.isLoading;
  const err = projectQuery.error as { response?: { data?: { error?: string } } } | undefined;
  const error = projectQuery.isError ? (err?.response?.data?.error || 'Failed to load project') : null;

  useEffect(() => {
    if (projectQuery.data) setProject(projectQuery.data);
    else if (projectQuery.isFetched && !projectQuery.data) setProject(null);
  }, [projectQuery.data, projectQuery.isFetched, setProject]);

  useEffect(() => {
    if (!projectId) return;
    return () => {
      reset();
      if (flushTimeout.current) clearTimeout(flushTimeout.current);
    };
  }, [projectId, reset]);

  const loadProject = useCallback(() => {
    if (projectId) projectQuery.refetch();
  }, [projectId, projectQuery]);

  const [activeTab, setActiveTab] = useState<TabId>('table');
  const [uploadReplace, setUploadReplace] = useState(true);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
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
  const [suggestions, setSuggestions] = useState<
    Array<{
      itemId: string;
      partNumber: string;
      manufacturer: string | null;
      wagoEquivalents: Array<{
        wagoPartId: string;
        partNumber: string;
        description: string;
        compatibilityScore: number;
        notes: string | null;
      }>;
    }>
  >([]);
  const [applyingItemId, setApplyingItemId] = useState<string | null>(null);
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);
  const [resolveItemId, setResolveItemId] = useState<string | null>(null);
  const [resolveSearchQuery, setResolveSearchQuery] = useState('');
  const [resolveSearchResults, setResolveSearchResults] = useState<Array<{ id: string; partNumber: string; description: string; category: string; catalogName: string }>>([]);
  const [resolveSearching, setResolveSearching] = useState(false);
  const pendingUpdates = useRef<Record<string, { quantity?: number; panelAccessory?: 'PANEL' | 'ACCESSORY' | null }>>({});
  const flushTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!projectId || project?.status !== 'SUBMITTED') return;
    projectApi.suggestUpgrades(projectId).then(({ data }) => {
      const res = data as { suggestions?: typeof suggestions };
      setSuggestions(res.suggestions ?? []);
    }).catch(() => setSuggestions([]));
  }, [projectId, project?.status]);

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
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
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
  }, [projectId, queryClient]);

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
      removeItem(itemId);
      try {
        await deleteItemMutation.mutateAsync(itemId);
        toast.success('Item removed');
      } catch {
        toast.error('Failed to remove item');
        queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
      }
    },
    [projectId, removeItem, deleteItemMutation, queryClient]
  );

  const handleUpload = async () => {
    if (!projectId || !uploadFile) {
      toast.error('Select a CSV file');
      return;
    }
    try {
      await uploadBOMMutation.mutateAsync({ file: uploadFile, replace: uploadReplace });
      toast.success('BOM uploaded');
      setUploadFile(null);
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
        : 'Upload failed';
      toast.error(msg);
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
      const data = await addItemMutation.mutateAsync({
        partId: r.id,
        partNumber: r.partNumber,
        description: r.description,
        quantity: 1,
      });
      addItem(data as ProjectItem);
      toast.success(`Added ${r.partNumber}`);
    } catch {
      toast.error('Failed to add to BOM');
    } finally {
      setAddingPartId(null);
    }
  };

  const handleSubmit = async () => {
    if (!projectId) return;
    try {
      await submitMutation.mutateAsync();
      for (;;) {
        const { data } = await projectQuery.refetch();
        if (data && (data as { status?: string }).status !== 'PROCESSING') {
          setProject(data);
          break;
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
      toast.success('Project submitted for review');
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
        : 'Submit failed';
      toast.error(msg);
    }
  };

  const handleFinalize = async () => {
    if (!projectId) return;
    setShowFinalizeConfirm(false);
    try {
      await finalizeMutation.mutateAsync();
      await projectQuery.refetch();
      if (projectQuery.data) setProject(projectQuery.data);
      toast.success('Project finalized');
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
        : 'Finalize failed';
      toast.error(msg);
    }
  };

  const handleApplyUpgrade = async (itemId: string, wagoPartId: string) => {
    if (!projectId) return;
    setApplyingItemId(itemId);
    try {
      await applyUpgradeMutation.mutateAsync({ itemId, wagoPartId });
      setSuggestions((prev) => prev.filter((s) => s.itemId !== itemId));
      toast.success('WAGO part applied');
    } catch {
      toast.error('Failed to apply upgrade');
    } finally {
      setApplyingItemId(null);
    }
  };

  const handleResolveSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = resolveSearchQuery.trim();
    if (q.length < 2) return;
    setResolveSearching(true);
    try {
      const { data } = await publicApi.searchParts(q, { limit: 20 });
      const res = data as { results?: typeof resolveSearchResults };
      setResolveSearchResults(res.results ?? []);
    } catch {
      setResolveSearchResults([]);
    } finally {
      setResolveSearching(false);
    }
  };

  const handleResolvePickPart = async (part: { id: string; partNumber: string; description: string }) => {
    if (!projectId || !resolveItemId) return;
    try {
      await projectApi.updateItem(projectId, resolveItemId, { partId: part.id });
      await loadProject();
      setResolveItemId(null);
      setResolveSearchQuery('');
      setResolveSearchResults([]);
      toast.success(`Resolved with ${part.partNumber}`);
    } catch {
      toast.error('Failed to resolve');
    }
  };

  const isDraft = project?.status === 'DRAFT';
  const isSubmitted = project?.status === 'SUBMITTED';
  const isCompleted = project?.status === 'COMPLETED';

  const getSuggestionForItem = (itemId: string) => suggestions.find((s) => s.itemId === itemId);

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
      cell: ({ row }) =>
        isDraft ? (
          <input
            type="number"
            min={1}
            value={row.original.quantity}
            onChange={(e) => handleQtyChange(row.original.id, Number(e.target.value))}
            className="input w-20 py-1 text-center"
          />
        ) : (
          <span>{row.original.quantity}</span>
        ),
    }),
    columnHelper.accessor('isWagoPart', {
      header: 'Type',
      cell: ({ row }) => (
        <span className={row.original.isWagoPart ? 'text-green-600' : 'text-gray-600'}>
          {row.original.isWagoPart ? 'WAGO' : 'Non-WAGO'}
        </span>
      ),
    }),
    columnHelper.accessor('panelAccessory', {
      header: 'Classification',
      cell: ({ row }) =>
        isDraft ? (
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
        ) : (
          <span>{row.original.panelAccessory ?? '—'}</span>
        ),
    }),
    ...(isSubmitted
      ? [
          columnHelper.display({
            id: 'wagoSuggestion',
            header: 'WAGO suggestion',
            cell: ({ row }) => {
              const sug = getSuggestionForItem(row.original.id);
              if (!sug || sug.wagoEquivalents.length === 0) {
                if (!row.original.partId)
                  return (
                    <button
                      type="button"
                      onClick={() => setResolveItemId(row.original.id)}
                      className="btn btn-secondary text-sm"
                    >
                      Resolve
                    </button>
                  );
                return <span>—</span>;
              }
              const best = sug.wagoEquivalents[0];
              const applying = applyingItemId === row.original.id;
              return (
                <div className="flex flex-col gap-1">
                  <span className="text-sm text-gray-700">{best.partNumber}</span>
                  <button
                    type="button"
                    onClick={() => handleApplyUpgrade(row.original.id, best.wagoPartId)}
                    disabled={applying}
                    className="btn btn-primary text-xs"
                  >
                    {applying ? <Loader2 className="w-3 h-3 animate-spin inline" /> : null}
                    Apply
                  </button>
                </div>
              );
            },
          }),
        ]
      : []),
    ...(isDraft
      ? [
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
        ]
      : []),
  ];

  const table = useReactTable({
    data: items,
    columns: bomColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  const rows = table.getRowModel().rows;
  const bomTableContainerRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => bomTableContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  });
  const useVirtual = items.length > VIRTUAL_THRESHOLD;

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
        <div className="flex items-center gap-4 flex-wrap">
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving…
            </span>
          )}
          {saveStatus === 'saved' && <span className="text-sm text-green-600">Saved</span>}
          {isDraft && items.length > 0 && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitMutation.isPending}
              className="btn btn-primary flex items-center gap-2"
            >
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Submit for Review
                </>
              )}
            </button>
          )}
          {isSubmitted && (
            <button
              type="button"
              onClick={() => setShowFinalizeConfirm(true)}
              disabled={finalizeMutation.isPending}
              className="btn btn-primary flex items-center gap-2"
            >
              {finalizeMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Finalizing…
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Accept & Finalize
                </>
              )}
            </button>
          )}
          {isCompleted && (
            <Link
              to={`/projects/${projectId}/report`}
              className="btn btn-secondary flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              View Report
            </Link>
          )}
        </div>
      </div>

      {showFinalizeConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Accept & Finalize</h3>
            <p className="text-gray-600 mb-4">
              This will mark the project as completed. You can view the report afterward. Continue?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowFinalizeConfirm(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button type="button" onClick={handleFinalize} className="btn btn-primary">
                Finalize
              </button>
            </div>
          </div>
        </div>
      )}

      {resolveItemId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Resolve unknown part</h3>
              <button
                type="button"
                onClick={() => {
                  setResolveItemId(null);
                  setResolveSearchQuery('');
                  setResolveSearchResults([]);
                }}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded"
              >
                ×
              </button>
            </div>
            <div className="p-4 border-b border-gray-200">
              <form onSubmit={handleResolveSearch} className="flex gap-2">
                <input
                  type="text"
                  value={resolveSearchQuery}
                  onChange={(e) => setResolveSearchQuery(e.target.value)}
                  placeholder="Search part number or description..."
                  className="input flex-1"
                />
                <button type="submit" disabled={resolveSearching} className="btn btn-primary">
                  {resolveSearching ? 'Searching…' : 'Search'}
                </button>
              </form>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {resolveSearchResults.length === 0 && !resolveSearching && (
                <p className="text-gray-500 text-sm">Search for a WAGO part to assign to this line.</p>
              )}
              <ul className="space-y-2">
                {resolveSearchResults.map((part) => (
                  <li
                    key={part.id}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <div>
                      <span className="font-medium">{part.partNumber}</span>
                      <p className="text-sm text-gray-600">{part.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleResolvePickPart(part)}
                      className="btn btn-primary text-sm"
                    >
                      Use this part
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
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
          {!isDraft ? (
            <p className="text-gray-600">This project has been submitted. Upload is only available for draft projects.</p>
          ) : (
            <>
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
            disabled={!uploadFile || uploadBOMMutation.isPending}
            className="btn btn-primary flex items-center gap-2"
          >
            {uploadBOMMutation.isPending ? (
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
            </>
          )}
        </div>
      )}

      {activeTab === 'finder' && (
        <div className="card p-6">
          {!isDraft ? (
            <p className="text-gray-600">This project has been submitted. Product Finder is only available for draft projects.</p>
          ) : (
            <>
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
            </>
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
          ) : useVirtual ? (
            <div ref={bomTableContainerRef} className="overflow-auto max-h-[60vh] overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0 z-10 bg-gray-50">
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
                <tbody
                  className="divide-y divide-gray-200 relative"
                  style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
                >
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const row = rows[virtualRow.index];
                    return (
                      <tr
                        key={row.id}
                        className="hover:bg-gray-50 absolute left-0 w-full"
                        style={{
                          height: `${ROW_HEIGHT}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                          display: 'table',
                          tableLayout: 'fixed',
                          width: '100%',
                        }}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="px-4 py-2">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
                  {rows.map((row) => (
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
