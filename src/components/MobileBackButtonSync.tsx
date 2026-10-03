import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { handleMobileBackAction } from '../lib/back-button-handler';

export const MobileBackButtonSync: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const locationRef = useRef(location.pathname);
  locationRef.current = location.pathname;

  useEffect(() => {
    let capListenerHandle: any = null;

    // 1. Native Capacitor Android Hardware Back Button (for installed APK / Android device)
    if (Capacitor.isNativePlatform()) {
      CapApp.addListener('backButton', () => {
        handleMobileBackAction(navigate, locationRef.current);
      }).then(handle => {
        capListenerHandle = handle;
      }).catch(err => {
        console.warn('Capacitor backButton listener error:', err);
      });
    }

    // 2. Mobile Browser, Chrome gesture, & PWA back navigation (popstate)
    const handlePopState = () => {
      handleMobileBackAction(navigate, locationRef.current);
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      if (capListenerHandle && typeof capListenerHandle.remove === 'function') {
        capListenerHandle.remove();
      }
      window.removeEventListener('popstate', handlePopState);
    };
  }, [navigate]);

  return null;
};
