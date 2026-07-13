import { useState, useEffect } from "react";

export function useDevOptionsVisibility() {
  const [hideDevOptions, setHideDevOptions] = useState(() => {
    const stored = localStorage.getItem("traclytag_hide_dev_options");
    // Default to hidden (true) if not set
    return stored === null ? true : stored === "true";
  });

  const [hideSsoOptions, setHideSsoOptions] = useState(() => {
    const stored = localStorage.getItem("traclytag_hide_sso_options");
    // Default to hidden (true) if not set
    return stored === null ? true : stored === "true";
  });

  useEffect(() => {
    const handleStorageChange = () => {
      const storedDev = localStorage.getItem("traclytag_hide_dev_options");
      setHideDevOptions(storedDev === null ? true : storedDev === "true");

      const storedSso = localStorage.getItem("traclytag_hide_sso_options");
      setHideSsoOptions(storedSso === null ? true : storedSso === "true");
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("traclytag_dev_visibility_changed", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("traclytag_dev_visibility_changed", handleStorageChange);
    };
  }, []);

  const setDevVisibility = (hide: boolean) => {
    localStorage.setItem("traclytag_hide_dev_options", String(hide));
    setHideDevOptions(hide);
    window.dispatchEvent(new Event("traclytag_dev_visibility_changed"));
  };

  const setSsoVisibility = (hide: boolean) => {
    localStorage.setItem("traclytag_hide_sso_options", String(hide));
    setHideSsoOptions(hide);
    window.dispatchEvent(new Event("traclytag_dev_visibility_changed"));
  };

  return { hideDevOptions, hideSsoOptions, setDevVisibility, setSsoVisibility };
}
