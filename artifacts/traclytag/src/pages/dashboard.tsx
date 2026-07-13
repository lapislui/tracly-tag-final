import { useState, useEffect } from "react";
import { useGetDashboardSummary, useGetCurrentUser } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Package, Layers, QrCode, CheckCircle, MapPin, Users, Building2, Copy, 
  ChevronRight, TrendingUp, ShieldAlert, AlertTriangle, MoreVertical, Globe, Download, Plus, Loader2, Filter 
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const { data: user } = useGetCurrentUser();
  const { data: summary, isLoading } = useGetDashboardSummary();

  const isMaster = user?.role === "master";

  const [hideRecentSerialization, setHideRecentSerialization] = useState(() => {
    return localStorage.getItem("traclytag_hide_recent_serialization") === "true";
  });

  useEffect(() => {
    const handleVisibilityChange = () => {
      setHideRecentSerialization(localStorage.getItem("traclytag_hide_recent_serialization") === "true");
    };
    window.addEventListener("traclytag_recent_serialization_visibility_changed", handleVisibilityChange);
    return () => {
      window.removeEventListener("traclytag_recent_serialization_visibility_changed", handleVisibilityChange);
    };
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  if (isLoading || !summary) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-[#737686]">
        <Loader2 className="h-8 w-8 animate-spin text-[#2563EB] mb-2" />
        <span className="text-sm font-semibold uppercase tracking-wider">Loading Executive Dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <nav className="flex items-center gap-2 text-[#737686] text-[10px] uppercase tracking-widest font-semibold mb-2">
            <span>Industrial Panel</span>
            <ChevronRight className="h-3 w-3 text-slate-400" />
            <span className="text-[#2563EB]">Executive Dashboard</span>
          </nav>
          <h2 className="text-3xl font-bold tracking-tight text-[#0F172A]">Executive Dashboard</h2>
          <p className="text-sm text-[#434655] mt-1">Global security monitoring and serialization integrity.</p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-6 lg:col-span-3">
          <Card className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm flex flex-col h-full hover:border-[#2563EB]/40 transition-colors">
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 bg-[#2563EB]/10 text-[#2563EB] rounded-lg flex items-center justify-center">
                <QrCode className="h-5 w-5" />
              </div>
              <div className="flex items-center gap-1 text-emerald-600 font-bold text-[10px] uppercase tracking-wider">
                <TrendingUp className="h-3 w-3" /> +12.5%
              </div>
            </div>
            <h3 className="text-[#737686] text-[11px] uppercase tracking-wider font-bold mb-1">Total Codes</h3>
            <p className="text-2xl font-bold text-[#0F172A]">{summary.totalCodes.toLocaleString()}</p>
            <p className="text-[10px] text-[#434655] mt-2 opacity-70">Active in current quarter</p>
          </Card>
        </div>

        <div className="col-span-12 md:col-span-6 lg:col-span-3">
          <Card className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm flex flex-col h-full hover:border-[#2563EB]/40 transition-colors">
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 bg-[#0F172A]/10 text-[#0F172A] rounded-lg flex items-center justify-center">
                <Layers className="h-5 w-5" />
              </div>
              <div className="text-[10px] text-[#737686] uppercase font-bold tracking-wider">Active Batch</div>
            </div>
            <h3 className="text-[#737686] text-[11px] uppercase tracking-wider font-bold mb-1">Active Batches</h3>
            <p className="text-2xl font-bold text-[#0F172A]">{summary.totalBatches.toLocaleString()}</p>
            <div className="mt-4 bg-[#F1F5F9] h-1.5 rounded-full overflow-hidden">
              <div className="bg-[#2563EB] h-full w-3/4"></div>
            </div>
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-6">
          <div className="bg-[#0F172A] text-white rounded-xl p-6 shadow-lg relative overflow-hidden h-full flex flex-col justify-between">
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start gap-4">
              <div>
                <h3 className="text-blue-200 text-[10px] uppercase tracking-wider font-bold">Security Alerts (24H)</h3>
                <p className="text-xl font-bold text-white mt-1 uppercase tracking-tight">2,841 Blocked Attempts</p>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 bg-red-500/20 border border-red-500/40 rounded-full">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                <span className="text-red-400 text-[10px] font-bold uppercase tracking-wider">CRITICAL THREAT LEVEL</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-8 mt-6 relative z-10">
              <div>
                <p className="text-white/40 text-[10px] uppercase font-bold mb-0.5">Unauthorized Geofence</p>
                <p className="text-lg font-bold text-white font-mono">1,102</p>
              </div>
              <div>
                <p className="text-white/40 text-[10px] uppercase font-bold mb-0.5">Duplicate Scan ID</p>
                <p className="text-lg font-bold text-white font-mono">948</p>
              </div>
              <div>
                <p className="text-white/40 text-[10px] uppercase font-bold mb-0.5">Expired Signature</p>
                <p className="text-lg font-bold text-white font-mono">791</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Split Grid */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left: Geofencing Live View */}
        <div className="col-span-12 lg:col-span-8 flex flex-col">
          <Card className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden flex flex-col h-full">
            <div className="px-6 py-4 border-b border-[#E2E8F0] flex justify-between items-center bg-[#F8FAFC]">
              <div>
                <h2 className="font-semibold text-[#0F172A] text-base">AI Geofencing Live View</h2>
                <p className="text-xs text-[#434655]">Real-time scan verification clusters</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="h-8 px-3 text-[10px] font-bold uppercase tracking-wider bg-white border border-[#E2E8F0] text-[#0F172A] hover:bg-slate-50 cursor-pointer">WORLDWIDE</Button>
                <Button className="h-8 px-3 text-[10px] font-bold uppercase tracking-wider bg-[#2563EB] hover:bg-[#2563EB]/90 text-white shadow-md cursor-pointer">ANOMALY ONLY</Button>
              </div>
            </div>
            <div className="relative aspect-video bg-[#0F172A] flex-1">
              <img 
                alt="Geofencing Map" 
                className="w-full h-full object-cover opacity-60 grayscale contrast-125 pointer-events-none" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuD5CQa_Fsw-g5I-mSSbEHryBLoqdjvWh4izjpJbR3uwaa-bFZ9A6s1VSwPApK4NkhsczW_MD-1Pb8aRDTdJiePa8Lt1ju1-wTiwQiqyWhWR-CjT52yXs6aa8NjNL65qvQLeGZy2h4OcuOY5TqAXmXJw56KhRxemVAfKkybfChl-d6hG-lZA96Q2yLX6Zc1ai6Iv4CH_OPQWCm9xks2YIupD7eus0WtZXwZoJ8nahCdQP9w7vOoZNGE8Qebi4r4diop0iMEPxNpc0Lix"
              />
              <div className="absolute inset-0 p-6 pointer-events-none">
                <div className="absolute top-6 right-6 bg-[#0F172A]/90 backdrop-blur-md p-4 rounded-lg border border-white/10 w-48 shadow-2xl">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2.5 h-2.5 bg-[#2563EB] rounded-full shadow-[0_0_8px_#2563eb]"></span>
                    <span className="text-[10px] text-white/70 uppercase font-bold tracking-wider">Verified Scan</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-red-500 rounded-full shadow-[0_0_8px_#EF4444]"></span>
                    <span className="text-[10px] text-white/70 uppercase font-bold tracking-wider">Fraud Attempt</span>
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <p className="text-white font-bold text-lg font-mono">99.8%</p>
                    <p className="text-white/40 text-[9px] uppercase font-bold">Integrity Rate</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Right: Fraud Feed */}
        <div className="col-span-12 lg:col-span-4">
          <Card className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden h-full flex flex-col">
            <div className="px-6 py-4 border-b border-[#E2E8F0] flex justify-between items-center bg-[#F8FAFC]">
              <h2 className="font-semibold text-[#0F172A] text-base">Fraud Alert Feed</h2>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-[#737686] hover:text-[#0F172A] cursor-pointer">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[360px]">
              {/* Alert Item 1 */}
              <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-lg">
                <div className="flex gap-3">
                  <div className="p-2 bg-red-500/10 text-red-600 rounded-lg h-fit">
                    <ShieldAlert className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-xs font-bold text-red-600 font-mono">TR-99412-B</p>
                      <span className="text-[9px] text-[#737686] font-bold">2M AGO</span>
                    </div>
                    <p className="text-xs font-bold text-[#0F172A]">Unauthorized Geofence Breach</p>
                    <p className="text-[10px] text-[#434655] mt-1 leading-relaxed opacity-80">Shanghai, CN. Expected: Frankfurt, DE.</p>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" className="bg-[#0F172A] hover:bg-[#2563EB] text-white text-[9px] h-6 px-2.5 rounded font-bold uppercase cursor-pointer">Quarantine</Button>
                      <Button variant="outline" size="sm" className="text-[9px] h-6 px-2.5 rounded font-bold uppercase cursor-pointer">View Batch</Button>
                    </div>
                  </div>
                </div>
              </div>
              {/* Alert Item 2 */}
              <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                <div className="flex gap-3">
                  <div className="p-2 bg-amber-500/10 text-amber-600 rounded-lg h-fit">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-xs font-bold text-[#0F172A] font-mono">SZ-00122-K</p>
                      <span className="text-[9px] text-[#737686] font-bold">14M AGO</span>
                    </div>
                    <p className="text-xs font-bold text-[#0F172A]">Duplicate Signature Detected</p>
                    <p className="text-[10px] text-[#434655] mt-1 opacity-80">System auto-voided hash.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#E2E8F0] bg-[#F8FAFC] text-center">
              <Button variant="link" className="text-[#2563EB] font-bold text-[10px] uppercase tracking-wider hover:underline h-fit p-0 cursor-pointer">View All Alerts (42)</Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Recent Serialization Table */}
      {!hideRecentSerialization && (
        <Card className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E2E8F0] bg-[#F8FAFC] flex justify-between items-center">
            <h2 className="font-semibold text-[#0F172A] text-base">Recent Product Serialization</h2>
            <div className="flex gap-3">
              <Button variant="outline" className="flex items-center gap-2 h-9 border border-[#E2E8F0] bg-white hover:bg-slate-50 font-bold text-[#0F172A] px-3 cursor-pointer">
                <Filter className="h-4 w-4" /> Filter
              </Button>
              <Button className="flex items-center gap-2 h-9 bg-[#2563EB] hover:bg-[#2563EB]/90 text-white px-4 rounded-lg font-semibold shadow-md cursor-pointer">
                <Plus className="h-4 w-4" /> Generate New
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                  <TableHead className="px-6 py-4 text-[11px] font-bold text-[#737686] uppercase tracking-wider">Unit ID</TableHead>
                  <TableHead className="px-6 py-4 text-[11px] font-bold text-[#737686] uppercase tracking-wider">Product Name</TableHead>
                  <TableHead className="px-6 py-4 text-[11px] font-bold text-[#737686] uppercase tracking-wider">Batch No.</TableHead>
                  <TableHead className="px-6 py-4 text-[11px] font-bold text-[#737686] uppercase tracking-wider">Status</TableHead>
                  <TableHead className="px-6 py-4 text-[11px] font-bold text-[#737686] uppercase tracking-wider">Level</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.recentCodes?.map((code) => (
                  <TableRow key={code.id} className="hover:bg-slate-50 transition-colors border-b border-[#E2E8F0]">
                    <td className="px-6 py-4 font-mono font-bold text-[#2563EB] text-xs">
                      <div className="flex items-center gap-2">
                        <span className="truncate max-w-[150px] inline-block">{code.serialNumber || code.ssccCode}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-[#737686] cursor-pointer" onClick={() => copyToClipboard(code.rawString)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-[#0F172A] text-sm">{code.productName || "Unknown"}</td>
                    <td className="px-6 py-4 font-mono text-xs text-[#434655]">{code.batchNumber || "Unknown"}</td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                        code.mapped 
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" 
                          : "bg-slate-100 text-[#434655] border-slate-200"
                      )}>
                        {code.mapped ? "Mapped" : "Unmapped"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className="uppercase font-mono tracking-wider">{code.level}</Badge>
                    </td>
                  </TableRow>
                ))}
                {(!summary.recentCodes || summary.recentCodes.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-[#737686]">
                      No recent codes found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Technical Footnote */}
      <div className="mt-8 flex items-center justify-between border-t border-[#E2E8F0] pt-6 text-[10px] text-[#737686] uppercase tracking-widest font-semibold">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#10B981] inline-block animate-pulse"></span>
            <span>System Status: Optimal</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span>Last Sync: 2m ago</span>
          </div>
        </div>
        <div>© 2026 TracelyTag Systems Inc. Confidential Industrial Interface</div>
      </div>
    </div>
  );
}

