import { useState, useEffect, useCallback } from 'react';
import { Plus, FolderOpen, Download, Trash2, Upload, FileSpreadsheet, FileText, AlertTriangle, CheckCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { costTableApi } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

// Sample CSV for download (matches backend expected format)
const SAMPLE_CSV = `Part Number,Description,Custom Cost,Notes
750-352,Cage Clamp Connector 2 Position,2.45,Sample part
750-353,Cage Clamp Connector 3 Position,3.12,Minimum order 10
750-880,8-Channel Digital I/O Module,45.00,
750-530,Power Supply 24V DC,28.50,Volume discount available`;

interface PricingContract {
  id: string;
  name: string;
  description: string | null;
  userId: string | null;
  turnkeyTeamId: string | null;
  user?: { firstName: string | null; lastName: string | null; email: string | null } | null;
  turnkeyTeam?: { name: string } | null;
  _count?: { items: number };
}

const PricingContractsPage = () => {
  const { user } = useAuthStore();
  const [contracts, setContracts] = useState<PricingContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [createDropFile, setCreateDropFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<{
    contractId: string;
    imported: number;
    skipped: Array<{ partNumber: string; reason: string }>;
    unparsed: string[];
    seriesDiscounts?: Array<{ series: string; discountPercent: number; description: string }>;
    warnings?: Array<{ type: string; message: string; partNumber?: string }>;
    metadata?: { quoteNumber?: string; customerName?: string };
    stats?: { totalLinesProcessed: number; productRows: number; discountRows: number };
  } | null>(null);

  const canManage = user?.role && ['TURNKEY', 'DISTRIBUTOR', 'RSM', 'ADMIN'].includes(user.role);

  const loadContracts = useCallback(() => {
    if (!canManage) return;
    setLoading(true);
    costTableApi
      .getAll()
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : [];
        setContracts(data);
      })
      .catch(() => {
        toast.error('Failed to load pricing contracts');
        setContracts([]);
      })
      .finally(() => setLoading(false));
  }, [canManage]);

  useEffect(() => {
    loadContracts();
  }, [loadContracts]);

  const handleDownloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pricing-contract-sample.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Sample CSV downloaded');
  };

  const handleCreate = () => {
    if (!newName.trim()) {
      toast.error('Name is required');
      return;
    }
    setCreating(true);
    costTableApi
      .create({
        name: newName.trim(),
        description: newDesc.trim() || undefined,
      })
      .then((res) => {
        const newId = res.data?.id;
        toast.success('Pricing contract created');
        setShowCreate(false);
        setNewName('');
        setNewDesc('');
        setCreateDropFile(null);
        loadContracts();

        // If user dropped a file, upload it to the new contract
        if (newId && createDropFile) {
          setUploadingId(newId);
          const formData = new FormData();
          formData.append('csv', createDropFile);
          formData.append('costTableId', newId);
          costTableApi
            .uploadCsv(formData)
            .then((uploadRes) => {
              toast.success(`CSV uploaded: ${uploadRes.data?.itemsImported ?? 'items'} imported`);
              loadContracts();
            })
            .catch((err: unknown) =>
              toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to upload CSV')
            )
            .finally(() => {
              setUploadingId(null);
              setCreateDropFile(null);
            });
        }
      })
      .catch((err: unknown) =>
        toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to create')
      )
      .finally(() => setCreating(false));
  };

  const handleUploadFile = (id: string, file: File) => {
    const isPdf = file.name.toLowerCase().endsWith('.pdf');
    const isCsv = file.name.toLowerCase().endsWith('.csv');
    
    if (!isPdf && !isCsv) {
      toast.error('Please select a CSV or PDF file');
      return;
    }
    
    setUploadingId(id);
    const formData = new FormData();
    
    if (isPdf) {
      formData.append('pdf', file);
      costTableApi
        .uploadPdf(id, formData)
        .then((res) => {
          const data = res.data;
          const imported = data?.itemsImported ?? 0;
          const skipped = data?.skipped ?? [];
          const unparsed = data?.unparsedRowDetails ?? [];
          const seriesDiscounts = data?.seriesDiscounts ?? [];
          const warnings = data?.warnings ?? [];
          const metadata = data?.metadata ?? {};
          const stats = data?.stats ?? {};
          
          if (imported > 0) {
            const quoteInfo = metadata?.quoteNumber ? ` (Quote: ${metadata.quoteNumber})` : '';
            toast.success(`PDF imported: ${imported} items added${quoteInfo}`);
          }
          
          // Show results modal (always show for PDF to display series discounts)
          setUploadResult({
            contractId: id,
            imported,
            skipped,
            unparsed,
            seriesDiscounts,
            warnings,
            metadata,
            stats,
          });
          
          loadContracts();
        })
        .catch((err: unknown) => {
          const errData = (err as { response?: { data?: { error?: string; unparsedRows?: string[]; warnings?: Array<{ type: string; message: string }> } } })?.response?.data;
          toast.error(errData?.error || 'Failed to upload PDF');
          setUploadResult({
            contractId: id,
            imported: 0,
            skipped: [],
            unparsed: errData?.unparsedRows ?? [],
            warnings: errData?.warnings ?? [],
          });
        })
        .finally(() => setUploadingId(null));
    } else {
      formData.append('csv', file);
      formData.append('costTableId', id);
      costTableApi
        .uploadCsv(formData)
        .then((res) => {
          toast.success(`CSV uploaded: ${res.data?.itemsImported ?? 'items'} imported`);
          loadContracts();
        })
        .catch((err: unknown) =>
          toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to upload CSV')
        )
        .finally(() => setUploadingId(null));
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete pricing contract "${name}"?`)) return;
    try {
      await costTableApi.delete(id);
      toast.success('Pricing contract deleted');
      loadContracts();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to delete');
    }
  };

  const handleDownload = (id: string, name: string) => {
    costTableApi
      .downloadCsv(id)
      .then((res) => {
        const blob = new Blob([res.data], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pricing-contract-${name.replace(/\s+/g, '-')}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Download started');
      })
      .catch(() => toast.error('Download failed'));
  };

  const onDrop = useCallback(
    (e: React.DragEvent, targetId?: string) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      if (targetId) {
        handleUploadFile(targetId, file);
      } else if (showCreate) {
        setCreateDropFile(file);
      }
    },
    [showCreate]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>, targetId?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (targetId) {
      handleUploadFile(targetId, file);
    } else if (showCreate) {
      setCreateDropFile(file);
    }
    e.target.value = '';
  };

  const DropZone = ({
    id,
    label = 'Drop CSV or PDF here',
  }: {
    id?: string;
    label?: string;
  }) => (
    <div
      onDrop={(e) => onDrop(e, id)}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
        dragActive ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-green-400 bg-gray-50'
      }`}
    >
      <input
        type="file"
        accept=".csv,.pdf"
        className="hidden"
        id={id ? `upload-${id}` : 'create-upload'}
        onChange={(e) => onFileSelect(e, id)}
      />
      <label
        htmlFor={id ? `upload-${id}` : 'create-upload'}
        className="cursor-pointer flex flex-col items-center gap-2"
      >
        <div className="flex gap-2">
          <FileSpreadsheet className="w-8 h-8 text-gray-400" />
          <FileText className="w-8 h-8 text-gray-400" />
        </div>
        <span className="text-sm text-gray-600">{label}</span>
        <span className="text-xs text-gray-500">CSV (Part Number, Description, Cost) or WAGO Quote PDF</span>
      </label>
    </div>
  );

  // Results modal for showing import details
  const UploadResultsModal = () => {
    if (!uploadResult) return null;
    const { imported, skipped, unparsed, seriesDiscounts, warnings, metadata, stats } = uploadResult;
    const hasIssues = skipped.length > 0 || unparsed.length > 0 || (warnings && warnings.length > 0);

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              {hasIssues ? (
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
              ) : (
                <CheckCircle className="w-5 h-5 text-green-500" />
              )}
              <div>
                <h3 className="font-semibold">PDF Import Results</h3>
                {metadata?.quoteNumber && (
                  <p className="text-xs text-gray-500">Quote: {metadata.quoteNumber}</p>
                )}
              </div>
            </div>
            <button onClick={() => setUploadResult(null)} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 overflow-y-auto max-h-[65vh] space-y-4">
            {/* Summary stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-green-50 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-700">{imported}</div>
                <div className="text-xs text-green-600">Items Imported</div>
              </div>
              {stats?.discountRows !== undefined && stats.discountRows > 0 && (
                <div className="p-3 bg-blue-50 rounded-lg text-center">
                  <div className="text-2xl font-bold text-blue-700">{stats.discountRows}</div>
                  <div className="text-xs text-blue-600">Series Discounts</div>
                </div>
              )}
              {skipped.length > 0 && (
                <div className="p-3 bg-yellow-50 rounded-lg text-center">
                  <div className="text-2xl font-bold text-yellow-700">{skipped.length}</div>
                  <div className="text-xs text-yellow-600">Skipped</div>
                </div>
              )}
              {unparsed.length > 0 && (
                <div className="p-3 bg-red-50 rounded-lg text-center">
                  <div className="text-2xl font-bold text-red-700">{unparsed.length}</div>
                  <div className="text-xs text-red-600">Unparsed</div>
                </div>
              )}
            </div>

            {/* Series discounts applied */}
            {seriesDiscounts && seriesDiscounts.length > 0 && (
              <div>
                <h4 className="font-medium text-blue-700 mb-2 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  Series Discounts Applied
                </h4>
                <div className="bg-blue-50 rounded-lg p-3 text-sm">
                  <div className="flex flex-wrap gap-2">
                    {seriesDiscounts.map((d, i) => (
                      <span key={i} className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                        Series {d.series}: {d.discountPercent}% off
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-blue-600 mt-2">
                    Net prices calculated and applied to matching part numbers.
                  </p>
                </div>
              </div>
            )}

            {/* Validation warnings */}
            {warnings && warnings.length > 0 && (
              <div>
                <h4 className="font-medium text-orange-700 mb-2 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  {warnings.length} validation warning{warnings.length > 1 ? 's' : ''}
                </h4>
                <div className="bg-orange-50 rounded-lg p-3 text-sm max-h-32 overflow-y-auto">
                  <ul className="text-orange-700 space-y-1">
                    {warnings.slice(0, 10).map((w, i) => (
                      <li key={i} className="flex items-start gap-1">
                        <span className="text-orange-500">•</span>
                        <span>{w.partNumber && <code className="text-xs bg-orange-100 px-1 rounded">{w.partNumber}</code>} {w.message}</span>
                      </li>
                    ))}
                    {warnings.length > 10 && (
                      <li className="text-orange-600">...and {warnings.length - 10} more</li>
                    )}
                  </ul>
                </div>
              </div>
            )}

            {/* Skipped items */}
            {skipped.length > 0 && (
              <div>
                <h4 className="font-medium text-yellow-700 mb-2 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  {skipped.length} items skipped
                </h4>
                <div className="bg-yellow-50 rounded-lg p-3 text-sm max-h-40 overflow-y-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-yellow-800">
                        <th className="pb-1 pr-4">Part/Series</th>
                        <th className="pb-1">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="text-yellow-700">
                      {skipped.slice(0, 20).map((s, i) => (
                        <tr key={i}>
                          <td className="py-0.5 pr-4 font-mono text-xs">{s.partNumber}</td>
                          <td className="py-0.5 text-xs">{s.reason}</td>
                        </tr>
                      ))}
                      {skipped.length > 20 && (
                        <tr>
                          <td colSpan={2} className="py-1 text-yellow-600 text-xs">
                            ...and {skipped.length - 20} more
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Unparsed rows */}
            {unparsed.length > 0 && (
              <div>
                <h4 className="font-medium text-red-700 mb-2 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  {unparsed.length} rows could not be parsed
                </h4>
                <div className="bg-red-50 rounded-lg p-3 text-sm max-h-32 overflow-y-auto">
                  <ul className="text-red-700 space-y-1">
                    {unparsed.slice(0, 10).map((row, i) => (
                      <li key={i} className="font-mono text-xs truncate">{row}</li>
                    ))}
                    {unparsed.length > 10 && (
                      <li className="text-red-600">...and {unparsed.length - 10} more</li>
                    )}
                  </ul>
                </div>
              </div>
            )}

            {/* Processing stats */}
            {stats && (
              <div className="text-xs text-gray-500 border-t pt-3">
                Processed {stats.totalLinesProcessed} lines: {stats.productRows} products, {stats.discountRows} discounts
              </div>
            )}
          </div>

          <div className="p-4 border-t bg-gray-50">
            <button onClick={() => setUploadResult(null)} className="btn btn-primary w-full">
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (!canManage) {
    return (
      <div className="p-6">
        <p className="text-gray-600">You do not have access to pricing contracts.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <UploadResultsModal />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pricing Contracts</h1>
          <p className="text-gray-600 mt-1">
            Custom pricing contracts for quotes and projects. Upload CSV or WAGO Quote PDF.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="btn btn-primary flex items-center gap-2 w-fit"
        >
          <Plus className="w-5 h-5" />
          New Pricing Contract
        </button>
      </div>

      {showCreate && (
        <div className="card p-6 mb-6">
          <h3 className="font-bold mb-4">Create Pricing Contract</h3>
          <div className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sample CSV</label>
              <button
                type="button"
                onClick={handleDownloadSample}
                className="flex items-center gap-2 text-green-600 hover:underline text-sm"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Download sample CSV with example data
              </button>
            </div>

            <input
              type="text"
              placeholder="Name *"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="input w-full"
            />
            <input
              type="text"
              placeholder="Description (optional)"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="input w-full"
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Upload File (optional)</label>
              <DropZone label="Drop CSV or WAGO Quote PDF here" />
              {createDropFile && (
                <p className="text-sm text-green-600 mt-2">Selected: {createDropFile.name}</p>
              )}
            </div>

            <div className="flex gap-2">
              <button onClick={handleCreate} disabled={creating} className="btn btn-primary">
                {creating ? 'Creating...' : 'Create'}
              </button>
              <button
                onClick={() => {
                  setShowCreate(false);
                  setCreateDropFile(null);
                  setNewName('');
                  setNewDesc('');
                }}
                className="btn bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : contracts.length === 0 ? (
          <div className="p-12 text-center">
            <FolderOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No pricing contracts yet</p>
            <button onClick={() => setShowCreate(true)} className="btn btn-primary mt-4">
              Create your first pricing contract
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Owner</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Items</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {contracts.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {c.turnkeyTeam?.name ||
                        (c.user ? [c.user.firstName, c.user.lastName].filter(Boolean).join(' ') || c.user.email : '—')}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c._count?.items ?? 0}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-2 justify-end">
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept=".csv,.pdf"
                            className="hidden"
                            disabled={uploadingId === c.id}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleUploadFile(c.id, f);
                              e.target.value = '';
                            }}
                          />
                          <span className="text-green-600 hover:underline flex items-center gap-1">
                            <Upload className="w-4 h-4" />
                            {uploadingId === c.id ? 'Uploading...' : 'Upload'}
                          </span>
                        </label>
                        <button
                          onClick={() => handleDownload(c.id, c.name)}
                          className="text-green-600 hover:underline flex items-center gap-1"
                        >
                          <Download className="w-4 h-4" /> CSV
                        </button>
                        <button
                          onClick={() => handleDelete(c.id, c.name)}
                          className="text-red-600 hover:underline flex items-center gap-1"
                        >
                          <Trash2 className="w-4 h-4" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PricingContractsPage;
