# WAGO Project Hub - UI Design System

## Design Philosophy

### Desktop-First, Mobile-Friendly
The main application uses a traditional dashboard layout optimized for desktop workflows, with responsive adaptations for mobile devices.

### Video Section - Mobile-First
The video engagement area uses a TikTok/YouTube Shorts style vertical scroll feed for optimal mobile video consumption.

---

## Layout Architecture

### 1. Desktop Layout (≥1024px)

```
┌────────────────────────────────────────────────────────────┐
│  Header (Fixed)                                            │
│  Logo | Navigation | Search | User Menu                    │
├──────────┬─────────────────────────────────────────────────┤
│          │                                                  │
│          │                                                  │
│ Sidebar  │          Main Content Area                      │
│ (Fixed)  │          (Dashboard, Catalog, Projects, etc.)   │
│          │                                                  │
│ - Home   │                                                  │
│ - Catalog│                                                  │
│ - Videos │                                                  │
│ - Projects│                                                 │
│ - Quotes │                                                  │
│ - Teams  │                                                  │
│ - Admin  │                                                  │
│          │                                                  │
└──────────┴─────────────────────────────────────────────────┘
```

### 2. Tablet Layout (768px - 1023px)

```
┌────────────────────────────────────────────────────────────┐
│  Header (Fixed) + Hamburger Menu                           │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  Main Content Area (Full Width)                            │
│  Sidebar collapses to overlay menu                         │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

### 3. Mobile Layout (<768px)

```
┌──────────────────────┐
│  Header (Compact)    │
├──────────────────────┤
│                      │
│  Main Content        │
│  (Full Width)        │
│                      │
├──────────────────────┤
│  Bottom Navigation   │
│  Icons Only          │
└──────────────────────┘
```

---

## Video Feed Layout (All Devices)

### Desktop Video Feed
```
┌─────────────────────────────────────┐
│  Sidebar                            │
├─────────────┬───────────────────────┤
│             │  Video Player         │
│  Video      │  (16:9 aspect)        │
│  Playlist   │                       │
│             ├───────────────────────┤
│  Thumbnail  │  Video Info           │
│  Thumbnail  │  Title, Description   │
│  Thumbnail  │                       │
│  Thumbnail  │  Comments Section     │
│  ...        │  Threaded, scrollable │
└─────────────┴───────────────────────┘
```

### Mobile Video Feed (TikTok Style)
```
┌──────────────────┐
│                  │
│                  │
│  Full Screen     │
│  Video Player    │
│  (Vertical)      │
│                  │
│                  │
│  ↓ Swipe Down    │
│                  │
│  Overlay Info    │
│  @User  ❤️ 👍 💬 │
└──────────────────┘
```

**Interactions:**
- Swipe up/down - Next/previous video
- Tap - Pause/play
- Swipe right - Like
- Tap comment icon - Show comments overlay
- Long press - Show options menu

---

## Page Layouts

### 1. Dashboard (Desktop)

```
┌────────────────────────────────────────────────────────────┐
│  Dashboard                                 User: John Doe   │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │ Projects │ │  Parts   │ │  Videos  │ │  Quotes  │     │
│  │   142    │ │   1,248  │ │    45    │ │    23    │     │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘     │
│                                                             │
│  Recent Activity              │  Quick Actions             │
│  ┌─────────────────────────┐ │  ┌──────────────────────┐ │
│  │ Project Updated          │ │  │ + New Project        │ │
│  │ New Video Approved       │ │  │ + Create Quote       │ │
│  │ Quote Sent               │ │  │ + Upload BOM         │ │
│  └─────────────────────────┘ │  └──────────────────────┘ │
│                                                             │
│  Team Activity (TurnKey Users)                             │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Sarah updated Control Panel Project                  │ │
│  │ Mike created new cost table                          │ │
│  └──────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

### 2. Catalog View (Desktop)

