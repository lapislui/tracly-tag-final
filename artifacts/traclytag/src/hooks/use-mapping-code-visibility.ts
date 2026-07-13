import { useState, useEffect } from "react";

export function useMappingCodeVisibility() {
  const [hideMappingCode, setHideMappingCode] = useState(false);

  const fetchConfig = async () => {
    try {
      const res = await fetch("/api/system-config");
      if (res.ok) {
        const data = await res.json();
        setHideMappingCode(data.hideMappingCode);
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

    window.addEventListener("traclytag_mapping_visibility_changed", handleCustomChange);

    return () => {
      window.removeEventListener("traclytag_mapping_visibility_changed", handleCustomChange);
    };
  }, []);

  const toggleVisibility = async (hide: boolean) => {
    try {
      const res = await fetch("/api/system-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hideMappingCode: hide }),
      });
      if (res.ok) {
        setHideMappingCode(hide);
        window.dispatchEvent(new Event("traclytag_mapping_visibility_changed"));
      }
    } catch (err) {
      // ignore
    }
  };

  return { hideMappingCode, toggleVisibility };
}
