import { useState, useEffect } from 'react';
import { loadBusinessSettings, getCachedSettings, getCompanyName } from '@food/utils/businessSettings';

const sanitizeCompanyName = (name) => {
  if (!name) return 'RedGo';
  const lower = name.toLowerCase();
  if (lower.includes('master') || lower.includes('appzeto')) {
    return 'RedGo';
  }
  return name;
};

/**
 * Custom hook to get company name from business settings
 * @returns {string} Company name with fallback to "RedGo"
 */
export const useCompanyName = () => {
  const [companyName, setCompanyName] = useState(() => {
    // Initialize with cached value if available
    const cached = getCachedSettings();
    return sanitizeCompanyName(cached?.companyName);
  });

  useEffect(() => {
    const loadCompanyName = async () => {
      try {
        const settings = await loadBusinessSettings();
        if (settings?.companyName) {
          setCompanyName(sanitizeCompanyName(settings.companyName));
        }
      } catch (error) {
        // Keep default value on error
        console.warn('Failed to load company name:', error);
      }
    };

    // Load if not cached
    const cached = getCachedSettings();
    if (!cached?.companyName) {
      loadCompanyName();
    } else {
      setCompanyName(sanitizeCompanyName(cached.companyName));
    }

    // Listen for business settings updates
    const handleSettingsUpdate = () => {
      const updated = getCachedSettings();
      if (updated?.companyName) {
        setCompanyName(sanitizeCompanyName(updated.companyName));
      }
    };

    window.addEventListener('businessSettingsUpdated', handleSettingsUpdate);

    return () => {
      window.removeEventListener('businessSettingsUpdated', handleSettingsUpdate);
    };
  }, []);

  return companyName;
};
