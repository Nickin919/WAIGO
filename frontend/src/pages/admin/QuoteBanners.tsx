import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Upload, Trash2, Image, ToggleLeft, ToggleRight, GripVertical } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { bannerApi, appSettingsApi } from '@/lib/api';

interface Banner {
  id: string;
  url: string;
  label: string | null;
  active: boolean;
  order: number;
  createdAt: string;
}

const QuoteBanners = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [labelDraft, setLabelDraft] = useState('');
  const [genericThumbUrl, setGenericThumbUrl] = useState<string | null>(null);
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      bannerApi.list(),
      appSettingsApi.getGenericThumbnail(),
    ]).then(([banRes, thumbRes]) => {
      setBanners(Array.isArray(banRes.data) ? banRes.data : []);
      setGenericThumbUrl((thumbRes.data as any).url ?? null);
    }).catch(() => toast.error('Failed to load')).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploading(true);
    try {
      await bannerApi.upload(file, labelDraft.trim() || undefined);
      setLabelDraft('');
      toast.success('Banner uploaded');
      load();
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const toggleActive = async (b: Banner) => {
    try {
      await bannerApi.update(b.id, { active: !b.active });
      setBanners((prev) => prev.map((x) => x.id === b.id ? { ...x, active: !x.active } : x));
    } catch {
      toast.error('Failed to update');
    }
  };

  const saveLabel = async (b: Banner, label: string) => {
    try {
      await bannerApi.update(b.id, { label: label.trim() || undefined });
      setBanners((prev) => prev.map((x) => x.id === b.id ? { ...x, label: label.trim() || null } : x));
    } catch {
      toast.error('Failed to update');
    }
  };

  const deleteBanner = async (id: string) => {
    if (!confirm('Delete this banner?')) return;
    try {
      await bannerApi.remove(id);
      setBanners((prev) => prev.filter((b) => b.id !== id));
      toast.success('Banner deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleThumbUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploadingThumb(true);
    try {
      const res = await appSettingsApi.uploadGenericThumbnail(file);
      setGenericThumbUrl((res.data as any).url);
      toast.success('Generic thumbnail updated');
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploadingThumb(false);
    }
  };

  const deleteThumb = async () => {
    if (!confirm('Remove generic thumbnail?')) return;
    try {
      await appSettingsApi.deleteGenericThumbnail();
      setGenericThumbUrl(null);
      toast.success('Removed');
    } catch {
      toast.error('Failed to remove');
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/admin" className="text-green-600 hover:underline flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Admin
        </Link>
        <h1 className="text-2xl font-bold">Quote PDF Assets</h1>
      </div>

      {/* ── Generic Product Thumbnail ── */}
      <section className="card p-6 mb-8">
        <h2 className="text-lg font-semibold mb-1">Generic Product Thumbnail</h2>
        <p className="text-sm text-gray-500 mb-4">
          Shown in the PDF line-items table for any product that doesn't have its own thumbnail.
          Recommended size: <strong>200 × 200 px</strong> PNG with transparent background.
        </p>
        <div className="flex items-center gap-6">
          {genericThumbUrl ? (
            <div className="relative group">
              <img src={genericThumbUrl} alt="Generic thumbnail" className="w-20 h-20 object-contain border rounded-lg bg-gray-50" />
              <button
                onClick={deleteThumb}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
              <Image className="w-8 h-8 text-gray-300" />
            </div>
          )}
          <div>
            <button
              onClick={() => thumbInputRef.current?.click()}
              disabled={uploadingThumb}
              className="btn btn-outline flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              {uploadingThumb ? 'Uploading…' : genericThumbUrl ? 'Replace' : 'Upload'}
            </button>
            <input ref={thumbInputRef} type="file" accept="image/*" className="hidden" onChange={handleThumbUpload} />
          </div>
        </div>
      </section>

      {/* ── Product Banners ── */}
      <section className="card p-6">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h2 className="text-lg font-semibold">Product Banners</h2>
            <p className="text-sm text-gray-500 mt-1">
              One active banner is randomly selected and appended as the final page of each PDF quote.
              Recommended size: <strong>1240 × 300 px</strong> (or 2480 × 600 px for high-DPI print).
              Formats: PNG or JPEG.
            </p>
          </div>
        </div>

        {/* Upload new banner */}
        <div className="flex items-end gap-3 mt-4 mb-6 p-4 bg-gray-50 rounded-lg border">
          <div className="flex-1">
            <label className="text-sm font-medium text-gray-700 mb-1 block">Label (optional)</label>
            <input
              type="text"
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              placeholder="e.g. Spring 2026 – Connector Line"
              className="input w-full"
            />
          </div>
          <button
            onClick={() => bannerInputRef.current?.click()}
            disabled={uploading}
            className="btn btn-primary flex items-center gap-2 whitespace-nowrap"
          >
            <Upload className="w-4 h-4" />
            {uploading ? 'Uploading…' : 'Upload Banner'}
          </button>
          <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} />
        </div>

        {loading ? (
          <div className="py-12 text-center">
            <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : banners.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <Image className="w-14 h-14 mx-auto mb-3 text-gray-200" />
            <p>No banners yet. Upload your first one above.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {banners.map((b) => (
              <div key={b.id} className={`flex items-center gap-4 p-3 rounded-lg border ${b.active ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
                <GripVertical className="w-4 h-4 text-gray-300 shrink-0" />
                <img
                  src={b.url}
                  alt={b.label || 'Banner'}
                  className="w-28 h-12 object-cover rounded border bg-gray-100 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    defaultValue={b.label || ''}
                    onBlur={(e) => saveLabel(b, e.target.value)}
                    placeholder="Add a label…"
                    className="text-sm font-medium text-gray-800 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-green-500 outline-none w-full pb-0.5"
                  />
                  <p className="text-xs text-gray-400 mt-0.5">{new Date(b.createdAt).toLocaleDateString()}</p>
                </div>
                <button
                  onClick={() => toggleActive(b)}
                  className={`flex items-center gap-1.5 text-sm font-medium px-2 py-1 rounded transition-colors ${b.active ? 'text-green-700 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                  title={b.active ? 'Active — click to disable' : 'Inactive — click to enable'}
                >
                  {b.active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                  {b.active ? 'Active' : 'Off'}
                </button>
                <button
                  onClick={() => deleteBanner(b.id)}
                  className="text-red-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default QuoteBanners;
