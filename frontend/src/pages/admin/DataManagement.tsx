import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, Upload, FileSpreadsheet } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '@/lib/api';

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export default function DataManagement() {
  const [crossRefFile, setCrossRefFile] = useState<File | null>(null);
  const [crossRefReplace, setCrossRefReplace] = useState(false);
  const [crossRefLoading, setCrossRefLoading] = useState(false);
  const [nonWagoFile, setNonWagoFile] = useState<File | null>(null);
  const [nonWagoReplace, setNonWagoReplace] = useState(false);
  const [nonWagoLoading, setNonWagoLoading] = useState(false);
  const crossRefInputRef = useRef<HTMLInputElement>(null);
  const nonWagoInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadCrossRefSample = async () => {
    try {
      const { data } = await adminApi.getCrossReferencesSample();
      downloadBlob(data as Blob, 'cross-references-sample.csv');
      toast.success('Sample downloaded');
    } catch (e) {
      toast.error('Failed to download sample');
    }
  };

  const handleImportCrossReferences = async () => {
    if (!crossRefFile) {
      toast.error('Select a CSV file first');
      return;
    }
    setCrossRefLoading(true);
    try {
      const { data } = await adminApi.importCrossReferences(crossRefFile, crossRefReplace);
      const msg = `Imported ${data.created} of ${data.totalRows} rows${data.errors?.length ? ` (${data.errors.length} errors)` : ''}`;
      toast.success(msg);
      if (data.errors?.length) {
        console.warn('Import errors:', data.errors);
      }
      setCrossRefFile(null);
      if (crossRefInputRef.current) crossRefInputRef.current.value = '';
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Import failed');
    } finally {
      setCrossRefLoading(false);
    }
  };

  const handleDownloadNonWagoSample = async () => {
    try {
      const { data } = await adminApi.getNonWagoProductsSample();
      downloadBlob(data as Blob, 'non-wago-products-sample.csv');
      toast.success('Sample downloaded');
    } catch (e) {
      toast.error('Failed to download sample');
    }
  };

  const handleImportNonWagoProducts = async () => {
    if (!nonWagoFile) {
      toast.error('Select a CSV file first');
      return;
    }
    setNonWagoLoading(true);
    try {
      const { data } = await adminApi.importNonWagoProducts(nonWagoFile, nonWagoReplace);
      const msg = `Imported ${data.created} of ${data.totalRows} rows${data.errors?.length ? ` (${data.errors.length} errors)` : ''}`;
      toast.success(msg);
      if (data.errors?.length) {
        console.warn('Import errors:', data.errors);
      }
      setNonWagoFile(null);
      if (nonWagoInputRef.current) nonWagoInputRef.current.value = '';
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Import failed');
    } finally {
      setNonWagoLoading(false);
    }
  };

  return (
    <div className="container-custom py-6">
      <div className="mb-6">
        <Link to="/admin" className="text-green-600 hover:underline flex items-center gap-1 mb-2">
          <ArrowLeft className="w-5 h-5" /> Back to Admin
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">BOM Data Management</h1>
        <p className="text-gray-600 mt-1">
          Download sample CSVs and upload to add or replace Cross-References and Non-WAGO Products. Admin only.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Cross-References */}
        <div className="card p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-green-600" />
            Cross-References
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Maps competitor manufacturer + part number to WAGO Part. Use <strong>MASTER Cross Reference Import</strong> to upload with column mapping (recommended). Or use the fixed template below to add/replace quickly.
          </p>
          <div className="space-y-4">
            <Link
              to="/admin/import-cross-references"
              className="btn btn-primary flex items-center gap-2 w-fit"
            >
              <Upload className="w-5 h-5" />
              MASTER Cross Reference Import (with column mapping)
            </Link>
            <button
              type="button"
              onClick={handleDownloadCrossRefSample}
              className="btn btn-secondary flex items-center gap-2"
            >
              <Download className="w-5 h-5" /> Download Sample CSV
            </button>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Upload CSV</label>
              <input
                ref={crossRefInputRef}
                type="file"
                accept=".csv"
                onChange={(e) => setCrossRefFile(e.target.files?.[0] || null)}
                className="input block w-full text-sm"
              />
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={crossRefReplace}
                onChange={(e) => setCrossRefReplace(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Replace all (uncheck to append/upsert)</span>
            </label>
            <button
              type="button"
              onClick={handleImportCrossReferences}
              disabled={!crossRefFile || crossRefLoading}
              className="btn btn-primary flex items-center gap-2"
            >
              <Upload className="w-5 h-5" />
              {crossRefLoading ? 'Importing...' : 'Import Cross-References'}
            </button>
          </div>
        </div>

        {/* Non-WAGO Products */}
        <div className="card p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-blue-600" />
            Non-WAGO Products
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Catalog of known competitor parts. Columns: manufacturer, partNumber, description, category.
          </p>
          <div className="space-y-4">
            <button
              type="button"
              onClick={handleDownloadNonWagoSample}
              className="btn btn-secondary flex items-center gap-2"
            >
              <Download className="w-5 h-5" /> Download Sample CSV
            </button>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Upload CSV</label>
              <input
                ref={nonWagoInputRef}
                type="file"
                accept=".csv"
                onChange={(e) => setNonWagoFile(e.target.files?.[0] || null)}
                className="input block w-full text-sm"
              />
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={nonWagoReplace}
                onChange={(e) => setNonWagoReplace(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Replace all (uncheck to append/upsert)</span>
            </label>
            <button
              type="button"
              onClick={handleImportNonWagoProducts}
              disabled={!nonWagoFile || nonWagoLoading}
              className="btn btn-primary flex items-center gap-2"
            >
              <Upload className="w-5 h-5" />
              {nonWagoLoading ? 'Importing...' : 'Import Non-WAGO Products'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
