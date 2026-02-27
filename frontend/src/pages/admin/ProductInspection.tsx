import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Search, Edit2, X, Save, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi, catalogApi, partApi } from '@/lib/api';

interface PartRow {
  id: string;
  catalogId: string;
  categoryId: string;
  partNumber: string;
  series: string | null;
  description: string;
  active: boolean;
  gridLevelNumber: number | null;
  gridLevelName: string | null;
  gridSublevelNumber: number | null;
  gridSublevelName: string | null;
  category?: { id: string; name: string };
  catalog?: { id: string; name: string };
}

interface CatalogOption {
  id: string;
  name: string;
}

const PART_FIELDS: { key: keyof PartRow | string; label: string; type?: 'text' | 'number' | 'boolean' | 'date' }[] = [
  { key: 'partNumber', label: 'Part number' },
  { key: 'series', label: 'Series' },
  { key: 'description', label: 'Description', type: 'text' },
  { key: 'englishDescription', label: 'English description', type: 'text' },
  { key: 'minQty', label: 'Min qty', type: 'number' },
  { key: 'packageQty', label: 'Package qty', type: 'number' },
  { key: 'level', label: 'Level', type: 'number' },
  { key: 'basePrice', label: 'Base price', type: 'number' },
  { key: 'listPricePer100', label: 'List price per 100', type: 'number' },
  { key: 'distributorDiscount', label: 'Distributor discount', type: 'number' },
  { key: 'wagoIdent', label: 'WAGO ident' },
  { key: 'active', label: 'Active', type: 'boolean' },
  { key: 'gridLevelNumber', label: 'Grid level number', type: 'number' },
  { key: 'gridLevelName', label: 'Grid level name' },
  { key: 'gridSublevelNumber', label: 'Grid sublevel number', type: 'number' },
  { key: 'gridSublevelName', label: 'Grid sublevel name' },
  { key: 'priceDate', label: 'Price date', type: 'date' },
  { key: 'thumbnailUrl', label: 'Thumbnail URL' },
  { key: 'createdAt', label: 'Created at', type: 'date' },
  { key: 'updatedAt', label: 'Updated at', type: 'date' },
];

