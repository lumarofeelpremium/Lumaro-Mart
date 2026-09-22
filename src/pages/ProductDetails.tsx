import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Star, Plus, Minus, ShoppingCart, MessageSquare, Send, Loader2, Heart, Zap, Sparkles, Check } from 'lucide-react';
import { Button, Input, Skeleton } from '../components/ui/Base';
import { Product, Review, User } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
import { WishlistButton } from '../components/WishlistButton';
import { MultiSavingsBadge } from '../components/MultiSavingsBadge';
import { getMultiQuantitySavings } from '../lib/savings-utils';
import { cacheUtils } from '../lib/cache-utils';

// Mock products for fallback if not in Firestore
const MOCK_PRODUCTS: Product[] = [
  {
    id: 'p1',
    name: 'Organic Avocados',
    price: 399,
    stock: 25,
    category: 'Fresh Produce',
    image: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?auto=format&fit=crop&q=80&w=400',
    description: 'Creamy, rich organic avocados perfect for toast, salads, or guacamole. Sourced from local sustainable farms.'
  },
  {
    id: 'p2',
    name: 'Premium Coffee Beans',
    price: 850,
    stock: 15,
    category: 'Pantry',
    image: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&q=80&w=400',
    description: 'Medium roast premium Arabica beans with notes of chocolate and caramel. Freshly roasted and packed.'
  },
  {
    id: 'p3',
    name: 'Artisan Sourdough',
    price: 245,
    stock: 10,
    category: 'Bakery',
    image: 'https://images.unsplash.com/photo-1585478259715-876acc5be8eb?auto=format&fit=crop&q=80&w=400',
    description: 'Traditional sourdough bread with a crispy crust and soft, tangy interior. Baked fresh daily.'
  },
  {
    id: 'p4',
    name: 'Mixed Berry Granola',
    price: 599,
    stock: 30,
    category: 'Snacks',
    image: 'https://images.unsplash.com/photo-1517093157656-b9424f461507?auto=format&fit=crop&q=80&w=400',
    description: 'Crunchy granola clusters with dried strawberries, blueberries, and raspberries. High in fiber and protein.'
  },
];

