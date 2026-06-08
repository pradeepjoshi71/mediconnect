import { createContext, useContext, useEffect, useState, useCallback } from "react";
import apiClient from "../services/apiClient";
import { hasSession } from "../services/session";

const BrandingContext = createContext({
  branding: {},
  loading: false,
  refresh: () => {},
  loadBrandingByCode: () => Promise.resolve({}),
});

const BRANDING_KEY = "mc_branding";

function loadCached() {
  try {
    const raw = localStorage.getItem(BRANDING_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function applyBrandingToDOM(branding) {
  if (!branding) return;

  const root = document.documentElement;

  // Inject primary/secondary color CSS custom properties
  if (branding.primaryColor) {
    root.style.setProperty("--mc-primary", branding.primaryColor);
  } else {
    root.style.removeProperty("--mc-primary");
  }
  if (branding.secondaryColor) {
    root.style.setProperty("--mc-secondary", branding.secondaryColor);
  } else {
    root.style.removeProperty("--mc-secondary");
  }

  // Update document title
  if (branding.displayName) {
    document.title = `${branding.displayName} — MediConnect`;
  }

  // Update favicon
  if (branding.faviconUrl) {
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = branding.faviconUrl;
  }
}

export function BrandingProvider({ children }) {
  const [branding, setBranding] = useState(loadCached);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!hasSession()) return;
    setLoading(true);
    try {
      const r = await apiClient.get("/hospitals/branding");
      const b = r.data.branding || {};
      setBranding(b);
      localStorage.setItem(BRANDING_KEY, JSON.stringify(b));
      applyBrandingToDOM(b);
    } catch {
      // Non-blocking: silently fail, keep cached branding
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBrandingByCode = useCallback(async (code) => {
    if (!code) return;
    setLoading(true);
    try {
      const r = await apiClient.get(`/hospitals/public/branding/${code}`);
      const b = r.data.branding || {};
      setBranding(b);
      localStorage.setItem(BRANDING_KEY, JSON.stringify(b));
      applyBrandingToDOM(b);
      return b;
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  // Apply cached branding immediately on mount (no flicker)
  useEffect(() => {
    applyBrandingToDOM(branding);
  }, []);

  // Fetch fresh branding once session is ready
  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <BrandingContext.Provider value={{ branding, loading, refresh, loadBrandingByCode }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}

export function clearBrandingCache() {
  localStorage.removeItem(BRANDING_KEY);
  const root = document.documentElement;
  root.style.removeProperty("--mc-primary");
  root.style.removeProperty("--mc-secondary");
  document.title = "MediConnect HMS";
}
