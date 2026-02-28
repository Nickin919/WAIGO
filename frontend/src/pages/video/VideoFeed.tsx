import { useEffect, useState, useRef, useCallback } from 'react';
import { Heart, MessageCircle, Share2, Bookmark, ChevronDown, X, ChevronRight } from 'lucide-react';
import { videoApi, videoLibraryApi } from '@/lib/api';
import { useAuthStore, isGuestUser } from '@/stores/authStore';
import { useActiveProjectBook } from '@/hooks/useActiveProjectBook';
import { NoActiveProjectBookEmptyState } from '@/components/shared/NoActiveProjectBookEmptyState';
import { ActiveProjectBookBar } from '@/components/shared/ActiveProjectBookBar';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import toast from 'react-hot-toast';

interface Video {
  id: string;
  title: string;
  description?: string;
  videoUrl: string;
  level: number;
  part: {
    partNumber: string;
    description: string;
  };
  isFavorited?: boolean;
  _count: {
    views: number;
    comments: number;
    favorites?: number;
  };
}

const VideoFeed = () => {
  const guest = useAuthStore(isGuestUser);
  const [videos, setVideos] = useState<Video[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const startY = useRef(0);
  const [videoError, setVideoError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showPlaylistDropdown, setShowPlaylistDropdown] = useState(false);
  const [playlists, setPlaylists] = useState<{ id: string; name: string }[]>([]);
  const [comments, setComments] = useState<{ id: string; content: string; user: { firstName?: string; lastName?: string }; createdAt: string }[]>([]);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const wheelLockRef = useRef(false);
  const didSwipeRef = useRef(false);

  const {
    activeCatalogId,
    activeCatalogName,
    assignedProjectBooks,
    hasAssignedProjectBooks,
    canShowContent,
    isLoading: pbLoading,
    isSwitching,
    setActiveProjectBook,
  } = useActiveProjectBook();

  useEffect(() => {
    if (pbLoading) return;
    if (!canShowContent || !activeCatalogId) {
      setLoading(false);
      return;
    }
    loadVideos(activeCatalogId);
  }, [canShowContent, activeCatalogId, pbLoading]);

  const loadVideos = async (catalogId: string) => {
    setLoading(true);
    setCurrentIndex(0);
    try {
      const { data } = await videoApi.getFeed(catalogId);
      setVideos(Array.isArray(data.videos) ? data.videos : []);
    } catch (error) {
      console.error('Failed to load video feed:', error);
      setVideos([]);
    } finally {
      setLoading(false);
    }
  };

  // Reset video state when switching videos
  useEffect(() => {
    setVideoError(false);
    setIsPlaying(false);
    if (videoRef.current) {
      videoRef.current.load();
    }
  }, [currentIndex]);

  const togglePlay = useCallback(() => {
    if (didSwipeRef.current) return;
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setIsPlaying(true); }
    else { v.pause(); setIsPlaying(false); }
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const endY = e.changedTouches[0].clientY;
    const diff = startY.current - endY;
    if (Math.abs(diff) > 50) {
      if (diff > 0) { nextVideo(); didSwipeRef.current = true; setTimeout(() => { didSwipeRef.current = false; }, 300); }
      else { prevVideo(); didSwipeRef.current = true; setTimeout(() => { didSwipeRef.current = false; }, 300); }
    }
  };

  const nextVideo = () => {
    if (currentIndex < videos.length - 1) setCurrentIndex((i) => i + 1);
  };

  const prevVideo = () => {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (guest) { toast.error('Sign in to save favorites'); return; }
    if (!currentVideo) return;
    try {
      const { data } = await videoLibraryApi.toggleFavorite(currentVideo.id);
      setVideos((prev) =>
        prev.map((v) =>
          v.id === currentVideo.id
            ? {
                ...v,
                isFavorited: data.favorited,
                _count: { ...v._count, favorites: (v._count.favorites ?? 0) + (data.favorited ? 1 : -1) },
              }
            : v
        )
      );
      toast.success(data.favorited ? 'Added to favorites' : 'Removed from favorites');
    } catch {
      toast.error('Failed to update favorite');
    }
  };

  const handleComment = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (guest) { toast.error('Sign in to view comments'); return; }
    setShowComments(true);
  };

  const loadComments = useCallback(async () => {
    if (!currentVideo?.id) return;
    try {
      const res = await videoLibraryApi.getComments(currentVideo.id);
      setComments(Array.isArray(res.data) ? res.data : []);
    } catch {
      setComments([]);
    }
  }, [currentVideo?.id]);

  useEffect(() => {
    if (showComments && currentVideo?.id) loadComments();
  }, [showComments, currentVideo?.id, loadComments]);

  const submitComment = async () => {
    if (guest || !currentVideo?.id || !commentText.trim()) return;
    setSubmittingComment(true);
    try {
      await videoLibraryApi.postComment(currentVideo.id, { content: commentText.trim() });
      setCommentText('');
      loadComments();
      toast.success('Comment posted');
    } catch {
      toast.error('Failed to post comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = window.location.href;
    if (navigator.share && typeof navigator.share === 'function') {
      navigator
        .share({
          title: currentVideo?.title ?? 'Video',
          text: currentVideo?.description ?? '',
          url,
        })
        .then(() => toast.success('Shared'))
        .catch((err) => {
          if (err.name !== 'AbortError') copyShareUrl(url);
        });
    } else {
      copyShareUrl(url);
    }
  };

  function copyShareUrl(url: string) {
    navigator.clipboard.writeText(url).then(() => toast.success('Link copied to clipboard'));
  }

  const handleBookmark = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (guest) { toast.error('Sign in to save to playlist'); return; }
    try {
      const res = await videoLibraryApi.getPlaylists();
      setPlaylists(Array.isArray(res.data) ? res.data : []);
      setShowPlaylistDropdown(true);
    } catch {
      toast.error('Failed to load playlists');
    }
  };

  const addToPlaylist = async (playlistId: string) => {
    if (!currentVideo?.id) return;
    try {
      await videoLibraryApi.addToPlaylist(playlistId, currentVideo.id);
      toast.success('Added to playlist');
      setShowPlaylistDropdown(false);
    } catch {
      toast.error('Failed to add to playlist');
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.deltaY === 0) return;
    if (wheelLockRef.current) return;
    wheelLockRef.current = true;
    if (e.deltaY > 0) nextVideo();
    else prevVideo();
    setTimeout(() => { wheelLockRef.current = false; }, 400);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); nextVideo(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); prevVideo(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentIndex, videos.length]);

  // Still resolving project book
  if (pbLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-black">
        <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Guest or no project book assigned
  if (guest || !canShowContent) {
    return (
      <div className="h-screen flex flex-col bg-gray-50 overflow-y-auto">
        <NoActiveProjectBookEmptyState
          feature="Video Academy"
          isGuest={guest}
          hasAssignedProjectBooks={hasAssignedProjectBooks}
        />
      </div>
    );
  }

  // Loading videos from API
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-white text-sm opacity-75">Loading your project book videos...</p>
        </div>
      </div>
    );
  }

  // No videos in this project book yet
  if (videos.length === 0) {
    return (
      <div className="h-screen flex flex-col bg-black">
        {/* Active project book bar overlaid at top */}
        {activeCatalogId && activeCatalogName && (
          <div className="absolute top-4 left-4 right-4 z-20">
            <ActiveProjectBookBar
              activeCatalogId={activeCatalogId}
              activeCatalogName={activeCatalogName}
              assignedProjectBooks={assignedProjectBooks}
              onSwitch={setActiveProjectBook}
              isSwitching={isSwitching}
            />
          </div>
        )}
        <div className="flex-1 flex flex-col items-center justify-center text-white px-6 text-center">
          <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold mb-2">No videos in this project book yet</h2>
          <p className="text-sm opacity-60">Videos linked to parts in your active project book will appear here.</p>
        </div>
      </div>
    );
  }

  const currentVideo = videos[currentIndex];

  return (
    <div
      ref={containerRef}
      className="relative h-screen w-full overflow-hidden bg-black"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
    >
      {/* Active project book bar — pinned top */}
      {activeCatalogId && activeCatalogName && (
        <div className="absolute top-4 left-4 right-4 z-20">
          <ActiveProjectBookBar
            activeCatalogId={activeCatalogId}
            activeCatalogName={activeCatalogName}
            assignedProjectBooks={assignedProjectBooks}
            onSwitch={setActiveProjectBook}
            isSwitching={isSwitching}
          />
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={currentVideo?.id}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '-100%' }}
          transition={{ type: 'tween', duration: 0.3 }}
          className="absolute inset-0"
        >
          {/* Video Player — tap to play/pause */}
          <div className="w-full h-full bg-black relative" onClick={togglePlay}>
            {currentVideo?.videoUrl && !videoError ? (
              <>
                <video
                  ref={videoRef}
                  src={currentVideo.videoUrl}
                  className="w-full h-full object-cover"
                  playsInline
                  preload="metadata"
                  onError={() => setVideoError(true)}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                />
                {/* Play/pause tap indicator */}
                {!isPlaying && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-16 h-16 bg-black/40 rounded-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-wago-dark to-green-800 flex items-center justify-center">
                <div className="text-center text-white">
                  <svg className="w-20 h-20 mx-auto mb-4 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm opacity-60">{videoError ? 'Video unavailable' : 'No preview available'}</p>
                </div>
              </div>
            )}
          </div>

          {/* Video overlay info */}
          <div className="absolute bottom-24 left-4 right-20 text-white z-10">
            <h2 className="text-xl font-bold mb-2" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
              {currentVideo?.title}
            </h2>
            <div className="flex items-center space-x-2 mb-2">
              <span className="px-3 py-1 bg-green-600 rounded-full text-xs font-medium">
                {currentVideo?.part?.partNumber}
              </span>
              <span className="px-3 py-1 bg-purple-600 rounded-full text-xs font-medium">
                Level {currentVideo?.level}
              </span>
            </div>
            <p className="text-sm opacity-90 mb-2">{currentVideo?.description}</p>
            <div className="flex items-center space-x-4 text-sm">
              <span>❤️ {currentVideo?._count?.views?.toLocaleString()}</span>
              <span>💬 {currentVideo?._count?.comments}</span>
            </div>
          </div>

          {/* Action buttons — stopPropagation so tap doesn't toggle play */}
          <div className="absolute right-4 bottom-24 flex flex-col space-y-6 z-10" onClick={(e) => e.stopPropagation()}>
            <button onClick={handleLike} className="flex flex-col items-center text-white hover:scale-110 transition-transform">
              <Heart className={clsx('w-8 h-8 mb-1', currentVideo?.isFavorited && 'fill-red-500')} />
              <span className="text-xs">{currentVideo?._count?.favorites ?? 0}</span>
            </button>
            <button onClick={handleComment} className="flex flex-col items-center text-white hover:scale-110 transition-transform">
              <MessageCircle className="w-8 h-8 mb-1" />
              <span className="text-xs">{currentVideo?._count?.comments ?? 0}</span>
            </button>
            <button onClick={handleShare} className="flex flex-col items-center text-white hover:scale-110 transition-transform">
              <Share2 className="w-8 h-8 mb-1" />
              <span className="text-xs">Share</span>
            </button>
            <button onClick={handleBookmark} className="flex flex-col items-center text-white hover:scale-110 transition-transform">
              <Bookmark className="w-8 h-8 mb-1" />
              <span className="text-xs">Save</span>
            </button>
          </div>

          {/* Swipe hint */}
          {currentIndex < videos.length - 1 && (
            <motion.div
              className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-white flex flex-col items-center"
              animate={{ y: [0, 10, 0] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              <ChevronDown className="w-6 h-6" />
              <span className="text-xs">Swipe up</span>
            </motion.div>
          )}

          {/* Progress indicator */}
          <div className="absolute top-16 left-1/2 transform -translate-x-1/2 flex space-x-1 z-10">
            {videos.map((_, index) => (
              <div
                key={index}
                className={clsx(
                  'h-1 rounded-full transition-all',
                  index === currentIndex ? 'w-6 bg-white' : 'w-1 bg-white/50'
                )}
              />
            ))}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Next-video preview strip — desktop only */}
      {videos.length > 1 && (
        <div className="hidden md:flex absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/90 to-transparent z-10 items-end justify-center gap-2 pb-2 px-4">
          <span className="text-white/80 text-xs font-medium self-center mr-2">Up next</span>
          {videos.slice(currentIndex + 1, currentIndex + 5).map((v, i) => (
            <button
              key={v.id}
              onClick={(e) => { e.stopPropagation(); setCurrentIndex(currentIndex + 1 + i); }}
              className="flex-shrink-0 w-28 h-14 rounded-lg overflow-hidden bg-white/10 border border-white/20 hover:border-white/50 hover:bg-white/20 transition-all flex items-center justify-center text-center"
            >
              <span className="text-white text-xs font-medium line-clamp-2 px-1">{v.title}</span>
            </button>
          ))}
        </div>
      )}

      {/* Comments overlay */}
      {showComments && (
        <div className="fixed inset-0 bg-black/80 z-50 flex flex-col" onClick={() => setShowComments(false)}>
          <div
            className="bg-gray-900 rounded-t-2xl mt-auto max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h3 className="font-semibold text-white">Comments</h3>
              <button onClick={() => setShowComments(false)} className="text-gray-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-3">
              {comments.map((c) => (
                <div key={c.id} className="text-sm">
                  <span className="font-medium text-white">
                    {[c.user?.firstName, c.user?.lastName].filter(Boolean).join(' ') || 'User'}
                  </span>
                  <p className="text-gray-300 mt-0.5">{c.content}</p>
                </div>
              ))}
            </div>
            {!guest && (
              <div className="p-4 border-t border-gray-700 flex gap-2">
                <input
                  type="text"
                  placeholder="Add a comment..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="flex-1 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm"
                />
                <button
                  onClick={submitComment}
                  disabled={submittingComment || !commentText.trim()}
                  className="btn btn-primary py-2"
                >
                  Post
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Playlist dropdown */}
      {showPlaylistDropdown && (
        <div className="fixed inset-0 z-50" onClick={() => setShowPlaylistDropdown(false)}>
          <div
            className="absolute right-4 bottom-32 w-56 bg-gray-900 border border-gray-700 rounded-xl shadow-xl py-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-2 text-xs text-gray-400 border-b border-gray-700">Add to playlist</div>
            {playlists.length === 0 ? (
              <p className="px-3 py-4 text-sm text-gray-500">No playlists yet. Create one in Video Library.</p>
            ) : (
              playlists.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addToPlaylist(p.id)}
                  className="w-full text-left px-3 py-2 text-white hover:bg-gray-800 flex items-center gap-2"
                >
                  <ChevronRight className="w-4 h-4 opacity-50" />
                  {p.name}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoFeed;
