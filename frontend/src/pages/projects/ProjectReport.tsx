import { useParams, Link } from 'react-router-dom';
import { FileText, ArrowLeft } from 'lucide-react';

/** Placeholder for Phase 3 – full report view, download, email */
export default function ProjectReport() {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    <div className="container-custom py-6">
      <Link
        to={projectId ? `/projects/${projectId}` : '/projects'}
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-5 h-5" />
        Back to project
      </Link>
      <div className="card p-8 max-w-2xl text-center">
        <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Project Report</h1>
        <p className="text-gray-600 mb-6">
          Full report view, download (PDF/Excel), and email will be available in Phase 3.
        </p>
        <Link to={projectId ? `/projects/${projectId}` : '/projects'} className="btn btn-primary">
          Back to project
        </Link>
      </div>
    </div>
  );
}
