/**
 * @deprecated This page is deprecated. All data imports (Master Catalog, Cross Reference, Non-WAGO Database)
 * are consolidated at /admin/data-imports. This file is kept only so that direct links to
 * /admin/data-management can redirect; the route in App.tsx redirects to /admin/data-imports.
 */
import { Navigate } from 'react-router-dom';

export default function DataManagement() {
  return <Navigate to="/admin/data-imports" replace />;
}
