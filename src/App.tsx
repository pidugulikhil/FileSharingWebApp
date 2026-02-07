import React, { useState, useEffect } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import { Menu, X, Moon, SunMedium } from 'lucide-react';
import 'react-toastify/dist/ReactToastify.css';
import './styles/global.css';
import UploadBox from './components/UploadBox';
import DownloadBox from './components/DownloadBox';
import Footer from './components/Footer';
import { UploadResult } from './types';

const THEME_STORAGE_KEY = 'fsv1-theme';
const DISPLAY_TIMER_MS = 24 * 60 * 60 * 1000;

const formatCountdown = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((unit) => String(unit).padStart(2, '0')).join(':');
};

const TOAST_IDS = {
  uploadReady: 'toast-upload-ready',
};

const getInitialTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY) as 'light' | 'dark' | null;
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  } catch (error) {
    console.warn('Unable to read theme preference', error);
  }
  return 'light';
};

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => getInitialTheme());
  const [tab, setTab] = useState<'upload' | 'download'>('upload');
  const [uploadedId, setUploadedId] = useState<string | null>(null);
  const [recentUpload, setRecentUpload] = useState<UploadResult | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareTimerTarget, setShareTimerTarget] = useState<number | null>(null);
  const [shareCountdown, setShareCountdown] = useState<string | null>(null);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.classList.toggle('theme-dark', theme === 'dark');
      document.body.classList.toggle('theme-light', theme === 'light');
      document.body.setAttribute('data-theme', theme);
    }

    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, theme);
      } catch (error) {
        console.warn('Unable to persist theme preference', error);
      }
    }
  }, [theme]);

  const handleUploadComplete = (result: UploadResult) => {
    setRecentUpload(result);
    setUploadedId(result.id);
    setShareTimerTarget(Date.now() + DISPLAY_TIMER_MS);
    toast.dismiss(TOAST_IDS.uploadReady);
    toast.info('File ID ready in the download tab', { toastId: TOAST_IDS.uploadReady });
    setTab('download');
  };

  useEffect(() => {
    if (!shareTimerTarget) {
      setShareCountdown(null);
      return undefined;
    }

    const tick = () => {
      const diff = shareTimerTarget - Date.now();
      if (diff <= 0) {
        setShareCountdown('00:00:00');
        return false;
      }
      setShareCountdown(formatCountdown(diff));
      return true;
    };

    tick();
    const interval = window.setInterval(() => {
      const shouldContinue = tick();
      if (!shouldContinue) {
        window.clearInterval(interval);
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [shareTimerTarget]);

  useEffect(() => {
    if (!recentUpload) {
      setShareTimerTarget(null);
      setShareCountdown(null);
    }
  }, [recentUpload]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const toggleTab = () => {
    setTab((prev) => (prev === 'upload' ? 'download' : 'upload'));
    setMenuOpen(false);
  };

  const copyToClipboard = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch (error) {
      toast.error('Copy failed. Please copy manually.');
    }
  };

  const nextTabLabel = tab === 'upload' ? 'Switch to Download Section' : 'Switch to Upload Section';

  return (
    <div className={`app-shell ${theme === 'dark' ? 'theme-dark' : 'theme-light'}`}>
      <div className="ambient-gradient" />
      <div className="ambient-grid" />

      <nav className="fs-nav surface-card">
        <div className="fs-brand">
                      <img src="/fs_icon.png" alt="FileShare V1 logo" className="fs-badge-icon" height="60" width="60" style={{ borderRadius: '15px' }} />

          <div>
            <p className="fs-title">FileShare V1</p>
            <p className="fs-subtitle">Share files and folders in seconds</p>
          </div>
        </div>
        <div className="fs-nav-actions">
          <button
            className="menu-button theme-toggle"
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <SunMedium className="w-5 h-5" />}
          </button>
          <button
            className="menu-button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </nav>

      <div
        className={`fs-drawer-overlay ${menuOpen ? 'open' : ''}`}
        onClick={() => setMenuOpen(false)}
      />
      <aside className={`fs-drawer ${menuOpen ? 'open' : ''}`}>
        <header className="fs-drawer-header">
          <div>
            <h4>MENU</h4>
          </div>
          <button className="menu-button" onClick={() => setMenuOpen(false)} aria-label="Close menu">
            <X className="w-5 h-5" />
          </button>
        </header>
        <div className="fs-drawer-actions">
          <button onClick={toggleTab}>{nextTabLabel}</button>
          <button onClick={toggleTheme}>Switch to {theme === 'light' ? 'dark' : 'light'} mode</button>
          <a href="https://likhil.42web.io" target="_blank" rel="noreferrer">Visit portfolio</a>
        </div>
      </aside>

      <section className="workspace-section">
        <div className="tab-switcher surface-card single-toggle">
          <div>
            <p className="toggle-eyebrow">Current workspace</p>
            <h4>{tab === 'upload' ? 'Upload mode' : 'Download mode'}</h4>
          </div>
          <button className="toggle-cta" onClick={toggleTab}>{nextTabLabel}</button>
        </div>

        <div className="panel-card surface-card">
          {tab === 'upload' ? (
            <UploadBox onUploadComplete={handleUploadComplete} />
          ) : (
            <DownloadBox onDownloadComplete={() => {}} prefillId={uploadedId} />
          )}
        </div>

        {recentUpload && (
          <div className="share-card surface-card">
            <div>
              <p className="share-label">Share this File ID</p>
              <p className="share-value">{recentUpload.id}</p>
            </div>
            <div className="share-actions">
              <button onClick={() => copyToClipboard(recentUpload.id, 'File ID')}>Copy ID</button>
              <button onClick={() => recentUpload.downloadUrl && window.open(recentUpload.downloadUrl, '_blank')}>Open Link</button>
              <button onClick={() => copyToClipboard(recentUpload.downloadUrl, 'Download link')}>Copy Link</button>
            </div>
            <p className="share-expiry">
              Visible for 24 hours · {shareCountdown ?? '24:00:00'} left
            </p>
          </div>
        )}
      </section>


      <Footer />

      <ToastContainer
        position="bottom-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme={theme === 'light' ? 'light' : 'dark'}
      />
    </div>
  );
}

export default App;