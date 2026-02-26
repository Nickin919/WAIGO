import { Routes, Route, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuthStore, isGuestUser } from './stores/authStore';

// Layouts
import MainLayout from './layouts/MainLayout';
import AuthLayout from './layouts/AuthLayout';

// Pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import Dashboard from './pages/Dashboard';
import Catalog from './pages/catalog/Catalog';
import CategoryView from './pages/catalog/CategoryView';
import PartDetail from './pages/catalog/PartDetail';
import VideoPlayer from './pages/video/VideoPlayer';
import VideoFeed from './pages/video/VideoFeed';
import Projects from './pages/projects/Projects';
import ProjectDetail from './pages/projects/ProjectDetail';
import NewProject from './pages/projects/NewProject';
import ProjectReport from './pages/projects/ProjectReport';
import Quotes from './pages/quotes/Quotes';
import QuoteDetail from './pages/quotes/QuoteDetail';
import QuoteForm from './pages/quotes/QuoteForm';
import ManageCustomers from './pages/customers/ManageCustomers';
import Profile from './pages/Profile';
import AdminDashboard from './pages/admin/AdminDashboard';
import ProductImport from './pages/admin/ProductImport';
import CrossReferenceImport from './pages/admin/CrossReferenceImport';
import DataManagement from './pages/admin/DataManagement';
import LiteratureLibrary from './pages/admin/LiteratureLibrary';
import CatalogList from './pages/catalog/CatalogList';
import CatalogCreator from './pages/catalog/CatalogCreator';
import AccountsPage from './pages/accounts/AccountsPage';
import AccountDetailPage from './pages/accounts/AccountDetailPage';
import MyPriceContractsPage from './pages/assignments/MyPriceContractsPage';
import PricingContractsPage from './pages/management/PricingContractsPage';
import PriceContractDetailPage from './pages/management/PriceContractDetailPage';
import ActivityPage from './pages/management/ActivityPage';
import ProductFinder from './pages/public/ProductFinder';
import BomCrossReference from './pages/public/BomCrossReference';
import BomAnalyzer from './pages/public/BomAnalyzer';
import SalesDashboard from './pages/sales/SalesDashboard';
import NotificationsPage from './pages/NotificationsPage';
import NotFound from './pages/NotFound';
import LiteratureBrowse from './pages/literature/LiteratureBrowse';
import LiteratureKits from './pages/literature/LiteratureKits';
import LiteratureKitDetail from './pages/literature/LiteratureKitDetail';
import VideoLibraryBrowse from './pages/videos/VideoLibraryBrowse';
import MyPlaylists from './pages/videos/MyPlaylists';
import VideoLibrary from './pages/admin/VideoLibrary';
import QuoteBanners from './pages/admin/QuoteBanners';

// Redirect /assignments and /managed-users to /accounts (optionally with userId from query)
const AssignmentsRedirect = () => {
  const [searchParams] = useSearchParams();
  const userId = searchParams.get('userId');
  return <Navigate to={userId ? `/accounts/${userId}` : '/accounts'} replace />;
};

// Redirect guest to catalog, others to dashboard
const GuestOrDashboardRedirect = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const guest = useAuthStore(isGuestUser);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (guest) return <Navigate to="/catalog" replace />;
  return <Navigate to="/dashboard" replace />;
};

// Paths allowed for guest (limited access without login)
const GUEST_ALLOWED_PATHS = ['/catalog', '/product-finder', '/bom-cross-reference', '/bom-analyzer'];

// Protect restricted routes from guest users
const GuestRouteGuard = ({ children }: { children: React.ReactNode }) => {
  const guest = useAuthStore(isGuestUser);
  const { pathname } = useLocation();

  if (!guest) return <>{children}</>;
  const allowed = GUEST_ALLOWED_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
  if (allowed) return <>{children}</>;
  return <Navigate to="/catalog" replace state={{ message: 'Sign in to access this feature' }} />;
};

// Protected route wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <GuestRouteGuard>{children}</GuestRouteGuard> : <Navigate to="/login" replace />;
};

// Admin route wrapper
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAuthenticated } = useAuthStore();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (user?.role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
};

function App() {
  return (
    <Routes>
      {/* Auth routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      {/* Protected routes */}
      <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
        <Route path="/" element={<GuestOrDashboardRedirect />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/catalog" element={<Catalog />} />
        <Route path="/catalog/category/:categoryId" element={<CategoryView />} />
        <Route path="/catalog/part/:partId" element={<PartDetail />} />
        <Route path="/videos" element={<VideoFeed />} />
        <Route path="/video/:videoId" element={<VideoPlayer />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/new" element={<NewProject />} />
        <Route path="/projects/:projectId/report" element={<ProjectReport />} />
        <Route path="/projects/:projectId" element={<ProjectDetail />} />
        <Route path="/quotes" element={<Quotes />} />
        <Route path="/quotes/new" element={<QuoteForm />} />
        <Route path="/quotes/:quoteId/edit" element={<QuoteForm />} />
        <Route path="/quotes/:quoteId" element={<QuoteDetail />} />
        <Route path="/customers" element={<ManageCustomers />} />
        <Route path="/catalog-list" element={<CatalogList />} />
        <Route path="/catalog-creator/new" element={<CatalogCreator />} />
        <Route path="/catalog-creator/:id" element={<CatalogCreator />} />
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/accounts/:userId" element={<AccountDetailPage />} />
        <Route path="/assignments" element={<AssignmentsRedirect />} />
        <Route path="/managed-users" element={<Navigate to="/accounts" replace />} />
        <Route path="/pricing-contracts" element={<PricingContractsPage />} />
        <Route path="/pricing-contracts/:id" element={<PriceContractDetailPage />} />
        <Route path="/cost-tables" element={<Navigate to="/pricing-contracts" replace />} />
        <Route path="/team" element={<Navigate to="/dashboard" replace />} />
        <Route path="/activity" element={<ActivityPage />} />
        <Route path="/product-finder" element={<ProductFinder />} />
        <Route path="/bom-cross-reference" element={<BomCrossReference />} />
        <Route path="/bom-analyzer" element={<BomAnalyzer />} />
        <Route path="/sales" element={<SalesDashboard />} />
        <Route path="/my-price-contracts" element={<MyPriceContractsPage />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/literature" element={<LiteratureBrowse />} />
        <Route path="/literature/kits" element={<LiteratureKits />} />
        <Route path="/literature/kits/:id" element={<LiteratureKitDetail />} />
        <Route path="/videos/library" element={<VideoLibraryBrowse />} />
        <Route path="/videos/library/playlists" element={<MyPlaylists />} />
      </Route>

      {/* Admin routes */}
      <Route element={<AdminRoute><MainLayout /></AdminRoute>}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/import-products" element={<ProductImport />} />
        <Route path="/admin/import-cross-references" element={<CrossReferenceImport />} />
        <Route path="/admin/data-management" element={<DataManagement />} />
        <Route path="/admin/literature" element={<LiteratureLibrary />} />
        <Route path="/admin/video-library" element={<VideoLibrary />} />
        <Route path="/admin/quote-banners" element={<QuoteBanners />} />
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