```
┌────────────────────────────────────────────────────────────┐
│  Catalog: Industrial Controls                              │
│  [Filter] [Sort] [View: Grid/List]                         │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  Breadcrumb: Home > Terminal Blocks > Push-in Connectors   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Categories (Horizontal Carousel - Desktop)         │  │
│  │  [Terminal Blocks] [Electronics] [Automation] ...   │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  Parts Grid (3-4 columns desktop, 2 tablet, 1 mobile)      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │ Part Img │ │ Part Img │ │ Part Img │ │ Part Img │     │
│  │ 2002-1201│ │ 2002-1401│ │ 221-412  │ │ 2002-1301│     │
│  │ $0.85    │ │ $1.45    │ │ $0.35    │ │ $1.12    │     │
│  │ [Details]│ │ [Details]│ │ [Details]│ │ [Details]│     │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘     │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

### 3. Video Academy (Mobile-First Feed)

**Desktop View:**
```
┌────────────────────────────────────────────────────────────┐
│  Video Academy                        [Upload Video]        │
├─────────────┬──────────────────────────────────────────────┤
│             │  ┌────────────────────────────────┐          │
│ Playlists   │  │                                │          │
│             │  │  Video Player (16:9)           │          │
│ ▶ Level 1   │  │                                │          │
│   Level 2🔒 │  │                                │          │
│   Level 3🔒 │  └────────────────────────────────┘          │
│             │                                              │
│ Categories  │  Installation Guide for 2002-1201            │
│ □ Terminal  │  Part: 2002-1201 | Level: 1 | Views: 324    │
│ □ Automation│                                              │
│ □ Tools     │  ❤️ 45  👍 89  💬 12  📤 Share              │
│             │                                              │
│ Filters     │  ─────────────────────────────────────────── │
│ ☑ Watched   │  Comments (12)                               │
│ □ Bookmarked│  └─ Great tutorial! Very clear...           │
│             │     └─ Reply: Thanks! Glad it helped...     │
└─────────────┴──────────────────────────────────────────────┘
```

**Mobile View (TikTok Style):**
```
┌──────────────────┐
│                  │
│   Video Title    │◀── Overlay on video
│   Part: 2002-1201│
│                  │
│     FULL         │
│     SCREEN       │
│     VIDEO        │
│     PLAYER       │
│                  │
│  👤 John Doe     │◀── Right side overlay
│  ❤️ 45          │
│  💬 12          │
│  📤 Share       │
│  🔖 Save        │
│                  │
│  ↓ Swipe        │◀── Gesture hint
└──────────────────┘
```

### 4. Projects & BOM (Desktop)

```
┌────────────────────────────────────────────────────────────┐
│  Project: Control Panel Upgrade                [Actions ▼] │
│  Rev 3 | Last updated: 2 hours ago                         │
├────────────────────────────────────────────────────────────┤
│  [BOM] [Revisions] [Documents] [Team]                      │
│                                                             │
│  Bill of Materials (128 items)                             │
│  [Upload CSV] [Export] [Generate Quote] [Find Equivalents] │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ # │ Part Number │ Mfg    │ Desc      │ Qty │ Action │ │
│  ├───┼─────────────┼────────┼───────────┼─────┼────────┤ │
│  │ 1 │ 2002-1201   │ WAGO   │ Terminal  │ 50  │ [Edit] │ │
│  │ 2 │ UK-2.5      │ Phoenix│ Terminal  │ 100 │ [🔄]   │ │
│  │   │  └─ Suggest WAGO: 2002-1201 (95% match)        │ │
│  │ 3 │ 1492-J4     │ Allen  │ Block     │ 25  │ [🔄]   │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                             │
│  [Accept All WAGO Equivalents] [Create New Revision]       │
└────────────────────────────────────────────────────────────┘
```

### 5. Cost Tables (TurnKey Users)

```
┌────────────────────────────────────────────────────────────┐
│  Cost Tables                               [+ New Table]    │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  📋 Q1 2024 Pricing (Team Shared)                          │
│  └─ 248 parts | Last updated: Yesterday                    │
│     [View] [Edit] [Download CSV] [Upload CSV]              │
│                                                             │
│  📋 Special Customer Pricing (Personal)                    │
│  └─ 89 parts | Last updated: Last week                     │
│     [View] [Edit] [Download CSV] [Upload CSV]              │
│                                                             │
│  Active Table Preview:                                      │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Part Number  │ Description    │ Custom Cost │ Notes  │ │
│  ├──────────────┼────────────────┼─────────────┼────────┤ │
│  │ 2002-1201    │ Terminal Block │ $0.72       │ Promo  │ │
│  │ 221-412      │ Splice Conn    │ $0.28       │ Volume │ │
│  └──────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

### 6. Distributor Dashboard

