import { Router } from 'express';
import * as catalogCreatorController from '../controllers/catalogCreator.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get user's visible catalogs (with hierarchy)
router.get('/my-catalogs', catalogCreatorController.getVisibleCatalogs);

// Get catalog detail with products
router.get('/detail/:id', catalogCreatorController.getCatalogDetail);

// Create new catalog
router.post('/create', catalogCreatorController.createUserCatalog);

// Update catalog
router.patch('/update/:id', catalogCreatorController.updateUserCatalog);

// Delete catalog
router.delete('/delete/:id', catalogCreatorController.deleteUserCatalog);

// Get all products for catalog creator
router.get('/products-for-catalog', catalogCreatorController.getProductsForCatalog);

// Bulk lookup products by part numbers
router.post('/lookup-parts', catalogCreatorController.lookupPartNumbers);

export default router;
