import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { 
  ChevronRight, Search, Filter, Download, Eye, ChevronLeft, QrCode, Maximize2, Loader2,
  Lock, EyeOff, ShieldCheck, Fingerprint, Smartphone, CheckCircle2, AlertCircle, ArrowRight, Printer, Check,
  Camera, Volume2, RefreshCw, Wifi, Keyboard, ClipboardList, Info, Clock, CheckCircle
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { 
  useGetProductReport, 
  useListProducts, 
  useListBatches, 
  useListLocations,
  getGetProductReportQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export default function MappingCode() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  
  // Real API integration
  const { data: reportData = [], isLoading: isLoadingReport } = useGetProductReport();
  const { data: products = [] } = useListProducts();
  const { data: batches = [] } = useListBatches({});
  const { data: locations = [] } = useListLocations();

  // Dropdown filter states
  const [filterProductId, setFilterProductId] = useState<string>("all");
  const [filterBatchId, setFilterBatchId] = useState<string>("all");
  const [downloadingBatch, setDownloadingBatch] = useState<string | null>(null);

  // Status Details Dialog state (Mapped vs Pending popup)
  const [detailBatchId, setDetailBatchId] = useState<number | null>(null);
  const [detailBatchNumber, setDetailBatchNumber] = useState<string>("");
  const [detailCodesList, setDetailCodesList] = useState<any[]>([]);
  const [loadingDetailCodes, setLoadingDetailCodes] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "mapped" | "pending">("all");

  // Wizard state
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<"login" | "batch" | "scan" | "status">("login");
  const [selectedRow, setSelectedRow] = useState<any>(null);
  const [operatorId, setOperatorId] = useState("OP-82914");
  const [accessToken, setAccessToken] = useState("password123");
  const [showAccessToken, setShowAccessToken] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [isAutoScanning, setIsAutoScanning] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printSuccess, setPrintSuccess] = useState(false);

  // Live Camera and Scanner machine state
  const [inputMode, setInputMode] = useState<"camera" | "scanner_machine">("camera");
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [scannerInputValue, setScannerInputValue] = useState("");
  
  // Real codes list for the active mapping wizard
  const [codesList, setCodesList] = useState<any[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");

  // Synthesize a scan beep audio effect using Web Audio API
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(1200, audioCtx.currentTime); // 1200Hz frequency
      gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime); // volume

      oscillator.start();
      setTimeout(() => {
        oscillator.stop();
        audioCtx.close();
      }, 100); // 100ms beep
    } catch (e) {
      console.warn("Audio Context blocked or failed to initialize", e);
    }
  };

  // Enumerate cameras
  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices()
        .then(devices => {
          const videoDevices = devices.filter(device => device.kind === "videoinput");
          setCameras(videoDevices);
          if (videoDevices.length > 0 && !selectedCameraId) {
            setSelectedCameraId(videoDevices[0].deviceId);
          }
        })
        .catch(err => console.error("Error enumerating video inputs", err));
    }
  }, [isWizardOpen]);

  // Load locations default selection
  useEffect(() => {
    if (locations.length > 0 && !selectedLocationId) {
      setSelectedLocationId(locations[0].id.toString());
    }
  }, [locations, selectedLocationId]);

  // Fetch codes for the active batch in the wizard
  useEffect(() => {
    if (isWizardOpen && selectedRow?.batchId) {
      fetch(`/api/codes?batchId=${selectedRow.batchId}&limit=5000`)
        .then(res => res.json())
        .then(data => {
          setCodesList(data || []);
        })
        .catch(err => console.error("Error loading codes: ", err));
    }
  }, [isWizardOpen, selectedRow?.batchId]);

  // Map codes scan progress matching
  useEffect(() => {
    if (codesList.length > 0) {
      const mappedCount = codesList.filter(c => c.mapped).length;
      setScanProgress(mappedCount);
    }
  }, [codesList]);

  // Auto transition to status screen when batch is fully mapped
  useEffect(() => {
    if (isWizardOpen && wizardStep === "scan" && codesList.length > 0 && codesList.every(c => c.mapped)) {
      setIsAutoScanning(false);
      setTimeout(() => {
        setWizardStep("status");
      }, 800);
    }
  }, [codesList, isWizardOpen, wizardStep]);

  // Map scanned code function
  const mapScannedCode = async (codeId: number) => {
    try {
      const response = await fetch(`/api/codes/${codeId}/map`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          locationId: parseInt(selectedLocationId, 10) || 1
        })
      });
      
      if (!response.ok) throw new Error("Failed to map code");
      
      const updatedCode = await response.json();
      setCodesList(prev => prev.map(c => c.id === codeId ? { ...c, mapped: true } : c));
      toast.success(`Successfully mapped code: ${updatedCode.serialNumber || updatedCode.ssccCode}`);
      queryClient.invalidateQueries({ queryKey: getGetProductReportQueryKey() });
    } catch (err) {
      console.error("Mapping failed: ", err);
      toast.error("Failed to map scanned code");
    }
  };

  // Handle camera scanning with html5-qrcode
  useEffect(() => {
    let html5QrCode: any = null;
    const scannerId = "camera-viewfinder-element";

    if (isWizardOpen && wizardStep === "scan" && inputMode === "camera" && selectedCameraId) {
      import("html5-qrcode").then(({ Html5Qrcode }) => {
        const element = document.getElementById(scannerId);
        if (!element) return;

        html5QrCode = new Html5Qrcode(scannerId);
        const config = {
          fps: 10,
          qrbox: (width: number, height: number) => {
            const size = Math.min(width, height) * 0.7;
            return { width: size, height: size };
          }
        };

        const onScanSuccess = (decodedText: string) => {
          if (isScanning) return;

          // Normalize scanned serial code
          let searchSerial = decodedText.trim();
          if (searchSerial.includes("?")) {
            searchSerial = searchSerial.split("?")[0].trim();
          }
          if (searchSerial.includes("/code/")) {
            searchSerial = searchSerial.substring(searchSerial.indexOf("/code/") + 6);
          }
          if (searchSerial.includes("::")) {
            searchSerial = searchSerial.split("::")[1] || searchSerial;
          } else if (searchSerial.includes(":")) {
            const parts = searchSerial.split(":");
            searchSerial = parts[parts.length - 1] || searchSerial;
          }
          if (searchSerial.includes("-")) {
            const parts = searchSerial.split("-");
            const serialIndex = parts.findIndex(p => p.startsWith("21"));
            if (serialIndex > -1) {
              searchSerial = parts.slice(serialIndex).join("-").substring(2);
            } else {
              const ssccIndex = parts.findIndex(p => p.startsWith("00"));
              if (ssccIndex > -1) {
                searchSerial = parts.slice(ssccIndex).join("-").substring(2);
              }
            }
          } else if (searchSerial.includes("(21)")) {
            const match = searchSerial.match(/\(21\)([^()]+)/);
            if (match && match[1]) {
              searchSerial = match[1];
            }
          } else if (searchSerial.includes("(00)")) {
            const match = searchSerial.match(/\(00\)([^()]+)/);
            if (match && match[1]) {
              searchSerial = match[1];
            }
          } else if (searchSerial.startsWith("01") && searchSerial.length >= 18) {
            searchSerial = searchSerial.substring(18);
          } else if (searchSerial.startsWith("00") && searchSerial.length >= 20) {
            searchSerial = searchSerial.substring(2);
          }

          // Match code in current batch list
          const matchedCode = codesList.find(c => 
            c.serialNumber === searchSerial || 
            c.ssccCode === searchSerial || 
            c.rawString === searchSerial
          );

          if (!matchedCode) {
            toast.error(`Scanned code "${searchSerial}" does not belong to this batch!`);
            return;
          }

          if (matchedCode.mapped) {
            toast.info(`Code "${searchSerial}" is already mapped.`);
            return;
          }

          setIsScanning(true);
          playBeep();
          
          mapScannedCode(matchedCode.id).finally(() => {
            setIsScanning(false);
          });
        };

        const onScanFailure = () => {};

        html5QrCode.start(
          selectedCameraId,
          config,
          onScanSuccess,
          onScanFailure
        ).catch((err: any) => {
          console.warn("Html5Qrcode start failed: ", err);
        });
      });
    }

    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch((err: any) => console.error("Failed to stop scanner", err));
      }
    };
  }, [isWizardOpen, wizardStep, inputMode, selectedCameraId, codesList, isScanning]);

  // Demo auto scan generator
  useEffect(() => {
    let timer: any;
    const pendingCode = codesList.find(c => !c.mapped);
    if (isAutoScanning && isWizardOpen && wizardStep === "scan" && pendingCode) {
      timer = setTimeout(() => {
        setIsScanning(true);
        setTimeout(() => {
          setIsScanning(false);
          playBeep();
          mapScannedCode(pendingCode.id);
        }, 300);
      }, 850);
    } else if (isAutoScanning && !pendingCode) {
      setIsAutoScanning(false);
    }
    return () => clearTimeout(timer);
  }, [isAutoScanning, isWizardOpen, wizardStep, codesList]);

  const handleManualScan = () => {
    if (isScanning) return;
    const pendingCode = codesList.find(c => !c.mapped);
    if (!pendingCode) {
      toast.info("All codes in this batch are already mapped!");
      return;
    }
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      playBeep();
      mapScannedCode(pendingCode.id);
    }, 450);
  };

  const handlePrint = () => {
    setIsPrinting(true);
    setPrintSuccess(false);
    setTimeout(() => {
      setIsPrinting(false);
      setPrintSuccess(true);
    }, 1500);
  };

  const handleDownloadQR = async (batchNumber: string) => {
    setDownloadingBatch(batchNumber);
    try {
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
        window.location.origin + "/code/" + batchNumber
      )}`;
      const response = await fetch(qrUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `qrcode_${batchNumber}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Failed to download QR code image", e);
    } finally {
      setDownloadingBatch(null);
    }
  };

  // View Details popup handler (mapped vs pending codes list)
  const handleViewDetails = async (batchId: number, batchNumber: string) => {
    setDetailBatchId(batchId);
    setDetailBatchNumber(batchNumber);
    setLoadingDetailCodes(true);
    setActiveTab("all");
    try {
      const response = await fetch(`/api/codes?batchId=${batchId}&limit=5000`);
      if (!response.ok) throw new Error("Failed to fetch codes");
      const codes = await response.json();
      setDetailCodesList(codes || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load status details");
    } finally {
      setLoadingDetailCodes(false);
    }
  };

  // Filtered batch report list
  const filteredReport = reportData.filter((row) => {
    if (filterProductId !== "all" && row.productId?.toString() !== filterProductId) return false;
    if (filterBatchId !== "all" && row.batchId?.toString() !== filterBatchId) return false;
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        row.productName?.toLowerCase().includes(searchLower) ||
        row.batchNumber?.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 font-sans text-midnight-navy">
      {/* Page Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <nav className="flex items-center gap-2 text-outline font-bold text-[10px] mb-2 uppercase tracking-widest text-[#737686]">
            <span>Industrial Panel</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-safety-blue">Mapping Code</span>
          </nav>
          <h2 className="text-3xl font-bold tracking-tight">Mapping Code Module</h2>
          <p className="text-sm text-on-surface-variant mt-1">Manage and audit QR code mapping across production batches.</p>
        </div>
      </div>

      {/* Filter Container */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg p-4 flex flex-wrap items-center gap-4 shadow-sm">
        <div className="flex-1 min-w-[240px]">
          <label className="font-bold text-[10px] text-[#737686] mb-1 block uppercase">Search Products/Batches</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#737686] h-4 w-4" />
            <Input
              className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg py-2 pl-10 pr-4 text-sm focus:border-safety-blue outline-none transition-all h-10"
              placeholder="Filter by name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="font-bold text-[10px] text-[#737686] mb-1 block uppercase">Product Name</label>
          <select 
            value={filterProductId}
            onChange={(e) => {
              setFilterProductId(e.target.value);
              setFilterBatchId("all");
            }}
            className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg py-2 px-3 text-sm focus:border-safety-blue outline-none transition-all h-10"
          >
            <option value="all">All Products</option>
            {products.map(p => (
              <option key={p.id} value={p.id.toString()}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="font-bold text-[10px] text-[#737686] mb-1 block uppercase">Batch Name</label>
          <select 
            value={filterBatchId}
            onChange={(e) => setFilterBatchId(e.target.value)}
            className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg py-2 px-3 text-sm focus:border-safety-blue outline-none transition-all h-10"
            disabled={filterProductId === "all"}
          >
            <option value="all">All Batches</option>
            {batches
              .filter(b => b.productId?.toString() === filterProductId)
              .map(b => (
                <option key={b.id} value={b.id.toString()}>{b.batchNumber}</option>
              ))
            }
          </select>
        </div>
        <div className="flex items-end h-full mt-5">
          <Button 
            variant="outline" 
            onClick={() => {
              setSearchTerm("");
              setFilterProductId("all");
              setFilterBatchId("all");
            }}
            className="h-10 px-3 border border-[#E2E8F0] rounded-lg hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4 text-[#434655]" />
          </Button>
        </div>
        <div className="flex items-end h-full ml-auto mt-5">
          <Button variant="outline" className="flex items-center gap-2 h-10 px-4 border border-[#E2E8F0] rounded-lg font-bold text-midnight-navy hover:bg-slate-50">
            <Download className="h-4 w-4" />
            Export XLSX
          </Button>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-[#E2E8F0]">
                <th className="px-6 py-4 font-bold text-[11px] text-[#737686] uppercase tracking-wider whitespace-nowrap">Product Name</th>
                <th className="px-6 py-4 font-bold text-[11px] text-[#737686] uppercase tracking-wider whitespace-nowrap">Batch Name</th>
                <th className="px-6 py-4 font-bold text-[11px] text-[#737686] uppercase tracking-wider whitespace-nowrap text-right">Total QR</th>
                <th className="px-6 py-4 font-bold text-[11px] text-[#737686] uppercase tracking-wider whitespace-nowrap text-right">Mapped QR</th>
                <th className="px-6 py-4 font-bold text-[11px] text-[#737686] uppercase tracking-wider whitespace-nowrap text-right">Remaining QR</th>
                <th className="px-6 py-4 font-bold text-[11px] text-[#737686] uppercase tracking-wider whitespace-nowrap text-center">Efficiency</th>
                <th className="px-6 py-4 font-bold text-[11px] text-[#737686] uppercase tracking-wider whitespace-nowrap text-right">Actions</th>
                <th className="px-6 py-4 font-bold text-[11px] text-[#737686] uppercase tracking-wider whitespace-nowrap text-center">Mapping Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {isLoadingReport ? (
                <tr>
                  <td colSpan={8} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-safety-blue" />
                  </td>
                </tr>
              ) : filteredReport.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-500 text-sm">
                    No active batch serialization data found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredReport.map((row) => {
                  const efficiency = row.total ? Math.round((row.mapped / row.total) * 100) : 0;
                  const isFinished = efficiency === 100;
                  return (
                    <tr key={row.batchId} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-semibold text-midnight-navy">{row.productName}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 font-mono">{row.batchNumber}</td>
                      <td className="px-6 py-4 text-sm text-right text-slate-600">{Number(row.total).toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm text-right text-slate-600">{Number(row.mapped).toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm text-right text-slate-600">{Number(row.unmapped).toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm text-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${isFinished ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {efficiency}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-8 w-8 text-slate-600 hover:text-safety-blue hover:border-safety-blue transition-colors cursor-pointer"
                            title="Start scan mapping process"
                            onClick={() => {
                              setSelectedRow({
                                product: row.productName,
                                batch: row.batchNumber,
                                batchId: row.batchId,
                                total: row.total,
                                mapped: row.mapped
                              });
                              setWizardStep("login");
                              setIsWizardOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center">
                          <Button 
                            variant="ghost" 
                            className="flex items-center gap-1.5 h-8 px-3 text-xs font-bold text-safety-blue hover:bg-slate-100 border border-slate-200 rounded-lg transition-all cursor-pointer"
                            onClick={() => handleViewDetails(row.batchId, row.batchNumber)}
                          >
                            <ClipboardList className="h-3.5 w-3.5" />
                            View Status
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-6 py-4 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center justify-between">
          <span className="text-sm text-[#434655]">Showing <span className="font-semibold text-midnight-navy">1 to {filteredReport.length}</span> of <span className="font-semibold text-midnight-navy">{filteredReport.length}</span> batches</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8 disabled:opacity-30" disabled>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1">
              <Button className="w-8 h-8 p-0 bg-safety-blue hover:bg-safety-blue/90 text-white font-bold text-sm">1</Button>
            </div>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Dialog for Mapping Status Details (Mapped vs Pending Popup) */}
      <Dialog open={detailBatchId !== null} onOpenChange={(open) => !open && setDetailBatchId(null)}>
        <DialogContent className="sm:max-w-[550px] max-h-[85vh] flex flex-col bg-white border border-[#E2E8F0] text-midnight-navy font-sans p-6 rounded-2xl shadow-2xl">
          <DialogHeader className="border-b border-[#E2E8F0] pb-4 shrink-0">
            <DialogTitle className="text-xl font-bold tracking-tight">Mapping Audit Log</DialogTitle>
            <DialogDescription className="text-slate-500 text-sm">
              Batch: <span className="font-mono font-bold text-slate-800">{detailBatchNumber}</span> • Code mapping status tracker.
            </DialogDescription>
          </DialogHeader>

          {/* Quick stats dashboard */}
          <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl mt-3 shrink-0">
            <div className="text-center border-r border-slate-200">
              <div className="text-[10px] text-slate-400 font-bold uppercase">Total Codes</div>
              <div className="text-lg font-extrabold text-slate-800">{detailCodesList.length}</div>
            </div>
            <div className="text-center border-r border-slate-200">
              <div className="text-[10px] text-emerald-600 font-bold uppercase flex items-center justify-center gap-1">
                <CheckCircle className="h-3 w-3" /> Mapped
              </div>
              <div className="text-lg font-extrabold text-emerald-600">{detailCodesList.filter(c => c.mapped).length}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-slate-500 font-bold uppercase flex items-center justify-center gap-1">
                <Clock className="h-3 w-3 text-slate-400" /> Pending
              </div>
              <div className="text-lg font-extrabold text-slate-500">{detailCodesList.filter(c => !c.mapped).length}</div>
            </div>
          </div>

          {/* Tabs header */}
          <div className="flex border-b border-[#E2E8F0] mt-4 shrink-0 gap-1.5">
            <button
              onClick={() => setActiveTab("all")}
              className={`pb-2.5 px-4 font-bold text-xs border-b-2 transition-all ${activeTab === "all" ? "border-safety-blue text-safety-blue" : "border-transparent text-slate-400 hover:text-slate-600"}`}
            >
              All Codes ({detailCodesList.length})
            </button>
            <button
              onClick={() => setActiveTab("mapped")}
              className={`pb-2.5 px-4 font-bold text-xs border-b-2 transition-all ${activeTab === "mapped" ? "border-safety-blue text-safety-blue" : "border-transparent text-slate-400 hover:text-slate-600"}`}
            >
              Mapped ({detailCodesList.filter(c => c.mapped).length})
            </button>
            <button
              onClick={() => setActiveTab("pending")}
              className={`pb-2.5 px-4 font-bold text-xs border-b-2 transition-all ${activeTab === "pending" ? "border-safety-blue text-safety-blue" : "border-transparent text-slate-400 hover:text-slate-600"}`}
            >
              Pending ({detailCodesList.filter(c => !c.mapped).length})
            </button>
          </div>

          <div className="flex-1 overflow-y-auto min-h-[220px] py-3 pr-1">
            {loadingDetailCodes ? (
              <div className="flex flex-col items-center justify-center h-[200px] gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-safety-blue" />
                <span className="text-xs text-slate-500">Loading code list...</span>
              </div>
            ) : detailCodesList.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                No codes found in this batch.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {detailCodesList
                  .filter(c => {
                    if (activeTab === "mapped") return c.mapped;
                    if (activeTab === "pending") return !c.mapped;
                    return true;
                  })
                  .map((code) => (
                    <div key={code.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                      <div>
                        <div className="font-mono font-bold text-slate-800 text-[13px] tracking-tight">
                          {code.serialNumber || code.ssccCode}
                        </div>
                        {code.mapped && (
                          <div className="text-[10px] text-slate-400 mt-1 flex flex-col gap-0.5">
                            <span>Mapped At: {new Date(code.mappedAt).toLocaleString()}</span>
                            <span>Mapped By: {code.mappedByUsername || "Unknown"} • Loc: {code.locationName || "Default Warehouse"}</span>
                          </div>
                        )}
                      </div>
                      <div className="shrink-0">
                        {code.mapped ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-50 text-green-700 border border-green-200">
                            Mapped
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200">
                            Pending
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                }
              </div>
            )}
          </div>
          <div className="border-t border-[#E2E8F0] pt-4 shrink-0 flex justify-end">
            <Button
              onClick={() => setDetailBatchId(null)}
              className="bg-safety-blue hover:bg-safety-blue/90 text-white font-bold h-10 px-6 rounded-xl text-sm"
            >
              Dismiss audit
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog for Mapping Process Wizard */}
      <Dialog open={isWizardOpen} onOpenChange={(open) => {
        if (!open) {
          setIsWizardOpen(false);
          setIsAutoScanning(false);
        }
      }}>
        <DialogContent className="sm:max-w-[480px] bg-slate-900 border border-slate-800 text-slate-100 font-sans p-6 rounded-2xl shadow-2xl overflow-hidden">
          {/* Step 1: Login Form */}
          {wizardStep === "login" && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-lg shadow-amber-500/5 mx-auto mb-2">
                  <Lock className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold tracking-tight text-white">Operator Authorization</h3>
                <p className="text-slate-400 text-sm">Verify identity to initialize code mapping context</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Operator ID</label>
                  <div className="relative">
                    <Input
                      className="bg-slate-800/80 border border-slate-700 text-white rounded-xl placeholder-slate-500 h-11 focus:border-amber-500 focus-visible:ring-1 focus-visible:ring-amber-500"
                      placeholder="e.g. OP-82914"
                      value={operatorId}
                      onChange={(e) => setOperatorId(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Access Token</label>
                  <div className="relative">
                    <Input
                      type={showAccessToken ? "text" : "password"}
                      className="bg-slate-800/80 border border-slate-700 text-white rounded-xl placeholder-slate-500 h-11 focus:border-amber-500 focus-visible:ring-1 focus-visible:ring-amber-500 pr-10"
                      placeholder="Enter access token"
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                      onClick={() => setShowAccessToken(!showAccessToken)}
                    >
                      {showAccessToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Biometrics */}
              <div className="bg-slate-800/30 border border-slate-800/50 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  <span>Secure Biometrics Quick Sign-In</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    className="border-slate-700 bg-slate-800/50 hover:bg-slate-800 hover:text-white text-slate-300 rounded-xl h-11 flex items-center justify-center gap-2 text-xs"
                    onClick={() => {
                      setOperatorId("OP-BIO-99");
                      setAccessToken("biometric-authorized");
                      setWizardStep("batch");
                    }}
                  >
                    <Fingerprint className="h-4 w-4 text-amber-500" />
                    Touch ID
                  </Button>
                  <Button
                    variant="outline"
                    className="border-slate-700 bg-slate-800/50 hover:bg-slate-800 hover:text-white text-slate-300 rounded-xl h-11 flex items-center justify-center gap-2 text-xs"
                    onClick={() => {
                      setOperatorId("OP-FACE-88");
                      setAccessToken("biometric-authorized");
                      setWizardStep("batch");
                    }}
                  >
                    <Smartphone className="h-4 w-4 text-amber-500" />
                    Face ID
                  </Button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 border-slate-700 bg-slate-800/20 text-slate-400 hover:text-white rounded-xl h-11"
                  onClick={() => setIsWizardOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl h-11 flex items-center justify-center gap-2"
                  onClick={() => setWizardStep("batch")}
                >
                  <span>Authorize Access</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Batch Config */}
          {wizardStep === "batch" && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shadow-lg shadow-blue-500/5 mx-auto mb-2">
                  <Smartphone className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold tracking-tight text-white">Configure Shipper Context</h3>
                <p className="text-slate-400 text-sm">Establish product scope and scan parameters</p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Product</label>
                    <div className="bg-slate-800/80 border border-slate-700 text-slate-350 text-slate-350 rounded-xl px-3 py-2 text-xs font-semibold leading-normal truncate h-11 flex items-center">
                      {selectedRow?.product || "Pharmaceutical A-202"}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Batch Number</label>
                    <div className="bg-slate-800/80 border border-slate-700 text-slate-350 text-slate-350 rounded-xl px-3 py-2 text-xs font-mono leading-normal h-11 flex items-center">
                      {selectedRow?.batch || "BTCH-2024-001"}
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mapping Location</label>
                  <select 
                    value={selectedLocationId}
                    onChange={(e) => setSelectedLocationId(e.target.value)}
                    className="w-full bg-slate-800/50 border border-slate-700 text-white rounded-xl px-3 h-11 text-sm focus:border-blue-500 outline-none"
                  >
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id.toString()} className="bg-slate-900 text-slate-100">
                        {loc.locationName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Shipper Unit Configuration</label>
                  <select className="w-full bg-slate-800/50 border border-slate-700 text-white rounded-xl px-3 h-11 text-sm focus:border-blue-500 outline-none">
                    <option value="1">1 Shipper Box (10 QRs)</option>
                    <option value="5">5 Shippers (50 QRs total)</option>
                    <option value="10">10 Shippers (100 QRs total)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">QR Code Capacity per Shipper</label>
                  <div className="bg-slate-800/80 border border-slate-700 text-slate-300 rounded-xl px-3 py-2 text-sm leading-normal h-11 flex items-center justify-between">
                    <span>10 QR codes / unit</span>
                    <span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded text-slate-400 font-bold uppercase">Standard</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 border-slate-700 bg-slate-800/20 text-slate-400 hover:text-white rounded-xl h-11"
                  onClick={() => setWizardStep("login")}
                >
                  Back
                </Button>
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl h-11 flex items-center justify-center gap-2"
                  onClick={() => {
                    setWizardStep("scan");
                  }}
                >
                  <span>Start Mapping Device</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Scan */}
          {wizardStep === "scan" && (
            <div className="space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold tracking-tight text-white">Mapping Terminal</h3>
                  <p className="text-slate-400 text-xs truncate max-w-[280px]">
                    {selectedRow?.product || "Pharmaceutical A-202"} ({selectedRow?.batch})
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-1 rounded font-bold uppercase tracking-wider">
                    Scanner Online
                  </span>
                </div>
              </div>

              {/* Mode Selection Tabs */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950/60 rounded-xl border border-slate-800">
                <button
                  type="button"
                  className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${inputMode === "camera" ? "bg-slate-800 text-white border border-slate-700 shadow-sm" : "text-slate-400 hover:text-slate-200"}`}
                  onClick={() => setInputMode("camera")}
                >
                  <Camera className="w-3.5 h-3.5" />
                  Device Camera
                </button>
                <button
                  type="button"
                  className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${inputMode === "scanner_machine" ? "bg-slate-800 text-white border border-slate-700 shadow-sm" : "text-slate-400 hover:text-slate-200"}`}
                  onClick={() => setInputMode("scanner_machine")}
                >
                  <Keyboard className="w-3.5 h-3.5" />
                  Scanner Machine
                </button>
              </div>

              {/* Camera selection */}
              {inputMode === "camera" && cameras.length > 1 && (
                <div className="flex items-center gap-2 text-xs bg-slate-800/40 border border-slate-800 px-3 py-2 rounded-xl">
                  <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-slate-400 text-[11px] font-medium mr-1">Active Camera:</span>
                  <select
                    value={selectedCameraId}
                    onChange={(e) => setSelectedCameraId(e.target.value)}
                    className="bg-transparent text-white border-none outline-none cursor-pointer text-xs flex-1 font-semibold"
                  >
                    {cameras.map((camera, i) => (
                      <option key={camera.deviceId} value={camera.deviceId} className="bg-slate-900 text-slate-100">
                        {camera.label || `Camera ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Progress Counters */}
              <div className="grid grid-cols-2 gap-4 bg-slate-800/40 border border-slate-800 rounded-xl p-3 text-center">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Mapping Location</p>
                  <p className="text-xs font-bold text-white mt-1 truncate">
                    {locations.find(l => l.id.toString() === selectedLocationId)?.locationName || "Warehouse"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Mapped Codes</p>
                  <p className="text-xl font-bold text-white mt-1">
                    {scanProgress} <span className="text-xs text-slate-500">/ {codesList.length}</span>
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-slate-400 font-medium">
                  <span>Capacity Mapped</span>
                  <span>{codesList.length ? Math.round((scanProgress / codesList.length) * 100) : 0}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
                  <div 
                    className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-300 rounded-full" 
                    style={{ width: `${codesList.length ? (scanProgress / codesList.length) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* Scanning Viewport / Scanner Area */}
              {inputMode === "camera" ? (
                <div className="bg-slate-950 border-2 border-slate-800 rounded-2xl overflow-hidden aspect-[4/3] flex flex-col items-center justify-center relative shadow-inner group">
                  {/* html5-qrcode target container element */}
                  <div 
                    id="camera-viewfinder-element" 
                    className="absolute inset-0 w-full h-full object-cover [&_video]:w-full [&_video]:h-full [&_video]:object-cover"
                  />

                  {/* Viewfinder crosshairs */}
                  <div className="border-t-2 border-l-2 border-emerald-500 w-6 h-6 absolute top-4 left-4 z-10" />
                  <div className="border-t-2 border-r-2 border-emerald-500 w-6 h-6 absolute top-4 right-4 z-10" />
                  <div className="border-b-2 border-l-2 border-emerald-500 w-6 h-6 absolute bottom-4 left-4 z-10" />
                  <div className="border-b-2 border-r-2 border-emerald-500 w-6 h-6 absolute bottom-4 right-4 z-10" />

                  {/* Laser scan animation line */}
                  <div className="absolute left-0 w-full h-[2px] bg-emerald-500 shadow-[0_0_10px_#10B981] top-1/2 -translate-y-1/2 z-10" />

                  {isScanning && (
                    <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center gap-3 z-20">
                      <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                      <p className="text-xs text-emerald-400 font-mono tracking-widest uppercase">Registering Code...</p>
                    </div>
                  )}

                  {/* Scanned Success Flash Overlay */}
                  {scanProgress > 0 && !isScanning && (
                    <div className="absolute bottom-4 bg-emerald-500/80 border border-emerald-500/40 px-3 py-1.5 rounded-full text-emerald-400 text-[10px] font-mono flex items-center gap-1.5 backdrop-blur-sm z-10 animate-pulse">
                      <Check className="w-3 h-3" />
                      <span>Last Scan: Mapping Verified</span>
                    </div>
                  )}
                </div>
              ) : (
                /* Scanner Machine Input Mode */
                <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-5 space-y-4 flex flex-col items-center justify-center relative min-h-[220px]">
                  <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-md">
                    <Wifi className="w-8 h-8 animate-pulse" />
                  </div>
                  <div className="text-center space-y-1">
                    <h4 className="text-sm font-semibold text-white">Hardware Scan Engine</h4>
                    <p className="text-xs text-slate-400 max-w-[300px] mx-auto">
                      Plug in your USB/Wireless scanner gun. Focus the input below, then pull the trigger on a QR barcode to map it instantly.
                    </p>
                  </div>

                  <div className="w-full space-y-2">
                    <div className="relative">
                      <Input
                        autoFocus
                        className="bg-slate-800/80 border border-slate-700 text-white rounded-xl placeholder-slate-500 h-11 focus:border-amber-500 focus-visible:ring-1 focus-visible:ring-amber-500 text-center font-mono text-xs tracking-wider"
                        placeholder="👉 Click here to focus & pull scanner trigger 👈"
                        value={scannerInputValue}
                        onChange={(e) => setScannerInputValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && scannerInputValue.trim()) {
                            e.preventDefault();
                            // Decode manually
                            let searchSerial = scannerInputValue.trim();
                            if (searchSerial.includes("?")) {
                              searchSerial = searchSerial.split("?")[0].trim();
                            }
                            if (searchSerial.includes("/code/")) {
                              searchSerial = searchSerial.substring(searchSerial.indexOf("/code/") + 6);
                            }
                            if (searchSerial.includes("::")) {
                              searchSerial = searchSerial.split("::")[1] || searchSerial;
                            } else if (searchSerial.includes(":")) {
                              const parts = searchSerial.split(":");
                              searchSerial = parts[parts.length - 1] || searchSerial;
                            }
                            if (searchSerial.includes("-")) {
                              const parts = searchSerial.split("-");
                              const serialIndex = parts.findIndex(p => p.startsWith("21"));
                              if (serialIndex > -1) {
                                searchSerial = parts.slice(serialIndex).join("-").substring(2);
                              } else {
                                const ssccIndex = parts.findIndex(p => p.startsWith("00"));
                                if (ssccIndex > -1) {
                                  searchSerial = parts.slice(ssccIndex).join("-").substring(2);
                                }
                              }
                            } else if (searchSerial.includes("(21)")) {
                              const match = searchSerial.match(/\(21\)([^()]+)/);
                              if (match && match[1]) {
                                searchSerial = match[1];
                              }
                            } else if (searchSerial.includes("(00)")) {
                              const match = searchSerial.match(/\(00\)([^()]+)/);
                              if (match && match[1]) {
                                searchSerial = match[1];
                              }
                            } else if (searchSerial.startsWith("01") && searchSerial.length >= 18) {
                              searchSerial = searchSerial.substring(18);
                            } else if (searchSerial.startsWith("00") && searchSerial.length >= 20) {
                              searchSerial = searchSerial.substring(2);
                            }
                            const matchedCode = codesList.find(c => 
                              c.serialNumber === searchSerial || 
                              c.ssccCode === searchSerial || 
                              c.rawString === searchSerial
                            );
                            if (matchedCode) {
                              playBeep();
                              mapScannedCode(matchedCode.id);
                            } else {
                              toast.error(`Code ${searchSerial} not found in this batch.`);
                            }
                            setScannerInputValue("");
                          }
                        }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 text-center italic">
                      Hardware scanner will auto-send code parameters followed by 'Enter' command
                    </p>
                  </div>
                </div>
              )}

              {/* Controls */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className={`flex-1 border-slate-700 bg-slate-800/20 text-slate-300 hover:bg-slate-800 hover:text-white rounded-xl h-11 flex items-center justify-center gap-2 ${isAutoScanning ? "border-emerald-500 text-emerald-400" : ""}`}
                  onClick={() => setIsAutoScanning(!isAutoScanning)}
                >
                  {isAutoScanning ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                      <span>Stop Auto-Scan</span>
                    </>
                  ) : (
                    <span>Auto-Scan (Demo)</span>
                  )}
                </Button>
                <Button
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl h-11 flex items-center justify-center gap-2"
                  onClick={handleManualScan}
                  disabled={isScanning || isAutoScanning || scanProgress >= codesList.length}
                >
                  <Maximize2 className="h-4 w-4" />
                  <span>Manual Scan</span>
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Status */}
          {wizardStep === "status" && (
            <div className="space-y-6 text-center py-4">
              <div className="relative w-20 h-20 mx-auto">
                <div className="absolute inset-0 rounded-full bg-emerald-500/10 border border-emerald-500/20 animate-ping" />
                <div className="relative w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-xl shadow-emerald-500/10">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-bold tracking-tight text-white">Batch Mapping Finalized</h3>
                <p className="text-slate-400 text-sm">All unit-level codes successfully registered & signed</p>
              </div>

              {/* Mapping Details Receipt Card */}
              <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-4 text-left space-y-3 font-mono text-xs">
                <div className="border-b border-slate-800 pb-2 flex justify-between text-slate-500">
                  <span>METADATA FIELD</span>
                  <span>RECORD VALUE</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">PRODUCT ID</span>
                  <span className="text-white font-medium truncate max-w-[200px]">{selectedRow?.product || "Pharmaceutical A-202"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">BATCH CODE</span>
                  <span className="text-white font-medium">{selectedRow?.batch || "BTCH-2024-001"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">MAPPING LOCATION</span>
                  <span className="text-white font-medium">
                    {locations.find(l => l.id.toString() === selectedLocationId)?.locationName || "Warehouse"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">QR ASSOCIATED</span>
                  <span className="text-white font-medium">{codesList.length} / {codesList.length} Associated</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">OPERATOR ID</span>
                  <span className="text-white font-medium">{operatorId}</span>
                </div>
                <div className="flex justify-between border-t border-slate-800 pt-2 text-slate-500">
                  <span>TIMESTAMP</span>
                  <span>{new Date().toLocaleString()}</span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 border-slate-700 bg-slate-800/20 text-slate-300 hover:bg-slate-800 hover:text-white rounded-xl h-11 flex items-center justify-center gap-2"
                  onClick={handlePrint}
                  disabled={isPrinting}
                >
                  {isPrinting ? (
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  ) : printSuccess ? (
                    <Check className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Printer className="h-4 w-4" />
                  )}
                  <span>{isPrinting ? "Printing..." : printSuccess ? "Printed!" : "Print Receipt"}</span>
                </Button>
                <Button
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl h-11"
                  onClick={() => {
                    setIsWizardOpen(false);
                  }}
                >
                  Return to Console
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
