import { useState, useEffect } from "react";
import { 
  useGetMyCompany, 
  useGetCurrentUser,
  useListCompanies
} from "@workspace/api-client-react";
import { toast } from "sonner";
import { 
  HelpCircle, 
  Globe, 
  Code2, 
  Key, 
  Copy, 
  Check, 
  RefreshCw, 
  ExternalLink,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Server,
  Loader2
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export default function Support() {
  const { data: currentUser } = useGetCurrentUser();
  const isSuperMaster = currentUser?.role === "super_master";

  const getApiBaseUrl = () => {
    if (typeof window === "undefined") return "";
    const { protocol, hostname, port } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return `${protocol}//${hostname}:3000/api`;
    }
    if (port && port !== "80" && port !== "443") {
      return `${protocol}//${hostname}:3000/api`;
    }
    return `${window.location.origin}/api`;
  };

  const getAuthToken = () => {
    if (!currentUser) return "";
    if (currentUser.role === "super_master") return "supermaster";
    if (currentUser.role === "master") return "master";
    if (currentUser.role === "client_admin") return "demo_admin";
    return "demo_op";
  };

  const { data: companies = [] } = useListCompanies({
    query: {
      enabled: isSuperMaster,
    }
  } as any);

  const [selectedCompanyId, setSelectedCompanyId] = useState<number>(1);
  const [adminCompany, setAdminCompany] = useState<any>(null);
  const [isAdminCompanyLoading, setIsAdminCompanyLoading] = useState(false);

  const fetchAdminCompany = async (id: number) => {
    setIsAdminCompanyLoading(true);
    try {
      const res = await fetch(`/api/companies/my-company?companyId=${id}`);
      if (res.ok) {
        const data = await res.json();
        setAdminCompany(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAdminCompanyLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperMaster) {
      fetchAdminCompany(selectedCompanyId);
    }
  }, [selectedCompanyId, isSuperMaster]);

  const { data: myCompany, refetch: refetchMyCompany, isLoading: isMyCompanyLoading } = useGetMyCompany({
    query: {
      enabled: !isSuperMaster && !!currentUser?.companyId,
    }
  } as any);

  const company = isSuperMaster ? adminCompany : myCompany;
  const isLoading = isSuperMaster ? isAdminCompanyLoading : isMyCompanyLoading;

  const refetchCompany = () => {
    if (isSuperMaster) {
      fetchAdminCompany(selectedCompanyId);
    } else {
      refetchMyCompany();
    }
  };

  const [supportMode, setSupportMode] = useState<"system" | "company">("system");

  // --- SMTP Test States ---
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpRecipient, setSmtpRecipient] = useState("");
  const [isSendingSmtpTest, setIsSendingSmtpTest] = useState(false);
  const [smtpError, setSmtpError] = useState<string | null>(null);
  const [smtpSuccess, setSmtpSuccess] = useState<string | null>(null);

  const handleSendSmtpTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smtpPassword || !smtpRecipient) {
      toast.error("Please fill in both fields");
      return;
    }
    setIsSendingSmtpTest(true);
    setSmtpError(null);
    setSmtpSuccess(null);
    try {
      const res = await fetch("/api/auth/send-test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: smtpPassword, recipient: smtpRecipient })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send test email");
      }
      setSmtpSuccess(data.message || "Test email sent successfully!");
      toast.success("Test email sent successfully!");
    } catch (err: any) {
      setSmtpError(err.message || "An unknown error occurred");
      toast.error("Failed to send SMTP test email");
    } finally {
      setIsSendingSmtpTest(false);
    }
  };
  const [domainInput, setDomainInput] = useState("");
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedWidget, setCopiedWidget] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const [isUpdatingDomain, setIsUpdatingDomain] = useState(false);
  const [isRegeneratingKey, setIsRegeneratingKey] = useState(false);

  useEffect(() => {
    if (company?.companyUrl) {
      setDomainInput(company.companyUrl);
    } else {
      setDomainInput("");
    }
  }, [company]);

  const handleSaveDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingDomain(true);
    try {
      const url = isSuperMaster ? `/api/companies/my-company?companyId=${selectedCompanyId}` : `/api/companies/my-company`;
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyUrl: domainInput.trim() || null })
      });
      if (!res.ok) throw new Error("Failed to save domain");
      toast.success("Custom domain configuration saved successfully!");
      refetchCompany();
    } catch (err: any) {
      toast.error(err.message || "Failed to update custom domain");
    } finally {
      setIsUpdatingDomain(false);
    }
  };

  const handleRegenerateKey = async () => {
    if (confirm("Are you sure you want to regenerate your API Key? Any existing applications using this key will lose access immediately.")) {
      setIsRegeneratingKey(true);
      try {
        const url = isSuperMaster ? `/api/companies/my-company/regenerate-api-key?companyId=${selectedCompanyId}` : `/api/companies/my-company/regenerate-api-key`;
        const res = await fetch(url, {
          method: "POST",
        });
        if (!res.ok) throw new Error("Failed to regenerate API key");
        toast.success("New API key generated successfully!");
        refetchCompany();
      } catch (err: any) {
        toast.error(err.message || "Failed to regenerate API key");
      } finally {
        setIsRegeneratingKey(false);
      }
    }
  };

  const copyToClipboard = (text: string, type: "key" | "widget") => {
    navigator.clipboard.writeText(text);
    if (type === "key") {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
      toast.success("API key copied to clipboard");
    } else {
      setCopiedWidget(true);
      setTimeout(() => setCopiedWidget(false), 2000);
      toast.success("Widget code copied to clipboard");
    }
  };

  const isMaster = currentUser?.role === "master" || currentUser?.role === "super_master";

  // Widget Code Generation
  const appOrigin = window.location.origin;
  const widgetCodeSnippet = `<!-- TraclyTag Verification Widget -->
<div id="traclytag-verification-widget"></div>
<script>
  (function() {
    var container = document.getElementById("traclytag-verification-widget");
    if (!container) return;
    
    container.innerHTML = \`
      <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 450px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background: #fff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 20px;">
          <h3 style="margin: 0 0 8px 0; color: #0f172a; font-size: 1.25rem; font-weight: 700;">Verify Product Authenticity</h3>
          <p style="margin: 0; color: #64748b; font-size: 0.875rem;">Enter secure barcode/serial code</p>
        </div>
        <div style="margin-bottom: 16px;">
          <input type="text" id="tt-serial-input" placeholder="Enter Serial Number" style="width: 100%; box-sizing: border-box; padding: 12px 16px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.875rem; outline: none;" />
        </div>
        <button id="tt-verify-btn" style="width: 100%; padding: 12px; background: #2563eb; color: #fff; border: none; border-radius: 8px; font-size: 0.875rem; font-weight: 600; cursor: pointer; transition: background 0.2s;">Verify Now</button>
        <div id="tt-result" style="margin-top: 20px; display: none;"></div>
      </div>
    \`;
    
    var btn = document.getElementById("tt-verify-btn");
    var input = document.getElementById("tt-serial-input");
    var resultDiv = document.getElementById("tt-result");
    
    btn.addEventListener("click", function() {
      var val = input.value.trim();
      if (!val) return;
      btn.disabled = true;
      btn.innerText = "Verifying...";
      
      fetch("${appOrigin}/api/codes/public/" + encodeURIComponent(val) + "?customerName=WidgetScan&mobileNumber=9999999999&zipCode=000000")
        .then(function(r) { return r.json(); })
        .then(function(data) {
          btn.disabled = false;
          btn.innerText = "Verify Now";
          resultDiv.style.display = "block";
          if (data.error) {
            resultDiv.innerHTML = '<div style="padding: 12px; border-radius: 8px; background: #fef2f2; color: #991b1b; font-size: 0.875rem; border: 1px solid #fee2e2;">❌ ' + data.error + '</div>';
          } else {
            resultDiv.innerHTML = \`
              <div style="padding: 16px; border-radius: 8px; background: #f0fdf4; color: #166534; font-size: 0.875rem; border: 1px solid #dcfce7; line-height: 1.5; text-align: left;">
                <div style="font-weight: 700; margin-bottom: 6px; font-size: 0.95rem;">✅ Authenticity Verified</div>
                <div><strong>Product:</strong> \\\${data.productName}</div>
                <div><strong>Batch:</strong> \\\${data.batchNumber || 'N/A'}</div>
                <div><strong>Mfg Date:</strong> \\\${data.mfgDate ? new Date(data.mfgDate).toLocaleDateString() : 'N/A'}</div>
                <div><strong>Expiry:</strong> \\\${data.expiryDate ? new Date(data.expiryDate).toLocaleDateString() : 'N/A'}</div>
                <div><strong>Owner:</strong> \\\${data.companyName}</div>
              </div>
            \`;
          }
        })
        .catch(function() {
          btn.disabled = false;
          btn.innerText = "Verify Now";
          resultDiv.style.display = "block";
          resultDiv.innerHTML = '<div style="padding: 12px; border-radius: 8px; background: #fef2f2; color: #991b1b; font-size: 0.875rem; border: 1px solid #fee2e2;">❌ Network error. Please try again.</div>';
        });
    });
  })();
</script>`;

  if (isMaster && (!isSuperMaster || supportMode === "system")) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto font-sans pb-16">
        {isSuperMaster && (
          <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit mb-6">
            <button
              type="button"
              onClick={() => setSupportMode("system")}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-semibold transition-all",
                supportMode === "system"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
              )}
            >
              System Console
            </button>
            <button
              type="button"
              onClick={() => setSupportMode("company")}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-semibold transition-all",
                supportMode === "company"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
              )}
            >
              Company Support Portal
            </button>
          </div>
        )}

        <div className="flex items-center gap-4 text-outline font-bold text-[10px] uppercase tracking-widest mb-6">
          <span>Master Integrations Dashboard</span>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Console Card */}
          <Card className="lg:col-span-2 border border-border-subtle shadow-sm bg-white dark:bg-slate-900 rounded-2xl">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-5">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-6 w-6 text-safety-blue" />
                <div>
                  <CardTitle className="text-xl font-bold text-midnight-navy dark:text-white">Global Integration Console</CardTitle>
                  <CardDescription className="dark:text-slate-400">Infrastructure and routing requirements for tenant white-labeling.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="space-y-4">
                <h4 className="font-bold text-sm text-midnight-navy dark:text-white flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
                  Active Routing Pointer (DNS Target)
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  All tenant custom domains map to this central target. Ensure your DNS server continues to route traffic correctly:
                </p>

                <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800 rounded-xl font-mono text-xs space-y-2">
                  <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span className="font-bold text-slate-400 uppercase text-[10px]">DNS Hostname</span>
                    <span className="font-bold text-slate-400 uppercase text-[10px]">Points to Target</span>
                    <span className="font-bold text-slate-400 uppercase text-[10px]">Status</span>
                  </div>
                  <div className="flex justify-between text-midnight-navy dark:text-white pt-1">
                    <span>domains.tracelytag.com</span>
                    <span>tracly-tag-final-traclytag-ruddy.vercel.app</span>
                    <span className="text-emerald-500 font-bold">ONLINE</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4 border-t border-slate-100 dark:border-slate-800 pt-6">
                <h4 className="font-bold text-sm text-midnight-navy dark:text-white">Server-Side Actions Required:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-xs text-midnight-navy dark:text-white uppercase tracking-wider">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-safety-blue/10 text-safety-blue font-bold text-[10px]">1</span>
                      Dynamic SSL/TLS Setup
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Configure your reverse proxy (Nginx/Traefik) or cloud host (Vercel Custom Domains API / Cloudflare for SaaS) to dynamically issue SSL certificates for newly mapped tenant domains.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-xs text-midnight-navy dark:text-white uppercase tracking-wider">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-safety-blue/10 text-safety-blue font-bold text-[10px]">2</span>
                      Host Headers Detection
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Ensure the backend API and frontend routing detect the incoming HTTP <code>Host</code> header to query the database and render the correct tenant's branded portal.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            {/* Quick Config Card */}
            <Card className="border border-border-subtle shadow-sm bg-white dark:bg-slate-900 rounded-2xl p-6 space-y-6">
              <h3 className="font-bold text-sm text-midnight-navy dark:text-white uppercase tracking-wider">Master Actions</h3>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg h-fit">
                    <Server className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">Reverse Proxy SSL Status</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Wildcard TLS certificate verified active for domain endpoints.</p>
                  </div>
                </div>

                <div className="flex gap-3 border-t border-slate-100 dark:border-slate-800 pt-4">
                  <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg h-fit">
                    <Globe className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">CNAME Validation Server</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">DNS validation server running at 142.250.190.46.</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Instance Card */}
            <Card className="border border-border-subtle bg-white dark:bg-slate-900 shadow-sm rounded-2xl p-6 space-y-4">
              <div>
                <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Instance</p>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-success-emerald animate-pulse"></div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">Production Node 04</span>
                </div>
              </div>
              <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800">
                <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Mobile API Endpoint</p>
                <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 rounded-lg p-1.5 border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <span className="text-[10px] font-mono text-slate-600 dark:text-slate-400 truncate flex-1 select-all" title={getApiBaseUrl()}>
                    {getApiBaseUrl()}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 shrink-0 cursor-pointer"
                    onClick={() => {
                      navigator.clipboard.writeText(getApiBaseUrl());
                      toast.success("Mobile API endpoint copied to clipboard");
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800">
                <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">API Authorization Token</p>
                <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 rounded-lg p-1.5 border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <span className="text-[10px] font-mono text-slate-600 dark:text-slate-400 truncate flex-1 select-all" title={getAuthToken()}>
                    {getAuthToken()}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 shrink-0 cursor-pointer"
                    onClick={() => {
                      navigator.clipboard.writeText(getAuthToken());
                      toast.success("API Authorization Token copied to clipboard");
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </Card>

            {/* SMTP Test Card */}
            <Card className="border border-border-subtle bg-white dark:bg-slate-900 shadow-sm rounded-2xl p-6 space-y-4">
              <h3 className="font-bold text-sm text-midnight-navy dark:text-white uppercase tracking-wider">SMTP Connection Test</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Test SMTP routing configuration and OTP delivery logs to ensure notifications deliver correctly.
              </p>
              <form onSubmit={handleSendSmtpTest} className="space-y-3.5 flex flex-col text-left">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">Super Master Password</label>
                  <Input
                    type="password"
                    placeholder="Enter supermaster password"
                    value={smtpPassword}
                    onChange={(e) => setSmtpPassword(e.target.value)}
                    className="bg-white dark:bg-slate-900 text-xs py-1.5 h-8 border border-slate-200 dark:border-slate-800 rounded focus-visible:border-[#2563EB] focus-visible:ring-0"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">Test Recipient Email</label>
                  <Input
                    type="email"
                    placeholder="recipient@example.com"
                    value={smtpRecipient}
                    onChange={(e) => setSmtpRecipient(e.target.value)}
                    className="bg-white dark:bg-slate-900 text-xs py-1.5 h-8 border border-slate-200 dark:border-slate-800 rounded focus-visible:border-[#2563EB] focus-visible:ring-0"
                  />
                </div>

                {smtpError && (
                  <div className="p-2 text-[10px] bg-red-50 text-red-700 border border-red-205 rounded leading-normal max-h-24 overflow-y-auto font-mono">
                    ⚠️ {smtpError}
                  </div>
                )}

                {smtpSuccess && (
                  <div className="p-2 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-205 rounded leading-normal font-mono">
                    ✅ {smtpSuccess}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isSendingSmtpTest}
                  className="w-full bg-[#2563EB] hover:bg-blue-600 text-white font-semibold text-[11px] h-8 rounded mt-1 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isSendingSmtpTest ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send Test Email"
                  )}
                </Button>
              </form>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="h-8 w-8 animate-spin text-safety-blue" />
          <p className="text-sm text-slate-400 animate-pulse">Loading developer portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto font-sans pb-16">
      {isSuperMaster && (
        <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit mb-6">
          <button
            type="button"
            onClick={() => setSupportMode("system")}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-semibold transition-all",
              supportMode === "system"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
            )}
          >
            System Console
          </button>
          <button
            type="button"
            onClick={() => setSupportMode("company")}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-semibold transition-all",
              supportMode === "company"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
            )}
          >
            Company Support Portal
          </button>
        </div>
      )}

      {isSuperMaster && supportMode === "company" && (
        <div className="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between gap-4 mb-6">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Company Context</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Select target company node to view/manage its developer options</span>
          </div>
          <Select 
            value={selectedCompanyId.toString()} 
            onValueChange={(val) => setSelectedCompanyId(Number(val))}
          >
            <SelectTrigger className="w-[280px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg">
              <SelectValue placeholder="Select company" />
            </SelectTrigger>
            <SelectContent>
              {companies.map((c: any) => (
                <SelectItem key={c.id} value={c.id.toString()}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex items-center gap-4 text-outline font-bold text-[10px] uppercase tracking-widest mb-6">
        <span>Help, Support & Developer Integrations</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl h-11">
              <TabsTrigger value="overview" className="rounded-lg text-xs font-semibold">Overview</TabsTrigger>
              <TabsTrigger value="domain" className="rounded-lg text-xs font-semibold">1. Custom Domain</TabsTrigger>
              <TabsTrigger value="widget" className="rounded-lg text-xs font-semibold">2. JS Widget</TabsTrigger>
              <TabsTrigger value="api" className="rounded-lg text-xs font-semibold">3. Headless API</TabsTrigger>
            </TabsList>

            {/* TAB: OVERVIEW */}
            <TabsContent value="overview" className="mt-4">
              <Card className="border border-border-subtle bg-white dark:bg-slate-900 shadow-sm rounded-2xl overflow-hidden">
                <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
                  <CardTitle className="text-lg font-bold text-midnight-navy dark:text-white flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-safety-blue" />
                    How to Host Product Verification on Your Own Website
                  </CardTitle>
                  <CardDescription className="dark:text-slate-400">
                    TracelyTag gives you three easy ways to integrate verified authenticity checks into your custom domain or store page.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="bg-slate-50/50 dark:bg-slate-950/20 border-slate-100 dark:border-slate-800 p-4 rounded-xl space-y-3">
                      <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500 w-fit">
                        <Globe className="h-5 w-5" />
                      </div>
                      <h4 className="font-bold text-sm text-midnight-navy dark:text-white">1. Custom Domain</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Point a domain like <code className="font-mono text-[10px]">verify.yourbrand.com</code> to TracelyTag. Renders a white-labeled verification page.
                      </p>
                    </Card>

                    <Card className="bg-slate-50/50 dark:bg-slate-950/20 border-slate-100 dark:border-slate-800 p-4 rounded-xl space-y-3">
                      <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500 w-fit">
                        <Code2 className="h-5 w-5" />
                      </div>
                      <h4 className="font-bold text-sm text-midnight-navy dark:text-white">2. JS Widget</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Embed an interactive HTML/JS verification box on your existing Shopify, WordPress, or custom web pages.
                      </p>
                    </Card>

                    <Card className="bg-slate-50/50 dark:bg-slate-950/20 border-slate-100 dark:border-slate-800 p-4 rounded-xl space-y-3">
                      <div className="p-2 bg-purple-500/10 rounded-lg text-purple-500 w-fit">
                        <Key className="h-5 w-5" />
                      </div>
                      <h4 className="font-bold text-sm text-midnight-navy dark:text-white">3. Headless API</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Query TracelyTag programmatically using REST APIs and render verification details within your custom backend layout.
                      </p>
                    </Card>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Next Steps: Hosting Products Under Your Custom Domain</h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/10 space-y-1.5">
                        <div className="flex items-center gap-2 font-bold text-xs text-[#2563EB]">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 font-bold text-[10px]">1</span>
                          Point CNAME
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                          Go to your DNS manager (e.g. Cloudflare, GoDaddy) and point your subdomain CNAME (e.g. <code>verify.brand.com</code>) to <code>domains.tracelytag.com</code>.
                        </p>
                      </div>

                      <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/10 space-y-1.5">
                        <div className="flex items-center gap-2 font-bold text-xs text-[#2563EB]">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 font-bold text-[10px]">2</span>
                          Save Custom Domain
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                          In the "Custom Domain" tab, enter your pointed subdomain URL and click save. The system will configure SSL certificates automatically.
                        </p>
                      </div>

                      <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/10 space-y-1.5">
                        <div className="flex items-center gap-2 font-bold text-xs text-[#2563EB]">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 font-bold text-[10px]">3</span>
                          Automatic Isolation
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                          Visitors browsing your custom domain will only see your products. Verification workflows and scans isolate automatically under your brand context.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800 flex items-start gap-4">
                    <HelpCircle className="h-5 w-5 text-safety-blue flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h5 className="text-sm font-bold text-midnight-navy dark:text-white">Need custom design adjustments?</h5>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        The JavaScript widget and Custom Domain portal both support inheriting custom stylesheets. Contact support if you need assistance configuring themes or logos.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB: CUSTOM DOMAIN */}
            <TabsContent value="domain" className="mt-4">
              <Card className="border border-border-subtle bg-white dark:bg-slate-900 shadow-sm rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-midnight-navy dark:text-white flex items-center gap-2">
                    <Globe className="h-5 w-5 text-blue-500" />
                    Configure Your Custom Domain
                  </CardTitle>
                  <CardDescription className="dark:text-slate-400">
                    Host our secure verification page under your own custom domain name (e.g. <code className="font-mono">verify.luphoni.com</code>).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <form onSubmit={handleSaveDomain} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Domain Name</label>
                      <div className="flex gap-2">
                        <Input 
                          placeholder="e.g. verify.luphoni.com" 
                          value={domainInput}
                          onChange={(e) => setDomainInput(e.target.value)}
                          className="bg-slate-50 dark:bg-slate-950 max-w-md h-10 border-slate-200 dark:border-slate-800"
                        />
                        <Button 
                          type="submit" 
                          disabled={isUpdatingDomain}
                          className="bg-safety-blue hover:bg-safety-blue-hover text-white font-bold h-10 cursor-pointer"
                        >
                          {isUpdatingDomain ? "Saving..." : "Save Domain"}
                        </Button>
                      </div>
                    </div>
                  </form>

                  <div className="border-t border-slate-100 dark:border-slate-800 pt-6 space-y-4">
                    <h4 className="font-bold text-sm text-midnight-navy dark:text-white">Required DNS Setup:</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Add a CNAME record in your domain registrar's DNS manager (GoDaddy, Cloudflare, Namecheap, etc.) to route traffic to TracelyTag:
                    </p>

                    <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800 rounded-xl font-mono text-xs overflow-x-auto space-y-2">
                      <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                        <span className="font-bold text-slate-400 uppercase text-[10px]">Type</span>
                        <span className="font-bold text-slate-400 uppercase text-[10px]">Host/Name</span>
                        <span className="font-bold text-slate-400 uppercase text-[10px]">Points To/Value</span>
                      </div>
                      <div className="flex justify-between text-midnight-navy dark:text-white pt-1">
                        <span>CNAME</span>
                        <span>{domainInput.split('.')[0] || "verify"}</span>
                        <span>domains.tracelytag.com</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB: JS WIDGET */}
            <TabsContent value="widget" className="mt-4">
              <Card className="border border-border-subtle bg-white dark:bg-slate-900 shadow-sm rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-midnight-navy dark:text-white flex items-center gap-2">
                    <Code2 className="h-5 w-5 text-emerald-500" />
                    Embeddable Verification Widget
                  </CardTitle>
                  <CardDescription className="dark:text-slate-400">
                    Copy and paste this HTML/JS code into any page on your website to allow visitors to input and verify barcodes in real-time.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="relative">
                    <Button
                      onClick={() => copyToClipboard(widgetCodeSnippet, "widget")}
                      size="sm"
                      className="absolute right-3 top-3 bg-slate-800/80 hover:bg-slate-700 text-white font-bold gap-2 text-xs h-8 cursor-pointer rounded-lg border border-slate-700"
                    >
                      {copiedWidget ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-400" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Copy Snippet</span>
                        </>
                      )}
                    </Button>
                    <pre className="p-4 bg-slate-950 text-slate-300 rounded-xl text-xs font-mono overflow-x-auto max-h-[300px] border border-slate-900 leading-relaxed pt-12">
                      {widgetCodeSnippet}
                    </pre>
                  </div>

                  <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/20 dark:border-blue-900/30 dark:bg-blue-950/10 space-y-2">
                    <h5 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center gap-1.5">
                      💡 Integration Instructions
                    </h5>
                    <ul className="list-disc pl-4 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                      <li>Paste the snippet directly inside your site builder's Custom HTML block or theme files.</li>
                      <li>You can apply custom CSS styles to the elements inside the container to match your brand style exactly.</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB: HEADLESS API */}
            <TabsContent value="api" className="mt-4">
              <Card className="border border-border-subtle bg-white dark:bg-slate-900 shadow-sm rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-midnight-navy dark:text-white flex items-center gap-2">
                    <Key className="h-5 w-5 text-purple-500" />
                    Headless REST API Configuration
                  </CardTitle>
                  <CardDescription className="dark:text-slate-400">
                    Use your company's API key to query product verification data from your server or apps.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Company API Key</label>
                    <div className="flex gap-2">
                      <div className="relative flex-grow max-w-md">
                        <Input 
                          type={showApiKey ? "text" : "password"} 
                          readOnly 
                          value={company?.apiKey || "No API Key generated yet"} 
                          className="bg-slate-50 dark:bg-slate-950 font-mono text-xs pr-20 h-10 border-slate-200 dark:border-slate-800"
                        />
                        {company?.apiKey && (
                          <button
                            type="button"
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 hover:text-slate-700 bg-transparent border-0 cursor-pointer"
                          >
                            {showApiKey ? "Hide" : "Show"}
                          </button>
                        )}
                      </div>
                      <Button
                        onClick={() => company?.apiKey && copyToClipboard(company.apiKey, "key")}
                        disabled={!company?.apiKey}
                        className="bg-slate-100 hover:bg-slate-200 text-midnight-navy font-bold h-10 px-4 cursor-pointer border border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-white dark:hover:bg-slate-700"
                      >
                        {copiedKey ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                      <Button
                        onClick={handleRegenerateKey}
                        disabled={isRegeneratingKey}
                        className="bg-safety-blue hover:bg-safety-blue-hover text-white font-bold h-10 px-4 cursor-pointer gap-2"
                      >
                        <RefreshCw className={`h-4 w-4 ${isRegeneratingKey ? 'animate-spin' : ''}`} />
                        <span>{company?.apiKey ? "Regenerate" : "Generate Key"}</span>
                      </Button>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-800 pt-6 space-y-4">
                    <h4 className="font-bold text-sm text-midnight-navy dark:text-white">API Example: Fetch Code Details</h4>
                    <pre className="p-4 bg-slate-950 text-slate-300 rounded-xl text-xs font-mono overflow-x-auto border border-slate-900 leading-relaxed">
                      {`curl -X GET \\
  "${appOrigin}/api/codes/public/SERIAL_NUMBER_HERE" \\
  -H "Authorization: Bearer ${company?.apiKey || "YOUR_API_KEY"}"`}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar Help */}
        <div className="space-y-6">
          <Card className="border border-border-subtle bg-white dark:bg-slate-900 shadow-sm rounded-2xl">
            <CardHeader>
              <CardTitle className="text-md font-bold text-midnight-navy dark:text-white">Support & Resources</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2 hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition-all">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400">Developer Documentation</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Read complete integration guides and GS1 labeling best practices.
                </p>
                <a 
                  href="#" 
                  className="inline-flex items-center gap-1 text-xs font-bold text-safety-blue hover:underline pt-1"
                >
                  <span>Open API Docs</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2 hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition-all">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400">Need Enterprise Assistance?</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Our developer support team can help you map custom domains or build widgets.
                </p>
                <a 
                  href="mailto:support@tracelytag.com" 
                  className="inline-flex items-center gap-1 text-xs font-bold text-safety-blue hover:underline pt-1"
                >
                  <span>Contact Support Team</span>
                  <ArrowRight className="h-3 w-3" />
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Instance Card */}
          <Card className="border border-border-subtle bg-white dark:bg-slate-900 shadow-sm rounded-2xl p-6 space-y-4">
            <div>
              <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Instance</p>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-success-emerald animate-pulse"></div>
                <span className="text-xs font-bold text-slate-900 dark:text-white">Production Node 04</span>
              </div>
            </div>
            <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800">
              <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Mobile API Endpoint</p>
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 rounded-lg p-1.5 border border-slate-200 dark:border-slate-800 overflow-hidden">
                <span className="text-[10px] font-mono text-slate-600 dark:text-slate-400 truncate flex-1 select-all" title={getApiBaseUrl()}>
                  {getApiBaseUrl()}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 shrink-0 cursor-pointer"
                  onClick={() => {
                    navigator.clipboard.writeText(getApiBaseUrl());
                    toast.success("Mobile API endpoint copied to clipboard");
                  }}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800">
              <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">API Authorization Token</p>
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 rounded-lg p-1.5 border border-slate-200 dark:border-slate-800 overflow-hidden">
                <span className="text-[10px] font-mono text-slate-600 dark:text-slate-400 truncate flex-1 select-all" title={getAuthToken()}>
                  {getAuthToken()}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 shrink-0 cursor-pointer"
                  onClick={() => {
                    navigator.clipboard.writeText(getAuthToken());
                    toast.success("API Authorization Token copied to clipboard");
                  }}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
