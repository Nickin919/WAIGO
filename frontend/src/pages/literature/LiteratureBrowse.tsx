import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, Search, Eye, Download, Plus, Minus, X,
  Archive, BookMarked, ChevronDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { literatureApi, literatureKitApi } from '@/lib/api';

const LIT_TYPES = ['FLYER', 'BROCHURE', 'WHITE_PAPER', 'CATALOG_PAGE'];
const PAGE_SIZE = 24;

interface LitItem {
  id: string;
  title: string;
  description?: string;
  type: string;
  filePath: string;
  fileSize: number;
  keywords: string[];
  industryTags: string[];
  parts: { part: { partNumber: string } }[];
  series: { seriesName: string }[];
  createdAt: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    FLYER: 'bg-green-100 text-green-700',
    BROCHURE: 'bg-blue-100 text-blue-700',
    WHITE_PAPER: 'bg-purple-100 text-purple-700',
    CATALOG_PAGE: 'bg-orange-100 text-orange-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[type] ?? 'bg-gray-100 text-gray-600'}`}>
      {type.replace(/_/g, ' ')}
    </span>
  );
}

interface NameModalProps {
  onConfirm: (name: string) => void;
  onClose: () => void;
  loading: boolean;
  title: string;
}
function NameModal({ onConfirm, onClose, loading, title }: NameModalProps) {
  const [name, setName] = useState('');
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <input
          autoFocus
          type="text"
          className="input w-full mb-4"
          placeholder="Kit name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && name.trim() && onConfirm(name.trim())}
        />
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="btn bg-gray-100">Cancel</button>
          <button
            onClick={() => name.trim() && onConfirm(name.trim())}
            disabled={loading || !name.trim()}
            className="btn btn-primary disabled:opacity-60 flex items-center gap-2"
          >
            {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LiteratureBrowse() {
  const navigate = useNavigate();

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [partNumberFilter, setPartNumberFilter] = useState('');
  const [seriesFilter, setSeriesFilter] = useState('');
  const [industryFilter, setIndustryFilter] = useState('');
  const [page, setPage] = useState(0);

  // Results
  const [items, setItems] = useState<LitItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Selection
  const [selected, setSelected] = useState<Map<string, LitItem>>(new Map());

  // Kit actions
  const [showNameModal, setShowNameModal] = useState(false);
  const [kitSaving, setKitSaving] = useState(false);
  const [userKits, setUserKits] = useState<{ id: string; name: string }[]>([]);
  const [showKitDropdown, setShowKitDropdown] = useState(false);
  const [addingToKit, setAddingToKit] = useState<string | null>(null);

  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchItems = useCallback(async (
    pg = 0,
    s = search, t = typeFilter, pn = partNumberFilter,
    ser = seriesFilter, ind = industryFilter,
  ) => {
    setLoading(true);
    try {
      const { data } = await literatureApi.list({
        limit: PAGE_SIZE,
        offset: pg * PAGE_SIZE,
        search: s || undefined,
        type: t || undefined,
        partNumber: pn || undefined,
        seriesName: ser || undefined,
        industryTag: ind || undefined,
      });
      setItems(data.items as LitItem[]);
      setTotal(data.total ?? 0);
    } catch {
      toast.error('Failed to load literature');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line

  useEffect(() => { fetchItems(); }, []); // eslint-disable-line

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowKitDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const debouncedSearch = (val: string) => {
    setSearch(val); setPage(0);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchItems(0, val, typeFilter, partNumberFilter, seriesFilter, industryFilter), 400);
  };

  const applyFilter = (key: string, val: string) => {
    const next = { s: search, t: typeFilter, pn: partNumberFilter, ser: seriesFilter, ind: industryFilter, [key]: val };
    setPage(0);
    if (key === 't') setTypeFilter(val);
    if (key === 'pn') setPartNumberFilter(val);
    if (key === 'ser') setSeriesFilter(val);
    if (key === 'ind') setIndustryFilter(val);
    fetchItems(0, next.s, next.t, next.pn, next.ser, next.ind);
  };

  const toggleSelect = (item: LitItem) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.set(item.id, item);
      return next;
    });
  };

  const totalSelectedSize = Array.from(selected.values()).reduce((sum, i) => sum + i.fileSize, 0);

  const loadUserKits = async () => {
    try {
      const { data } = await literatureKitApi.list();
      setUserKits(data.items as { id: string; name: string }[]);
    } catch { /* silent */ }
  };

  const handleSaveAsKit = async (name: string) => {
    setKitSaving(true);
    try {
      const { data: kit } = await literatureKitApi.create({ name });
      await literatureKitApi.addItems(kit.id, Array.from(selected.keys()));
      toast.success(`Kit "${name}" created with ${selected.size} item(s)`);
      setShowNameModal(false);
      setSelected(new Map());
      navigate(`/literature/kits/${kit.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create kit');
    } finally {
      setKitSaving(false);
    }
  };

  const handleAddToExistingKit = async (kitId: string, kitName: string) => {
    setAddingToKit(kitId);
    try {
      await literatureKitApi.addItems(kitId, Array.from(selected.keys()));
      toast.success(`Added ${selected.size} item(s) to "${kitName}"`);
      setSelected(new Map());
      setShowKitDropdown(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to add to kit');
    } finally {
      setAddingToKit(null);
    }
  };

  const handleDownloadZip = async () => {
    if (selected.size === 0) return;
    try {
      // Create a temporary kit, download ZIP, then delete kit
      const { data: kit } = await literatureKitApi.create({ name: `__temp_${Date.now()}` });
      await literatureKitApi.addItems(kit.id, Array.from(selected.keys()));
      const { data: blob } = await literatureKitApi.downloadZip(kit.id);
      const url = URL.createObjectURL(blob as Blob);
      const a = document.createElement('a');
      a.href = url; a.download = `Literature_Selection.zip`; a.click();
      URL.revokeObjectURL(url);
      await literatureKitApi.delete(kit.id);
    } catch {
      toast.error('Failed to download ZIP');
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="container-custom py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="w-8 h-8 text-green-600" />
            Literature Library
          </h1>
          <p className="text-gray-500 mt-1">Browse and download official WAGO product documents.</p>
        </div>
        <button
          onClick={() => navigate('/literature/kits')}
          className="btn bg-green-50 text-green-700 border border-green-200 flex items-center gap-2"
        >
          <BookMarked className="w-4 h-4" /> My Literature Kits
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search title, description, keywords..."
              className="input pl-9 w-full"
              value={search}
              onChange={(e) => debouncedSearch(e.target.value)}
            />
          </div>
          <select className="input" value={typeFilter} onChange={(e) => applyFilter('t', e.target.value)}>
            <option value="">All types</option>
            {LIT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
          <input
            type="text" className="input" placeholder="Part number..."
            value={partNumberFilter}
            onChange={(e) => applyFilter('pn', e.target.value)}
          />
          <input
            type="text" className="input" placeholder="Industry..."
            value={industryFilter}
            onChange={(e) => applyFilter('ind', e.target.value)}
          />
        </div>
        {(search || typeFilter || partNumberFilter || seriesFilter || industryFilter) && (
          <button
            onClick={() => {
              setSearch(''); setTypeFilter(''); setPartNumberFilter('');
              setSeriesFilter(''); setIndustryFilter(''); setPage(0);
              fetchItems(0, '', '', '', '', '');
            }}
            className="mt-2 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Clear filters
          </button>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-16">
          <span className="w-10 h-10 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <BookOpen className="w-14 h-14 mx-auto mb-3 text-gray-300" />
          <p className="text-lg font-medium">No documents found</p>
          <p className="text-sm">Try adjusting your search or filters.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500 mb-4">{total} document{total !== 1 ? 's' : ''} found</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
            {items.map((item) => {
              const isSelected = selected.has(item.id);
              return (
                <div
                  key={item.id}
                  className={`card p-4 flex flex-col gap-3 transition-all ${isSelected ? 'ring-2 ring-green-500 bg-green-50' : 'hover:shadow-md'}`}
                >
                  {/* Title row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <TypeBadge type={item.type} />
                      <h3 className="font-semibold text-gray-900 text-sm mt-1 line-clamp-2">{item.title}</h3>
                    </div>
                    <button
                      onClick={() => toggleSelect(item)}
                      className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center border-2 transition-colors ${
                        isSelected
                          ? 'bg-green-600 border-green-600 text-white'
                          : 'border-gray-300 text-gray-400 hover:border-green-400 hover:text-green-500'
                      }`}
                      title={isSelected ? 'Remove from selection' : 'Add to selection'}
                    >
                      {isSelected ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* Description */}
                  {item.description && (
                    <p className="text-xs text-gray-500 line-clamp-2">{item.description}</p>
                  )}

                  {/* Keywords */}
                  {item.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {item.keywords.slice(0, 4).map((k) => (
                        <span key={k} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-xs">{k}</span>
                      ))}
                      {item.keywords.length > 4 && (
                        <span className="text-xs text-gray-400">+{item.keywords.length - 4}</span>
                      )}
                    </div>
                  )}

                  {/* Parts / Series */}
                  {(item.parts.length > 0 || item.series.length > 0) && (
                    <div className="text-xs text-gray-500 space-y-0.5">
                      {item.parts.length > 0 && (
                        <div>Parts: {item.parts.slice(0, 3).map((p) => p.part.partNumber).join(', ')}{item.parts.length > 3 ? ` +${item.parts.length - 3}` : ''}</div>
                      )}
                      {item.series.length > 0 && (
                        <div>Series: {item.series.slice(0, 2).map((s) => s.seriesName).join(', ')}</div>
                      )}
                    </div>
                  )}

                  {/* Footer: size + upload date + actions */}
                  <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100">
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-400">{formatBytes(item.fileSize)}</span>
                      <span className="text-xs text-gray-400">
                        {new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={item.filePath}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                        title="View in new tab"
                      >
                        <Eye className="w-3.5 h-3.5" /> View
                      </a>
                      <a
                        href={item.filePath}
                        download
                        className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800"
                        title="Download"
                      >
                        <Download className="w-3.5 h-3.5" /> Download
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mb-8">
              <button
                onClick={() => { setPage(page - 1); fetchItems(page - 1); }}
                disabled={page === 0}
                className="btn bg-gray-100 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">Page {page + 1} of {totalPages}</span>
              <button
                onClick={() => { setPage(page + 1); fetchItems(page + 1); }}
                disabled={page >= totalPages - 1}
                className="btn bg-gray-100 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Selection Tray */}
      {selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-2xl z-40">
          <div className="container-custom py-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-bold">
                  {selected.size}
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">{selected.size} document{selected.size !== 1 ? 's' : ''} selected</p>
                  <p className="text-xs text-gray-500">~{formatBytes(totalSelectedSize)} total</p>
                </div>
                <button onClick={() => setSelected(new Map())} className="text-gray-400 hover:text-gray-600 ml-2">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleDownloadZip}
                  className="btn bg-gray-100 flex items-center gap-2 text-sm"
                >
                  <Archive className="w-4 h-4" /> Download ZIP
                </button>

                {/* Add to existing kit dropdown */}
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={async () => {
                      if (!showKitDropdown) await loadUserKits();
                      setShowKitDropdown((v) => !v);
                    }}
                    className="btn bg-gray-100 flex items-center gap-2 text-sm"
                  >
                    <BookMarked className="w-4 h-4" /> Add to Kit <ChevronDown className="w-3 h-3" />
                  </button>
                  {showKitDropdown && (
                    <div className="absolute bottom-full mb-2 right-0 bg-white border border-gray-200 rounded-lg shadow-xl w-56 z-50">
                      {userKits.length === 0 ? (
                        <div className="p-3 text-sm text-gray-500">No saved kits yet</div>
                      ) : (
                        <ul className="py-1 max-h-48 overflow-y-auto">
                          {userKits.map((kit) => (
                            <li key={kit.id}>
                              <button
                                onClick={() => handleAddToExistingKit(kit.id, kit.name)}
                                disabled={addingToKit === kit.id}
                                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
                              >
                                {kit.name}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setShowNameModal(true)}
                  className="btn btn-primary flex items-center gap-2 text-sm"
                >
                  <BookOpen className="w-4 h-4" /> Save as New Kit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Name modal */}
      {showNameModal && (
        <NameModal
          title="Name Your Literature Kit"
          onConfirm={handleSaveAsKit}
          onClose={() => setShowNameModal(false)}
          loading={kitSaving}
        />
      )}
    </div>
  );
}
