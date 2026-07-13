import { useState, useEffect } from 'react';

export function useDatamatrixUrlMode() {
  const [datamatrixUrlMode, setDatamatrixUrlMode] = useState(false);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/system-config');
      if (res.ok) {
        const data = await res.json();
        setDatamatrixUrlMode(!!data.datamatrixUrlMode);
      }
    } catch (err) {
      // ignore
    }
  };

  useEffect(() => {
    fetchConfig();

    const handleCustomChange = () => {
      fetchConfig();
    };

    window.addEventListener('traclytag_datamatrix_visibility_changed', handleCustomChange);

    return () => {
      window.removeEventListener('traclytag_datamatrix_visibility_changed', handleCustomChange);
    };
  }, []);

  const setUrlMode = async (enabled: boolean) => {
    try {
      const res = await fetch('/api/system-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datamatrixUrlMode: enabled }),
      });
      if (res.ok) {
        setDatamatrixUrlMode(enabled);
        window.dispatchEvent(new Event('traclytag_datamatrix_visibility_changed'));
      }
    } catch (err) {
      // ignore
    }
  };

  return { datamatrixUrlMode, setUrlMode };
}
