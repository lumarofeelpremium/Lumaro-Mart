import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, Search, Plus, Filter, ArrowUpDown, X } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Input, Button, Skeleton } from '../components/ui/Base';
import { motion, AnimatePresence } from 'motion/react';
import { Product, Category, User } from '../types';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { WishlistButton } from '../components/WishlistButton';
import { cacheUtils } from '../lib/cache-utils';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';

export const Categories = ({ user, onAddToCart }: { user: User | null, onAddToCart: (p: Product) => void }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState(location.state?.category || '');
  const [loading, setLoading] = useState(true);
  
  // Filter & Sort State
  const [showFilters, setShowFilters] = useState(false);
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [sortBy, setSortBy] = useState<'popularity' | 'priceLow' | 'priceHigh'>('popularity');

  // Load cached categories on mount
  useEffect(() => {
    const cachedCats = cacheUtils.getItem('categories_list_cache');
    if (cachedCats) {
      try {
        const cats = JSON.parse(cachedCats);
        setCategories(cats);
        if (!selectedCategory && cats.length > 0) {
          setSelectedCategory(cats[0].name);
        }
      } catch (e) {
        console.error('Error parsing categories cache', e);
      }
    }
  }, []);

  // Load cached products for selected category
  useEffect(() => {
    if (!selectedCategory) return;
    const cachedProds = cacheUtils.getItem(`category_prods_${selectedCategory}`);
    if (cachedProds) {
      try {
        setProducts(JSON.parse(cachedProds));
        setLoading(false);
      } catch (e) {
        console.error('Error parsing category products cache', e);
      }
    } else {
      setLoading(true);
    }
  }, [selectedCategory]);

  useEffect(() => {
    const q = query(collection(db, 'categories'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
      setCategories(cats);
      cacheUtils.setItem('categories_list_cache', cats);
      if (!selectedCategory && cats.length > 0) {
        setSelectedCategory(cats[0].name);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'categories');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!selectedCategory) return;

    const q = query(
      collection(db, 'products'),
      where('category', '==', selectedCategory)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const prods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(prods);
      cacheUtils.setItem(`category_prods_${selectedCategory}`, prods);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedCategory]);

  const filteredAndSortedProducts = useMemo(() => {
    let result = [...products];

    // Filter by Price
    if (minPrice !== '') {
      result = result.filter(p => p.price >= Number(minPrice));
    }
    if (maxPrice !== '') {
      result = result.filter(p => p.price <= Number(maxPrice));
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'popularity') {
        return (b.salesCount || 0) - (a.salesCount || 0);
      }
      if (sortBy === 'priceLow') {
        return a.price - b.price;
      }
      if (sortBy === 'priceHigh') {
        return b.price - a.price;
      }
      return 0;
    });

    return result;
  }, [products, minPrice, maxPrice, sortBy]);

  const clearFilters = () => {
    setMinPrice('');
    setMaxPrice('');
    setSortBy('popularity');
  };

  return (
    <div className="min-h-screen bg-[#F8FBF9] pb-32">
      <div className="bg-white px-6 py-6 flex items-center justify-between border-b border-gray-100 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 bg-[#F0F7F4] rounded-xl flex items-center justify-center text-gray-600"
          >
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-lg font-bold text-[#1A1A1A]">Categories</h1>
        </div>
        <button 
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
            showFilters ? "bg-[#66D2A4] text-white" : "bg-[#F0F7F4] text-gray-600"
          )}
        >
          <Filter size={20} />
        </button>
      </div>

      <div className="px-6 pt-6">
        {/* Category Selection */}
        <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
          {categories.length === 0 ? (
            [1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="min-w-[120px] h-12 rounded-2xl" />
            ))
          ) : (
            categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.name)}
                className={cn(
                  "flex items-center gap-2 px-6 py-3 rounded-2xl font-bold whitespace-nowrap transition-all",
                  selectedCategory === cat.name 
                    ? "bg-[#66D2A4] text-white shadow-md shadow-[#66D2A4]/20" 
                    : "bg-white text-gray-500 border border-gray-100"
                )}
              >
                <span>{cat.icon}</span>
                <span>{cat.name}</span>
              </button>
            ))
          )}
        </div>

        {/* Filters Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-6"
            >
              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-[#1A1A1A]">Filters & Sort</h3>
                  <button onClick={clearFilters} className="text-xs font-bold text-[#66D2A4]">Clear All</button>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Price Range (₹)</label>
                  <div className="flex items-center gap-3">
                    <Input 
                      type="number" 
                      placeholder="Min" 
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                      className="text-sm"
                    />
                    <div className="w-4 h-[2px] bg-gray-200" />
                    <Input 
                      type="number" 
                      placeholder="Max" 
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Sort By</label>
                  <div className="flex flex-wrap gap-2">
                    <SortOption 
                      active={sortBy === 'popularity'} 
                      onClick={() => setSortBy('popularity')} 
                      label="Popularity" 
                    />
                    <SortOption 
                      active={sortBy === 'priceLow'} 
                      onClick={() => setSortBy('priceLow')} 
                      label="Price: Low to High" 
                    />
                    <SortOption 
                      active={sortBy === 'priceHigh'} 
                      onClick={() => setSortBy('priceHigh')} 
                      label="Price: High to Low" 
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-[#1A1A1A]">{selectedCategory} Products</h2>
            <span className="text-gray-400 text-sm">{filteredAndSortedProducts.length} items</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {loading ? (
              [1, 2, 3, 4].map(i => (
                <div key={i} className="bg-white rounded-[32px] p-4 shadow-sm border border-gray-50 h-[220px]">
                  <Skeleton className="w-full aspect-square mb-3 rounded-2xl" />
                  <Skeleton className="w-3/4 h-3 mb-2 rounded-full" />
                  <Skeleton className="w-1/2 h-2 mb-4 rounded-full" />
                  <div className="flex justify-between items-center mt-auto">
                    <Skeleton className="w-12 h-4 rounded-full" />
                    <Skeleton className="w-8 h-8 rounded-xl" />
                  </div>
                </div>
              ))
            ) : (
              <>
                {filteredAndSortedProducts.length === 0 && (
                  <div className="col-span-2 py-12 text-center">
                    <p className="text-gray-400 text-sm">No products match your filters</p>
                  </div>
                )}
                {filteredAndSortedProducts.map((product) => (
                  <motion.div 
                    key={product.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.02 }}
                    className="bg-white rounded-[32px] p-4 shadow-sm border border-gray-50 cursor-pointer"
                    onClick={() => navigate(`/product/${product.id}`)}
                  >
                    <div className="relative aspect-square mb-3 rounded-2xl overflow-hidden bg-gray-100 flex items-center justify-center">
                      {product.image ? (
                        <img 
                          src={product.image} 
                          alt={product.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <Plus size={24} className="text-gray-300" />
                      )}
                      <WishlistButton user={user} productId={product.id} className="absolute top-2 right-2 w-8 h-8 rounded-xl" />
                    </div>
                    <h4 className="font-bold text-sm text-[#1A1A1A] mb-1 line-clamp-1">{product.name}</h4>
                    <p className={cn(
                      "text-[10px] mb-2 font-bold",
                      product.stock > 0 ? "text-gray-400" : "text-red-500"
                    )}>
                      {product.stock > 0 ? `${product.stock} in stock` : "Out of Stock"}
                    </p>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-[#66D2A4]">₹{product.price}</span>
                      <button 
                        disabled={product.stock <= 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (product.stock > 0) onAddToCart(product);
                        }}
                        className={cn(
                          "text-white p-2 rounded-xl transition-colors",
                          product.stock > 0 ? "bg-[#66D2A4] hover:bg-[#55b88e]" : "bg-gray-300 cursor-not-allowed"
                        )}
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const SortOption = ({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) => (
  <button 
    onClick={onClick}
    className={cn(
      "px-4 py-2 rounded-xl text-xs font-bold transition-all",
      active 
        ? "bg-[#66D2A4] text-white shadow-sm" 
        : "bg-[#F0F7F4] text-gray-500 hover:bg-gray-100"
    )}
  >
    {label}
  </button>
);

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
