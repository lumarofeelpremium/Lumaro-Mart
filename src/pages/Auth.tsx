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
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
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

  const getSyntheticEmail = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
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
    
    if (!phoneNumber || phoneNumber.length < 10) {
      setError('Please enter a valid mobile number');
      return;
    }

    if (mode === 'signup') {
      if (!fullName) {
        setError('Please enter your full name');
        return;
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
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
      handleSignup();
    } else {
      if (!password || !/^\d{4}$/.test(password)) {
        setError('Please enter your 4-digit numeric password (PIN)');
        return;
      }
      handleLogin();
    }
  };

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      const authEmail = getSyntheticEmail(phoneNumber);
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
        if (phoneNumber.includes('7830948738') && userData.role !== 'admin') {
          await updateDoc(doc(db, 'users', firebaseUser.uid), { role: 'admin' });
          userData.role = 'admin';
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

  const handleSignup = async () => {
    setIsLoading(true);
    try {
      const authEmail = getSyntheticEmail(phoneNumber);
      const securePassword = getSecurePassword(password);
      const userCredential = await createUserWithEmailAndPassword(auth, authEmail, securePassword);
      const firebaseUser = userCredential.user;

      await updateProfile(firebaseUser, {
        displayName: fullName
      });

      const role = (phoneNumber === '7830948738') ? 'admin' : 'user'; 

      const userData = {
        uid: firebaseUser.uid,
        displayName: fullName,
        email: email || authEmail,
        phoneNumber: phoneNumber,
        role: role,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'users', firebaseUser.uid), userData);
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
                  <Input 
                    placeholder="Full Name" 
                    icon={<UserIcon size={20} />} 
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                  <Input 
                    placeholder="Email Address (Optional)" 
                    icon={<Mail size={20} />} 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                  />
                </>
              )}
              
              <div className="flex gap-3">
                <div className="bg-[#F0F7F4] rounded-2xl px-4 flex items-center gap-2 text-xs font-bold text-gray-900 border-none h-[56px] w-[90px] justify-between">
                  <span>IN +91</span>
                  <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 1L5 5L9 1" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <Input 
                  placeholder="Mobile Number" 
                  icon={<Phone size={20} />} 
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  type="tel"
                  required
                />
              </div>

              <Input 
                placeholder={mode === 'signup' ? "Set 4-Digit PIN" : "Enter 4-Digit PIN"}
                icon={<Lock size={20} />} 
                value={password}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setPassword(val);
                }}
                type="password"
                inputMode="numeric"
                required
              />
              
              {mode === 'signup' && (
                <Input 
                  placeholder="Confirm 4-Digit PIN"
                  icon={<Lock size={20} />} 
                  value={confirmPassword}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setConfirmPassword(val);
                  }}
                  type="password"
                  inputMode="numeric"
                  required
                />
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
