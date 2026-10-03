import React, { useState, useEffect, useMemo } from 'react';
import { Search, Bell, Heart, Plus, X, ShoppingBag, ChevronLeft, ChevronRight, MapPin, Globe } from 'lucide-react';
import { Button, Input, Skeleton } from '../components/ui/Base';
import { motion, AnimatePresence } from 'motion/react';
import { Product, Category, Banner, User, DeliveryLocation, ProductVariant } from '../types';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, limit, onSnapshot, orderBy, where } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
import { WishlistButton } from '../components/WishlistButton';
import { MultiSavingsBadge } from '../components/MultiSavingsBadge';
import { LocationSelectorModal } from '../components/LocationSelectorModal';
import { filterProductsByLocation } from '../lib/location-utils';
import { cn, sortVariantsByWeight } from '../lib/utils';
import { cacheUtils } from '../lib/cache-utils';

export const Home = ({ 
  user, 
  onAddToCart,
  categories,
  allProducts,
  banners,
  initialDataLoading,
  deliveryLocation,
  onSelectDeliveryLocation
}: { 
  user: User | null;
  onAddToCart: (p: Product, quantity?: number, variant?: ProductVariant) => void;
  categories: Category[];
  allProducts: Product[];
  banners: Banner[];
  initialDataLoading: boolean;
  deliveryLocation?: DeliveryLocation | null;
  onSelectDeliveryLocation?: (loc: DeliveryLocation | null) => void;
}) => {
  const navigate = useNavigate();
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasUnreadNotifs, setHasUnreadNotifs] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [jumpPage, setJumpPage] = useState('');
  const itemsPerPage = 50;

  // Deriving immediate states from properties for instant responses
  const loading = initialDataLoading && categories.length === 0 && allProducts.length === 0;

  // Products filtered by selected delivery location (Pincode / State)
  const locationFilteredProducts = useMemo(() => {
    return filterProductsByLocation(allProducts, deliveryLocation || null);
  }, [allProducts, deliveryLocation]);

  const popularItems = useMemo(() => {
    if (!locationFilteredProducts || locationFilteredProducts.length === 0) return [];
    const populars = locationFilteredProducts.filter(product => product.isPopular);
    if (populars.length > 0) {
      // Sort DESCENDING: the most recently added/marked popular product comes FIRST!
      const sorted = [...populars].sort((a, b) => {
        const timeA = a.popularUpdatedAt?.toMillis 
          ? a.popularUpdatedAt.toMillis() 
          : (a.popularUpdatedAt?.seconds ? a.popularUpdatedAt.seconds * 1000 : (typeof a.popularUpdatedAt === 'number' ? a.popularUpdatedAt : 0));
        const timeB = b.popularUpdatedAt?.toMillis 
          ? b.popularUpdatedAt.toMillis() 
          : (b.popularUpdatedAt?.seconds ? b.popularUpdatedAt.seconds * 1000 : (typeof b.popularUpdatedAt === 'number' ? b.popularUpdatedAt : 0));
        
        if (timeA !== timeB) {
          return timeB - timeA; // Newest popular item first!
        }
        const creatA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
        const creatB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
        return creatB - creatA;
      });
      // Show up to 10 popular products
      return sorted.slice(0, 10);
    } else {
      const sortedPopular = [...locationFilteredProducts].sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0));
      return sortedPopular.slice(0, 10);
    }
  }, [locationFilteredProducts]);

  const newArrivals = useMemo(() => {
    if (!locationFilteredProducts || locationFilteredProducts.length === 0) return [];
    const sortedNew = [...locationFilteredProducts].sort((a, b) => {
      const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
      const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
      return timeB - timeA;
    });
    return sortedNew.slice(0, 4);
  }, [locationFilteredProducts]);

  // Handle Notifications query
  useEffect(() => {
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

    return () => unsubNotifs();
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
    
    // Split query by spaces to search for individual words in any order
    const queryWords = searchQuery
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter(Boolean);
      
    if (queryWords.length === 0) return [];

    const scored = locationFilteredProducts.map(p => {
      const productName = (p.name || '').toLowerCase();
      const productCategory = (p.category || '').toLowerCase();
      const productDesc = (p.description || '').toLowerCase();
      
      // All search words must be present in either the name, category, or description
      const matchesAll = queryWords.every(word => 
        productName.includes(word) || 
        productCategory.includes(word) || 
        productDesc.includes(word)
      );
      
      if (!matchesAll) return { product: p, score: -1 };
      
      let score = 0;
      
      queryWords.forEach(word => {
        // 1. Check in Title/Name matches
        if (productName.includes(word)) {
          // Base match in product name
          score += 10;
          
          // Exact name matches the query word exactly
          if (productName === word) {
            score += 100;
          }
          
          // Exact word match (bounded by word boundaries)
          const escapedWord = word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          const exactWordRegex = new RegExp(`\\b${escapedWord}\\b`, 'i');
          if (exactWordRegex.test(productName)) {
            score += 50;
          }
          
          // Word starts with the query word
          const startsWithWordRegex = new RegExp(`\\b${escapedWord}`, 'i');
          if (startsWithWordRegex.test(productName)) {
            score += 30;
          }
          
          // Leftmost start of the name matches
          if (productName.startsWith(word)) {
            score += 20;
          }
        }
        
        // 2. Check in Category matches
        if (productCategory.includes(word)) {
          score += 2;
          const escapedWord = word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          const exactWordRegex = new RegExp(`\\b${escapedWord}\\b`, 'i');
          if (exactWordRegex.test(productCategory)) {
            score += 5;
          }
        }
        
        // 3. Check in Description matches
        if (productDesc.includes(word)) {
          score += 1;
        }
      });
      
      return { product: p, score };
    });

    return scored
      .filter(item => item.score >= 0)
      .sort((a, b) => b.score - a.score)
      .map(item => item.product);
  }, [searchQuery, locationFilteredProducts]);

  const isSearching = searchQuery.trim().length > 0;

  // Pagination Logic
  const totalPages = Math.ceil(locationFilteredProducts.length / itemsPerPage);
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return locationFilteredProducts.slice(start, start + itemsPerPage);
  }, [locationFilteredProducts, currentPage]);

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
      <div className="flex justify-between items-center mb-4">
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

      {/* Delivery Location Selector Bar */}
      <div className="flex items-center justify-between mb-4 bg-emerald-50/90 border border-emerald-100 rounded-2xl px-3.5 py-2.5 shadow-2xs">
        <button 
          onClick={() => setShowLocationModal(true)}
          className="flex items-center gap-2.5 text-left flex-1 min-w-0 group"
        >
          <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
            <MapPin size={16} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">Delivering To</span>
              <span className="text-[10px] font-bold text-emerald-600 underline group-hover:text-emerald-800">Change</span>
            </div>
            <p className="text-xs font-extrabold text-gray-900 truncate">
              {deliveryLocation?.label || (deliveryLocation?.district ? `${deliveryLocation.district}, ${deliveryLocation.state || ''}` : deliveryLocation?.state || 'All India (Select State / District / Pincode)')}
            </p>
          </div>
        </button>
        {deliveryLocation ? (
          <button
            onClick={() => onSelectDeliveryLocation?.(null)}
            className="text-[10px] font-bold text-gray-500 hover:text-gray-700 bg-white px-2.5 py-1.5 rounded-xl border border-gray-200 ml-2 shrink-0 shadow-2xs"
            title="Show All Products (Remove Location Filter)"
          >
            Show All
          </button>
        ) : (
          <button
            onClick={() => setShowLocationModal(true)}
            className="text-[10px] font-bold text-emerald-700 bg-white px-2.5 py-1.5 rounded-xl border border-emerald-200 ml-2 shrink-0 shadow-2xs hover:bg-emerald-50"
          >
            📍 Set Location
          </button>
        )}
      </div>

      {/* Location Filter Active Notice */}
      {deliveryLocation && (
        <div className="mb-4 -mt-2 px-1 flex items-center justify-between text-[11px] text-gray-500">
          <span>
            📍 Showing {locationFilteredProducts.length} items for <strong>{deliveryLocation.label}</strong>
          </span>
          <button 
            onClick={() => onSelectDeliveryLocation?.(null)}
            className="text-emerald-600 font-bold hover:underline"
          >
            Clear Filter
          </button>
        </div>
      )}

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
                        {(product.offerLabel || product.discountPrice) ? (
                          <div className="absolute top-2 left-2 bg-red-500 text-white text-[8px] font-bold px-2 py-0.5 rounded-full uppercase z-10">
                            {product.offerLabel || 'Offer'}
                          </div>
                        ) : (
                          <div className="absolute top-2 left-2 bg-[#66D2A4] text-white text-[8px] font-bold px-2 py-0.5 rounded-full uppercase z-10">
                            New
                          </div>
                        )}
                        <div className="absolute bottom-2 left-2 bg-white/80 backdrop-blur-sm text-gray-600 text-[8px] font-bold px-2 py-0.5 rounded-full uppercase border border-gray-100 z-10">
                          {product.category}
                        </div>
                        <WishlistButton user={user} productId={product.id} className="absolute top-2 right-2 w-7 h-7 rounded-lg z-10" />
                      </div>
                      <h4 className="font-bold text-[11px] text-[#1A1A1A] line-clamp-1">{product.name}</h4>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="font-bold text-[#66D2A4] text-xs">₹{product.discountPrice || product.price}</span>
                        {product.discountPrice && (
                          <span className="text-[9px] text-gray-400 line-through">₹{product.price}</span>
                        )}
                      </div>
                      <div className="mt-1 min-h-[16px] flex items-center">
                        <MultiSavingsBadge product={product} variant="compact" />
                      </div>
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
                          {(product.offerLabel || product.discountPrice) ? (
                            <div className="absolute top-2 left-2 bg-red-500 text-white text-[8px] font-bold px-2 py-0.5 rounded-full uppercase z-10">
                              {product.offerLabel || 'Offer'}
                            </div>
                          ) : (
                            <div className="absolute top-2 left-2 bg-orange-500 text-white text-[8px] font-bold px-2 py-0.5 rounded-full uppercase z-10">
                              Hot
                            </div>
                          )}
                          <div className="absolute bottom-2 left-2 bg-white/80 backdrop-blur-sm text-gray-600 text-[8px] font-bold px-2 py-0.5 rounded-full uppercase border border-gray-100 z-10">
                            {product.category}
                          </div>
                          <WishlistButton user={user} productId={product.id} className="absolute top-2 right-2 w-7 h-7 rounded-lg z-10" />
                        </div>
                        <h4 className="font-bold text-[11px] text-[#1A1A1A] line-clamp-1">{product.name}</h4>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="font-bold text-[#66D2A4] text-xs">₹{product.discountPrice || product.price}</span>
                          {product.discountPrice && (
                            <span className="text-[9px] text-gray-400 line-through">₹{product.price}</span>
                          )}
                        </div>
                        <div className="mt-1 min-h-[16px] flex items-center">
                          <MultiSavingsBadge product={product} variant="compact" />
                        </div>
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
                <span className="text-xs text-gray-400 font-medium">{locationFilteredProducts.length} items</span>
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
                    {locationFilteredProducts.length === 0 && (
                      <div className="col-span-2 py-8 text-center bg-white rounded-3xl p-6 border border-gray-100 shadow-2xs">
                        <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-3 text-emerald-600">
                          <MapPin size={24} />
                        </div>
                        <p className="text-sm font-bold text-gray-800">
                          {deliveryLocation ? `No products deliverable to ${deliveryLocation.label}` : 'No products found'}
                        </p>
                        <p className="text-xs text-gray-400 mt-1 mb-4">
                          {deliveryLocation ? 'Try changing your pincode or view products available Pan-India' : 'Check back later for fresh stock.'}
                        </p>
                        {deliveryLocation && (
                          <button 
                            onClick={() => onSelectDeliveryLocation?.(null)}
                            className="bg-[#66D2A4] hover:bg-[#55b88e] text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs transition-colors"
                          >
                            View All-India Products
                          </button>
                        )}
                      </div>
                    )}
                    {paginatedProducts.map((product) => (
                      <ProductCard key={product.id} product={product} user={user} onAddToCart={onAddToCart} navigate={navigate} />
                    ))}
                  </>
                )}
              </div>

              {/* Pagination UI */}
              {!loading && locationFilteredProducts.length > itemsPerPage && (
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

      <LocationSelectorModal 
        isOpen={showLocationModal} 
        onClose={() => setShowLocationModal(false)} 
        currentLocation={deliveryLocation || null} 
        onSelectLocation={(loc) => onSelectDeliveryLocation?.(loc)} 
        user={user} 
      />
    </div>
  );
};

