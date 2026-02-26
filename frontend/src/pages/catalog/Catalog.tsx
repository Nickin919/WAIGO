import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Swiper, SwiperSlide } from 'swiper/react';
import { FreeMode } from 'swiper/modules';
import { ChevronRight, Grid3x3, LayoutList } from 'lucide-react';
import { useAuthStore, isGuestUser } from '@/stores/authStore';
import { categoryApi, publicApi, catalogApi } from '@/lib/api';
import CatalogGrid from './CatalogGrid';

import 'swiper/css';
import 'swiper/css/free-mode';

type ViewMode = 'grid' | 'categories';

const Catalog = () => {
  const [searchParams] = useSearchParams();
  const catalogIdFromUrl = searchParams.get('catalogId');
  const user = useAuthStore((s) => s.user);
  const guest = useAuthStore(isGuestUser);
  const navigate = useNavigate();
  const [effectiveCatalogId, setEffectiveCatalogId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [topCategories, setTopCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [subCategories, setSubCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Resolve catalog ID: URL param > user's catalog > guest public > first available
  useEffect(() => {
    const resolveCatalog = async () => {
      if (catalogIdFromUrl) {
        setEffectiveCatalogId(catalogIdFromUrl);
        return;
      }
      if (user?.catalogId) {
        setEffectiveCatalogId(user.catalogId);
        return;
      }
      if (guest) {
        try {
          const { data } = await publicApi.getCatalogs();
          const catalogs = Array.isArray(data) ? data : [];
          if (catalogs.length > 0) {
            setEffectiveCatalogId(catalogs[0].id);
          } else {
            setLoading(false);
          }
        } catch (error) {
          console.error('Failed to load public catalogs:', error);
          setLoading(false);
        }
        return;
      }
      // Logged-in user without catalogId: use first available catalog
      try {
        const { data } = await catalogApi.getAll();
        const catalogs = Array.isArray(data) ? data : [];
        if (catalogs.length > 0) {
          setEffectiveCatalogId(catalogs[0].id);
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error('Failed to load catalogs:', error);
        setLoading(false);
      }
    };
    resolveCatalog();
  }, [catalogIdFromUrl, user?.catalogId, user?.role, guest]);

  useEffect(() => {
    const loadTopCategories = async () => {
      if (!effectiveCatalogId) return;

      try {
        const { data } = await categoryApi.getByCatalog(effectiveCatalogId, {
          parentId: 'null',
        });
        setTopCategories(data);
        if (data.length > 0) {
          setSelectedCategory(data[0]);
        }
      } catch (error) {
        console.error('Failed to load categories:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTopCategories();
  }, [effectiveCatalogId]);

  useEffect(() => {
    const loadSubCategories = async () => {
      if (!selectedCategory) return;

      try {
        const { data } = await categoryApi.getChildren(selectedCategory.id);
        setSubCategories(data);
      } catch (error) {
        console.error('Failed to load subcategories:', error);
      }
    };

    loadSubCategories();
  }, [selectedCategory?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-wago-green border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* View toggle + Top horizontal carousel for main categories */}
      <div className="bg-white border-b border-gray-200 py-4">
        <div className="container-custom">
          <div className="flex items-center justify-between mb-3">
            <div className="flex rounded-lg border border-gray-200 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium ${viewMode === 'grid' ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <Grid3x3 className="w-4 h-4" />
                Grid
              </button>
              <button
                type="button"
                onClick={() => setViewMode('categories')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium ${viewMode === 'categories' ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <LayoutList className="w-4 h-4" />
                Categories
              </button>
            </div>
            <h2 className="text-sm font-semibold text-gray-600 uppercase">
              {viewMode === 'grid' ? 'Quick Grid' : 'Categories'}
            </h2>
          </div>
          {viewMode === 'categories' && (
          <Swiper
            modules={[FreeMode]}
            spaceBetween={16}
            slidesPerView="auto"
            freeMode={true}
            className="!overflow-visible"
          >
            {topCategories.map((category) => (
              <SwiperSlide key={category.id} style={{ width: 'auto' }}>
                <button
                  onClick={() => setSelectedCategory(category)}
                  className={`
                    px-6 py-4 rounded-xl border-2 transition-all duration-200 min-w-[140px]
                    ${
                      selectedCategory?.id === category.id
                        ? 'border-wago-green bg-wago-green text-white shadow-lg scale-105'
                        : 'border-gray-200 bg-white text-gray-900 hover:border-wago-green'
                    }
                  `}
                >
                  <div className="text-center">
                    {category.thumbnailUrl && (
                      <img
                        src={category.thumbnailUrl}
                        alt={category.name}
                        className="w-12 h-12 mx-auto mb-2 object-contain"
                      />
                    )}
                    <div className="font-semibold text-sm mb-1">
                      {category.name}
                    </div>
                    {category.shortText && (
                      <div className="text-xs opacity-80">
                        {category.shortText}
                      </div>
                    )}
                  </div>
                </button>
              </SwiperSlide>
            ))}
          </Swiper>
          )}
        </div>
      </div>

      {/* Vertical scroll area: Grid or Categories */}
      <div className="flex-1 overflow-y-auto">
        <div className="container-custom py-6">
          {viewMode === 'grid' && effectiveCatalogId ? (
            <CatalogGrid catalogId={effectiveCatalogId} />
          ) : (
          selectedCategory && (
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  {selectedCategory.name}
                </h1>
                {selectedCategory.longText && (
                  <p className="text-gray-600">{selectedCategory.longText}</p>
                )}
              </div>

              {subCategories.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {subCategories.map((subCategory) => (
                    <button
                      key={subCategory.id}
                      onClick={() => navigate(`/catalog/category/${subCategory.id}`)}
                      className="card card-hover p-6 text-left"
                    >
                      {subCategory.thumbnailUrl && (
                        <img
                          src={subCategory.thumbnailUrl}
                          alt={subCategory.name}
                          className="w-20 h-20 object-contain mx-auto mb-4"
                        />
                      )}
                      <h3 className="font-semibold text-gray-900 mb-2">
                        {subCategory.name}
                      </h3>
                      {subCategory.shortText && (
                        <p className="text-sm text-gray-600 mb-3">
                          {subCategory.shortText}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">
                          {subCategory._count.parts} parts
                        </span>
                        <ChevronRight className="w-5 h-5 text-wago-green" />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-600">No subcategories found</p>
                </div>
              )}
            </>
          ) )}
        </div>
      </div>
    </div>
  );
};

export default Catalog;
