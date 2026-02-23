import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Upload, Download, FileText, FileSpreadsheet, BookOpen,
  Eye, Pencil, Trash2, X, Check, Search, ChevronLeft, ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { literatureApi } from '@/lib/api';

const LIT_TYPES = ['FLYER', 'BROCHURE', 'WHITE_PAPER', 'CATALOG_PAGE'];
const PAGE_SIZE = 50;

interface LitItem {
  id: string;
  title: string;
  description?: string;
  type: string;
  filePath: string;
  fileSize: number;
  keywords: string[];
  industryTags: string[];
  createdAt: string;
  parts: { part: { id: string; partNumber: string } }[];
  series: { seriesName: string }[];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function TagInput({
  value, onChange, placeholder,
}: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="input w-full"
      placeholder={placeholder}
    />
  );
}

interface EditModalProps {
  item: LitItem;
  onClose: () => void;
  onSaved: () => void;
}

function EditModal({ item, onClose, onSaved }: EditModalProps) {
  const [form, setForm] = useState({
    title: item.title,
    description: item.description ?? '',
    type: item.type,
    partNumbers: item.parts.map((p) => p.part.partNumber).join(', '),
    seriesNames: item.series.map((s) => s.seriesName).join(', '),
    keywords: item.keywords.join(', '),
    industryTags: item.industryTags.join(', '),
  });
  const [saving, setSaving] = useState(false);
  const [unresolvedParts, setUnresolvedParts] = useState<string[]>([]);

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    setSaving(true);
    setUnresolvedParts([]);
    try {
      const splitList = (s: string) => s.split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean);
      const [, assocResult] = await Promise.all([
        literatureApi.updateMetadata(item.id, {
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          type: form.type,
          keywords: splitList(form.keywords),
          industryTags: splitList(form.industryTags),
        }),
        literatureApi.updateAssociations(item.id, {
          partNumbers: splitList(form.partNumbers),
          seriesNames: splitList(form.seriesNames),
        }),
      ]);
      const unresolved: string[] = (assocResult.data as any)?.unresolvedParts ?? [];
      if (unresolved.length > 0) {
        setUnresolvedParts(unresolved);
        toast.success('Saved — but some part numbers were not found (see below)');
        onSaved();
        // Don't close — keep modal open so admin can see the warning
      } else {
        toast.success('Saved');
        onSaved();
        onClose();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold">Edit Literature</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input className="input w-full" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select className="input w-full" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
              {LIT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input className="input w-full" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Part Numbers <span className="text-gray-400 font-normal">(catalog: 221-2301 or article: 51015188)</span></label>
            <TagInput value={form.partNumbers} onChange={(v) => setForm((f) => ({ ...f, partNumbers: v }))} placeholder="221-2301, 51015188, 750-841" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Series <span className="text-gray-400 font-normal">(comma-separated)</span></label>
            <TagInput value={form.seriesNames} onChange={(v) => setForm((f) => ({ ...f, seriesNames: v }))} placeholder="221 Series, 750 Series" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Keywords <span className="text-gray-400 font-normal">(comma-separated)</span></label>
            <TagInput value={form.keywords} onChange={(v) => setForm((f) => ({ ...f, keywords: v }))} placeholder="CAGE CLAMP, push-in, terminal block" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Industry Tags <span className="text-gray-400 font-normal">(comma-separated)</span></label>
            <TagInput value={form.industryTags} onChange={(v) => setForm((f) => ({ ...f, industryTags: v }))} placeholder="Automation, Panel Building, Rail" />
          </div>
        </div>
        {unresolvedParts.length > 0 && (
          <div className="mx-6 mb-2 p-3 rounded-lg bg-amber-50 border border-amber-300">
            <p className="text-sm font-semibold text-amber-800 mb-1">
              ⚠ {unresolvedParts.length} part number{unresolvedParts.length !== 1 ? 's' : ''} not found in catalog
            </p>
            <p className="text-xs text-amber-700 mb-1">
              These numbers were not matched to any part in the database and were not saved:
            </p>
            <div className="flex flex-wrap gap-1">
              {unresolvedParts.map((pn) => (
                <code key={pn} className="px-1.5 py-0.5 bg-amber-100 text-amber-900 rounded text-xs font-mono">{pn}</code>
              ))}
            </div>
            <p className="text-xs text-amber-600 mt-2">
              Check that these numbers exist in the product catalog, or add them as keywords instead.
            </p>
          </div>
        )}
        <div className="flex justify-end gap-3 p-6 border-t">
          <button onClick={onClose} className="btn bg-gray-100">
            {unresolvedParts.length > 0 ? 'Close' : 'Cancel'}
          </button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary flex items-center gap-2 disabled:opacity-60">
            {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
            {unresolvedParts.length > 0 ? 'Save Again' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

export default function LiteratureLibrary() {
  // Upload form
  const [uploadForm, setUploadForm] = useState({
    title: '', type: 'FLYER', description: '', partNumbers: '', seriesNames: '', keywords: '', industryTags: '',
  });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadUnresolved, setUploadUnresolved] = useState<string[]>([]);

  // Library list
  const [items, setItems] = useState<LitItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [editItem, setEditItem] = useState<LitItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LitItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Bulk / export
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  const loadList = useCallback(async (pageNum = page, searchVal = search, typeVal = typeFilter) => {
    setLoading(true);
    try {
      const { data } = await literatureApi.list({
        limit: PAGE_SIZE,
        offset: pageNum * PAGE_SIZE,
        search: searchVal || undefined,
        type: typeVal || undefined,
      });
      setItems(data.items as LitItem[]);
      setTotal(data.total ?? 0);
    } catch {
      toast.error('Failed to load literature');
    } finally {
      setLoading(false);
    }
  }, [page, search, typeFilter]);

  useEffect(() => { loadList(0, search, typeFilter); }, []); // eslint-disable-line

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(0);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadList(0, val, typeFilter), 400);
  };

  const handleTypeFilter = (val: string) => {
    setTypeFilter(val);
    setPage(0);
    loadList(0, search, val);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    loadList(newPage, search, typeFilter);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadForm.title.trim() || !uploadFile) { toast.error('Title and PDF file are required'); return; }
    setUploading(true);
    setUploadUnresolved([]);
    try {
      const splitList = (s: string) => s.split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean);
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('title', uploadForm.title.trim());
      formData.append('type', uploadForm.type);
      if (uploadForm.description.trim()) formData.append('description', uploadForm.description.trim());
      splitList(uploadForm.partNumbers).forEach((p) => formData.append('partNumbers', p));
      splitList(uploadForm.seriesNames).forEach((s) => formData.append('seriesNames', s));
      splitList(uploadForm.keywords).forEach((k) => formData.append('keywords', k));
      splitList(uploadForm.industryTags).forEach((t) => formData.append('industryTags', t));

      const { data } = await literatureApi.upload(formData);
      const unresolved: string[] = data.unresolvedParts ?? [];
      if (unresolved.length > 0) {
        setUploadUnresolved(unresolved);
        toast.success('Uploaded — check part number warnings below');
      } else {
        toast.success('Literature uploaded successfully');
      }
      setUploadForm({ title: '', type: 'FLYER', description: '', partNumbers: '', seriesNames: '', keywords: '', industryTags: '' });
      setUploadFile(null);
      // Reset file input
      const fileInput = document.querySelector('input[type="file"][accept*="pdf"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      loadList(0, search, typeFilter);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await literatureApi.delete(deleteTarget.id);
      toast.success('Deleted');
      setDeleteTarget(null);
      loadList(0, search, typeFilter);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkUpdate = async () => {
    if (!bulkFile) { toast.error('Select a CSV file first'); return; }
    setBulkLoading(true);
    try {
      const { data } = await literatureApi.bulkUpdateAssociations(bulkFile);
      toast.success(`Updated ${data.updated} item(s)${data.errors?.length ? `. ${data.errors.length} error(s).` : ''}`);
      if (data.errors?.length) console.warn('Bulk errors:', data.errors);
      setBulkFile(null);
      loadList(0, search, typeFilter);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Bulk update failed');
    } finally {
      setBulkLoading(false);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="container-custom py-6">
      {/* Header */}
      <div className="mb-6">
        <Link to="/admin" className="text-green-600 hover:underline flex items-center gap-1 mb-2">
          <ArrowLeft className="w-4 h-4" /> Back to Admin
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <BookOpen className="w-8 h-8" /> Literature Library
        </h1>
        <p className="text-gray-600 mt-1">
          Upload and manage official WAGO PDF documents — flyers, brochures, white papers, and catalog pages.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left column: Upload form */}
        <div className="xl:col-span-1 space-y-6">
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Upload className="w-4 h-4" /> Upload PDF
            </h2>
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text" className="input w-full"
                  placeholder="e.g. 221 Series Product Flyer"
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                <select
                  className="input w-full" value={uploadForm.type}
                  onChange={(e) => setUploadForm((f) => ({ ...f, type: e.target.value }))}
                >
                  {LIT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text" className="input w-full"
                  placeholder="Brief description (optional)"
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Part Numbers</label>
                <input
                  type="text" className="input w-full"
                  placeholder="221-2301, 750-841"
                  value={uploadForm.partNumbers}
                  onChange={(e) => setUploadForm((f) => ({ ...f, partNumbers: e.target.value }))}
                />
                <p className="text-xs text-gray-400 mt-1">Comma-separated — use catalog numbers (221-2301) or article/order numbers (51015188)</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Series</label>
                <input
                  type="text" className="input w-full"
                  placeholder="221 Series, 750 Series"
                  value={uploadForm.seriesNames}
                  onChange={(e) => setUploadForm((f) => ({ ...f, seriesNames: e.target.value }))}
                />
                <p className="text-xs text-gray-400 mt-1">Comma-separated series names</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Keywords</label>
                <input
                  type="text" className="input w-full"
                  placeholder="CAGE CLAMP, push-in, terminal block"
                  value={uploadForm.keywords}
                  onChange={(e) => setUploadForm((f) => ({ ...f, keywords: e.target.value }))}
                />
                <p className="text-xs text-gray-400 mt-1">Comma-separated search terms</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Industry Tags</label>
                <input
                  type="text" className="input w-full"
                  placeholder="Automation, Panel Building, Rail"
                  value={uploadForm.industryTags}
                  onChange={(e) => setUploadForm((f) => ({ ...f, industryTags: e.target.value }))}
                />
                <p className="text-xs text-gray-400 mt-1">Comma-separated industry categories</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">PDF File *</label>
                <input
                  type="file" accept=".pdf,application/pdf"
                  className="input w-full"
                  onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <button
                type="submit" disabled={uploading}
                className="btn btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {uploading
                  ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Upload className="w-4 h-4" />}
              {uploading ? 'Uploading...' : 'Upload'}
            </button>

            {uploadUnresolved.length > 0 && (
              <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-300">
                <p className="text-sm font-semibold text-amber-800 mb-1">
                  ⚠ {uploadUnresolved.length} part number{uploadUnresolved.length !== 1 ? 's' : ''} not found in catalog
                </p>
                <p className="text-xs text-amber-700 mb-2">
                  These were not linked to the uploaded document:
                </p>
                <div className="flex flex-wrap gap-1 mb-2">
                  {uploadUnresolved.map((pn) => (
                    <code key={pn} className="px-1.5 py-0.5 bg-amber-100 text-amber-900 rounded text-xs font-mono">{pn}</code>
                  ))}
                </div>
                <p className="text-xs text-amber-600">
                  Use the Edit button on the uploaded item to re-enter these once confirmed, or add them as keywords.
                </p>
                <button onClick={() => setUploadUnresolved([])} className="mt-2 text-xs text-amber-700 underline">Dismiss</button>
              </div>
            )}
          </form>
        </div>

          {/* Export & Bulk */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Export & Bulk Update</h2>
            <div className="space-y-3">
              <div className="flex gap-2">
                <button onClick={async () => { try { const { data } = await literatureApi.exportPdf(); downloadBlob(data as Blob, 'literature-report.pdf'); } catch { toast.error('Export failed'); } }}
                  className="btn bg-gray-100 flex items-center gap-2 flex-1 justify-center text-sm">
                  <FileText className="w-4 h-4" /> PDF Report
                </button>
                <button onClick={async () => { try { const { data } = await literatureApi.exportCsv(); downloadBlob(data as Blob, 'literature-export.csv'); } catch { toast.error('Export failed'); } }}
                  className="btn bg-gray-100 flex items-center gap-2 flex-1 justify-center text-sm">
                  <FileSpreadsheet className="w-4 h-4" /> Export CSV
                </button>
              </div>
              <button onClick={async () => { try { const { data } = await literatureApi.getSampleCsv(); downloadBlob(data as Blob, 'literature-bulk-sample.csv'); } catch { toast.error('Download failed'); } }}
                className="btn bg-gray-100 flex items-center gap-2 w-full justify-center text-sm">
                <Download className="w-4 h-4" /> Sample CSV Template
              </button>
              <div className="pt-2 border-t">
                <label className="block text-sm font-medium text-gray-700 mb-2">Bulk Update from CSV</label>
                <input
                  type="file" accept=".csv,text/csv"
                  className="input w-full mb-2 text-sm"
                  onChange={(e) => setBulkFile(e.target.files?.[0] ?? null)}
                />
                <button
                  onClick={handleBulkUpdate} disabled={!bulkFile || bulkLoading}
                  className="btn btn-primary w-full disabled:opacity-60 text-sm"
                >
                  {bulkLoading ? 'Updating...' : 'Run Bulk Update'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Library list */}
        <div className="xl:col-span-2">
          <div className="card p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-semibold">Library ({total})</h2>
              <div className="flex gap-2 flex-1 sm:max-w-sm">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text" placeholder="Search title, keywords..."
                    className="input pl-8 w-full text-sm"
                    value={search} onChange={(e) => handleSearchChange(e.target.value)}
                  />
                </div>
                <select className="input text-sm" value={typeFilter} onChange={(e) => handleTypeFilter(e.target.value)}>
                  <option value="">All types</option>
                  {LIT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <span className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="font-medium">No literature yet</p>
                <p className="text-sm">Upload a PDF using the form on the left.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Title</th>
                        <th className="px-3 py-2 text-left">Type</th>
                        <th className="px-3 py-2 text-left">Keywords / Tags</th>
                        <th className="px-3 py-2 text-left">Parts / Series</th>
                        <th className="px-3 py-2 text-right">Size</th>
                        <th className="px-3 py-2 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {items.map((lit) => (
                        <tr key={lit.id} className="hover:bg-gray-50">
                          <td className="px-3 py-3">
                            <div className="font-medium text-gray-900 line-clamp-1">{lit.title}</div>
                            {lit.description && (
                              <div className="text-xs text-gray-400 line-clamp-1 mt-0.5">{lit.description}</div>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                              {lit.type.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap gap-1 max-w-[180px]">
                              {lit.keywords.slice(0, 3).map((k) => (
                                <span key={k} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-xs">{k}</span>
                              ))}
                              {lit.keywords.length > 3 && (
                                <span className="text-xs text-gray-400">+{lit.keywords.length - 3}</span>
                              )}
                              {lit.industryTags.slice(0, 2).map((t) => (
                                <span key={t} className="px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded text-xs">{t}</span>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-gray-500 text-xs">
                            <div>{lit.parts.map((p) => p.part.partNumber).slice(0, 3).join(', ') || '—'}</div>
                            {lit.series.length > 0 && (
                              <div className="text-gray-400">{lit.series.map((s) => s.seriesName).slice(0, 2).join(', ')}</div>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right text-gray-500 whitespace-nowrap">
                            {formatBytes(lit.fileSize)}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center justify-center gap-1">
                              <a
                                href={lit.filePath} target="_blank" rel="noopener noreferrer"
                                className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-blue-600"
                                title="View PDF"
                              >
                                <Eye className="w-4 h-4" />
                              </a>
                              <button
                                onClick={() => setEditItem(lit)}
                                className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-green-600"
                                title="Edit"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeleteTarget(lit)}
                                className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-red-600"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <span className="text-sm text-gray-500">
                      Page {page + 1} of {totalPages} — {total} total
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handlePageChange(page - 1)} disabled={page === 0}
                        className="btn bg-gray-100 disabled:opacity-40 p-2"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handlePageChange(page + 1)} disabled={page >= totalPages - 1}
                        className="btn bg-gray-100 disabled:opacity-40 p-2"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editItem && (
        <EditModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSaved={() => loadList(page, search, typeFilter)}
        />
      )}

      {/* Delete Confirm Dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Delete Literature</h2>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete <strong>"{deleteTarget.title}"</strong>? This will permanently remove the PDF from storage.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)} className="btn bg-gray-100">Cancel</button>
              <button
                onClick={handleDelete} disabled={deleting}
                className="btn bg-red-600 text-white hover:bg-red-700 flex items-center gap-2 disabled:opacity-60"
              >
                {deleting ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