export const ProductDetails = ({ 
  user, 
  onAddToCart 
}: { 
  user: User | null, 
  onAddToCart: (p: Product, quantity?: number) => void 
}) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [newReview, setNewReview] = useState({ rating: 0, comment: '' });
  const [justAdded, setJustAdded] = useState(false);
  const [addedCount, setAddedCount] = useState(0);
  const reviewsRef = useRef<HTMLDivElement>(null);

  const scrollToReviews = () => {
    reviewsRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load cached product and reviews on mount
  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTo(0, 0);
    document.body.scrollTo(0, 0);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const cachedProduct = cacheUtils.getItem(`product_detail_${id}`);
    if (cachedProduct) {
      try {
        setProduct(JSON.parse(cachedProduct));
        setLoading(false);
      } catch (e) {
        console.error('Error parsing product cache', e);
      }
    }

    const cachedReviews = cacheUtils.getItem(`product_reviews_${id}`);
    if (cachedReviews) {
      try {
        setReviews(JSON.parse(cachedReviews));
      } catch (e) {
        console.error('Error parsing reviews cache', e);
      }
    }
  }, [id]);

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;
      
      // 1. Check mock data first for instant UI
      const mockProduct = MOCK_PRODUCTS.find(p => p.id === id);
      if (mockProduct && !product) {
        setProduct(mockProduct);
        setLoading(false);
      }

      try {
        // 2. Fetch from Firestore in background to get latest info
        const productDoc = await getDoc(doc(db, 'products', id));
        if (productDoc.exists()) {
          const prodData = { id: productDoc.id, ...productDoc.data() } as Product;
          setProduct(prodData);
          cacheUtils.setItem(`product_detail_${id}`, prodData);
          setLoading(false);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `products/${id}`);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  useEffect(() => {
    if (!id) return;

    // Try to get reviews. If the ordered query fails (likely due to missing index),
    // we fall back to a simple query and sort in memory.
    const reviewsCollection = collection(db, 'reviews');
    const simpleQuery = query(reviewsCollection, where('productId', '==', id));
    
    const unsubscribe = onSnapshot(simpleQuery, (snapshot) => {
      const reviewsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Review[];
      
      // Sort in memory to avoid "Missing Index" errors in Firestore
      const sortedReviews = reviewsData.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : Date.now();
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : Date.now();
        return dateB - dateA;
      });
      
      setReviews(sortedReviews);
      if (id) {
        cacheUtils.setItem(`product_reviews_${id}`, sortedReviews);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'reviews');
    });

    return () => unsubscribe();
  }, [id]);

  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate('/login');
      return;
    }

    setSubmittingReview(true);
    try {
      if (newReview.rating === 0) {
        alert("Please select a star rating before submitting.");
        return;
      }
      await addDoc(collection(db, 'reviews'), {
        productId: id,
        userId: user.uid,
        userName: user.displayName || 'Anonymous User',
        rating: newReview.rating,
        comment: newReview.comment.trim(),
        createdAt: serverTimestamp()
      });
      setNewReview({ rating: 0, comment: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'reviews');
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FBF9] pb-32">
        <div className="bg-white px-6 pt-12 pb-6 rounded-b-[40px] shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <Skeleton className="w-10 h-10 rounded-xl" />
            <Skeleton className="w-16 h-6 rounded-full" />
          </div>
          <Skeleton className="aspect-square rounded-[40px] mb-6" />
          <div className="flex justify-between items-start mb-2">
            <div className="space-y-2">
              <Skeleton className="w-48 h-8 rounded-lg" />
              <Skeleton className="w-24 h-6 rounded-lg" />
            </div>
            <Skeleton className="w-24 h-12 rounded-2xl" />
          </div>
          <div className="space-y-2 mb-6">
            <Skeleton className="w-full h-4 rounded-lg" />
            <Skeleton className="w-full h-4 rounded-lg" />
            <Skeleton className="w-2/3 h-4 rounded-lg" />
          </div>
          <div className="flex gap-4">
            <Skeleton className="flex-grow h-16 rounded-3xl" />
            <Skeleton className="w-16 h-16 rounded-3xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FBF9] px-6 text-center">
        <h2 className="text-2xl font-bold text-[#1A1A1A] mb-4">Product not found</h2>
        <Button onClick={() => navigate('/')}>Back to Home</Button>
      </div>
    );
  }

  const averageRating = reviews.length > 0 
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
    : '0.0';

  const savingsInfo = product ? getMultiQuantitySavings(product, quantity) : null;

  return (
    <div className="min-h-screen bg-[#F8FBF9] pb-32">
      {/* Header */}
      <div className="bg-white px-6 pt-12 pb-6 rounded-b-[40px] shadow-sm relative z-10">
        <div className="flex items-center justify-between mb-6">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 bg-[#F0F7F4] rounded-xl flex items-center justify-center text-gray-600"
          >
            <ChevronLeft size={20} />
          </button>
          <button 
            onClick={scrollToReviews}
            className="flex items-center gap-1 bg-[#F0F7F4] px-3 py-1 rounded-full hover:bg-[#E5F1EB] transition-colors"
          >
            <Star size={14} className="text-yellow-400 fill-yellow-400" />
            <span className="text-xs font-bold text-gray-600">{averageRating}</span>
          </button>
        </div>
        
        <div className="aspect-square rounded-[40px] overflow-hidden bg-gray-100 mb-6 shadow-inner flex items-center justify-center">
          {product.image ? (
            <img 
              src={product.image} 
              alt={product.name} 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <ShoppingCart size={48} className="text-gray-200" />
          )}
        </div>

        <div className="flex justify-between items-start mb-2">
          <div>
            <div className="inline-block bg-[#F0F7F4] text-[#66D2A4] text-[10px] font-bold px-2 py-0.5 rounded-full uppercase mb-1">
              {product.category}
            </div>
            <h1 className="text-2xl font-extrabold text-[#1A1A1A]">{product.name}</h1>
            <div className="flex items-center gap-3">
              <p className="text-[#66D2A4] font-bold text-xl">₹{product.discountPrice || product.price}</p>
              {product.discountPrice && (
                <p className="text-gray-400 text-sm line-through">₹{product.price}</p>
              )}
              {(product.offerLabel || product.discountPrice) && (
                <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                  {product.offerLabel || 'Special Offer'}
                </span>
              )}
              {product.stock <= 0 && (
                <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-1 rounded-full uppercase">
                  Out of Stock
                </span>
              )}
            </div>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <MultiSavingsBadge product={product} variant="chip" />
            </div>
          </div>
          <div className={cn(
            "flex items-center gap-3 bg-[#F0F7F4] rounded-2xl p-1",
            product.stock <= 0 && "opacity-50 pointer-events-none"
          )}>
            <button 
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              disabled={product.stock <= 0}
              className="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-[#66D2A4]"
            >
              <Minus size={18} />
            </button>
            <span className="font-bold w-6 text-center text-lg">{quantity}</span>
            <button 
              onClick={() => setQuantity(quantity + 1)}
              disabled={product.stock <= 0}
              className="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-[#66D2A4]"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>

        {/* Multi-Quantity Savings Interactive Helper Card */}
        {savingsInfo && savingsInfo.hasSavings && product.stock >= 2 && (
          <div className="mb-6 p-3.5 rounded-3xl bg-gradient-to-br from-emerald-50/90 via-teal-50/70 to-emerald-50/90 border border-emerald-200/80 shadow-2xs">
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-1.5 text-emerald-800 font-extrabold text-xs">
                <Zap size={14} className="fill-emerald-600 text-emerald-600" />
                <span>Multi-Quantity Savings Offer</span>
              </div>
              <span className="text-[10px] font-extrabold text-emerald-700 bg-white/95 border border-emerald-200 px-2.5 py-0.5 rounded-full shadow-2xs">
                Save up to {savingsInfo.percentSaved}%
              </span>
            </div>

            {/* Quick Bundle Quantity Selectors */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setQuantity(1)}
                className={cn(
                  "p-2.5 rounded-2xl border text-center transition-all flex flex-col items-center justify-center cursor-pointer",
                  quantity === 1 
                    ? "bg-white border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs" 
                    : "bg-white/70 border-gray-200/80 hover:bg-white"
                )}
              >
                <span className="text-[10px] text-gray-500 font-bold">1 Item</span>
                <span className="text-xs font-extrabold text-[#1A1A1A]">₹{savingsInfo.unitPrice}</span>
                <span className="text-[9px] text-gray-400">Regular</span>
              </button>

              <button
                type="button"
                onClick={() => setQuantity(2)}
                className={cn(
                  "p-2.5 rounded-2xl border text-center transition-all flex flex-col items-center justify-center relative cursor-pointer",
                  quantity === 2 
                    ? "bg-white border-emerald-500 ring-2 ring-emerald-500/30 shadow-xs" 
                    : "bg-white/70 border-emerald-200/90 hover:bg-white"
                )}
              >
                <div className="absolute -top-2 bg-emerald-600 text-white text-[8px] font-extrabold px-2 py-0.2 rounded-full uppercase tracking-tighter shadow-2xs">
                  Popular
                </div>
                <span className="text-[10px] text-emerald-800 font-bold">2 Items</span>
                <span className="text-xs font-extrabold text-emerald-700">₹{savingsInfo.unitPrice * 2}</span>
                <span className="text-[9px] font-extrabold text-emerald-600">Save ₹{savingsInfo.unitSaving * 2}</span>
              </button>

              {product.stock >= 3 ? (
                <button
                  type="button"
                  onClick={() => setQuantity(3)}
                  className={cn(
                    "p-2.5 rounded-2xl border text-center transition-all flex flex-col items-center justify-center relative cursor-pointer",
                    quantity === 3 
                      ? "bg-white border-teal-500 ring-2 ring-teal-500/30 shadow-xs" 
                      : "bg-white/70 border-teal-200/90 hover:bg-white"
                  )}
                >
                  <div className="absolute -top-2 bg-teal-600 text-white text-[8px] font-extrabold px-2 py-0.2 rounded-full uppercase tracking-tighter shadow-2xs">
                    Best Value
                  </div>
                  <span className="text-[10px] text-teal-800 font-bold">3 Items</span>
                  <span className="text-xs font-extrabold text-teal-700">₹{savingsInfo.unitPrice * 3}</span>
                  <span className="text-[9px] font-extrabold text-teal-600">Save ₹{savingsInfo.unitSaving * 3}</span>
                </button>
              ) : (
                <div className="p-2.5 rounded-2xl border border-dashed border-gray-200 flex flex-col items-center justify-center opacity-50 bg-white/40">
                  <span className="text-[10px] text-gray-400 font-medium">Limited Stock</span>
                </div>
              )}
            </div>

            {/* Dynamic Savings Feedback */}
            <div className="mt-2.5 pt-2 border-t border-emerald-200/60 flex items-center justify-between text-[11px]">
              <span className="text-gray-600 font-medium">
                {quantity === 1 ? (
                  <span>💡 Add 1 more to save <strong>₹{savingsInfo.unitSaving * 2}</strong> total!</span>
                ) : (
                  <span className="text-emerald-800 font-bold flex items-center gap-1">
                    <Sparkles size={12} className="text-emerald-600" />
                    You save ₹{savingsInfo.unitSaving * quantity} with {quantity} items!
                  </span>
                )}
              </span>
              <span className="font-extrabold text-[#1A1A1A]">Total: ₹{savingsInfo.unitPrice * quantity}</span>
            </div>
          </div>
        )}
        
        <p className="text-gray-400 text-sm leading-relaxed mb-6">
          {product.description || "No description available for this product."}
          {product.stock > 0 && (
            <span className="block mt-1 font-bold text-[#66D2A4]">
              {product.stock} items left in stock
            </span>
          )}
        </p>

        <div className="flex gap-4">
          <Button 
            className={cn(
              "flex-grow py-5 rounded-3xl shadow-lg flex items-center justify-center gap-3 text-lg transition-all",
              product.stock > 0 
                ? (justAdded ? "bg-[#55b88e] text-white shadow-[#66D2A4]/30 scale-[1.01]" : "shadow-[#66D2A4]/20") 
                : "bg-gray-300 shadow-none cursor-not-allowed"
            )}
            disabled={product.stock <= 0}
            onClick={() => {
              if (product.stock > 0) {
                onAddToCart(product, quantity);
                setAddedCount(quantity);
                setJustAdded(true);
                setTimeout(() => {
                  setJustAdded(false);
                }, 1800);
              }
            }}
          >
            {justAdded ? (
              <span className="flex items-center gap-2">
                <Check size={22} className="text-white animate-pulse" /> Added ({addedCount}) to Cart
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <ShoppingCart size={22} /> {product.stock > 0 ? "Add to Cart" : "Out of Stock"}
              </span>
            )}
          </Button>
          <WishlistButton user={user} productId={product.id} className="w-16 h-16 rounded-3xl" />
        </div>
      </div>

      {/* Reviews Section */}
      <div ref={reviewsRef} className="px-6 mt-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-[#1A1A1A] flex items-center gap-2">
            <MessageSquare size={20} className="text-[#66D2A4]" />
            Reviews ({reviews.length})
          </h3>
        </div>

        {/* Add Review Form */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-50 mb-8">
          <h4 className="font-bold text-[#1A1A1A] mb-4">Write a Review</h4>
          <div className="flex gap-2 mb-4">
            {[1, 2, 3, 4, 5].map((star) => (
              <button 
                key={star}
                onClick={() => setNewReview({ ...newReview, rating: star })}
                className="transition-transform active:scale-90"
              >
                <Star 
                  size={24} 
                  className={cn(
                    "transition-colors",
                    star <= newReview.rating ? "text-yellow-400 fill-yellow-400" : "text-gray-200"
                  )} 
                />
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input 
              placeholder="Share your experience..."
              value={newReview.comment}
              onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
              className="bg-[#F0F7F4] border-none"
            />
            <Button 
              onClick={handleAddReview}
              disabled={submittingReview}
              className="px-4 rounded-2xl"
            >
              {submittingReview ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
            </Button>
          </div>
        </div>

        {/* Reviews List */}
        <div className="space-y-4">
          {reviews.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-gray-200">
              <p className="text-gray-400 text-sm">No reviews yet. Be the first to review!</p>
            </div>
          ) : (
            reviews.map((review) => (
              <motion.div 
                key={review.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl p-5 shadow-sm border border-gray-50"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h5 className="font-bold text-[#1A1A1A] text-sm">{review.userName}</h5>
                    <div className="flex gap-0.5 mt-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star 
                          key={star} 
                          size={10} 
                          className={star <= review.rating ? "text-yellow-400 fill-yellow-400" : "text-gray-200"} 
                        />
                      ))}
                    </div>
                  </div>
                  <span className="text-[10px] text-gray-400">
                    {review.createdAt?.toDate ? review.createdAt.toDate().toLocaleDateString() : 'Just now'}
                  </span>
                </div>
                {review.comment && (
                  <p className="text-gray-600 text-sm leading-relaxed">{review.comment}</p>
                )}
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
