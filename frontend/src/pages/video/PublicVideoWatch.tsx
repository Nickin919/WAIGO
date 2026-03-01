import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { publicApi } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

interface PublicVideo {
  id: string;
  title: string;
  description?: string;
  videoUrl: string;
  thumbnailUrl?: string;
  level: number;
  part?: { partNumber: string; description: string };
}

const PublicVideoWatch = () => {
  const { videoId } = useParams<{ videoId: string }>();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [video, setVideo] = useState<PublicVideo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!videoId) {
      setLoading(false);
      setError('No video specified');
      return;
    }
    publicApi
      .getPublicVideo(videoId)
      .then((res) => setVideo(res.data))
      .catch(() => setError('Video not found or unavailable'))
      .finally(() => setLoading(false));
  }, [videoId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white p-6 text-center">
        <p className="text-lg mb-4">{error ?? 'Video not found'}</p>
        <Link to="/login" className="text-wago-green hover:underline">
          Sign in
        </Link>
        <span className="text-gray-500 mx-2">|</span>
        <Link to="/" className="text-wago-green hover:underline">
          Go home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-3xl">
          <div className="aspect-video bg-black rounded-lg overflow-hidden">
            <video
              src={video.videoUrl}
              poster={video.thumbnailUrl}
              controls
              playsInline
              className="w-full h-full object-contain"
              disablePictureInPicture
              disableRemotePlayback
            />
          </div>
          <div className="mt-4 text-white">
            <h1 className="text-xl font-bold mb-2">{video.title}</h1>
            {video.part && (
              <p className="text-sm text-gray-400 mb-1">
                Part: {video.part.partNumber} · Level {video.level}
              </p>
            )}
            {video.description && <p className="text-gray-300 text-sm mt-2">{video.description}</p>}
          </div>
        </div>
      </div>
      <div className="p-4 text-center border-t border-gray-800">
        <p className="text-gray-500 text-sm mb-2">Shared with you from WAGO Project Hub</p>
        {isAuthenticated && videoId ? (
          <Link to={`/videos?videoId=${encodeURIComponent(videoId)}`} className="text-wago-green hover:underline text-sm">
            Open in Video Academy
          </Link>
        ) : (
          <Link to="/login" className="text-wago-green hover:underline text-sm">
            Sign in to browse more videos and save favorites
          </Link>
        )}
      </div>
    </div>
  );
};

export default PublicVideoWatch;
