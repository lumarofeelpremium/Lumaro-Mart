import React, { useState, useEffect } from 'react';
import { ChevronLeft, User as UserIcon, Mail, Phone, Lock, Loader2, KeyRound, CheckCircle2 } from 'lucide-react';
import { Button, Input } from '../components/ui/Base';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../firebase';
import { 
  updateProfile,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateEmail,
  updatePassword
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs, increment, addDoc, limit } from 'firebase/firestore';
import { User } from '../types';

export const Signup = ({ setUser, initialMode = 'signup' }: { setUser: (u: User | null) => void, initialMode?: 'login' | 'signup' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/profile';
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [referralCode, setReferralCode] = useState('');

  const sanitizePhoneNumber = (rawPhone: string) => {
    let clean = (rawPhone || '').replace(/\D/g, '');
    if (clean.length === 12 && clean.startsWith('91')) {
      clean = clean.slice(2);
    } else if (clean.length === 11 && clean.startsWith('0')) {
      clean = clean.slice(1);
    }
    return clean.slice(0, 10);
  };

  const getSyntheticEmail = (phone: string) => {
    const cleanPhone = sanitizePhoneNumber(phone);
    return `${cleanPhone}@lumaro.com`;
  };

  const getSecurePassword = (pin: string) => {
    // Firebase requires at least 6 characters. 
    // We append a secret suffix to the 4-digit PIN.
    return `${pin}LUMARO`;
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const cleanPhone = sanitizePhoneNumber(phoneNumber);

    // Mobile number is strictly mandatory
    if (!cleanPhone || cleanPhone.trim() === '') {
      setError('मोबाइल नंबर डालना अनिवार्य (Mandatory) है। बिना मोबाइल नंबर के साइन अप नहीं किया जा सकता।');
      return;
    }

    if (cleanPhone.length !== 10) {
      setError('कृपया पूरा 10 अंकों का मोबाइल नंबर दर्ज करें (Enter valid 10-digit mobile number)');
      return;
    }

    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      setError('कृपया सही भारतीय मोबाइल नंबर दर्ज करें (जो 6, 7, 8 या 9 से शुरू होता हो)');
      return;
    }

    if (mode === 'signup') {
      if (!fullName.trim()) {
        setError('कृपया अपना पूरा नाम दर्ज करें (Please enter your full name)');
        return;
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        setError('Please enter a valid email address');
        return;
      }
      if (!password || !/^\d{4}$/.test(password)) {
        setError('Please set a 4-digit numeric password (PIN)');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      handleSignup(cleanPhone);
    } else {
      if (!password || !/^\d{4}$/.test(password)) {
        setError('Please enter your 4-digit numeric password (PIN)');
        return;
      }
      handleLogin(cleanPhone);
    }
  };

  const handleLogin = async (validPhone?: string) => {
    const cleanPhone = validPhone || sanitizePhoneNumber(phoneNumber);
    if (!cleanPhone || cleanPhone.length !== 10) {
      setError('कृपया अपना 10 अंकों का मोबाइल नंबर दर्ज करें');
      return;
    }

    setIsLoading(true);
    try {
      const authEmail = getSyntheticEmail(cleanPhone);
      const securePassword = getSecurePassword(password);
      const userCredential = await signInWithEmailAndPassword(auth, authEmail, securePassword);
      const firebaseUser = userCredential.user;
      
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      if (userDoc.exists()) {
        let userData = {
          uid: firebaseUser.uid,
          ...userDoc.data()
        } as User;

        // Force admin role for the specific mobile number
        if (cleanPhone.includes('7830948738') && userData.role !== 'admin') {
          await updateDoc(doc(db, 'users', firebaseUser.uid), { role: 'admin' });
          userData.role = 'admin';
        }

        // Always store or update the password PIN on login in case it was missing
        if (userData.password !== password) {
          await updateDoc(doc(db, 'users', firebaseUser.uid), { password: password });
          userData.password = password;
        }

        setUser(userData);
        navigate(from);
      } else {
        setError('User data not found. Please sign up.');
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Invalid mobile number or password.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Password login is not enabled in Firebase Console.');
      } else {
        setError(err.message || 'Login failed.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (validPhone?: string) => {
    const cleanPhone = validPhone || sanitizePhoneNumber(phoneNumber);
    if (!cleanPhone || cleanPhone.length !== 10) {
      setError('मोबाइल नंबर डालना अनिवार्य (Mandatory) है।');
      return;
    }

    setIsLoading(true);
    try {
      const authEmail = getSyntheticEmail(cleanPhone);
      const securePassword = getSecurePassword(password);

      // Verify referral code if supplied
      let referrerUid = '';
      const enteredReferral = referralCode.trim().toUpperCase();
      if (enteredReferral) {
        try {
          // Check dedicated referral_codes index first (public & instant)
          const refDoc = await getDoc(doc(db, 'referral_codes', enteredReferral));
          if (refDoc.exists()) {
            const rData = refDoc.data();
            if (rData.phoneNumber === cleanPhone || rData.uid === auth.currentUser?.uid) {
              setError('You cannot use your own referral code!');
              setIsLoading(false);
              return;
            }
            referrerUid = rData.uid;
          } else {
            // Fallback check
            console.log("Referral code not in registry, will record code as entered.");
          }
        } catch (refErr) {
          console.warn("Referral code verification check bypassed:", refErr);
        }
      }

      const userCredential = await createUserWithEmailAndPassword(auth, authEmail, securePassword);
      const firebaseUser = userCredential.user;

      await updateProfile(firebaseUser, {
        displayName: fullName.trim()
      });

      const role = (cleanPhone === '7830948738') ? 'admin' : 'user'; 
      
      // Generate a random uppercase alphanumeric referral code
      const generateRandomReferral = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return `LUM${result}`;
      };
      const myReferralCode = generateRandomReferral();

      const userData: Record<string, any> = {
        uid: firebaseUser.uid,
        displayName: fullName.trim(),
        email: email.trim() || authEmail,
        phoneNumber: cleanPhone,
        role: role,
        createdAt: new Date().toISOString(),
        referralCode: myReferralCode,
        loyaltyPoints: 0,
        password: password
      };

      if (enteredReferral) {
        userData.referredBy = enteredReferral;
      }

      // Create user document in Firestore
      await setDoc(doc(db, 'users', firebaseUser.uid), userData);

      // Save referral code in public index
      try {
        await setDoc(doc(db, 'referral_codes', myReferralCode), {
          uid: firebaseUser.uid,
          referralCode: myReferralCode,
          phoneNumber: cleanPhone,
          createdAt: new Date().toISOString()
        });
      } catch (refIndexErr) {
        console.warn("Could not index referral code:", refIndexErr);
      }

      // Track referral signup but don't award loyalty points
      if (referrerUid) {
        try {
          await addDoc(collection(db, 'notifications'), {
            title: '👋 Friend Signed Up!',
            message: `Congratulations! ${fullName} signed up using your referral code. Thank you for sharing Lumaro Mart!`,
            type: 'offer',
            createdAt: new Date()
          });
        } catch (notifErr) {
          console.error("Referral notification failed:", notifErr);
        }
      }

      setUser(userData as User);
      navigate(from);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('This mobile number is already registered. Please login.');
      } else {
        setError(err.message || 'Signup failed.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-white px-8 pt-12 pb-12 flex flex-col">
      <button 
        onClick={() => navigate(-1)}
        className="w-12 h-12 bg-[#F0F7F4] rounded-full flex items-center justify-center text-gray-800 mb-10 shrink-0"
      >
        <ChevronLeft size={24} />
      </button>

      <div className="mb-10 shrink-0">
        <h1 className="text-4xl font-extrabold text-[#1A1A1A] mb-2">
          {mode === 'signup' ? 'Create Account' : 'Welcome Back'}
        </h1>
        <p className="text-gray-500 font-medium">
          {mode === 'signup' ? 'Join Lumaro Mart for a better shopping experience' : 'Login with your mobile number and password'}
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-500 rounded-2xl text-sm font-medium">
          {error}
        </div>
      )}

      <div className="flex-grow">
        <AnimatePresence mode="wait">
          <motion.form 
            key={mode}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            onSubmit={handleAuthSubmit} 
            className="space-y-6"
          >
            <div className="space-y-4">
              {mode === 'signup' && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 px-1 flex items-center gap-1">
                      <span>Full Name</span>
                      <span className="text-red-500 font-bold">* (Mandatory)</span>
                    </label>
                    <Input 
                      placeholder="Enter Full Name *" 
                      icon={<UserIcon size={20} />} 
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        if (error) setError('');
                      }}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 px-1">
                      Email Address (Optional)
                    </label>
                    <Input 
                      placeholder="Email Address (Optional)" 
                      icon={<Mail size={20} />} 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      type="email"
                    />
                  </div>
                </>
              )}
              
              <div className="space-y-1">
                <div className="flex items-center justify-between px-1">
                  <label className="text-xs font-bold text-gray-700 flex items-center gap-1">
                    <span>Mobile Number</span>
                    <span className="text-red-500 font-bold">* (Mandatory / अनिवार्य)</span>
                  </label>
                  {phoneNumber && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      phoneNumber.length === 10 ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50'
                    }`}>
                      {phoneNumber.length}/10 digits
                    </span>
                  )}
                </div>
                <div className="flex gap-3">
                  <div className="bg-[#F0F7F4] rounded-2xl px-3 flex items-center gap-1.5 text-xs font-bold text-gray-900 border border-emerald-100/60 h-[56px] w-[95px] justify-between shrink-0 shadow-2xs">
                    <span>🇮🇳 +91</span>
                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M1 1L5 5L9 1" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div className="relative flex-1">
                    <Input 
                      placeholder="10-Digit Mobile Number *" 
                      icon={<Phone size={20} />} 
                      value={phoneNumber}
                      onChange={(e) => {
                        const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setPhoneNumber(digitsOnly);
                        if (error) setError('');
                      }}
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 px-1 flex items-center gap-1">
                  <span>{mode === 'signup' ? 'Set 4-Digit Security PIN' : 'Enter 4-Digit Security PIN'}</span>
                  <span className="text-red-500 font-bold">*</span>
                </label>
                <Input 
                  placeholder={mode === 'signup' ? "Set 4-Digit PIN (Password) *" : "Enter 4-Digit PIN (Password) *"}
                  icon={<Lock size={20} />} 
                  value={password}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setPassword(val);
                    if (error) setError('');
                  }}
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  required
                />
              </div>
              
              {mode === 'signup' && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 px-1 flex items-center gap-1">
                      <span>Confirm 4-Digit PIN</span>
                      <span className="text-red-500 font-bold">*</span>
                    </label>
                    <Input 
                      placeholder="Confirm 4-Digit PIN *"
                      icon={<Lock size={20} />} 
                      value={confirmPassword}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                        setConfirmPassword(val);
                        if (error) setError('');
                      }}
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 px-1">
                      Referral Code (Optional)
                    </label>
                    <Input 
                      placeholder="Referral Code (Optional)"
                      icon={<KeyRound size={20} />} 
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value.toUpperCase().trim())}
                    />
                  </div>
                </>
              )}
            </div>

            <Button 
              type="submit"
              className="w-full py-5 text-lg rounded-2xl shadow-lg shadow-[#66D2A4]/20 flex items-center justify-center gap-2 mt-4"
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : (mode === 'signup' ? 'Sign Up' : 'Login')}
            </Button>
          </motion.form>
        </AnimatePresence>
      </div>

      <div className="mt-auto pt-10">
        <div className="p-6 bg-[#F0F7F4] rounded-[32px] border border-green-50">
          <p className="text-center text-gray-600 text-sm font-medium">
            {mode === 'signup' ? "Already a member?" : "New to Lumaro Mart?"}
          </p>
          <button 
            onClick={() => {
              setMode(mode === 'signup' ? 'login' : 'signup');
              setError('');
            }}
            className="w-full mt-3 py-3 rounded-xl bg-white text-[#66D2A4] font-bold text-sm shadow-sm border border-green-100 hover:bg-green-50 transition-colors"
          >
            {mode === 'signup' ? 'Switch to Login' : 'Create New Account'}
          </button>
        </div>
      </div>
    </div>
  );
};

const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');

export const Login = ({ setUser }: { setUser: (u: User | null) => void }) => {
  return <Signup setUser={setUser} initialMode="login" />;
};