const ProductCard: React.FC<{ 
  product: Product, 
  user: User | null, 
  onAddToCart: (p: Product, quantity?: number, variant?: ProductVariant) => void, 
  navigate: any 
}> = ({ product, user, onAddToCart, navigate }) => {
  const sortedVariants = useMemo(() => {
    return product.hasVariants && product.variants ? sortVariantsByWeight(product.variants) : [];
  }, [product.hasVariants, product.variants]);

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(() => {
    return sortedVariants.length > 0 ? sortedVariants[0] : null;
  });

  useEffect(() => {
    if (sortedVariants.length > 0) {
      setSelectedVariant(prev => {
        if (!prev) return sortedVariants[0];
        const match = sortedVariants.find(v => v.id === prev.id || v.weight === prev.weight);
        return match || sortedVariants[0];
      });
    } else {
      setSelectedVariant(null);
    }
  }, [sortedVariants]);

  const effectivePrice = selectedVariant 
    ? (selectedVariant.discountPrice || selectedVariant.price)
    : (product.discountPrice || product.price);

  const effectiveOriginalPrice = selectedVariant
    ? (selectedVariant.discountPrice ? selectedVariant.price : null)
    : (product.discountPrice ? product.price : null);

  const effectiveStock = selectedVariant?.stock !== undefined 
    ? selectedVariant.stock 
    : product.stock;

  return (
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
        {(product.offerLabel || product.discountPrice) && (
          <div className="absolute top-2 left-2 bg-red-500 text-white text-[8px] font-bold px-2 py-0.5 rounded-full uppercase z-10">
            {product.offerLabel || 'Offer'}
          </div>
        )}
        <div className="absolute bottom-2 left-2 bg-white/80 backdrop-blur-sm text-gray-600 text-[8px] font-bold px-2 py-0.5 rounded-full uppercase border border-gray-100 z-10">
          {product.category}
        </div>
        <WishlistButton user={user} productId={product.id} className="absolute top-2 right-2 w-8 h-8 rounded-xl z-10" />
      </div>
      <h4 className="font-bold text-sm text-[#1A1A1A] mb-1 line-clamp-1">{product.name}</h4>
      <p className={cn(
        "text-[10px] mb-1 font-bold",
        effectiveStock > 0 ? "text-gray-400" : "text-red-500"
      )}>
        {effectiveStock > 0 ? `${effectiveStock} in stock` : "Out of Stock"}
      </p>

      {/* Weight Variant quick chips if product has multiple weights */}
      {product.hasVariants && sortedVariants.length > 0 && (
        <div className="mb-2 flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5" onClick={(e) => e.stopPropagation()}>
          {sortedVariants.map((v) => {
            const isSelected = (selectedVariant?.id && selectedVariant.id === v.id) || selectedVariant?.weight === v.weight;
            return (
              <button
                key={v.id || v.weight}
                type="button"
                onClick={() => setSelectedVariant(v)}
                className={cn(
                  "text-[9px] font-extrabold px-2 py-0.5 rounded-lg border transition-all shrink-0 cursor-pointer",
                  isSelected
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                    : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-emerald-50 hover:border-emerald-200"
                )}
              >
                {v.weight}
              </button>
            );
          })}
        </div>
      )}

      <div className="mb-2 min-h-[18px] flex items-center">
        <MultiSavingsBadge product={{
          ...product,
          price: selectedVariant ? selectedVariant.price : product.price,
          discountPrice: selectedVariant ? selectedVariant.discountPrice : product.discountPrice
        }} variant="pill" />
      </div>
      <div className="flex justify-between items-center mt-auto">
        <div className="flex flex-col">
          <div className="flex items-center gap-1">
            <span className="font-bold text-[#66D2A4]">₹{effectivePrice}</span>
            {selectedVariant && (
              <span className="text-[9px] font-bold text-emerald-800 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-100">
                {selectedVariant.weight}
              </span>
            )}
          </div>
          {effectiveOriginalPrice && (
            <span className="text-[10px] text-gray-400 line-through">₹{effectiveOriginalPrice}</span>
          )}
        </div>
        <button 
          disabled={effectiveStock <= 0}
          onClick={(e) => {
            e.stopPropagation();
            if (effectiveStock > 0) onAddToCart(product, 1, selectedVariant || undefined);
          }}
          className={cn(
            "text-white p-2 rounded-xl transition-colors",
            effectiveStock > 0 ? "bg-[#66D2A4] hover:bg-[#55b88e]" : "bg-gray-300 cursor-not-allowed"
          )}
        >
          <Plus size={16} />
        </button>
      </div>
    </motion.div>
  );
};
