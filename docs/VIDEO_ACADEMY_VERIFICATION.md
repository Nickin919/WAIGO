# Video Academy – Verification Checklist

Use this checklist to verify Video Academy behavior after changes (e.g. feed overhaul, button wiring, scroll/preview).

## Entry points and routing

- [ ] **/videos** – Opens Video Academy feed (project book bar, randomized feed). Requires active project book.
- [ ] **/video/:videoId** – Redirects to `/videos?videoId=:videoId` and feed opens with that video in view (if in project book).
- [ ] **Part detail** – “Video Tutorials” links go to `/videos?videoId=...` and open the feed with that video focused.

## Feed content and project book

- [ ] Feed only shows APPROVED videos that are linked to the **active project book** (by part, category expansion, series, or library part/series links).
- [ ] Changing the active project book (dropdown) reloads the feed with videos for the new book.
- [ ] Feed order is **randomized** per load (new seed each time). Refreshing gives a different order.
- [ ] **Load more** – Scrolling near the end (e.g. within 3 items) triggers “Loading more...” and appends more videos (same session seed). No duplicate videos in the list.

## Buttons (heart, comment, share, save)

- [ ] **Heart (like/favorite)**  
  - Toggles favorite state and updates count immediately (optimistic).  
  - If API fails, state and count revert and an error toast appears.  
  - Label shows **favorites count**, not views.
- [ ] **Comment**  
  - Opens comments sheet; count shown is comment count.  
  - Posting a comment increments the count and appends to the list without closing the sheet.  
  - Guest/user: appropriate toasts when not signed in.
- [ ] **Share**  
  - Shares/copies a **canonical app link** to the current video: `{origin}/videos?videoId={id}`.  
  - On mobile, native share sheet when available; otherwise copy to clipboard.
- [ ] **Save (bookmark)**  
  - Opens “Add to playlist” dropdown; choosing a playlist adds the video and shows success.  
  - Guest: toast asking to sign in.

## Scrolling and preview

- [ ] **Mobile** – Vertical swipe (threshold ~50px) goes to next/previous video. “Swipe up” hint when more videos below.
- [ ] **Desktop** – Mouse wheel and keyboard (Arrow Up/Down) change video. Wheel has a short lock (e.g. 400ms) to avoid double-scroll.
- [ ] **Desktop “Up next”** – Strip at bottom shows next few videos; clicking one jumps to that video in the feed.
- [ ] **Progress dots** – Current video indicator at top is correct.

## Modal player (Library / Playlists)

- [ ] Opening a video from **Video Library** or **My Playlists** uses the modal player (not the legacy page).
- [ ] **Heart, Comment, Share, Save** in the modal work (favorite toggle, post comment, copy link, add to playlist). Favorite and comment count update correctly after actions.
- [ ] Share in modal copies the video URL (or app link if you’ve standardized on that).

## Edge cases and errors

- [ ] **No videos** – Empty state message when project book has no linked videos.
- [ ] **No project book / guest** – Appropriate empty state or redirect (no feed).
- [ ] **403** – Requesting feed for a catalog the user is not assigned to returns 403 (or equivalent). Only assigned catalog (or ADMIN/RSM) can load that feed.

## Regression

- [ ] **Legacy route** – `/video/:id` no longer shows the old single-video page; it redirects to the feed.
- [ ] **Comment display** – No reliance on `comment.user.email` for display (backend may not return it); use firstName/lastName or “User”.
- [ ] **Part display** – Videos with only library part/series (no legacy `partId`) still show a part number or “Video” in the feed.

---

*Last updated: Video Academy functional overhaul (canonical feed, project-book resolver, cursor pagination, button wiring).*