export default function ProductInspection() {
  const [searchParams] = useSearchParams();
  const partNumberFromUrl = searchParams.get('partNumber') ?? '';

  const [q, setQ] = useState(partNumberFromUrl);
  const [catalogId, setCatalogId] = useState('');
  const [parts, setParts] = useState<PartRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [catalogs, setCatalogs] = useState<CatalogOption[]>([]);
  const [detailPart, setDetailPart] = useState<any | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadCatalogs = async () => {
      try {
        const { data } = await catalogApi.getAll();
        setCatalogs(Array.isArray(data) ? data : []);
      } catch {
        setCatalogs([]);
      }
    };
    loadCatalogs();
  }, []);

  useEffect(() => {
    if (!partNumberFromUrl) return;
    setQ(partNumberFromUrl);
    const params: Record<string, string | number> = { q: partNumberFromUrl, limit: 50, offset: 0 };
    if (catalogId) params.catalogId = catalogId;
    setLoading(true);
    adminApi.searchParts(params)
      .then(({ data }) => {
        setParts(data.parts ?? []);
        setTotal(data.total ?? 0);
      })
      .catch(() => {
        setParts([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [partNumberFromUrl]);

  const handleSearch = async (searchQ?: string, searchCatalogId?: string) => {
    const term = (searchQ ?? q).trim();
    if (!term) {
      toast.error('Enter a part number or search term');
      return;
    }
    setLoading(true);
    try {
      const params: Record<string, string | number> = { q: term, limit: 50, offset: 0 };
      if (searchCatalogId !== undefined ? searchCatalogId : catalogId) {
        params.catalogId = searchCatalogId ?? catalogId;
      }
      const { data } = await adminApi.searchParts(params);
      setParts(data.parts ?? []);
      setTotal(data.total ?? 0);
      if ((data.total ?? 0) === 0) toast('No parts found');
    } catch (e) {
      toast.error('Search failed');
      setParts([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (id: string) => {
    try {
      const { data } = await partApi.getById(id);
      setDetailPart(data);
      setEditForm({});
      setEditing(false);
    } catch {
      toast.error('Failed to load part');
    }
  };

  const startEdit = () => {
    if (!detailPart) return;
    const form: Record<string, unknown> = {};
    PART_FIELDS.forEach(({ key }) => {
      if (key in detailPart) form[key] = detailPart[key];
    });
    setEditForm(form);
    setEditing(true);
  };

  const setEditField = (key: string, value: unknown) => {
    setEditForm((prev) => ({ ...prev, [key]: value }));
  };

  const savePart = async () => {
    if (!detailPart?.id) return;
    setSaving(true);
    const allowedKeys = new Set([
      'categoryId', 'partNumber', 'description', 'thumbnailUrl', 'minQty', 'packageQty', 'level', 'basePrice',
      'series', 'englishDescription', 'active', 'gridLevelNumber', 'gridLevelName', 'gridSublevelNumber', 'gridSublevelName',
      'listPricePer100', 'distributorDiscount', 'wagoIdent', 'priceDate'
    ]);
    const payload: Record<string, unknown> = {};
    Object.keys(editForm).forEach((k) => {
      if (allowedKeys.has(k)) payload[k] = editForm[k];
    });
    try {
      await adminApi.updatePart(detailPart.id, payload);
      toast.success('Part updated');
      const { data } = await partApi.getById(detailPart.id);
      setDetailPart(data);
      setEditing(false);
      setEditForm({});
      setParts((prev) =>
        prev.map((p) => (p.id === detailPart.id ? { ...p, ...data } : p))
      );
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const formatValue = (key: string, value: unknown): string => {
    if (value == null) return '—';
    if (key === 'priceDate' || key === 'createdAt' || key === 'updatedAt') {
      return new Date(value as string).toLocaleDateString();
    }
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
  };

  return (
    <div className="container-custom py-6">
      <div className="mb-6">
        <Link to="/admin" className="text-wago-green hover:underline flex items-center gap-1 mb-2">
          <ArrowLeft className="w-5 h-5" /> Back to Admin
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Product Inspection</h1>
        <p className="text-gray-600 mt-1">
          Look up products by part number, view full records, and edit data to resolve failure reports and submission issues.
        </p>
      </div>

      <div className="card p-4 mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Part number or search term</label>
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="e.g. 221-413"
              className="input"
            />
          </div>
          <div className="min-w-[180px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Catalog (optional)</label>
            <select
              value={catalogId}
              onChange={(e) => setCatalogId(e.target.value)}
              className="input"
            >
              <option value="">All catalogs</option>
              {catalogs.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => handleSearch()}
            disabled={loading}
            className="btn btn-primary flex items-center gap-2"
          >
            <Search className="w-5 h-5" />
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-10 h-10 border-4 border-wago-green border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left p-3 font-semibold">Part number</th>
                  <th className="text-left p-3 font-semibold">Catalog</th>
                  <th className="text-left p-3 font-semibold">Category</th>
                  <th className="text-left p-3 font-semibold">Series</th>
                  <th className="text-left p-3 font-semibold">Description</th>
                  <th className="text-left p-3 font-semibold">Active</th>
                  <th className="text-left p-3 font-semibold">Grid</th>
                  <th className="text-left p-3 font-semibold w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {parts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-gray-500">
                      Enter a search term and click Search to find parts.
                    </td>
                  </tr>
                ) : (
                  parts.map((p) => (
                    <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                      <td className="p-3 font-medium">{p.partNumber}</td>
                      <td className="p-3 text-gray-600">{p.catalog?.name ?? p.catalogId}</td>
                      <td className="p-3 text-gray-600">{p.category?.name ?? p.categoryId}</td>
                      <td className="p-3">{p.series ?? '—'}</td>
                      <td className="p-3 max-w-xs truncate" title={p.description}>{p.description}</td>
                      <td className="p-3">{p.active ? 'Yes' : 'No'}</td>
                      <td className="p-3">
                        {p.gridLevelNumber != null || p.gridSublevelNumber != null
                          ? `${p.gridLevelNumber ?? '—'}/${p.gridSublevelNumber ?? '—'}`
                          : '—'}
                      </td>
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => openDetail(p.id)}
                          className="text-wago-green hover:underline"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {total > 0 && (
            <div className="p-3 border-t border-gray-100 text-gray-500 text-sm">
              Showing {parts.length} of {total}
            </div>
          )}
        </div>
      )}

      {/* Detail / Edit modal */}
      {detailPart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Part: {detailPart.partNumber}</h3>
              <div className="flex items-center gap-2">
                <a
                  href={`/admin/failure-report?partNumber=${encodeURIComponent(detailPart.partNumber)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary text-sm flex items-center gap-1"
                >
                  Failure report <ExternalLink className="w-4 h-4" />
                </a>
                <a
                  href={`/admin/unmatched-submissions?q=${encodeURIComponent(detailPart.partNumber)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary text-sm flex items-center gap-1"
                >
                  Unmatched <ExternalLink className="w-4 h-4" />
                </a>
                {!editing ? (
                  <button type="button" onClick={startEdit} className="btn btn-primary flex items-center gap-1">
                    <Edit2 className="w-4 h-4" /> Edit
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={savePart}
                      disabled={saving}
                      className="btn btn-primary flex items-center gap-1"
                    >
                      <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEditing(false); setEditForm({}); }}
                      className="btn btn-secondary"
                    >
                      Cancel
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => { setDetailPart(null); setEditing(false); setEditForm({}); }}
                  className="p-2 text-gray-500 hover:text-gray-700"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {!editing ? (
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  {PART_FIELDS.map(({ key, label }) => (
                    <div key={key}>
                      <dt className="text-gray-500 font-medium">{label}</dt>
                      <dd className="text-gray-900 break-words">{formatValue(key, detailPart[key])}</dd>
                    </div>
                  ))}
                  <div className="sm:col-span-2">
                    <dt className="text-gray-500 font-medium">Catalog</dt>
                    <dd className="text-gray-900">{(detailPart as any).catalog?.name ?? detailPart.catalogId ?? '—'}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-gray-500 font-medium">Category</dt>
                    <dd className="text-gray-900">{(detailPart as any).category?.name ?? detailPart.categoryId ?? '—'}</dd>
                  </div>
                </dl>
              ) : (
                <div className="space-y-4">
                  {PART_FIELDS.filter((f) => !['createdAt', 'updatedAt'].includes(f.key)).map(({ key, label, type }) => (
                    <div key={key}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                      {type === 'boolean' ? (
                        <select
                          value={editForm[key] === true ? '1' : '0'}
                          onChange={(e) => setEditField(key, e.target.value === '1')}
                          className="input"
                        >
                          <option value="1">Yes</option>
                          <option value="0">No</option>
                        </select>
                      ) : type === 'number' ? (
                        <input
                          type="number"
                          value={editForm[key] != null ? String(editForm[key]) : ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            setEditField(key, v === '' ? null : Number(v));
                          }}
                          step={key.includes('Price') || key.includes('Discount') ? 0.01 : 1}
                          className="input"
                        />
                      ) : type === 'date' ? (
                        <input
                          type="date"
                          value={editForm[key] ? (editForm[key] as string).slice(0, 10) : ''}
                          onChange={(e) => setEditField(key, e.target.value || null)}
                          className="input"
                        />
                      ) : (
                        <input
                          type="text"
                          value={String(editForm[key] ?? '')}
                          onChange={(e) => setEditField(key, e.target.value || null)}
                          className="input"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
