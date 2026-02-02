import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FileText, ArrowLeft, Download, Mail, Loader2 } from 'lucide-react';
import { projectApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { useReportQuery } from '@/hooks/useProjectQueries';

type ReportData = {
  project: { id: string; name: string; description: string | null; status: string };
  summary: { itemCount: number; wagoCount: number; nonWagoCount: number };
  items: Array<{
    partNumber: string;
    manufacturer: string | null;
    description: string;
    quantity: number;
    unitPrice: number | null;
    isWagoPart: boolean;
    panelAccessory: string | null;
  }>;
  costSummary: { totalEstimated: number; lineCountWithPrice: number };
  advantages: string[];
};

export default function ProjectReport() {
  const { projectId } = useParams<{ projectId: string }>();
  const reportQuery = useReportQuery(projectId);
  const report = reportQuery.data as ReportData | undefined;
  const loading = reportQuery.isLoading;
  const error = reportQuery.isError ? (reportQuery.error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to load report' : null;

  const [email, setEmail] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);

  const handleDownloadPdf = async () => {
    if (!projectId) return;
    setDownloadingPdf(true);
    try {
      const { data } = await projectApi.getReportPdf(projectId);
      const url = URL.createObjectURL(data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `project-report-${projectId.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF downloaded');
    } catch {
      toast.error('Failed to download PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDownloadExcel = async () => {
    if (!projectId) return;
    setDownloadingExcel(true);
    try {
      const { data } = await projectApi.getReportExcel(projectId);
      const url = URL.createObjectURL(data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `project-report-${projectId.slice(0, 8)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Excel downloaded');
    } catch {
      toast.error('Failed to download Excel');
    } finally {
      setDownloadingExcel(false);
    }
  };

  const handleEmailReport = async (e: React.FormEvent) => {
    e.preventDefault();
    const addr = email.trim();
    if (!projectId || !addr) {
      toast.error('Enter an email address');
      return;
    }
    setSendingEmail(true);
    try {
      await projectApi.emailReport(projectId, addr);
      toast.success(`Report sent to ${addr}`);
      setEmail('');
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
        : 'Failed to send email';
      toast.error(msg);
    } finally {
      setSendingEmail(false);
    }
  };

  if (!projectId) {
    return (
      <div className="container-custom py-6">
        <p className="text-gray-600">Invalid project.</p>
        <Link to="/projects" className="btn btn-secondary mt-4">Back to Projects</Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container-custom py-6 flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-10 h-10 text-wago-green animate-spin" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="container-custom py-6">
        <p className="text-red-600">{error || 'Report not available'}</p>
        <Link to={`/projects/${projectId}`} className="btn btn-secondary mt-4">
          Back to project
        </Link>
      </div>
    );
  }

  return (
    <div className="container-custom py-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <Link
          to={`/projects/${projectId}`}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to project
        </Link>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="btn btn-secondary flex items-center gap-2"
          >
            {downloadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download PDF
          </button>
          <button
            type="button"
            onClick={handleDownloadExcel}
            disabled={downloadingExcel}
            className="btn btn-secondary flex items-center gap-2"
          >
            {downloadingExcel ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download Excel
          </button>
        </div>
      </div>

      <div className="card overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h1 className="text-2xl font-bold text-gray-900">{report.project.name}</h1>
          {report.project.description && (
            <p className="text-gray-600 text-sm mt-1">{report.project.description}</p>
          )}
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-gray-50">
            <div className="text-2xl font-bold text-gray-900">{report.summary.itemCount}</div>
            <div className="text-sm text-gray-600">Total items</div>
          </div>
          <div className="p-4 rounded-lg bg-green-50">
            <div className="text-2xl font-bold text-green-700">{report.summary.wagoCount}</div>
            <div className="text-sm text-gray-600">WAGO items</div>
          </div>
          <div className="p-4 rounded-lg bg-gray-50">
            <div className="text-2xl font-bold text-gray-900">{report.summary.nonWagoCount}</div>
            <div className="text-sm text-gray-600">Other items</div>
          </div>
        </div>
        <div className="px-6 pb-4">
          <p className="text-sm text-gray-600">
            Estimated total: <span className="font-semibold text-gray-900">{report.costSummary.totalEstimated.toFixed(2)}</span>
            {report.costSummary.lineCountWithPrice > 0 && (
              <span> ({report.costSummary.lineCountWithPrice} lines with price)</span>
            )}
          </p>
        </div>
      </div>

      <div className="card overflow-hidden mb-6">
        <div className="px-6 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Bill of Materials</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Part #</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Manufacturer</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Description</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">Qty</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">Unit Price</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {report.items.map((row, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{row.partNumber}</td>
                  <td className="px-4 py-3 text-gray-600">{row.manufacturer ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{row.description}</td>
                  <td className="px-4 py-3 text-right">{row.quantity}</td>
                  <td className="px-4 py-3 text-right">{row.unitPrice != null ? row.unitPrice.toFixed(2) : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={row.isWagoPart ? 'text-green-600 font-medium' : 'text-gray-600'}>
                      {row.isWagoPart ? 'WAGO' : 'Other'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Advantages</h2>
        <ul className="space-y-2 text-gray-600">
          {report.advantages.map((a, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="text-green-600 mt-0.5">•</span>
              <span>{a}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Email report</h2>
        <p className="text-gray-600 text-sm mb-4">Send a PDF of this report to an email address.</p>
        <form onSubmit={handleEmailReport} className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="report-email" className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
            <input
              id="report-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="recipient@example.com"
              className="input w-full"
            />
          </div>
          <button
            type="submit"
            disabled={sendingEmail}
            className="btn btn-primary flex items-center gap-2"
          >
            {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            {sendingEmail ? 'Sending…' : 'Send report'}
          </button>
        </form>
      </div>
    </div>
  );
}
