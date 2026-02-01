import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, PlayCircle, FileText, Download } from 'lucide-react';
import { partApi, videoApi } from '@/lib/api';

const PartDetail = () => {
  const { partId } = useParams<{ partId: string }>();
  const [part, setPart] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPart = async () => {
      if (!partId) return;

      try {
        const { data } = await partApi.getById(partId);
        setPart(data);
      } catch (error) {
        console.error('Failed to load part:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPart();
  }, [partId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-wago-green border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!part) {
    return (
      <div className="container-custom py-12 text-center">
        <p className="text-gray-600">Part not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container-custom py-6">
        <Link
          to={`/catalog/category/${part.category.id}`}
          className="flex items-center text-wago-green hover:underline mb-6"
        >
          <ChevronLeft className="w-5 h-5" />
          Back to {part.category.name}
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Product image */}
          <div className="card p-8">
            <img
              src={part.thumbnailUrl || '/placeholder.png'}
              alt={part.partNumber}
              className="w-full max-w-md mx-auto object-contain"
            />
          </div>

          {/* Product info */}
          <div>
            <div className="text-sm text-wago-green font-semibold mb-2">
              {part.partNumber}
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              {part.description}
            </h1>

            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between py-2 border-b border-gray-200">
                <span className="text-gray-600">Package Qty</span>
                <span className="font-semibold">{part.packageQty}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-200">
                <span className="text-gray-600">Min Order Qty</span>
                <span className="font-semibold">{part.minQty}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-200">
                <span className="text-gray-600">Category</span>
                <span className="font-semibold">{part.category.name}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button className="btn btn-primary">
                Add to Project
              </button>
              <button className="btn btn-outline">
                Request Quote
              </button>
            </div>
          </div>
        </div>

        {/* Videos section */}
        {part.videos && part.videos.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Video Tutorials
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {part.videos.map((video: any) => (
                <Link
                  key={video.id}
                  to={`/video/${video.id}`}
                  className="card card-hover overflow-hidden"
                >
                  <div className="relative aspect-video bg-gray-900">
                    {video.thumbnailUrl ? (
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <PlayCircle className="w-16 h-16 text-white opacity-50" />
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <PlayCircle className="w-12 h-12 text-white" />
                    </div>
                    <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                      Level {video.level}
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {video.title}
                    </h3>
                    {video.description && (
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {video.description}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Files section */}
        {part.files && part.files.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Downloads
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {part.files.map((file: any) => (
                <a
                  key={file.id}
                  href={file.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card card-hover p-4 flex items-center space-x-4"
                >
                  <div className="w-12 h-12 bg-wago-green/10 rounded-lg flex items-center justify-center">
                    {file.fileType === 'datasheet' ? (
                      <FileText className="w-6 h-6 text-wago-green" />
                    ) : (
                      <Download className="w-6 h-6 text-wago-green" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">
                      {file.fileName}
                    </div>
                    <div className="text-sm text-gray-600 capitalize">
                      {file.fileType}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PartDetail;
