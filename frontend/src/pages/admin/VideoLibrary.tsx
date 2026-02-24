import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Upload, Download, FileSpreadsheet, Play,
  Eye, Pencil, Trash2, X, Check, Search, ChevronLeft, ChevronRight,
  BarChart2, Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { videoLibraryApi } from '@/lib/api';

const VIDEO_TYPES = [
  'TECHNICAL', 'APPLICATION', 'TESTIMONIAL', 'TUTORIAL',
  'PRODUCT_DEMO', 'WEBINAR', 'TRAINING', 'OTHER',
];

const PAGE_SIZE = 50;

const TYPE_COLORS: Record<string, string> = {
  TECHNICAL:   'bg-blue-100 text-blue-800',
  APPLICATION: 'bg-green-100 text-green-800',
  TESTIMONIAL: 'bg-amber-100 text-amber-800',
  TUTORIAL:    'bg-purple-100 text-purple-800',
  PRODUCT_DEMO:'bg-cyan-100 text-cyan-800',
  WEBINAR:     'bg-pink-100 text-pink-800',
  TRAINING:    'bg-orange-100 text-orange-800',
  OTHER:       'bg-gray-100 text-gray-700',
};

interface VideoItem {
  id: string;
  title: string;
  description?: string;
  videoType: string;
  videoUrl: string;
  thumbnailUrl?: string;
  duration?: number;
  keywords: string[];
  industryTags: string[];
  createdAt: string;
  libraryParts: { part: { id: string; partNumber: string } }[];
  librarySeries: { seriesName: string }[];
  _count: { views: number; comments: number; favorites: number };
}

function formatDuration(seconds?: number): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function countItems(value: string): number {
  return value.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean).length;
}

interface TagFieldProps {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  rows?: number;
}

function TagField({ label, hint, value, onChange, placeholder, rows = 3 }: TagFieldProps) {
  const count = countItems(value);
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <label className="text-sm font-medium text-gray-700">
          {label}
          {count > 0 && (
            <span className="ml-2 px-1.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
              {count}
            </span>
          )}
        </label>
        {hint && <span className="text-xs text-gray-400">{hint}</span>}
      </div>
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input w-full resize-y font-mono text-sm leading-relaxed"
        placeholder={placeholder}
      />
      <p className="text-xs text-gray-400 mt-0.5">Separate with commas, semicolons, or new lines</p>
    </div>
  );
}

interface EditModalProps {
  item: VideoItem;
  onClose: () => void;
  onSaved: () => void;
}

