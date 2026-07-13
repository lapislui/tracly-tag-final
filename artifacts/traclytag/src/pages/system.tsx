import { useState, useEffect } from "react";
import { useGetCurrentUser, useLogout, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, Redirect } from "wouter";
import { toast } from "sonner";
import { 
  Cpu, Activity, Database, Search, ShieldAlert, 
  Terminal, RefreshCw, AlertCircle, Copy, Check, Info
} from "lucide-react";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const DEFAULT_SEED_DATA = {
  company: {
    name: "Demo Pharma Pvt Ltd",
    email: "ops@demopharma.in",
    address: "Plot 14, MIDC Industrial Area, Pune, Maharashtra 411019",
    gstin: "27AABCD1234E1Z5"
  },
  users: [
    { username: "supermaster", email: "supermaster@tracelytag.com", phone: "+91 8000000000", password: "super123", role: "super_master" },
    { username: "master", email: "master@tracelytag.com", phone: "+91 9000000000", password: "master123", role: "master" },
    { username: "demo_admin", email: "admin@demopharma.in", phone: "+91 9111111111", password: "admin123", role: "admin" },
    { username: "demo_manager", email: "manager@demopharma.in", phone: "+91 9155555555", password: "manager123", role: "client_admin" },
    { username: "demo_op", email: "op@demopharma.in", phone: "+91 9222222222", password: "op123", role: "operator" }
  ],
  locations: [
    { locationType: "Warehouse", uniqueName: "WH-PUNE-01", locationName: "Pune Central Warehouse", contactNo: "+91 2027451234", state: "Maharashtra", city: "Pune", address: "Plot 14, MIDC Industrial Area, Pune 411019" },
    { locationType: "Distributor", uniqueName: "DST-MUM-04", locationName: "Mumbai Distributor Hub", contactNo: "+91 2261234500", state: "Maharashtra", city: "Mumbai", address: "Andheri East, Mumbai 400069" },
    { locationType: "Retailer", uniqueName: "RTL-DEL-12", locationName: "Connaught Place Pharmacy", contactNo: "+91 1141234567", state: "Delhi", city: "New Delhi", address: "Block A, Connaught Place, New Delhi 110001" }
  ],
  products: [
    { skuId: "PARA-500-10S", name: "Paracetamol 500mg", skuSize: "10x10 Tablets", marketedBy: "Demo Pharma Pvt Ltd", sapDescription: "PARACETAMOL TABLETS IP 500MG", gtin: "08901234567896", mrp: 45, registrationNo: "MH/DRUGS/2023/0451", l1Size: 10, l2Size: 100, shipperSize: 1000, expiryDate: "2028-04-30" },
    { skuId: "VITC-1000-30S", name: "Vitamin C 1000mg Effervescent", skuSize: "30 Tablets Tube", marketedBy: "Demo Pharma Pvt Ltd", sapDescription: "ASCORBIC ACID 1000MG EFFERVESCENT", gtin: "08907654321094", mrp: 299, registrationNo: "MH/DRUGS/2023/0892", l1Size: 6, l2Size: 36, shipperSize: 216, expiryDate: "2027-12-31" }
  ],
  batches: [
    { productSkuId: "PARA-500-10S", batchNumber: "PCM2604A", mfgDate: "2026-04-01", expiryDate: "2028-04-30" },
    { productSkuId: "VITC-1000-30S", batchNumber: "VTC2604B", mfgDate: "2026-04-15", expiryDate: "2027-12-31" }
  ]
};

interface SystemInfo {
  env: Record<string, string>;
  nodeVersion: string;
  platform: string;
  arch: string;
  uptime: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  cwd: string;
}

