'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';

const DEFAULT_IDLE_TIMEOUT_MS = 5 * 60 * 1000; // default 5 menit

export default function SessionTimeoutManager() {
  const [showTimeoutModal, setShowTimeoutModal] = useState(false);
  const [idleTimeoutMs, setIdleTimeoutMs] = useState(DEFAULT_IDLE_TIMEOUT_MS);
  const isHandlingLogout = useRef(false);

  // Fetch dynamic timeout setting from system parameters
  useEffect(() => {
    async function loadTimeoutSetting() {
      try {
        const res = await fetch('/api/v1/store/settings');
        const json = await res.json();
        if (json.success && json.data?.session_idle_timeout_minutes) {
          setIdleTimeoutMs(Math.max(1, Number(json.data.session_idle_timeout_minutes)) * 60 * 1000);
        }
      } catch {}
    }
    loadTimeoutSetting();
  }, []);

  const performLogout = useCallback(async () => {
    if (isHandlingLogout.current) return;
    isHandlingLogout.current = true;

    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
    } catch {}

    sessionStorage.removeItem('bv_ops_token');
    localStorage.removeItem('bv_last_active');
    setShowTimeoutModal(true);
  }, []);

  const resetTimer = useCallback(() => {
    localStorage.setItem('bv_last_active', String(Date.now()));
  }, []);

  useEffect(() => {
    // Inisialisasi timestamp aktivitas jika belum ada
    if (!localStorage.getItem('bv_last_active')) {
      resetTimer();
    }

    // Cek aktivitas berkala
    async function checkIdle() {
      const hasOpsToken = sessionStorage.getItem('bv_ops_token');
      const lastActive = Number(localStorage.getItem('bv_last_active') || Date.now());
      const idleTime = Date.now() - lastActive;

      if (idleTime >= idleTimeoutMs) {
        // Cek status sesi ke server sebelum logout
        try {
          const res = await fetch('/api/v1/auth/session');
          const json = await res.json();
          if (json.data?.authenticated || hasOpsToken) {
            await performLogout();
          }
        } catch {}
      }
    }

    const intervalId = setInterval(checkIdle, 10000);

    // Cek saat tab kembali aktif
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        checkIdle();
      }
    }

    // Event listener aktivitas (throttled)
    let throttleTimeout: NodeJS.Timeout | null = null;
    function onUserActivity() {
      if (!throttleTimeout) {
        resetTimer();
        throttleTimeout = setTimeout(() => {
          throttleTimeout = null;
        }, 3000);
      }
    }

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach((ev) => window.addEventListener(ev, onUserActivity, { passive: true }));
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      events.forEach((ev) => window.removeEventListener(ev, onUserActivity));
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (throttleTimeout) clearTimeout(throttleTimeout);
    };
  }, [performLogout, resetTimer]);

  function handleCloseModal() {
    setShowTimeoutModal(false);
    isHandlingLogout.current = false;
    window.location.reload();
  }

  if (!showTimeoutModal) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="modal-content" style={{ maxWidth: '420px', textAlign: 'center', padding: '24px' }}>
        <h3 className="font-title-lg" style={{ color: 'var(--gold-light)', marginBottom: '10px' }}>
          Sesi Telah Berakhir
        </h3>
        <p style={{ fontSize: '0.88rem', color: 'var(--body)', marginBottom: '20px', lineHeight: 1.5 }}>
          Anda telah tidak aktif selama lebih dari 5 menit. Demi keamanan akun, sesi Anda telah diakhiri secara otomatis.
        </p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleCloseModal}
          style={{ width: '100%', padding: '10px' }}
        >
          Masuk Kembali
        </button>
      </div>
    </div>
  );
}
