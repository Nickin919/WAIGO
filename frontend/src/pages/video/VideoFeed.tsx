import { useEffect, useState, useRef } from 'react';
import { Heart, MessageCircle, Share2, Bookmark, ChevronDown } from 'lucide-react';
import { videoApi } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [videos, setVideos] = useState<Video[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);

  useEffect(() => {
    loadVideos();
  }, []);

  const loadVideos = async () => {
    try {
      // TODO: Load videos from API
      // For demo, using mock data
      setVideos([
        {
          id: '1',
          title: 'Terminal Block Installation Guide',
          description: 'Learn the basics of CAGE CLAMP® installation',
          videoUrl: '/videos/demo1.mp4',
          level: 1,
          part: { partNumber: '2002-1201', description: 'Push-in Terminal Block' },
          _count: { views: 1234, comments: 45 },
        },
        {
          id: '2',
          title: 'Advanced Wiring Techniques',
          description: 'Professional tips for LEVER-NUTS® connections',
          videoUrl: '/videos/demo2.mp4',
          level: 2,
          part: { partNumber: '221-412', description: 'Splicing Connector' },
          _count: { views: 2567, comments: 89 },
        },
      ]);
    } catch (error) {
      console.error('Failed to load videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const endY = e.changedTouches[0].clientY;
    const diff = startY.current - endY;

    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        // Swiped up - next video
        nextVideo();
      } else {
        // Swiped down - previous video
        prevVideo();
      }
    }
  };

  const nextVideo = () => {
    if (currentIndex < videos.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const prevVideo = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleLike = async () => {
    // TODO: API call to like video
    console.log('Liked video');
  };

  const handleComment = () => {
    // TODO: Show comments overlay
    console.log('Show comments');
  };

  const handleShare = () => {
    // TODO: Show share dialog
    console.log('Share video');
  };

  const handleBookmark = () => {
    // TODO: Save video
    console.log('Bookmark video');
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-black">
        <div className="text-white">Loading videos...</div>
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
      <AnimatePresence mode="wait">
        <motion.div
          key={currentVideo?.id}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '-100%' }}
          transition={{ type: 'tween', duration: 0.3 }}
          className="absolute inset-0"
        >
          {/* Video Player Background */}
          <div className="w-full h-full bg-gradient-to-br from-blue-700 to-green-600 flex items-center justify-center">
            <div className="text-center text-white">
              <svg className="w-24 h-24 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              </svg>
              <p className="text-lg">Video Player Demo</p>
              <p className="text-sm opacity-75">Swipe up/down for more videos</p>
            </div>
          </div>

          {/* Video Overlay Information */}
          <div className="absolute bottom-24 left-4 right-20 text-white z-10">
            <h2 className="text-xl font-bold mb-2" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
              {currentVideo?.title}
            </h2>
            <div className="flex items-center space-x-2 mb-2">
              <span className="px-3 py-1 bg-green-600 rounded-full text-xs font-medium">
                {currentVideo?.part.partNumber}
              </span>
              <span className="px-3 py-1 bg-purple-600 rounded-full text-xs font-medium">
                Level {currentVideo?.level}
              </span>
            </div>
            <p className="text-sm opacity-90 mb-2">{currentVideo?.description}</p>
            <div className="flex items-center space-x-4 text-sm">
              <span>❤️ {currentVideo?._count.views.toLocaleString()}</span>
              <span>💬 {currentVideo?._count.comments}</span>
            </div>
          </div>

          {/* Action Buttons (Right Side) */}
          <div className="absolute right-4 bottom-24 flex flex-col space-y-6 z-10">
            <button
              onClick={handleLike}
              className="flex flex-col items-center text-white hover:scale-110 transition-transform"
            >
              <Heart className="w-8 h-8 mb-1" />
              <span className="text-xs">{currentVideo?._count.views}</span>
            </button>
            <button
              onClick={handleComment}
              className="flex flex-col items-center text-white hover:scale-110 transition-transform"
            >
              <MessageCircle className="w-8 h-8 mb-1" />
              <span className="text-xs">{currentVideo?._count.comments}</span>
            </button>
            <button
              onClick={handleShare}
              className="flex flex-col items-center text-white hover:scale-110 transition-transform"
            >
              <Share2 className="w-8 h-8 mb-1" />
              <span className="text-xs">Share</span>
            </button>
            <button
              onClick={handleBookmark}
              className="flex flex-col items-center text-white hover:scale-110 transition-transform"
            >
              <Bookmark className="w-8 h-8 mb-1" />
              <span className="text-xs">Save</span>
            </button>
          </div>

          {/* Swipe Hint */}
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

          {/* Progress Indicator */}
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 flex space-x-1 z-10">
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
