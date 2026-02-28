import { useEffect, useState, useRef, useCallback } from 'react';
import { Heart, MessageCircle, Share2, Bookmark, ChevronDown } from 'lucide-react';
import { videoApi } from '@/lib/api';
import { useAuthStore, isGuestUser } from '@/stores/authStore';
import { useActiveProjectBook } from '@/hooks/useActiveProjectBook';
import { NoActiveProjectBookEmptyState } from '@/components/shared/NoActiveProjectBookEmptyState';
import { ActiveProjectBookBar } from '@/components/shared/ActiveProjectBookBar';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

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
  _count: {
    views: number;
    comments: number;
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
      if (diff > 0) nextVideo();
      else prevVideo();
    }
  };

  const nextVideo = () => {
    if (currentIndex < videos.length - 1) setCurrentIndex((i) => i + 1);
  };

  const prevVideo = () => {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  };

  const handleLike = async () => {
    // TODO: API call to like video
  };

  const handleComment = () => {
    // TODO: Show comments overlay
  };

  const handleShare = () => {
    // TODO: Show share dialog
  };

  const handleBookmark = () => {
    // TODO: Save video
  };

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
          {/* Video Player */}
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

          {/* Action buttons */}
          <div className="absolute right-4 bottom-24 flex flex-col space-y-6 z-10">
            <button onClick={handleLike} className="flex flex-col items-center text-white hover:scale-110 transition-transform">
              <Heart className="w-8 h-8 mb-1" />
              <span className="text-xs">{currentVideo?._count?.views}</span>
            </button>
            <button onClick={handleComment} className="flex flex-col items-center text-white hover:scale-110 transition-transform">
              <MessageCircle className="w-8 h-8 mb-1" />
              <span className="text-xs">{currentVideo?._count?.comments}</span>
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
    </div>
  );
};

export default VideoFeed;
