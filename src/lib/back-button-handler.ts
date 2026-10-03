import { useEffect, useRef } from 'react';
import { NavigateFunction } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';

type ModalHandler = () => boolean | void;

// Stack of active modal handlers (LIFO - Last In First Out)
const modalStack: { id: string; handler: ModalHandler; priority: number }[] = [];

let lastBackPressTime = 0;
let exitToastTimeout: any = null;

/**
 * Registers an on-close handler for an active modal or bottom-sheet.
 * When the user presses the hardware/gesture back button, the topmost modal
 * will be closed first before navigating away from the page.
 */
export function registerModalBackHandler(id: string, handler: ModalHandler, priority = 0): () => void {
  // Remove any existing entry with the same id
  const index = modalStack.findIndex(m => m.id === id);
  if (index !== -1) {
    modalStack.splice(index, 1);
  }

  // Push new handler sorted by priority (higher priority first)
  modalStack.push({ id, handler, priority });
  modalStack.sort((a, b) => b.priority - a.priority);

  // Push a dummy history state on Web to capture the popstate event
  try {
    if (typeof window !== 'undefined' && window.history) {
      window.history.pushState({ modalOpen: true, modalId: id }, '');
    }
  } catch {
    // Ignore history state errors
  }

  return () => {
    const idx = modalStack.findIndex(m => m.id === id);
    if (idx !== -1) {
      modalStack.splice(idx, 1);
    }
  };
}

/**
 * Unregisters a modal handler by id.
 */
export function unregisterModalBackHandler(id: string) {
  const idx = modalStack.findIndex(m => m.id === id);
  if (idx !== -1) {
    modalStack.splice(idx, 1);
  }
}

/**
 * Custom React Hook to automatically wire any modal or bottom sheet
 * to the mobile back button system.
 */
export function useModalBackHandler(isOpen: boolean, onClose: () => void, modalId?: string, priority = 0) {
  const idRef = useRef(modalId || `modal_${Math.random().toString(36).substring(2, 9)}`);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    const unregister = registerModalBackHandler(
      idRef.current,
      () => {
        onCloseRef.current();
        return true;
      },
      priority
    );

    return () => {
      unregister();
    };
  }, [isOpen, priority]);
}

/**
 * Show a clean, non-intrusive floating toast notification
 */
function showExitToast(message: string) {
  if (typeof document === 'undefined') return;

  const existingToast = document.getElementById('mobile-back-toast');
  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement('div');
  toast.id = 'mobile-back-toast';
  toast.textContent = message;
  toast.style.position = 'fixed';
  toast.style.bottom = '80px';
  toast.style.left = '50%';
  toast.style.transform = 'translateX(-50%)';
  toast.style.backgroundColor = 'rgba(26, 26, 26, 0.92)';
  toast.style.color = '#ffffff';
  toast.style.padding = '10px 20px';
  toast.style.borderRadius = '9999px';
  toast.style.fontSize = '12px';
  toast.style.fontWeight = '700';
  toast.style.zIndex = '99999';
  toast.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.3)';
  toast.style.pointerEvents = 'none';
  toast.style.transition = 'opacity 0.2s ease-in-out';
  toast.style.backdropFilter = 'blur(8px)';

  document.body.appendChild(toast);

  if (exitToastTimeout) clearTimeout(exitToastTimeout);
  exitToastTimeout = setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 250);
  }, 2000);
}

/**
 * Central function to process a mobile back action (called by hardware back listener or popstate)
 */
export function handleMobileBackAction(navigate: NavigateFunction, currentPathname: string): boolean {
  // 1. If any modal/sheet is open, close the topmost one
  if (modalStack.length > 0) {
    const top = modalStack[modalStack.length - 1];
    try {
      const handled = top.handler();
      if (handled !== false) {
        // Remove from stack if closed
        modalStack.pop();
        return true;
      }
    } catch (e) {
      console.error('Error in modal back handler:', e);
      modalStack.pop();
      return true;
    }
  }

  // 2. If user is NOT on the Home page ('/'), go back 1 step in history
  if (currentPathname !== '/' && currentPathname !== '') {
    navigate(-1);
    return true;
  }

  // 3. If user is already on the Home screen ('/')
  const now = Date.now();
  if (now - lastBackPressTime < 2000) {
    // Second back press within 2 seconds: allow exit if native app
    if (Capacitor.isNativePlatform()) {
      CapApp.exitApp();
    }
    return false;
  } else {
    // First back press on Home: show alert toast to prevent accidental exit
    lastBackPressTime = now;
    showExitToast('App band karne ke liye dobara back dabayein (Press back again to exit)');
    return true;
  }
}
