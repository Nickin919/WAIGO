import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { videoApi, commentApi } from '@/lib/api';

const VideoPlayer = () => {
  const { videoId } = useParams<{ videoId: string }>();
  const [video, setVideo] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadVideo = async () => {
      if (!videoId) return;

      try {
        const [videoRes, commentsRes] = await Promise.all([
          videoApi.getById(videoId),
          commentApi.getByVideo(videoId),
        ]);
        setVideo(videoRes.data);
        setComments(commentsRes.data);

        // Track view
        videoApi.trackView(videoId).catch(console.error);
      } catch (error) {
        console.error('Failed to load video:', error);
      } finally {
        setLoading(false);
      }
    };

    loadVideo();
  }, [videoId]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoId || !newComment.trim()) return;

    try {
      const { data } = await commentApi.create({
        videoId,
        content: newComment.trim(),
      });
      setComments([data, ...comments]);
      setNewComment('');
    } catch (error) {
      console.error('Failed to post comment:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-wago-green border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading video...</p>
        </div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="container-custom py-12 text-center">
        <p className="text-gray-600">Video not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-black">
        <div className="container-custom">
          {/* Video player */}
          <div className="aspect-video bg-black flex items-center justify-center">
            {video.videoUrl.includes('youtube.com') || video.videoUrl.includes('youtu.be') ? (
              <iframe
                src={video.videoUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <video
                src={video.videoUrl}
                controls
                className="w-full h-full"
              />
            )}
          </div>
        </div>
      </div>

      <div className="container-custom py-6">
        <Link
          to={`/catalog/part/${video.part.id}`}
          className="flex items-center text-wago-green hover:underline mb-6"
        >
          <ChevronLeft className="w-5 h-5" />
          Back to {video.part.partNumber}
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2">
            <div className="mb-6">
              <div className="flex items-center space-x-3 mb-3">
                <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
                  Level {video.level}
                </span>
                <span className="text-sm text-gray-600">
                  {video._count.views} views
                </span>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {video.title}
              </h1>
              {video.description && (
                <p className="text-gray-600">{video.description}</p>
              )}
            </div>

            {/* Comments section */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Comments ({comments.length})
              </h2>

              {/* Comment form */}
              <form onSubmit={handleSubmitComment} className="mb-6">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="input min-h-[100px] resize-none mb-2"
                  placeholder="Add a comment..."
                />
                <button
                  type="submit"
                  disabled={!newComment.trim()}
                  className="btn btn-primary"
                >
                  Post Comment
                </button>
              </form>

              {/* Comments list */}
              <div className="space-y-4">
                {comments.map((comment) => (
                  <div key={comment.id} className="card p-4">
                    <div className="flex items-start space-x-3">
                      <div className="w-10 h-10 bg-wago-blue rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-semibold text-sm">
                          {comment.user.firstName?.[0] || comment.user.email[0].toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 mb-1">
                          {comment.user.firstName} {comment.user.lastName}
                        </div>
                        <p className="text-gray-700 mb-2">{comment.content}</p>
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          <button className="hover:text-wago-green">
                            Like ({comment.likesCount})
                          </button>
                          <button className="hover:text-wago-green">Reply</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div>
            <div className="card p-6">
              <h3 className="font-bold text-gray-900 mb-4">Related Part</h3>
              <Link
                to={`/catalog/part/${video.part.id}`}
                className="block hover:bg-gray-50 rounded-lg p-3 -m-3 transition-colors"
              >
                <div className="text-sm text-wago-green font-semibold mb-1">
                  {video.part.partNumber}
                </div>
                <div className="text-sm text-gray-900">
                  {video.part.description}
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
