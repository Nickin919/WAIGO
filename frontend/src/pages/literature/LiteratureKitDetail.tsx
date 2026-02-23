import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  BookMarked, BookOpen, Eye, Download, Trash2,
  FileText, Archive, Mail, Pencil, Check, X, ArrowLeft,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { literatureKitApi } from '@/lib/api';

interface LitInKit {
  id: string;
  title: string;
  description?: string;
  type: string;
  filePath: string;
  fileSize: number;
  keywords: string[];
  parts: { part: { partNumber: string } }[];
  series: { seriesName: string }[];
}

interface KitDetail {
  id: string;
  name: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  items: { literature: LitInKit; addedAt: string }[];
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

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function LiteratureKitDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [kit, setKit] = useState<KitDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Inline name editing
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [savingName, setSavingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Notes editing
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Delete item
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Downloads
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [downloadingSlip, setDownloadingSlip] = useState(false);

  const loadKit = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data } = await literatureKitApi.getById(id);
      setKit(data as KitDetail);
      setNameValue((data as KitDetail).name);
      setNotesValue((data as KitDetail).notes ?? '');
    } catch (err: any) {
      if (err.response?.status === 404) setNotFound(true);
      else toast.error('Failed to load kit');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadKit(); }, [id]); // eslint-disable-line

  const saveName = async () => {
    if (!id || !nameValue.trim()) return;
    setSavingName(true);
    try {
      await literatureKitApi.update(id, { name: nameValue.trim() });
      setKit((k) => k ? { ...k, name: nameValue.trim() } : k);
      setEditingName(false);
    } catch {
      toast.error('Failed to save name');
    } finally {
      setSavingName(false);
    }
  };

  const saveNotes = async () => {
    if (!id) return;
    setSavingNotes(true);
    try {
      await literatureKitApi.update(id, { notes: notesValue });
      setKit((k) => k ? { ...k, notes: notesValue } : k);
      setEditingNotes(false);
    } catch {
      toast.error('Failed to save notes');
    } finally {
      setSavingNotes(false);
    }
  };

  const removeItem = async (litId: string) => {
    if (!id) return;
    setRemovingId(litId);
    try {
      await literatureKitApi.removeItem(id, litId);
      setKit((k) => k ? { ...k, items: k.items.filter((i) => i.literature.id !== litId) } : k);
      toast.success('Removed from kit');
    } catch {
      toast.error('Failed to remove item');
    } finally {
      setRemovingId(null);
    }
  };

  const handleDownloadZip = async () => {
    if (!id) return;
    setDownloadingZip(true);
    try {
      const { data } = await literatureKitApi.downloadZip(id);
      downloadBlob(data as Blob, `Literature_Kit_${kit?.name?.replace(/[^a-zA-Z0-9]/g, '_') ?? id}.zip`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to generate ZIP');
    } finally {
      setDownloadingZip(false);
    }
  };

  const handleDownloadSlip = async () => {
    if (!id) return;
    setDownloadingSlip(true);
    try {
      const { data } = await literatureKitApi.downloadSlip(id);
      downloadBlob(data as Blob, `Literature_Slip_${kit?.name?.replace(/[^a-zA-Z0-9]/g, '_') ?? id}.pdf`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to generate slip');
    } finally {
      setDownloadingSlip(false);
    }
  };

  // ============================================================

  if (loading) {
    return (
      <div className="container-custom py-16 flex justify-center">
        <span className="w-10 h-10 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !kit) {
    return (
      <div className="container-custom py-16 text-center">
        <BookMarked className="w-16 h-16 mx-auto mb-4 text-gray-200" />
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Kit not found</h2>
        <Link to="/literature/kits" className="btn btn-primary mt-4 inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to My Kits
        </Link>
      </div>
    );
  }

  const totalSize = kit.items.reduce((sum, i) => sum + i.literature.fileSize, 0);

  return (
    <div className="container-custom py-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link to="/literature" className="hover:text-green-700 flex items-center gap-1">
          <BookOpen className="w-3.5 h-3.5" /> Library
        </Link>
        <span>/</span>
        <Link to="/literature/kits" className="hover:text-green-700 flex items-center gap-1">
          <BookMarked className="w-3.5 h-3.5" /> My Kits
        </Link>
        <span>/</span>
        <span className="text-gray-700 font-medium truncate max-w-[200px]">{kit.name}</span>
      </div>

      {/* Kit header */}
      <div className="card p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Editable name */}
            {editingName ? (
              <div className="flex items-center gap-2 mb-2">
                <input
                  ref={nameInputRef}
                  autoFocus
                  type="text"
                  className="input flex-1 text-xl font-bold"
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
                />
                <button onClick={saveName} disabled={savingName} className="btn btn-primary p-2">
                  {savingName ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                </button>
                <button onClick={() => setEditingName(false)} className="btn bg-gray-100 p-2">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mb-2 group">
                <h1 className="text-2xl font-bold text-gray-900">{kit.name}</h1>
                <button
                  onClick={() => { setEditingName(true); setTimeout(() => nameInputRef.current?.focus(), 50); }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-gray-400 hover:text-green-600"
                  title="Rename kit"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Editable notes */}
            {editingNotes ? (
              <div className="space-y-2">
                <textarea
                  autoFocus
                  className="input w-full resize-none text-sm"
                  rows={2}
                  value={notesValue}
                  onChange={(e) => setNotesValue(e.target.value)}
                  placeholder="Add notes..."
                />
                <div className="flex gap-2">
                  <button onClick={saveNotes} disabled={savingNotes} className="btn btn-primary text-sm py-1 flex items-center gap-1">
                    {savingNotes ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-3 h-3" />}
                    Save
                  </button>
                  <button onClick={() => setEditingNotes(false)} className="btn bg-gray-100 text-sm py-1">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 group">
                <p className="text-gray-500 text-sm flex-1">
                  {kit.notes || <span className="italic text-gray-400">No notes — click to add</span>}
                </p>
                <button
                  onClick={() => setEditingNotes(true)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-gray-400 hover:text-green-600 shrink-0"
                  title="Edit notes"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="flex items-center gap-4 mt-3 text-sm text-gray-400">
              <span>{kit.items.length} document{kit.items.length !== 1 ? 's' : ''}</span>
              <span>~{formatBytes(totalSize)}</span>
            </div>
          </div>

          {/* Action bar */}
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              onClick={handleDownloadSlip}
              disabled={downloadingSlip || kit.items.length === 0}
              className="btn bg-gray-100 flex items-center gap-2 text-sm disabled:opacity-50"
              title="Download Literature Slip PDF"
            >
              {downloadingSlip
                ? <span className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                : <FileText className="w-4 h-4" />}
              Literature Slip
            </button>
            <button
              onClick={handleDownloadZip}
              disabled={downloadingZip || kit.items.length === 0}
              className="btn bg-gray-100 flex items-center gap-2 text-sm disabled:opacity-50"
              title="Download all as ZIP"
            >
              {downloadingZip
                ? <span className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                : <Archive className="w-4 h-4" />}
              Download ZIP
            </button>
            <button
              disabled
              title="Email functionality coming soon"
              className="btn bg-gray-50 text-gray-400 flex items-center gap-2 text-sm cursor-not-allowed border border-dashed border-gray-300"
            >
              <Mail className="w-4 h-4" /> Email <span className="text-xs">(soon)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Items */}
      {kit.items.length === 0 ? (
        <div className="text-center py-16 card">
          <BookOpen className="w-14 h-14 mx-auto mb-3 text-gray-200" />
          <p className="text-lg font-medium text-gray-600">This kit is empty</p>
          <p className="text-sm text-gray-400 mb-6">Browse the Literature Library and add documents to this kit.</p>
          <Link to="/literature" className="btn btn-primary inline-flex items-center gap-2 mx-auto">
            <BookOpen className="w-4 h-4" /> Browse Literature Library
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Document</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Parts / Series</th>
                <th className="px-4 py-3 text-right">Size</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {kit.items.map(({ literature: lit }) => (
                <tr key={lit.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 line-clamp-1">{lit.title}</div>
                    {lit.description && (
                      <div className="text-xs text-gray-400 line-clamp-1 mt-0.5">{lit.description}</div>
                    )}
                    {lit.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {lit.keywords.slice(0, 3).map((k) => (
                          <span key={k} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-xs">{k}</span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <TypeBadge type={lit.type} />
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">
                    {lit.parts.slice(0, 3).map((p) => p.part.partNumber).join(', ') || '—'}
                    {lit.series.length > 0 && (
                      <div className="text-gray-400">{lit.series.slice(0, 2).map((s) => s.seriesName).join(', ')}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 whitespace-nowrap">
                    {formatBytes(lit.fileSize)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <a
                        href={lit.filePath}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600"
                        title="View PDF"
                      >
                        <Eye className="w-4 h-4" />
                      </a>
                      <a
                        href={lit.filePath}
                        download
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-green-600"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                      <button
                        onClick={() => removeItem(lit.id)}
                        disabled={removingId === lit.id}
                        className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 disabled:opacity-40"
                        title="Remove from kit"
                      >
                        {removingId === lit.id
                          ? <span className="w-4 h-4 border border-red-400 border-t-transparent rounded-full animate-spin inline-block" />
                          : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Bottom link */}
      <div className="mt-6 flex justify-start">
        <Link to="/literature" className="text-sm text-green-600 hover:underline flex items-center gap-1">
          <BookOpen className="w-4 h-4" /> Add more documents from the Literature Library
        </Link>
      </div>
    </div>
  );
}