```
┌────────────────────────────────────────────────────────────┐
│  Distributor Dashboard: ABC Electric Supply                │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  Managed Users (45)        │  Recent Activity              │
│  ┌──────────────────────┐ │  ┌──────────────────────────┐ │
│  │ BASIC: 23 users      │ │  │ John (Acme Corp)        │ │
│  │ TURNKEY: 15 users    │ │  │ Created quote           │ │
│  │ Teams: 7 teams       │ │  │                         │ │
│  └──────────────────────┘ │  │ Sarah (XYZ Inc)         │ │
│                            │  │ Uploaded BOM            │ │
│  Assigned Catalogs (12)    │  └──────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Catalog Name         │ Assigned To      │ Parts      │ │
│  ├──────────────────────┼──────────────────┼────────────┤ │
│  │ Industrial Controls  │ 12 users         │ 248        │ │
│  │ Automation Suite     │ 8 users          │ 156        │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                             │
│  [Assign Catalog] [Manage Users] [View All Activity]       │
└────────────────────────────────────────────────────────────┘
```

### 7. RSM Regional Dashboard

```
┌────────────────────────────────────────────────────────────┐
│  RSM Dashboard: Chicago Region                             │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  Distributors (8)          │  Regional Activity            │
│  ┌──────────────────────┐ │  ┌──────────────────────────┐ │
│  │ ABC Electric Supply  │ │  │ This Week:               │ │
│  │ └─ 45 users          │ │  │ 127 Projects             │ │
│  │                      │ │  │ 89 Quotes                │ │
│  │ Metro Parts Co       │ │  │ 234 BOM Uploads          │ │
│  │ └─ 32 users          │ │  └──────────────────────────┘ │
│  └──────────────────────┘ │                               │
│                            │  Top Distributors             │
│  Unassigned Users (12)     │  1. ABC Electric - $2.3M     │
│  [Assign to Distributor]   │  2. Metro Parts - $1.8M      │
│                            │  3. Industrial Supply - $1.5M │
│  Teams Needing Assignment  │                               │
│  □ XYZ Construction (5)    │  [Detailed Reports]           │
│  □ BuildCo Team (3)        │                               │
│                                                             │
│  [Create Team] [Assign Users] [Regional Analytics]         │
└────────────────────────────────────────────────────────────┘
```

---

## Component Library

### Navigation Components

#### 1. Desktop Sidebar
```jsx
<Sidebar>
  <Logo />
  <NavGroup label="Main">
    <NavItem icon={Home} to="/dashboard">Dashboard</NavItem>
    <NavItem icon={Grid} to="/catalog">Catalog</NavItem>
    <NavItem icon={Video} to="/videos">Video Academy</NavItem>
  </NavGroup>
  
  {/* Role-based sections */}
  {isTurnKey && (
    <NavGroup label="Team">
      <NavItem icon={Users} to="/team">My Team</NavItem>
      <NavItem icon={DollarSign} to="/cost-tables">Cost Tables</NavItem>
    </NavGroup>
  )}
  
  {isDistributor && (
    <NavGroup label="Management">
      <NavItem icon={Building} to="/managed-users">Users</NavItem>
      <NavItem icon={BarChart} to="/activity">Activity</NavItem>
    </NavGroup>
  )}
</Sidebar>
```

#### 2. Mobile Bottom Nav
```jsx
<BottomNav>
  <NavIcon icon={Home} to="/dashboard" label="Home" />
  <NavIcon icon={Grid} to="/catalog" label="Catalog" />
  <NavIcon icon={Video} to="/videos" label="Videos" />
  <NavIcon icon={Folder} to="/projects" label="Projects" />
  <NavIcon icon={Menu} onClick={openMenu} label="More" />
</BottomNav>
```

### Video Feed Components

#### Desktop Video Player
```jsx
<VideoPlayerDesktop>
  <VideoSidebar videos={playlist} onSelect={handleSelect} />
  <VideoContent>
    <VideoPlayer src={currentVideo.url} />
    <VideoInfo video={currentVideo} />
    <CommentsSection comments={comments} />
  </VideoContent>
</VideoPlayerDesktop>
```

#### Mobile Video Feed (TikTok Style)
```jsx
<VideoFeedMobile>
  <VerticalSwiper
    videos={videos}
    onSwipeUp={nextVideo}
    onSwipeDown={prevVideo}
    onTap={togglePlay}
  >
    {videos.map(video => (
      <VideoSlide key={video.id}>
        <FullScreenVideo src={video.url} />
        <VideoOverlay>
          <VideoTitle>{video.title}</VideoTitle>
          <PartTag>{video.part.partNumber}</PartTag>
        </VideoOverlay>
        <ActionBar>
          <ActionButton icon={Heart} count={video.likes} />
          <ActionButton icon={Comment} count={video.comments} />
          <ActionButton icon={Share} />
          <ActionButton icon={Bookmark} />
        </ActionBar>
        <SwipeHint>↓ Swipe</SwipeHint>
      </VideoSlide>
    ))}
  </VerticalSwiper>
</VideoFeedMobile>
```

### Card Components

