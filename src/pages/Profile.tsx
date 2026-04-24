import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, User as UserIcon, Settings, LogOut, ShieldCheck, Package, Users, ChevronRight, Clock, MapPin, X, Camera, Mail, Phone, Home, Hash, Loader2, Star, Heart, Bell, MessageCircle, Headset, LifeBuoy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button, Input } from '../components/ui/Base';
import { User, Order, AppSettings } from '../types';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, getDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
import { compressImage } from '../lib/utils';

export const Profile = ({ user, setUser, onLogout }: { user: User | null, setUser: (u: User | null) => void, onLogout: () => void }) => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editForm, setEditForm] = useState({
    displayName: user?.displayName || '',
    email: user?.email || '',
    phoneNumber: user?.phoneNumber || '',
    address: user?.address || '',
    pincode: user?.pincode || '',
    photoURL: user?.photoURL || ''
  });

  useEffect(() => {
    if (user) {
      setEditForm({
        displayName: user.displayName || '',
        email: user.email || '',
        phoneNumber: user.phoneNumber || '',
        address: user.address || '',
        pincode: user.pincode || '',
        photoURL: user.photoURL || ''
      });
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'orders'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Order[];

      // Sort client-side to avoid index requirement
      ordersData.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });

      setOrders(ordersData);
      setUnreadCount(ordersData.filter(o => !o.viewed).length);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      
      // Load read IDs from localStorage
      const saved = localStorage.getItem('read_notifications');
      let readIds: string[] = [];
      if (saved) {
        try {
          readIds = JSON.parse(saved);
        } catch (e) {
          console.error('Error parsing read notifications', e);
        }
      }
      
      const unread = notifs.filter(n => !readIds.includes(n.id)).length;
      setUnreadNotifCount(unread);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'global'));
        if (settingsDoc.exists()) {
          setAppSettings(settingsDoc.data() as AppSettings);
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'global'));
        if (settingsDoc.exists()) {
          setAppSettings(settingsDoc.data() as AppSettings);
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      }
    };
    fetchSettings();
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUpdating(true);
      try {
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = reader.result as string;
          // Compress image to ensure it stays well under 1MB
          const compressed = await compressImage(base64, 400, 400, 0.6);
          setEditForm(prev => ({ ...prev, photoURL: compressed }));
          setIsUpdating(false);
        };
        reader.readAsDataURL(file);
      } catch (error) {
        console.error("Error processing profile image:", error);
        alert("Failed to process image.");
        setIsUpdating(false);
      }
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsUpdating(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, editForm);
      
      // Update local state in App.tsx
      setUser({
        ...user,
        ...editForm
      });
      
      setShowEditProfile(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setIsUpdating(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F8FBF9] flex flex-col items-center justify-center px-8 text-center">
        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-sm">
          <UserIcon size={40} className="text-gray-200" />
        </div>
        <h2 className="text-2xl font-bold text-[#1A1A1A] mb-2">Join Lumaro Mart</h2>
        <p className="text-gray-400 mb-8">Login to manage your orders and profile</p>
        <div className="w-full space-y-4">
          <Button className="w-full py-4 rounded-2xl" onClick={() => navigate('/login')}>Login</Button>
          <Button variant="secondary" className="w-full py-4 rounded-2xl" onClick={() => navigate('/signup')}>Sign Up</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FBF9] pb-32">
      <div className="bg-white px-6 pt-12 pb-8 rounded-b-[40px] shadow-sm mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-20 h-20 rounded-3xl bg-[#66D2A4]/10 flex items-center justify-center text-[#66D2A4] overflow-hidden">
            {user.photoURL ? (
              <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <UserIcon size={40} />
            )}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[#1A1A1A]">{user.displayName}</h2>
            <p className="text-gray-400 text-sm">{user.email}</p>
            <div className="flex gap-2 mt-1">
              {user.role === 'admin' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  <ShieldCheck size={10} /> Admin
                </span>
              )}
              {user.phoneNumber && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  <Phone size={10} /> {user.phoneNumber}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Loyalty Points Card */}
        <div className="bg-gradient-to-br from-[#66D2A4] to-[#4FB98F] rounded-[32px] p-6 text-white shadow-lg shadow-[#66D2A4]/20">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                <Star size={20} fill="currentColor" />
              </div>
              <span className="text-sm font-bold uppercase tracking-wider opacity-90">Loyalty Points</span>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black">{user.loyaltyPoints || 0}</span>
            <span className="text-sm font-medium opacity-80">Points Available</span>
          </div>
          <p className="text-[10px] mt-4 opacity-70 font-medium">Earn 5% points on every order above ₹100</p>
        </div>
      </div>

      <div className="px-6 space-y-4">
        <div className="bg-white rounded-3xl p-2 shadow-sm border border-gray-50">
          <ProfileItem 
            icon={Package} 
            label="My Orders" 
            onClick={() => navigate('/my-orders')} 
            badge={unreadCount > 0 ? unreadCount : undefined}
          />

          <ProfileItem 
            icon={Bell} 
            label="Updates & Offers" 
            onClick={() => navigate('/notifications')} 
            badge={unreadNotifCount > 0 ? unreadNotifCount : undefined}
          />
          
          <ProfileItem 
            icon={Heart} 
            label="My Wishlist" 
            onClick={() => navigate('/wishlist')} 
          />
          
          <ProfileItem icon={Settings} label="Edit Profile" onClick={() => setShowEditProfile(true)} />
          
          {appSettings?.supportEnabled && appSettings.supportNumber && (
            <>
              <div className="h-px bg-gray-50 mx-4" />
              <div className="p-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 ml-2">Need help?</p>
                <div 
                  onClick={() => {
                    const msg = encodeURIComponent(`Hi Lumaro Mart Support, I need help with...`);
                    window.open(`https://wa.me/${appSettings.supportNumber}?text=${msg}`, '_blank');
                  }}
                  className="relative overflow-hidden p-5 bg-gradient-to-br from-green-50 to-white rounded-[32px] border border-green-100 group cursor-pointer active:scale-[0.98] transition-all"
                >
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="p-3 bg-green-500 text-white rounded-2xl shadow-lg shadow-green-500/30 group-hover:rotate-12 transition-transform">
                      <MessageCircle size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold text-[#1A1A1A]">WhatsApp Support</h4>
                      <p className="text-[10px] text-gray-400 font-medium">Quick response for all queries</p>
                    </div>
                    <div className="ml-auto p-2 bg-white rounded-xl text-green-500 shadow-sm border border-green-50 group-hover:translate-x-1 transition-transform">
                      <ChevronRight size={18} />
                    </div>
                  </div>
                  {/* Decorative element */}
                  <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-green-100/40 rounded-full blur-2xl" />
                  <div className="absolute top-0 right-0 p-2 opacity-5">
                    <MessageCircle size={80} />
                  </div>
                </div>
              </div>
            </>
          )}

          {user.role === 'admin' && (
            <>
              <div className="h-px bg-gray-50 mx-4" />
              <ProfileItem icon={ShieldCheck} label="Admin Dashboard" onClick={() => navigate('/admin')} color="text-purple-600" />
            </>
          )}
          <div className="h-px bg-gray-50 mx-4" />
          <ProfileItem icon={LogOut} label="Logout" onClick={onLogout} color="text-red-500" />
        </div>
      </div>

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {showEditProfile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-white w-full max-w-md rounded-t-[40px] sm:rounded-[40px] p-8 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold text-[#1A1A1A]">Edit Profile</h2>
                <button onClick={() => setShowEditProfile(false)} className="p-2 bg-gray-100 rounded-full text-gray-500">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-6">
                <div className="flex flex-col items-center mb-6">
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-[32px] bg-[#F0F7F4] flex items-center justify-center text-[#66D2A4] overflow-hidden border-4 border-white shadow-sm">
                      {editForm.photoURL ? (
                        <img src={editForm.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <UserIcon size={40} />
                      )}
                    </div>
                    <button 
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute -bottom-2 -right-2 bg-[#66D2A4] text-white p-2 rounded-xl shadow-lg border-2 border-white hover:scale-110 transition-transform"
                    >
                      <Camera size={16} />
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleImageUpload} 
                      className="hidden" 
                      accept="image/*"
                    />
                  </div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-4">Profile Photo</p>
                  <p className="text-[9px] text-gray-400 mt-1 font-medium">Auto-optimized • Format: JPG, PNG</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Full Name</label>
                    <Input 
                      placeholder="Your Name"
                      value={editForm.displayName}
                      onChange={(e) => setEditForm(prev => ({ ...prev, displayName: e.target.value }))}
                      icon={<UserIcon size={18} />}
                      className="bg-[#F0F7F4] border-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Gmail Address</label>
                    <Input 
                      placeholder="Your Email"
                      value={editForm.email}
                      onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                      icon={<Mail size={18} />}
                      className="bg-[#F0F7F4] border-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Mobile Number</label>
                    <Input 
                      placeholder="Your Phone"
                      value={editForm.phoneNumber}
                      onChange={(e) => setEditForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
                      icon={<Phone size={18} />}
                      className="bg-[#F0F7F4] border-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Full Address</label>
                    <Input 
                      placeholder="Your Address"
                      value={editForm.address}
                      onChange={(e) => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                      icon={<Home size={18} />}
                      className="bg-[#F0F7F4] border-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Pincode</label>
                    <Input 
                      placeholder="Your Pincode"
                      value={editForm.pincode}
                      onChange={(e) => setEditForm(prev => ({ ...prev, pincode: e.target.value }))}
                      icon={<Hash size={18} />}
                      className="bg-[#F0F7F4] border-none"
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <Button 
                    type="submit" 
                    className="w-full py-4 rounded-2xl flex items-center justify-center gap-2"
                    disabled={isUpdating}
                  >
                    {isUpdating ? <Loader2 className="animate-spin" size={20} /> : 'Save Changes'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ProfileItem = ({ icon: Icon, label, onClick, color = "text-gray-700", badge }: any) => (
  <button 
    onClick={onClick}
    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors rounded-2xl"
  >
    <div className="flex items-center gap-4">
      <div className={cn("p-2 rounded-xl bg-gray-50", color.replace('text-', 'bg-').replace('500', '50').replace('600', '50'))}>
        <Icon size={20} className={color} />
      </div>
      <span className={cn("font-semibold", color)}>{label}</span>
    </div>
    <div className="flex items-center gap-2">
      {badge && (
        <span className="bg-[#66D2A4] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
          {badge}
        </span>
      )}
      <ChevronRight size={20} className="text-gray-300" />
    </div>
  </button>
);

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