function EditModal({ item, onClose, onSaved }: EditModalProps) {
  const [form, setForm] = useState({
    title: item.title,
    description: item.description ?? '',
    videoType: item.videoType,
    partNumbers: item.libraryParts.map((p) => p.part.partNumber).join(', '),
    seriesNames: item.librarySeries.map((s) => s.seriesName).join(', '),
    keywords: item.keywords.join(', '),
    industryTags: item.industryTags.join(', '),
    duration: item.duration ? String(item.duration) : '',
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
        videoLibraryApi.updateMetadata(item.id, {
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          videoType: form.videoType,
          keywords: splitList(form.keywords),
          industryTags: splitList(form.industryTags),
          duration: form.duration ? parseInt(form.duration, 10) : undefined,
        }),
        videoLibraryApi.updateAssociations(item.id, {
          partNumbers: splitList(form.partNumbers),
          seriesNames: splitList(form.seriesNames),
        }),
      ]);
      const unresolved: string[] = (assocResult.data as any)?.unresolvedParts ?? [];
      if (unresolved.length > 0) {
        setUnresolvedParts(unresolved);
        toast.success('Saved — but some part numbers were not found (see below)');
        onSaved();
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
          <h2 className="text-lg font-semibold">Edit Video</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input className="input w-full" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Video Type</label>
            <select className="input w-full" value={form.videoType} onChange={(e) => setForm((f) => ({ ...f, videoType: e.target.value }))}>
              {VIDEO_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea className="input w-full resize-y" rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Duration (seconds)</label>
            <input type="number" className="input w-full" placeholder="e.g. 185" value={form.duration} onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))} />
          </div>
          <TagField
            label="Part Numbers"
            hint="catalog: 221-2301 or article: 51015188"
            value={form.partNumbers}
            onChange={(v) => setForm((f) => ({ ...f, partNumbers: v }))}
            placeholder="221-2301&#10;51015188&#10;750-841"
            rows={4}
          />
          <TagField
            label="Series"
            value={form.seriesNames}
            onChange={(v) => setForm((f) => ({ ...f, seriesNames: v }))}
            placeholder="221 Series&#10;750 Series"
            rows={2}
          />
          <TagField
            label="Keywords"
            value={form.keywords}
            onChange={(v) => setForm((f) => ({ ...f, keywords: v }))}
            placeholder="CAGE CLAMP&#10;push-in&#10;terminal block"
            rows={3}
          />
          <TagField
            label="Industry Tags"
            value={form.industryTags}
            onChange={(v) => setForm((f) => ({ ...f, industryTags: v }))}
            placeholder="Automation&#10;Panel Building&#10;Rail"
            rows={2}
          />
        </div>
        {unresolvedParts.length > 0 && (
          <div className="mx-6 mb-2 p-3 rounded-lg bg-amber-50 border border-amber-300">
            <p className="text-sm font-semibold text-amber-800 mb-1">
              ⚠ {unresolvedParts.length} part number{unresolvedParts.length !== 1 ? 's' : ''} not found in catalog
            </p>
            <div className="flex flex-wrap gap-1">
              {unresolvedParts.map((pn) => (
                <code key={pn} className="px-1.5 py-0.5 bg-amber-100 text-amber-900 rounded text-xs font-mono">{pn}</code>
              ))}
            </div>
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

export default function VideoLibrary() {
  // Upload form
  const [uploadForm, setUploadForm] = useState({
    title: '', videoType: 'TECHNICAL', description: '', duration: '',
    partNumbers: '', seriesNames: '', keywords: '', industryTags: '',
  });
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadUnresolved, setUploadUnresolved] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Library list
  const [items, setItems] = useState<VideoItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [editItem, setEditItem] = useState<VideoItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VideoItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [previewVideo, setPreviewVideo] = useState<VideoItem | null>(null);

  // Analytics
  const [analytics, setAnalytics] = useState<any>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);

  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  const loadList = useCallback(async (pageNum = page, searchVal = search, typeVal = typeFilter) => {
    setLoading(true);
    try {
      const { data } = await videoLibraryApi.list({
        limit: PAGE_SIZE,
        offset: pageNum * PAGE_SIZE,
        search: searchVal || undefined,
        videoType: typeVal || undefined,
        status: 'APPROVED',
      });
      setItems(data.items as VideoItem[]);
      setTotal(data.total ?? 0);
    } catch {
      toast.error('Failed to load videos');
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

  const handleUpload = async () => {
    if (!videoFile) { toast.error('Select a video file'); return; }
    if (!uploadForm.title.trim()) { toast.error('Title is required'); return; }
    if (!uploadForm.videoType) { toast.error('Video type is required'); return; }

    setUploading(true);
    setUploadUnresolved([]);
    setUploadProgress(0);
    try {
      const fd = new FormData();
      fd.append('video', videoFile);
      if (thumbnailFile) fd.append('thumbnail', thumbnailFile);
      fd.append('title', uploadForm.title.trim());
      fd.append('videoType', uploadForm.videoType);
      fd.append('description', uploadForm.description.trim());
      if (uploadForm.duration) fd.append('duration', uploadForm.duration);
      fd.append('partNumbers', uploadForm.partNumbers);
      fd.append('seriesNames', uploadForm.seriesNames);
      fd.append('keywords', uploadForm.keywords);
      fd.append('industryTags', uploadForm.industryTags);

      const { data } = await videoLibraryApi.upload(fd);
      const unresolved: string[] = data.unresolvedParts ?? [];
      setUploadUnresolved(unresolved);

      if (unresolved.length > 0) {
        toast.success(`Uploaded! ${unresolved.length} part number(s) not found — check below`);
      } else {
        toast.success('Video uploaded successfully!');
      }

      setUploadForm({ title: '', videoType: 'TECHNICAL', description: '', duration: '', partNumbers: '', seriesNames: '', keywords: '', industryTags: '' });
      setVideoFile(null);
      setThumbnailFile(null);
      loadList(0, '', '');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await videoLibraryApi.delete(deleteTarget.id);
      toast.success('Video deleted');
      setDeleteTarget(null);
      loadList();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      const { data } = await videoLibraryApi.exportCsv();
      downloadBlob(data as Blob, 'video-library-export.csv');
    } catch {
      toast.error('Export failed');
    }
  };

  const loadAnalytics = async () => {
    try {
      const { data } = await videoLibraryApi.getAnalytics();
      setAnalytics(data);
      setShowAnalytics(true);
    } catch {
      toast.error('Failed to load analytics');
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="container-custom py-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/admin" className="text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Video Library</h1>
          <p className="text-sm text-gray-500 mt-0.5">Admin-managed video content for users</p>
        </div>
        <button onClick={loadAnalytics} className="btn bg-gray-100 flex items-center gap-2 text-sm">
          <BarChart2 className="w-4 h-4" /> Analytics
        </button>
        <button onClick={handleExportCsv} className="btn bg-gray-100 flex items-center gap-2 text-sm">
          <FileSpreadsheet className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* Analytics panel */}
      {showAnalytics && analytics && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Video Analytics</h2>
            <button onClick={() => setShowAnalytics(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-blue-700">{analytics.totalVideos}</div>
              <div className="text-sm text-blue-600 mt-1">Total Videos</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-green-700">{analytics.totalViews}</div>
              <div className="text-sm text-green-600 mt-1">Total Views</div>
            </div>
          </div>
          {analytics.topViewed?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Top Viewed</h3>
              <div className="space-y-2">
                {analytics.topViewed.slice(0, 5).map((v: any) => (
                  <div key={v.id} className="flex items-center justify-between text-sm py-1 border-b border-gray-100">
                    <span className="text-gray-800 truncate max-w-xs">{v.title}</span>
                    <span className="text-gray-500 flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {v._count?.views ?? 0}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Upload form */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload New Video</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              className="input w-full"
              placeholder="e.g. How to wire a 221 connector"
              value={uploadForm.title}
              onChange={(e) => setUploadForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Video Type *</label>
            <select
              className="input w-full"
              value={uploadForm.videoType}
              onChange={(e) => setUploadForm((f) => ({ ...f, videoType: e.target.value }))}
            >
              {VIDEO_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              className="input w-full resize-y"
              rows={2}
              placeholder="Short description of what this video covers"
              value={uploadForm.description}
              onChange={(e) => setUploadForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Duration (seconds)</label>
            <input
              type="number"
              className="input w-full"
              placeholder="e.g. 185"
              value={uploadForm.duration}
              onChange={(e) => setUploadForm((f) => ({ ...f, duration: e.target.value }))}
            />
          </div>
          <div />

          <TagField
            label="Part Numbers"
            hint="catalog: 221-2301 or article: 51015188"
            value={uploadForm.partNumbers}
            onChange={(v) => setUploadForm((f) => ({ ...f, partNumbers: v }))}
            placeholder="221-2301&#10;51015188&#10;750-841"
            rows={3}
          />
          <TagField
            label="Series"
            value={uploadForm.seriesNames}
            onChange={(v) => setUploadForm((f) => ({ ...f, seriesNames: v }))}
            placeholder="221 Series&#10;750 Series"
            rows={3}
          />
          <TagField
            label="Keywords"
            value={uploadForm.keywords}
            onChange={(v) => setUploadForm((f) => ({ ...f, keywords: v }))}
            placeholder="CAGE CLAMP&#10;push-in&#10;terminal block"
            rows={3}
          />
          <TagField
            label="Industry Tags"
            value={uploadForm.industryTags}
            onChange={(v) => setUploadForm((f) => ({ ...f, industryTags: v }))}
            placeholder="Automation&#10;Panel Building&#10;Rail"
            rows={3}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Video File * (.mp4, .webm)</label>
            <input
              type="file"
              accept="video/mp4,video/webm"
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
              onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
            />
            {videoFile && <p className="text-xs text-gray-500 mt-1">{videoFile.name} ({(videoFile.size / 1024 / 1024).toFixed(1)} MB)</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Thumbnail Image (.jpg, .png)</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100 cursor-pointer"
              onChange={(e) => setThumbnailFile(e.target.files?.[0] ?? null)}
            />
            {thumbnailFile && <p className="text-xs text-gray-500 mt-1">{thumbnailFile.name}</p>}
          </div>
        </div>

        {uploadUnresolved.length > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-300">
            <p className="text-sm font-semibold text-amber-800 mb-1">
              ⚠ {uploadUnresolved.length} part number{uploadUnresolved.length !== 1 ? 's' : ''} not found in catalog
            </p>
            <div className="flex flex-wrap gap-1">
              {uploadUnresolved.map((pn) => (
                <code key={pn} className="px-1.5 py-0.5 bg-amber-100 text-amber-900 rounded text-xs font-mono">{pn}</code>
              ))}
            </div>
          </div>
        )}

        {uploading && (
          <div className="mt-3">
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full animate-pulse w-2/3" />
            </div>
            <p className="text-xs text-gray-500 mt-1">Uploading video to R2 — this may take a moment for large files...</p>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button
            onClick={handleUpload}
            disabled={uploading || !videoFile}
            className="btn btn-primary flex items-center gap-2 disabled:opacity-60"
          >
            {uploading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? 'Uploading...' : 'Upload Video'}
          </button>
        </div>
      </div>

      {/* Library table */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b flex flex-wrap gap-3 items-center">
          <div className="flex-1 min-w-48 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="input pl-9 w-full"
              placeholder="Search title, description, keywords…"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>
          <select
            className="input w-44"
            value={typeFilter}
            onChange={(e) => handleTypeFilter(e.target.value)}
          >
            <option value="">All Types</option>
            {VIDEO_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
          <span className="text-sm text-gray-500">{total} video{total !== 1 ? 's' : ''}</span>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16 text-gray-500">No videos found</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-4 py-3 w-16">Thumb</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3 w-32">Type</th>
                  <th className="px-4 py-3 w-20 text-center">Duration</th>
                  <th className="px-4 py-3 w-20 text-center">Views</th>
                  <th className="px-4 py-3 w-28">Added</th>
                  <th className="px-4 py-3 w-28 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div
                        className="w-12 h-9 rounded bg-gray-200 overflow-hidden flex items-center justify-center cursor-pointer relative group"
                        onClick={() => setPreviewVideo(item)}
                      >
                        {item.thumbnailUrl
                          ? <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                          : <Play className="w-5 h-5 text-gray-400" />
                        }
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Play className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 truncate max-w-xs" title={item.title}>{item.title}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {item.libraryParts.length > 0 && `${item.libraryParts.length} part(s) • `}
                        {item.librarySeries.length > 0 && `${item.librarySeries.length} series • `}
                        {item.keywords.length > 0 && `${item.keywords.length} keywords`}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${TYPE_COLORS[item.videoType] ?? 'bg-gray-100 text-gray-700'}`}>
                        {item.videoType.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">
                      <span className="flex items-center justify-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        {formatDuration(item.duration)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">
                      <span className="flex items-center justify-center gap-1">
                        <Eye className="w-3.5 h-3.5 text-gray-400" />
                        {item._count?.views ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => window.open(item.videoUrl, '_blank')}
                          className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                          title="Open video"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditItem(item)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(item)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded"
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
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-gray-600">
            <span>Page {page + 1} of {totalPages}</span>
            <div className="flex gap-2">
              <button
                disabled={page === 0}
                onClick={() => { const p = page - 1; setPage(p); loadList(p); }}
                className="btn bg-gray-100 disabled:opacity-40 flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => { const p = page + 1; setPage(p); loadList(p); }}
                className="btn bg-gray-100 disabled:opacity-40 flex items-center gap-1"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editItem && (
        <EditModal item={editItem} onClose={() => setEditItem(null)} onSaved={() => loadList()} />
      )}

      {/* Delete confirm modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Video?</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will permanently delete "<strong>{deleteTarget.title}</strong>" and remove it from R2 storage. This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)} className="btn bg-gray-100">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="btn bg-red-600 text-white disabled:opacity-60 flex items-center gap-2">
                {deleting ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick preview modal */}
      {previewVideo && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setPreviewVideo(null)}>
          <div className="bg-black rounded-xl overflow-hidden max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-3 border-b border-gray-800">
              <span className="text-white font-medium text-sm truncate">{previewVideo.title}</span>
              <button onClick={() => setPreviewVideo(null)} className="text-gray-400 hover:text-white ml-4">
                <X className="w-5 h-5" />
              </button>
            </div>
            <video
              src={previewVideo.videoUrl}
              poster={previewVideo.thumbnailUrl}
              controls
              autoPlay
              className="w-full max-h-[60vh] bg-black"
            />
          </div>
        </div>
      )}
    </div>
  );
}
