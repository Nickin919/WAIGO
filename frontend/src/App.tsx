import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';

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
import Quotes from './pages/quotes/Quotes';
import QuoteDetail from './pages/quotes/QuoteDetail';
import QuoteForm from './pages/quotes/QuoteForm';
import Profile from './pages/Profile';
import AdminDashboard from './pages/admin/AdminDashboard';
import ProductImport from './pages/admin/ProductImport';
import CatalogList from './pages/catalog/CatalogList';
import CatalogCreator from './pages/catalog/CatalogCreator';
import AssignmentsPage from './pages/assignments/AssignmentsPage';
import MyPriceContractsPage from './pages/assignments/MyPriceContractsPage';
import NotFound from './pages/NotFound';

// Protected route wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
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
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/catalog" element={<Catalog />} />
        <Route path="/catalog/category/:categoryId" element={<CategoryView />} />
        <Route path="/catalog/part/:partId" element={<PartDetail />} />
        <Route path="/videos" element={<VideoFeed />} />
        <Route path="/video/:videoId" element={<VideoPlayer />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:projectId" element={<ProjectDetail />} />
        <Route path="/quotes" element={<Quotes />} />
        <Route path="/quotes/new" element={<QuoteForm />} />
        <Route path="/quotes/:quoteId/edit" element={<QuoteForm />} />
        <Route path="/quotes/:quoteId" element={<QuoteDetail />} />
        <Route path="/catalog-list" element={<CatalogList />} />
        <Route path="/catalog-creator/new" element={<CatalogCreator />} />
        <Route path="/catalog-creator/:id" element={<CatalogCreator />} />
        <Route path="/assignments" element={<AssignmentsPage />} />
        <Route path="/my-price-contracts" element={<MyPriceContractsPage />} />
        <Route path="/profile" element={<Profile />} />
      </Route>

      {/* Admin routes */}
      <Route element={<AdminRoute><MainLayout /></AdminRoute>}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/import-products" element={<ProductImport />} />
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
