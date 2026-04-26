import React, { useState, useEffect, useMemo } from 'react';
import { Search, Bell, Heart, Plus, X, ShoppingBag, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, Input, Skeleton } from '../components/ui/Base';
import { motion, AnimatePresence } from 'motion/react';
import { Product, Category, Banner, User } from '../types';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, limit, onSnapshot, orderBy, where } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
import { WishlistButton } from '../components/WishlistButton';
import { cn } from '../lib/utils';
import { cacheUtils } from '../lib/cache-utils';

export const Home = ({ user, onAddToCart }: { user: User | null, onAddToCart: (p: Product) => void }) => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [popularItems, setPopularItems] = useState<Product[]>([]);
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasUnreadNotifs, setHasUnreadNotifs] = useState(false);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [jumpPage, setJumpPage] = useState('');
  const itemsPerPage = 10;

  // Load cached data on mount for instant UI
  useEffect(() => {
    const cachedData = localStorage.getItem('home_cache');
    if (cachedData) {
      try {
        const { categories: c, allProducts: p, banners: b } = JSON.parse(cachedData);
        if (c) setCategories(c);
        if (p) {
          setAllProducts(p);
          setPopularItems(p.slice(0, 4));
          const sortedNew = [...p].sort((a: any, b: any) => {
            const timeA = a.createdAt?.seconds || 0;
            const timeB = b.createdAt?.seconds || 0;
            return timeB - timeA;
          });
          setNewArrivals(sortedNew.slice(0, 4));
        }
        if (b) setBanners(b);
        setLoading(false); // We have cached data, so stop showing skeletons
      } catch (e) {
        console.error('Error parsing home cache', e);
      }
    }
  }, []);

  useEffect(() => {
    // Fetch all categories to avoid skipping those without the 'order' field
    const unsubCats = onSnapshot(collection(db, 'categories'), (snapshot) => {
      let cats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
      
      // Sort by order first, then by name
      cats.sort((a, b) => {
        const orderA = a.order ?? 999;
        const orderB = b.order ?? 999;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      });

      setCategories(cats.slice(0, 20));
      updateCache({ categories: cats.slice(0, 20) });
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'categories'));

    const unsubAllProds = onSnapshot(query(collection(db, 'products'), limit(100)), (snapshot) => {
      const prods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setAllProducts(prods);
      
      // Sort by salesCount for Popular Items
      const sortedPopular = [...prods].sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0));
      setPopularItems(sortedPopular.slice(0, 10));
      
      const sortedNew = [...prods].sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });
      setNewArrivals(sortedNew.slice(0, 4));
      
      setLoading(false);
      updateCache({ allProducts: prods });
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'products'));

    const unsubBanners = onSnapshot(query(collection(db, 'banners'), where('active', '==', true)), (snapshot) => {
      const bannersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Banner));
      const sortedBanners = bannersData.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });
      setBanners(sortedBanners);
      updateCache({ banners: sortedBanners });
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'banners'));

    const unsubNotifs = onSnapshot(query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(20)), (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      const saved = localStorage.getItem('read_notifications');
      let readIds: string[] = [];
      if (saved) {
        try {
          readIds = JSON.parse(saved);
        } catch (e) {
          console.error('Error parsing read notifications', e);
        }
      }
      const unread = notifs.some(n => !readIds.includes(n.id));
      setHasUnreadNotifs(unread);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'notifications'));

    const updateCache = (newData: any) => {
      const currentCache = JSON.parse(cacheUtils.getItem('home_cache') || '{}');
      
      // Limit products in cache to avoid QuotaExceededError
      if (newData.allProducts) {
        newData.allProducts = newData.allProducts.slice(0, 20);
      }
      
      cacheUtils.setItem('home_cache', { ...currentCache, ...newData });
    };

    return () => {
      unsubCats();
      unsubAllProds();
      unsubBanners();
      unsubNotifs();
    };
  }, []);

  useEffect(() => {
    if (banners.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % banners.length);
    }, 5000); // Change banner every 5 seconds

    return () => clearInterval(interval);
  }, [banners.length]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase().trim();
    return allProducts.filter(p => 
      p.name.toLowerCase().includes(query) || 
      p.category.toLowerCase().includes(query)
    );
  }, [searchQuery, allProducts]);

  const isSearching = searchQuery.trim().length > 0;

  // Pagination Logic
  const totalPages = Math.ceil(allProducts.length / itemsPerPage);
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return allProducts.slice(start, start + itemsPerPage);
  }, [allProducts, currentPage]);

  const handleJumpPage = (e: React.FormEvent) => {
    e.preventDefault();
    const pageNum = parseInt(jumpPage);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
      setJumpPage('');
      window.scrollTo({ top: document.getElementById('all-products-section')?.offsetTop ? document.getElementById('all-products-section')!.offsetTop - 100 : 0, behavior: 'smooth' });
    }
  };

  const goToPage = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: document.getElementById('all-products-section')?.offsetTop ? document.getElementById('all-products-section')!.offsetTop - 100 : 0, behavior: 'smooth' });
  };

  return (
    <div className="pb-24 px-6 pt-8 bg-[#F8FBF9] min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">
            Lumaro <span className="text-[#66D2A4]">Mart</span>
          </h1>
          <p className="text-gray-400 text-sm">Freshness at your doorstep</p>
        </div>
        <button 
          onClick={() => navigate('/notifications')}
          className="bg-white p-3 rounded-full shadow-sm relative"
        >
          <Bell size={20} className="text-gray-600" />
          {hasUnreadNotifs && (
            <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
          )}
        </button>
      </div>

      {/* Search */}
      <div className="flex gap-3 mb-8">
        <div className="relative flex-grow">
          <Input 
            placeholder="Search fresh groceries..." 
            icon={<Search size={20} />}
            className="bg-white shadow-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {isSearching && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Dynamic Banners Slideshow */}
      {!isSearching && (
        <div className="relative mb-8 overflow-hidden rounded-[40px]">
          {loading ? (
            <Skeleton className="w-full h-[180px] rounded-[40px]" />
          ) : (
            <AnimatePresence mode="wait">
              {banners.length > 0 ? (
                <motion.div 
                  key={banners[currentBannerIndex].id}
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.5 }}
                  style={{ backgroundColor: banners[currentBannerIndex].backgroundColor }}
                  className="relative p-8 text-white min-h-[180px] flex flex-col justify-center"
                >
                  <div className="relative z-10 max-w-[240px]">
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-2 opacity-90 drop-shadow-md">
                      {banners[currentBannerIndex].subtitle}
                    </p>
                    <h2 className="text-2xl font-extrabold leading-tight mb-4 drop-shadow-lg text-white">
                      {banners[currentBannerIndex].title}
                    </h2>
                    <Button 
                      variant="secondary" 
                      className="bg-white text-gray-900 border-none text-xs px-6 py-2 rounded-full shadow-lg"
                      onClick={() => navigate('/categories')}
                    >
                      {banners[currentBannerIndex].buttonText}
                    </Button>
                  </div>

                  {banners[currentBannerIndex].image && (
                    <div className="absolute inset-0 w-full h-full pointer-events-none">
                      <img 
                        src={banners[currentBannerIndex].image} 
                        alt={banners[currentBannerIndex].title} 
                        className="w-full h-full object-cover opacity-70"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-black/20 via-transparent to-transparent" />
                    </div>
                  )}
                  
                  {/* Abstract Shapes */}
                  <div className="absolute top-0 right-0 w-full h-full opacity-20 pointer-events-none">
                    <div className="absolute top-4 right-4 w-24 h-24 border-2 border-white rounded-full" />
                    <div className="absolute -bottom-10 -right-10 w-48 h-48 border-4 border-white rounded-full" />
                  </div>
                </motion.div>
              ) : (
                /* Fallback Banner if no active banners */
                <motion.div 
                  key="fallback-banner"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="relative bg-[#2EB87E] rounded-[40px] p-8 overflow-hidden text-white min-h-[180px] flex flex-col justify-center"
                >
                  <div className="relative z-10 max-w-[200px]">
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-2 opacity-80">Special Offer</p>
                    <h2 className="text-2xl font-extrabold leading-tight mb-4">
                      Get 20% Cashback on Loyalty Points
                    </h2>
                    <Button variant="secondary" className="bg-white text-[#2EB87E] border-none text-xs px-6 py-2 rounded-full">
                      Shop Now
                    </Button>
                  </div>
                  
                  <div className="absolute top-0 right-0 w-full h-full opacity-20 pointer-events-none">
                    <div className="absolute top-4 right-4 w-24 h-24 border-2 border-white rounded-full" />
                    <div className="absolute -bottom-10 -right-10 w-48 h-48 border-4 border-white rounded-full" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* Indicators */}
          {!loading && banners.length > 1 && (
            <div className="absolute bottom-4 left-8 flex gap-1.5 z-20">
              {banners.map((_, idx) => (
                <div 
                  key={idx}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === currentBannerIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/40'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <AnimatePresence mode="wait">
        {isSearching ? (
          <motion.div 
            key="search-results"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-[#1A1A1A]">Search Results</h3>
              <span className="text-xs text-gray-400 font-medium">{filteredProducts.length} items found</span>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-300">
                  <Search size={32} />
                </div>
                <h4 className="text-lg font-bold text-[#1A1A1A] mb-1">No products found</h4>
                <p className="text-sm text-gray-400 max-w-[200px]">We couldn't find any products matching your search.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {filteredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} user={user} onAddToCart={onAddToCart} navigate={navigate} />
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div 
            key="home-content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* New Arrivals */}
            {newArrivals.length > 0 && (
              <div className="mb-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-[#1A1A1A]">New Arrivals</h3>
                  <span className="bg-green-100 text-green-600 text-[10px] font-bold px-2 py-1 rounded-full uppercase">Just Added</span>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
                  {newArrivals.map((product) => (
                    <div 
                      key={product.id}
                      className="min-w-[140px] bg-white rounded-3xl p-3 shadow-sm border border-gray-50 flex flex-col cursor-pointer"
                      onClick={() => navigate(`/product/${product.id}`)}
                    >
                      <div className="relative aspect-square mb-2 rounded-2xl overflow-hidden bg-gray-100 flex items-center justify-center">
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
                        <div className="absolute top-2 left-2 bg-[#66D2A4] text-white text-[8px] font-bold px-2 py-0.5 rounded-full uppercase z-10">
                          New
                        </div>
                        <div className="absolute bottom-2 left-2 bg-white/80 backdrop-blur-sm text-gray-600 text-[8px] font-bold px-2 py-0.5 rounded-full uppercase border border-gray-100 z-10">
                          {product.category}
                        </div>
                        <WishlistButton user={user} productId={product.id} className="absolute top-2 right-2 w-7 h-7 rounded-lg z-10" />
                      </div>
                      <h4 className="font-bold text-[11px] text-[#1A1A1A] line-clamp-1">{product.name}</h4>
                      <span className="font-bold text-[#66D2A4] text-xs mt-1">₹{product.price}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Categories */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-[#1A1A1A]">Categories</h3>
                <button onClick={() => navigate('/categories')} className="text-[#66D2A4] text-sm font-semibold">See All</button>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
                {loading ? (
                  [1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="flex flex-col items-center gap-2 min-w-[70px]">
                      <Skeleton className="w-16 h-16 rounded-3xl" />
                      <Skeleton className="w-12 h-2 rounded-full" />
                    </div>
                  ))
                ) : (
                  <>
                    {categories.length === 0 && (
                      <p className="text-xs text-gray-400 py-4">No categories found</p>
                    )}
                    {categories.map((cat) => (
                      <div 
                        key={cat.id} 
                        className="flex flex-col items-center gap-2 min-w-[70px] cursor-pointer"
                        onClick={() => navigate('/categories', { state: { category: cat.name } })}
                      >
                        <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center text-2xl shadow-sm border border-gray-50">
                          {cat.icon}
                        </div>
                        <span className="text-[10px] font-medium text-gray-500 text-center line-clamp-1">{cat.name}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>

            {/* Popular Items */}
            {popularItems.length > 0 && (
              <div className="mb-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-[#1A1A1A]">Popular Items</h3>
                  <span className="bg-orange-100 text-orange-600 text-[10px] font-bold px-2 py-1 rounded-full uppercase">Top Trending</span>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
                  {loading ? (
                    [1, 2, 3, 4].map(i => (
                      <div key={i} className="min-w-[140px] bg-white rounded-3xl p-3 shadow-sm border border-gray-50 flex flex-col">
                        <Skeleton className="w-full aspect-square mb-2 rounded-2xl" />
                        <Skeleton className="w-3/4 h-2 mb-1 rounded-full" />
                        <Skeleton className="w-1/2 h-2 rounded-full" />
                      </div>
                    ))
                  ) : (
                    popularItems.map((product) => (
                      <div 
                        key={product.id}
                        className="min-w-[140px] bg-white rounded-3xl p-3 shadow-sm border border-gray-50 flex flex-col cursor-pointer"
                        onClick={() => navigate(`/product/${product.id}`)}
                      >
                        <div className="relative aspect-square mb-2 rounded-2xl overflow-hidden bg-gray-100 flex items-center justify-center">
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
                          <div className="absolute top-2 left-2 bg-orange-500 text-white text-[8px] font-bold px-2 py-0.5 rounded-full uppercase z-10">
                            Hot
                          </div>
                          <div className="absolute bottom-2 left-2 bg-white/80 backdrop-blur-sm text-gray-600 text-[8px] font-bold px-2 py-0.5 rounded-full uppercase border border-gray-100 z-10">
                            {product.category}
                          </div>
                          <WishlistButton user={user} productId={product.id} className="absolute top-2 right-2 w-7 h-7 rounded-lg z-10" />
                        </div>
                        <h4 className="font-bold text-[11px] text-[#1A1A1A] line-clamp-1">{product.name}</h4>
                        <span className="font-bold text-[#66D2A4] text-xs mt-1">₹{product.price}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* All Products */}
            <div className="pb-8" id="all-products-section">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-[#1A1A1A]">All Products</h3>
                <span className="text-xs text-gray-400 font-medium">{allProducts.length} items</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {loading ? (
                  [1, 2, 3, 4, 5, 6].map(i => (
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
                    {allProducts.length === 0 && (
                      <p className="text-xs text-gray-400 col-span-2 py-8 text-center">No products found</p>
                    )}
                    {paginatedProducts.map((product) => (
                      <ProductCard key={product.id} product={product} user={user} onAddToCart={onAddToCart} navigate={navigate} />
                    ))}
                  </>
                )}
              </div>

              {/* Pagination UI */}
              {!loading && allProducts.length > itemsPerPage && (
                <div className="mt-10 space-y-6">
                  <div className="flex items-center justify-center gap-2">
                    <button 
                      disabled={currentPage === 1}
                      onClick={() => goToPage(currentPage - 1)}
                      className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    
                    <div className="flex items-center gap-1">
                      {[...Array(totalPages)].map((_, i) => {
                        const pageNum = i + 1;
                        // Show first, last, current, and pages around current
                        if (
                          pageNum === 1 || 
                          pageNum === totalPages || 
                          (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                        ) {
                          return (
                            <button
                              key={pageNum}
                              onClick={() => goToPage(pageNum)}
                              className={cn(
                                "w-10 h-10 rounded-xl font-bold text-sm transition-all",
                                currentPage === pageNum 
                                  ? "bg-[#66D2A4] text-white shadow-lg shadow-[#66D2A4]/20" 
                                  : "bg-white text-gray-400 border border-gray-100 hover:border-[#66D2A4]/30"
                              )}
                            >
                              {pageNum}
                            </button>
                          );
                        } else if (
                          (pageNum === currentPage - 2 && pageNum > 1) || 
                          (pageNum === currentPage + 2 && pageNum < totalPages)
                        ) {
                          return <span key={pageNum} className="text-gray-300 px-1">...</span>;
                        }
                        return null;
                      })}
                    </div>

                    <button 
                      disabled={currentPage === totalPages}
                      onClick={() => goToPage(currentPage + 1)}
                      className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>

                  {/* Jump to Page */}
                  <form onSubmit={handleJumpPage} className="flex items-center justify-center gap-3">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Go to page</span>
                    <div className="relative w-20">
                      <input 
                        type="number"
                        min="1"
                        max={totalPages}
                        value={jumpPage}
                        onChange={(e) => setJumpPage(e.target.value)}
                        placeholder={currentPage.toString()}
                        className="w-full bg-white border border-gray-100 rounded-xl px-3 py-2 text-sm font-bold text-center outline-none focus:border-[#66D2A4] transition-colors shadow-sm"
                      />
                    </div>
                    <button 
                      type="submit"
                      className="bg-[#66D2A4] text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider shadow-md hover:bg-[#55b88e] transition-colors"
                    >
                      Go
                    </button>
                  </form>
                  
                  <p className="text-center text-[10px] font-bold text-gray-300 uppercase tracking-widest">
                    Page {currentPage} of {totalPages}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ProductCard: React.FC<{ product: Product, user: User | null, onAddToCart: (p: Product) => void, navigate: any }> = ({ product, user, onAddToCart, navigate }) => (
  <motion.div 
    whileHover={{ scale: 1.02 }}
    className="bg-white rounded-[32px] p-4 shadow-sm border border-gray-50 flex flex-col cursor-pointer h-full"
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
      <div className="absolute bottom-2 left-2 bg-white/80 backdrop-blur-sm text-gray-600 text-[8px] font-bold px-2 py-0.5 rounded-full uppercase border border-gray-100 z-10">
        {product.category}
      </div>
      <WishlistButton user={user} productId={product.id} className="absolute top-2 right-2 w-8 h-8 rounded-xl z-10" />
    </div>
    <h4 className="font-bold text-sm text-[#1A1A1A] mb-1 line-clamp-1">{product.name}</h4>
    <p className={cn(
      "text-[10px] mb-2 font-bold",
      product.stock > 0 ? "text-gray-400" : "text-red-500"
    )}>
      {product.stock > 0 ? `${product.stock} in stock` : "Out of Stock"}
    </p>
    <div className="flex justify-between items-center mt-auto">
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
);
