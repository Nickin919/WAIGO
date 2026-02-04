import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Upload, Download, FileText, FileSpreadsheet, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import { literatureApi } from '@/lib/api';

const LIT_TYPES = ['WHITE_PAPER', 'FLYER', 'BROCHURE', 'CATALOG_PAGE'];

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export default function LiteratureLibrary() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    title: '',
    type: 'FLYER',
    description: '',
    partIds: '',
    seriesNames: '',
  });
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const loadList = async () => {
    setLoading(true);
    try {
      const { data } = await literatureApi.list({ limit: 200 });
      setItems(data.items || []);
      setTotal(data.total ?? 0);
    } catch (e) {
      toast.error('Failed to load literature');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadList();
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadForm.title.trim() || !uploadFile) {
      toast.error('Title and PDF file are required');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('title', uploadForm.title.trim());
      formData.append('type', uploadForm.type);
      if (uploadForm.description.trim()) formData.append('description', uploadForm.description.trim());
      uploadForm.partIds.split(/[,;\s]+/).filter(Boolean).forEach((id) => formData.append('partIds', id.trim()));
      uploadForm.seriesNames.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean).forEach((s) => formData.append('seriesNames', s));
      await literatureApi.upload(formData);
      toast.success('Literature uploaded');
      setUploadForm({ title: '', type: 'FLYER', description: '', partIds: '', seriesNames: '' });
      setUploadFile(null);
      loadList();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleExportPdf = async () => {
    try {
      const { data } = await literatureApi.exportPdf();
      downloadBlob(data as Blob, 'literature-report.pdf');
      toast.success('PDF downloaded');
    } catch {
      toast.error('Export PDF failed');
    }
  };

  const handleExportCsv = async () => {
    try {
      const { data } = await literatureApi.exportCsv();
      downloadBlob(data as Blob, 'literature-export.csv');
      toast.success('CSV downloaded');
    } catch {
      toast.error('Export CSV failed');
    }
  };

  const handleSampleCsv = async () => {
    try {
      const { data } = await literatureApi.getSampleCsv();
      downloadBlob(data as Blob, 'literature-bulk-update-sample.csv');
      toast.success('Sample CSV downloaded');
    } catch {
      toast.error('Download failed');
    }
  };

  const handleBulkUpdate = async () => {
    if (!bulkFile) {
      toast.error('Select a CSV file first');
      return;
    }
    setBulkLoading(true);
    try {
      const { data } = await literatureApi.bulkUpdateAssociations(bulkFile);
      toast.success(`Updated ${data.updated} item(s)${data.errors?.length ? `. ${data.errors.length} error(s).` : ''}`);
      if (data.errors?.length) console.warn('Bulk errors:', data.errors);
      setBulkFile(null);
      loadList();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Bulk update failed');
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <div className="container-custom py-6">
      <div className="mb-6">
        <Link to="/admin" className="text-green-600 hover:underline flex items-center gap-1 mb-2">
          <ArrowLeft className="w-5 h-5" /> Back to Admin
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <BookOpen className="w-8 h-8" /> Literature Library
        </h1>
        <p className="text-gray-600 mt-1">
          Upload PDFs, link to parts and series, and export or bulk-edit associations. Attached literature is included when you email a quote.
        </p>
      </div>

      {/* Upload */}
      <div className="card p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Upload PDF</h2>
        <form onSubmit={handleUpload} className="space-y-4 max-w-2xl">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              type="text"
              value={uploadForm.title}
              onChange={(e) => setUploadForm((f) => ({ ...f, title: e.target.value }))}
              className="input w-full"
              placeholder="e.g. Product Flyer 2024"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={uploadForm.type}
              onChange={(e) => setUploadForm((f) => ({ ...f, type: e.target.value }))}
              className="input w-full"
            >
              {LIT_TYPES.map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
            <input
              type="text"
              value={uploadForm.description}
              onChange={(e) => setUploadForm((f) => ({ ...f, description: e.target.value }))}
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Part IDs (comma or space separated)</label>
            <input
              type="text"
              value={uploadForm.partIds}
              onChange={(e) => setUploadForm((f) => ({ ...f, partIds: e.target.value }))}
              className="input w-full"
              placeholder="P001, P002"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Series names (comma separated)</label>
            <input
              type="text"
              value={uploadForm.seriesNames}
              onChange={(e) => setUploadForm((f) => ({ ...f, seriesNames: e.target.value }))}
              className="input w-full"
              placeholder="Series A, Series B"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">PDF file *</label>
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              className="input w-full"
            />
          </div>
          <button type="submit" disabled={uploading} className="btn btn-primary flex items-center gap-2 disabled:opacity-60">
            {uploading ? <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Upload className="w-4 h-4" />}
            Upload
          </button>
        </form>
      </div>

      {/* Export & Bulk */}
      <div className="card p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Export & bulk update</h2>
        <div className="flex flex-wrap gap-4 items-end">
          <button type="button" onClick={handleExportPdf} className="btn bg-gray-200 flex items-center gap-2">
            <FileText className="w-4 h-4" /> Export PDF
          </button>
          <button type="button" onClick={handleExportCsv} className="btn bg-gray-200 flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" /> Export CSV
          </button>
          <button type="button" onClick={handleSampleCsv} className="btn bg-gray-200 flex items-center gap-2">
            <Download className="w-4 h-4" /> Sample CSV
          </button>
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setBulkFile(e.target.files?.[0] ?? null)}
              className="input max-w-xs"
            />
            <button type="button" onClick={handleBulkUpdate} disabled={!bulkFile || bulkLoading} className="btn btn-primary disabled:opacity-60">
              {bulkLoading ? 'Uploading...' : 'Bulk update'}
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4">Library ({total})</h2>
        {loading ? (
          <div className="flex justify-center py-8">
            <span className="inline-block w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-gray-500">No literature yet. Upload a PDF above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Title</th>
                  <th className="px-4 py-2 text-left">Type</th>
                  <th className="px-4 py-2 text-left">Parts</th>
                  <th className="px-4 py-2 text-left">Series</th>
                </tr>
              </thead>
              <tbody>
                {items.map((lit: any) => (
                  <tr key={lit.id} className="border-t">
                    <td className="px-4 py-2 font-medium">{lit.title}</td>
                    <td className="px-4 py-2">{lit.type?.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-2 text-gray-600">
                      {(lit.parts || []).map((p: any) => p.part?.partNumber || p.partId).join(', ') || '—'}
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {(lit.series || []).map((s: any) => s.seriesName).join(', ') || '—'}
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
}