#### Stats Card
```jsx
<StatsCard>
  <CardIcon icon={icon} color={color} />
  <CardValue>{value}</CardValue>
  <CardLabel>{label}</CardLabel>
  <CardTrend change={change} />
</StatsCard>
```

#### Action Card
```jsx
<ActionCard onClick={onClick}>
  <CardIcon icon={icon} size="large" />
  <CardTitle>{title}</CardTitle>
  <CardDescription>{description}</CardDescription>
</ActionCard>
```

### Table Components

#### Data Table
```jsx
<DataTable
  columns={columns}
  data={data}
  actions={rowActions}
  sortable
  filterable
  pagination
/>
```

#### BOM Table with Cross-Reference
```jsx
<BOMTable>
  <BOMRow>
    <PartNumber>UK-2.5</PartNumber>
    <Manufacturer>Phoenix</Manufacturer>
    <Description>Terminal Block</Description>
    <Quantity>100</Quantity>
    <Actions>
      <CrossRefButton onClick={showEquivalents}>
        🔄 Find WAGO
      </CrossRefButton>
    </Actions>
  </BOMRow>
  {showingSuggestion && (
    <SuggestionRow>
      <SuggestionIcon>↳</SuggestionIcon>
      <WagoEquivalent>
        2002-1201 (95% compatible)
        <AcceptButton>Accept</AcceptButton>
      </WagoEquivalent>
    </SuggestionRow>
  )}
</BOMTable>
```

---

## Responsive Breakpoints

```css
/* Breakpoints */
--mobile: 0px - 767px
--tablet: 768px - 1023px
--desktop: 1024px - 1439px
--wide: 1440px+

/* Sidebar */
Desktop: Fixed 240px width
Tablet: Overlay drawer 280px
Mobile: Hidden, bottom nav visible

/* Content Area */
Desktop: calc(100vw - 240px)
Tablet: 100vw with padding
Mobile: 100vw

/* Grid Columns */
Desktop: 4 columns
Tablet: 2-3 columns
Mobile: 1-2 columns

/* Video Feed */
Desktop: Split view (playlist + player)
Mobile: Full screen vertical scroll
```

---

## Color System

```css
/* Primary (WAGO Green) */
--primary-50: #f0fdf4
--primary-500: #00A651
--primary-700: #007A3D

/* Secondary (WAGO Blue) */
--secondary-500: #0066A1
--secondary-700: #004B77

/* Neutral */
--gray-50: #f9fafb
--gray-100: #f3f4f6
--gray-500: #6b7280
--gray-900: #111827

/* Semantic */
--success: #10b981
--warning: #f59e0b
--error: #ef4444
--info: #3b82f6
```

---

## Typography

```css
/* Desktop */
h1: 2.5rem (40px) - Page titles
h2: 2rem (32px) - Section headings
h3: 1.5rem (24px) - Card titles
body: 1rem (16px) - Default text
small: 0.875rem (14px) - Labels

/* Mobile */
h1: 2rem (32px)
h2: 1.5rem (24px)
h3: 1.25rem (20px)
body: 1rem (16px)
small: 0.875rem (14px)
```

---

## Animation Guidelines

### Desktop Transitions
- Smooth, professional
- 200-300ms duration
- Ease-in-out timing

### Mobile Video Feed
- Snap scrolling
- Momentum scrolling
- Quick response to gestures
- 150ms transitions

### Hover States (Desktop Only)
```css
.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  transition: all 200ms ease-in-out;
}
```

---

## Accessibility

### Keyboard Navigation
- Tab through all interactive elements
- Escape to close modals/overlays
- Arrow keys for lists/tables
- Enter/Space for buttons

### Screen Reader Support
- Semantic HTML
- ARIA labels on custom components
- Focus indicators
- Skip links

### Touch Targets (Mobile)
- Minimum 44x44px
- Adequate spacing between elements
- Clear visual feedback

---

## Performance Guidelines

### Desktop
- Lazy load below-the-fold content
- Code splitting by route
- Optimize images
- Cache API responses

### Mobile Video Feed
- Preload next 2 videos
- Adaptive bitrate streaming
- Lazy load video thumbnails
- Intersection observer for visibility

---

## Implementation Priority

1. ✅ Desktop dashboard layout
2. ✅ Role-based navigation
3. ✅ Mobile-first video feed
4. ⏳ Responsive catalog grid
5. ⏳ BOM table with cross-reference
6. ⏳ Cost table interface
7. ⏳ Distributor/RSM dashboards

---

This design system provides the foundation for a professional desktop application with a killer mobile video experience!
