import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Swiper, SwiperSlide } from 'swiper/react';
import { FreeMode } from 'swiper/modules';
import { ChevronRight } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { categoryApi } from '@/lib/api';

import 'swiper/css';
import 'swiper/css/free-mode';

const Catalog = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [topCategories, setTopCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [subCategories, setSubCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTopCategories = async () => {
      if (!user?.catalogId) return;

      try {
        const { data } = await categoryApi.getByCatalog(user.catalogId, {
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
  }, [user?.catalogId]);

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
          <p className="text-gray-600">Loading catalog...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Top horizontal carousel for main categories */}
      <div className="bg-white border-b border-gray-200 py-4">
        <div className="container-custom">
          <h2 className="text-sm font-semibold text-gray-600 uppercase mb-3">
            Categories
          </h2>
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
        </div>
      </div>

      {/* Vertical scroll area for subcategories and parts */}
      <div className="flex-1 overflow-y-auto">
        <div className="container-custom py-6">
          {selectedCategory && (
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
          )}
        </div>
      </div>
    </div>
  );
};

export default Catalog;