export default function System() {
  const { data: user, isLoading: isUserLoading } = useGetCurrentUser();
  const logoutMutation = useLogout();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [isInfoLoading, setIsInfoLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [customSeedJson, setCustomSeedJson] = useState(() => JSON.stringify(DEFAULT_SEED_DATA, null, 2));
  const [showSeedEditor, setShowSeedEditor] = useState(false);

  useEffect(() => {
    if (user && user.role === "super_master") {
      fetchSystemInfo();
    }
  }, [user]);

  const fetchSystemInfo = async () => {
    setIsInfoLoading(true);
    try {
      const res = await fetch("/api/system/info");
      if (!res.ok) {
        throw new Error("Failed to fetch system info");
      }
      const data = await res.json();
      setSystemInfo(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load system information");
    } finally {
      setIsInfoLoading(false);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success("Value copied to clipboard");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleResetDatabase = async () => {
    if (confirmText !== "reset database") {
      toast.error("Confirmation text does not match");
      return;
    }

    let parsedSeed = null;
    try {
      parsedSeed = JSON.parse(customSeedJson);
    } catch (e: any) {
      toast.error(`Invalid JSON seeding data: ${e.message}`);
      return;
    }

    setIsResetting(true);
    try {
      const res = await fetch("/api/system/reset-database", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seedData: parsedSeed }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to reset database");
      }

      toast.success("Database reset and seeded successfully!");
      setConfirmOpen(false);
      
      // Perform logout to force session refresh and login redirection
      logoutMutation.mutate(undefined, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
          setLocation("/login");
        }
      });
    } catch (err: any) {
      toast.error(err.message || "Database reset failed");
    } finally {
      setIsResetting(false);
    }
  };

  if (isUserLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-slate-500">Loading...</p>
      </div>
    );
  }

  // Gated: only supermaster
  if (!user || user.role !== "super_master") {
    return <Redirect to="/dashboard" />;
  }

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(" ");
  };

  const formatMB = (bytes: number) => {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const filteredKeys = systemInfo
    ? Object.keys(systemInfo.env)
        .filter(
          (key) =>
            key.toLowerCase().includes(search.toLowerCase()) ||
            String(systemInfo.env[key]).toLowerCase().includes(search.toLowerCase())
        )
        .sort()
    : [];

  return (
    <div className="space-y-6 font-sans">
      {/* Breadcrumbs */}
      <div className="mb-4 flex items-center gap-2 text-slate-500">
        <span className="text-[11px] font-bold uppercase tracking-wider">Super Master</span>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-[11px] text-[#2563EB] uppercase tracking-wider font-bold">System</span>
      </div>

      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-[30px] leading-[36px] font-bold text-[#0F172A] tracking-[-0.02em]">System Administration</h2>
          <p className="text-[16px] text-slate-600 mt-1">Unified monitoring and developer console for the TraclyTag platform.</p>
        </div>
        <Button
          onClick={fetchSystemInfo}
          variant="outline"
          className="h-10 shrink-0 flex items-center gap-2 border-slate-200 dark:border-slate-800"
          disabled={isInfoLoading}
        >
          <RefreshCw className={`h-4 w-4 ${isInfoLoading ? "animate-spin" : ""}`} />
          Refresh Stats
        </Button>
      </div>

      {isInfoLoading && !systemInfo ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <p className="text-slate-500">Loading system metrics...</p>
        </div>
      ) : systemInfo ? (
        <>
          {/* Top Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-xl">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-bold uppercase text-slate-400 tracking-wider">Runtime</CardTitle>
                <Cpu className="h-4 w-4 text-safety-blue" />
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold text-midnight-navy dark:text-white">Node.js {systemInfo.nodeVersion}</div>
                <p className="text-xs text-slate-500 mt-1">Platform: {systemInfo.platform} ({systemInfo.arch})</p>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-xl">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-bold uppercase text-slate-400 tracking-wider">Active Uptime</CardTitle>
                <Activity className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold text-midnight-navy dark:text-white">{formatUptime(systemInfo.uptime)}</div>
                <p className="text-xs text-slate-500 mt-1">Server process running duration</p>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-xl">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-bold uppercase text-slate-400 tracking-wider">Memory Allocation</CardTitle>
                <Terminal className="h-4 w-4 text-indigo-500" />
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold text-midnight-navy dark:text-white">{formatMB(systemInfo.memory.heapUsed)}</div>
                <p className="text-xs text-slate-500 mt-1">Heap Total: {formatMB(systemInfo.memory.heapTotal)}</p>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-xl">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-bold uppercase text-slate-400 tracking-wider">System RSS Memory</CardTitle>
                <Database className="h-4 w-4 text-pink-500" />
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold text-midnight-navy dark:text-white">{formatMB(systemInfo.memory.rss)}</div>
                <p className="text-xs text-slate-500 mt-1">Resident Set Size</p>
              </CardContent>
            </Card>
          </div>

          {/* Directory path */}
          <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 p-4 rounded-xl flex items-center gap-3">
            <Info className="h-4 w-4 text-safety-blue shrink-0" />
            <span className="text-xs text-slate-600 dark:text-slate-400 font-mono">
              Working Directory: <strong className="text-slate-800 dark:text-slate-200">{systemInfo.cwd}</strong>
            </span>
          </div>

          {/* Env Variables Card */}
          <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-xl">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 dark:border-slate-800 gap-4 pb-4">
              <div>
                <CardTitle className="text-lg font-bold text-midnight-navy dark:text-white">Environment Configuration</CardTitle>
                <CardDescription>Live deployment environment variables registered in the server environment.</CardDescription>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  className="pl-9 h-10 border-slate-200 dark:border-slate-800"
                  placeholder="Search keys or values..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent className="pt-4 overflow-x-auto">
              {filteredKeys.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-sm">
                  No matching environment variables found.
                </div>
              ) : (
                <div className="max-h-[500px] overflow-y-auto pr-2">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800">
                        <th className="py-3 px-4 font-semibold text-slate-500 text-xs uppercase tracking-wider w-1/3 border-b border-slate-100 dark:border-slate-800">Key</th>
                        <th className="py-3 px-4 font-semibold text-slate-500 text-xs uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">Value</th>
                        <th className="py-3 px-4 w-12 border-b border-slate-100 dark:border-slate-800"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-900">
                      {filteredKeys.map((key) => {
                        const val = systemInfo.env[key];
                        return (
                          <tr key={key} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors font-mono text-[11px] leading-tight">
                            <td className="py-3 px-4 font-semibold text-teal-600 dark:text-teal-400 select-all break-all w-1/3">
                              {key}
                            </td>
                            <td className="py-3 px-4 text-slate-700 dark:text-slate-300 break-all select-all font-semibold">
                              {val}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                onClick={() => handleCopy(val, key)}
                              >
                                {copiedKey === key ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Danger Zone Card */}
          <Card className="border border-red-200 dark:border-red-950/50 bg-red-50/10 dark:bg-red-950/5 shadow-sm rounded-xl">
            <CardHeader>
              <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
                <ShieldAlert className="h-6 w-6 shrink-0" />
                <div>
                  <CardTitle className="text-lg font-bold">Danger Zone</CardTitle>
                  <CardDescription className="text-red-600/70 dark:text-red-400/70">Irreversible administrative actions.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 p-5 border border-red-100 dark:border-red-950/30 rounded-xl bg-red-50/20 dark:bg-red-950/10">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-red-950 dark:text-red-200">Reset System Database</h4>
                  <p className="text-xs text-red-700/80 dark:text-red-400/80 max-w-2xl leading-relaxed">
                    This clears all companies, users, products, batches, locations, codes, and scans from the system, and resets the database back to the clean seed dataset templates (with default master, demo admin, and demo operator accounts). You will be logged out and redirected.
                  </p>
                </div>
                <Button
                  onClick={() => {
                    setConfirmText("");
                    setConfirmOpen(true);
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold shrink-0 shadow-lg shadow-red-500/10 h-10 px-5 transition-all"
                >
                  Reset Database
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className={cn("bg-slate-900 border border-slate-800 text-white font-sans p-6 rounded-2xl shadow-2xl transition-all duration-300", showSeedEditor ? "sm:max-w-[650px]" : "sm:max-w-[420px]")}>
          <DialogHeader className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 shadow-md">
              <ShieldAlert className="w-6 h-6 animate-bounce" />
            </div>
            <DialogTitle className="text-lg font-bold text-white">Reset Database?</DialogTitle>
            <DialogDescription className="text-slate-400 text-xs leading-relaxed">
              This action is destructive and will delete all custom records. The database will be restored to the template seeded state.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-4">
            <div className="rounded-lg bg-red-950/20 border border-red-900/30 p-3 flex items-start gap-2.5 text-xs text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>To confirm, please type <strong className="text-white font-semibold">reset database</strong> in the input below.</span>
            </div>
            
            <div className="space-y-1.5">
              <Label htmlFor="confirm-reset-text" className="text-xs text-slate-400 font-medium">Confirmation Text</Label>
              <Input
                id="confirm-reset-text"
                className="h-10 bg-slate-950 border-slate-800 text-white font-bold focus:ring-red-500 focus:border-red-500"
                placeholder="Type 'reset database'"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
              />
            </div>

            <div className="space-y-1.5 pt-2">
              <button
                type="button"
                onClick={() => setShowSeedEditor(!showSeedEditor)}
                className="text-[11px] font-bold text-safety-blue hover:underline flex items-center gap-1 cursor-pointer"
              >
                {showSeedEditor ? "Hide Seeding Data Editor" : "Configure Custom Seeding Data (JSON)"}
              </button>
              
              {showSeedEditor && (
                <div className="space-y-1.5 mt-2">
                  <Label className="text-[10px] text-slate-400 font-bold uppercase">JSON Seeding Template</Label>
                  <textarea
                    className="w-full h-56 bg-slate-950 border border-slate-800 text-slate-350 font-mono text-[10px] p-2.5 rounded-lg focus:outline-none focus:border-safety-blue scrollbar-thin resize-none"
                    value={customSeedJson}
                    onChange={(e) => setCustomSeedJson(e.target.value)}
                  />
                  <p className="text-[9px] text-slate-500 leading-normal">
                    Edit the organization name, roles, or default product SKUs prior to the system wipe.
                  </p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
              className="h-10 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl border border-slate-850"
            >
              Cancel
            </Button>
            <Button
              onClick={handleResetDatabase}
              disabled={confirmText !== "reset database" || isResetting}
              className="bg-red-600 hover:bg-red-500 text-white font-bold h-10 rounded-xl"
            >
              {isResetting ? "Resetting..." : "Confirm Reset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
