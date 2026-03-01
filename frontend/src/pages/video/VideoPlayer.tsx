import { Navigate, useParams } from 'react-router-dom';

/** Redirects to canonical Video Academy feed with optional videoId. Replaces legacy single-video page. */
const VideoPlayer = () => {
  const { videoId } = useParams<{ videoId: string }>();
  const to = videoId ? `/watch/${encodeURIComponent(videoId)}` : '/videos';
  return <Navigate to={to} replace />;
};

export default VideoPlayer;
