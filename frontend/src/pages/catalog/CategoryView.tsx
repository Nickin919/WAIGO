import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { categoryApi, partApi } from '@/lib/api';

const CategoryView = () => {
  const { categoryId } = useParams<{ categoryId: string }>();
  const navigate = useNavigate();
  const [category, setCategory] = useState<any>(null);
  const [breadcrumb, setBreadcrumb] = useState<any[]>([]);
  const [parts, setParts] = useState<any[]>([]);
  const [subCategories, setSubCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!categoryId) return;

      try {
        const [categoryRes, breadcrumbRes, partsRes] = await Promise.all([
          categoryApi.getById(categoryId),
          categoryApi.getBreadcrumb(categoryId),
          partApi.getByCategory(categoryId),
        ]);

        setCategory(categoryRes.data);
        setBreadcrumb(breadcrumbRes.data);
        setParts(partsRes.data);
        setSubCategories(categoryRes.data.children || []);
      } catch (error) {
        console.error('Failed to load category:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [categoryId]);

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
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="container-custom py-4">
          <div className="flex items-center space-x-2 text-sm overflow-x-auto">
            <button
              onClick={() => navigate('/catalog')}
              className="text-wago-green hover:underline whitespace-nowrap"
            >
              Catalog
            </button>
            {breadcrumb.map((item, index) => (
              <div key={item.id} className="flex items-center space-x-2">
                <ChevronRight className="w-4 h-4 text-gray-400" />
                {index === breadcrumb.length - 1 ? (
                  <span className="text-gray-900 font-medium whitespace-nowrap">
                    {item.name}
                  </span>
                ) : (
                  <button
                    onClick={() => navigate(`/catalog/category/${item.id}`)}
                    className="text-wago-green hover:underline whitespace-nowrap"
                  >
                    {item.name}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="container-custom py-6">
        {/* Category header */}
        {category && (
          <div className="mb-8">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center text-wago-green hover:underline mb-4"
            >
              <ChevronLeft className="w-5 h-5" />
              Back
            </button>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {category.name}
            </h1>
            {category.longText && (
              <p className="text-gray-600">{category.longText}</p>
            )}
          </div>
        )}

        {/* Subcategories */}
        {subCategories.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Subcategories
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {subCategories.map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => navigate(`/catalog/category/${sub.id}`)}
                  className="card card-hover p-6 text-left"
                >
                  <h3 className="font-semibold text-gray-900 mb-2">{sub.name}</h3>
                  {sub.shortText && (
                    <p className="text-sm text-gray-600 mb-3">{sub.shortText}</p>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">
                      {sub._count.parts} parts
                    </span>
                    <ChevronRight className="w-5 h-5 text-wago-green" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Parts grid */}
        {parts.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Parts</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {parts.map((part) => (
                <Link
                  key={part.id}
                  to={`/catalog/part/${part.id}`}
                  className="card card-hover p-4"
                >
                  {part.thumbnailUrl && (
                    <img
                      src={part.thumbnailUrl}
                      alt={part.partNumber}
                      className="w-full h-32 object-contain mb-3"
                    />
                  )}
                  <div className="text-sm font-semibold text-wago-green mb-1">
                    {part.partNumber}
                  </div>
                  <div className="text-sm text-gray-900 line-clamp-2 mb-2">
                    {part.description}
                  </div>
                  {part._count.videos > 0 && (
                    <div className="text-xs text-purple-600">
                      {part._count.videos} video{part._count.videos > 1 ? 's' : ''}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        {parts.length === 0 && subCategories.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600">No items found in this category</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoryView;
