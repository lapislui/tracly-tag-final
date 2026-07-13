import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { ShieldCheck, Loader2, AlertCircle, Landmark, QrCode, Lock, MapPin } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";


interface VerificationDetails {
  id: number;
  productId: number;
  productName: string;
  batchId: number | null;
  batchNumber: string | null;
  level: string;
  rawString: string;
  serialNumber: string | null;
  ssccCode: string | null;
  mapped: boolean;
  mappedAt: string | null;
  mappedByUserId: number | null;
  mappedByUsername: string | null;
  locationId: number | null;
  locationName: string | null;
  createdAt: string;
  mfgDate: string | null;
  expiryDate: string | null;
  marketedBy: string | null;
  registrationNo: string | null;
  companyName: string | null;
  companyAddress: string | null;
  productLogoUrl: string | null;
  sapDescription: string | null;
}

export default function PublicVerify() {
  const { serial } = useParams<{ serial: string }>();
  const [, setLocation] = useLocation();
  
  const [data, setData] = useState<VerificationDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states matching mockup
  const [step, setStep] = useState<"form" | "result">("form");
  const [fullName, setFullName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [locationAccess, setLocationAccess] = useState(true);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);

  const fetchLocationAutomatically = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    setIsFetchingLocation(true);
    toast.info("Fetching your location...");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 6000);

          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
            { signal: controller.signal, headers: { "User-Agent": "TraclyTag-App" } }
          );

          clearTimeout(timeoutId);

          if (!response.ok) throw new Error("Geocoding failed");

          const data = await response.json();
          const address = data.display_name || 
            (data.address ? `${data.address.city || data.address.town || ""}, ${data.address.state || ""}, ${data.address.country || ""}`.trim() : null);

          if (address) {
            setLocationAddress(address);
            toast.success("Location auto-fetched successfully");
          } else {
            const coords = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
            setLocationAddress(coords);
            toast.success("Coordinates auto-fetched");
          }
        } catch (err) {
          const coords = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          setLocationAddress(coords);
          toast.success("Coordinates fetched (Geocoding unavailable)");
        } finally {
          setIsFetchingLocation(false);
        }
      },
      (error) => {
        setIsFetchingLocation(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            toast.error("Location permission denied. Please enter manually.");
            break;
          case error.POSITION_UNAVAILABLE:
            toast.error("Location information unavailable. Please enter manually.");
            break;
          case error.TIMEOUT:
            toast.error("Location request timed out. Please enter manually.");
            break;
          default:
            toast.error("Failed to fetch location automatically.");
        }
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleVerify = () => {
    setError(null);

    if (!serial) {
      setError("No serial number provided.");
      return;
    }

    if (!fullName.trim()) {
      setError("Full Name is required.");
      return;
    }

    if (!mobileNumber.trim()) {
      setError("Mobile Number is required.");
      return;
    }

    if (!locationAddress.trim()) {
      setError("Location is required.");
      return;
    }

    setLoading(true);

    const params = new URLSearchParams({
      customerName: fullName.trim(),
      mobileNumber: mobileNumber.trim(),
      zipCode: locationAddress.trim(),
    });

    fetch(`/api/codes/public/${encodeURIComponent(serial)}?${params.toString()}`)
      .then((res) => {
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error("Invalid certificate or serial number not found.");
          }
          throw new Error("Unable to complete authenticity check at this time.");
        }
        return res.json();
      })
      .then((json) => {
        setData(json);
        setStep("result");
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "An unexpected error occurred.");
        setLoading(false);
      });
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "N/A";
    try {
      return format(new Date(dateStr), "MMM-yyyy");
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 flex flex-col">
      {/* TopAppBar */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center px-6 h-14 w-full z-50 sticky top-0 shadow-sm">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Logo" className="h-6 object-contain" />
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setLocation("/login")}
            className="text-xs font-bold text-safety-blue hover:underline uppercase tracking-wider bg-transparent border-0 cursor-pointer"
          >
            Terminal Login
          </button>
        </div>
      </header>

      <main className="flex-grow px-6 py-10 max-w-md mx-auto w-full flex flex-col justify-center">
        
        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 space-y-4 px-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg">
            <Loader2 className="h-10 w-10 animate-spin text-safety-blue" />
            <p className="text-sm text-slate-500 font-medium animate-pulse text-center">
              Running cryptographic authenticity checks...
            </p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="space-y-6">
            <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/10 dark:border-red-900/30 overflow-hidden rounded-xl shadow-lg">
              <div className="h-1.5 bg-red-500" />
              <CardContent className="flex flex-col items-center justify-center py-10 space-y-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 border border-red-200 dark:border-red-800 shadow-inner">
                  <AlertCircle className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-bold text-red-800 dark:text-red-400">Verification Failed</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 text-center leading-relaxed max-w-xs px-2">
                  {error}
                </p>
                <div className="text-[10px] text-slate-400 font-mono bg-white dark:bg-slate-900 px-3 py-1 rounded border border-slate-200 dark:border-slate-800">
                  Serial ID: <span className="font-bold text-slate-700 dark:text-slate-300">{serial}</span>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 text-xs h-10 rounded-lg cursor-pointer" onClick={() => setError(null)}>
                Try Again
              </Button>
              <Button className="flex-1 text-xs h-10 bg-safety-blue hover:bg-primary text-white rounded-lg cursor-pointer" onClick={() => setLocation("/login")}>
                Admin Sign In
              </Button>
            </div>
          </div>
        )}

        {/* Step 1: User Verification Inputs Form */}
        {!loading && !error && step === "form" && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="relative w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                <div className="scan-viewfinder-corners absolute inset-0 pulse-animation"></div>
                <img src="/logo-icon.png" alt="Scan Icon" className="h-12 w-12 object-contain animate-pulse" />
              </div>
              <h2 className="text-xl font-bold text-midnight-navy dark:text-white mb-2">Final Verification</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 px-4">
                Complete the secure form below to authenticate your product with TracelyTag Industrial Security.
              </p>
            </div>

            <section className="space-y-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-xl shadow-lg">
              {/* Full Name */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Full Name</label>
                <div className="relative">
                  <Input 
                    className="w-full h-11 pl-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-safety-blue rounded-lg text-sm" 
                    placeholder="Alexander Vance" 
                    value={fullName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)}
                    type="text"
                  />
                </div>
              </div>

              {/* Mobile Number */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Mobile Number</label>
                <div className="relative">
                  <Input 
                    className="w-full h-11 pl-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-safety-blue rounded-lg text-sm" 
                    placeholder="+1 (555) 000-0000" 
                    value={mobileNumber}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMobileNumber(e.target.value)}
                    type="tel"
                  />
                </div>
              </div>

              {/* Location */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Location</label>
                <div className="flex items-center w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 h-11 rounded-lg overflow-hidden pl-4 pr-1 gap-3 focus-within:border-safety-blue focus-within:ring-1 focus-within:ring-safety-blue transition-all">
                  <Input 
                    className="bg-transparent border-0 shadow-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0 text-sm w-full h-full p-0 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600" 
                    placeholder="Enter location or fetch automatically" 
                    value={locationAddress}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocationAddress(e.target.value)}
                    type="text"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={fetchLocationAutomatically}
                    disabled={isFetchingLocation}
                    title="Fetch GPS Location"
                    className="shrink-0 h-8 w-8 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    {isFetchingLocation ? (
                      <Loader2 className="h-4 w-4 animate-spin text-safety-blue" />
                    ) : (
                      <MapPin className="h-4 w-4 text-slate-400 hover:text-safety-blue" />
                    )}
                  </Button>
                </div>
              </div>


              {/* Location Toggle */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-midnight-navy dark:text-white">Location Access</span>
                  <span className="text-[10px] text-slate-400">Verify scanning location for audit trail</span>
                </div>
                <button
                  type="button"
                  onClick={() => setLocationAccess(!locationAccess)}
                  className={`w-11 h-6 rounded-full relative transition-colors duration-200 focus:outline-none ${locationAccess ? "bg-safety-blue" : "bg-slate-300 dark:bg-slate-800"}`}
                >
                  <div className={`absolute top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 ${locationAccess ? "right-1" : "left-1"}`} />
                </button>
              </div>

              {/* Encryption Banner */}
              <div className="flex gap-2.5 p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg">
                <Lock className="h-4 w-4 text-safety-blue flex-shrink-0" />
                <span className="text-[10px] text-slate-400 font-mono leading-relaxed">
                  Your verification data is encrypted and used only for product authenticity audit.
                </span>
              </div>

              <Button 
                onClick={handleVerify}
                className="w-full h-11 bg-safety-blue hover:bg-primary text-white font-bold rounded-lg shadow-sm transition-all duration-100 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <span>Verify Product</span>
                <ShieldCheck className="h-4 w-4" />
              </Button>
            </section>

            {/* Session Metadata */}
            <div className="space-y-2 opacity-60 px-2 text-[10px] font-mono text-slate-400">
              <div className="flex justify-between items-center border-t border-slate-200 dark:border-slate-800 pt-4">
                <span>SCAN SESSION</span>
                <span>#TT-{serial?.substring(0, 6).toUpperCase() || "NEW"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>ENCRYPTION</span>
                <span>AES-256 BIT</span>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Verification Details Success Details */}
        {!loading && !error && step === "result" && data && (
          <div className="space-y-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-xl shadow-lg">
            
            {/* Header Brand Logo */}
            <div className="text-center py-2 border-b border-slate-200 dark:border-slate-800">
              {data.productLogoUrl ? (
                <img 
                  src={data.productLogoUrl} 
                  className="h-10 object-contain mx-auto max-w-[200px]" 
                  alt="Company Logo" 
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-1">
                  <Landmark className="h-6 w-6 text-safety-blue mb-1" />
                  <span className="font-extrabold text-midnight-navy dark:text-white text-xs tracking-widest uppercase">
                    {data.companyName || "REGISTERED PRODUCER"}
                  </span>
                </div>
              )}
            </div>

            {/* Light Green Authenticity Banner */}
            <div className="border border-green-200 bg-green-50/70 rounded-lg py-2.5 px-4 text-center">
              <div className="flex items-center justify-center gap-1.5 text-green-700 font-bold text-xs sm:text-sm">
                <ShieldCheck className="h-4.5 w-4.5 text-green-600 flex-shrink-0" />
                <span>This is a Genuine Pack</span>
              </div>
            </div>

            {/* Uppercase Product Name Title */}
            <div className="border-b border-slate-200 dark:border-slate-800 pb-2">
              <h2 className="text-midnight-navy dark:text-white font-extrabold text-sm sm:text-base leading-tight tracking-normal">
                {data.productName.toUpperCase()}
              </h2>
            </div>

            {/* Product Verification Specifications Table */}
            <div className="space-y-3.5 text-xs text-slate-700 dark:text-slate-300">
              
              <div className="grid grid-cols-12 gap-x-2 items-start py-0.5">
                <span className="col-span-5 font-bold text-slate-500 dark:text-slate-400">Serial Number</span>
                <span className="col-span-1 text-center text-slate-400">:</span>
                <span className="col-span-6 font-mono font-bold text-slate-800 dark:text-white break-all select-all">
                  {data.serialNumber || data.ssccCode || "N/A"}
                </span>
              </div>

              <div className="grid grid-cols-12 gap-x-2 items-start py-0.5">
                <span className="col-span-5 font-bold text-slate-500 dark:text-slate-400">Generic Name</span>
                <span className="col-span-1 text-center text-slate-400">:</span>
                <span className="col-span-6 font-bold text-slate-800 dark:text-white">
                  {data.sapDescription || data.productName.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-12 gap-x-2 items-start py-0.5">
                <span className="col-span-5 font-bold text-slate-500 dark:text-slate-400">Brand Name</span>
                <span className="col-span-1 text-center text-slate-400">:</span>
                <span className="col-span-6 font-bold text-slate-800 dark:text-white">
                  {data.productName.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-12 gap-x-2 items-start py-0.5">
                <span className="col-span-5 font-bold text-slate-500 dark:text-slate-400">Manufacturer</span>
                <span className="col-span-1 text-center text-slate-400">:</span>
                <span className="col-span-6 font-medium text-slate-800 dark:text-white leading-relaxed">
                  {data.companyName}<br />
                  <span className="text-[10px] text-slate-400 leading-normal block mt-0.5">
                    {data.companyAddress || "N/A"}
                  </span>
                </span>
              </div>

              <div className="grid grid-cols-12 gap-x-2 items-start py-0.5">
                <span className="col-span-5 font-bold text-slate-500 dark:text-slate-400">Batch Number</span>
                <span className="col-span-1 text-center text-slate-400">:</span>
                <span className="col-span-6 font-mono font-bold text-slate-800 dark:text-white select-all">
                  {data.batchNumber || "N/A"}
                </span>
              </div>

              <div className="grid grid-cols-12 gap-x-2 items-start py-0.5">
                <span className="col-span-5 font-bold text-slate-500 dark:text-slate-400">Mfg Date</span>
                <span className="col-span-1 text-center text-slate-400">:</span>
                <span className="col-span-6 font-medium text-slate-800 dark:text-white">
                  {formatDate(data.mfgDate)}
                </span>
              </div>

              <div className="grid grid-cols-12 gap-x-2 items-start py-0.5">
                <span className="col-span-5 font-bold text-slate-500 dark:text-slate-400">Expiry Date</span>
                <span className="col-span-1 text-center text-slate-400">:</span>
                <span className="col-span-6 font-medium text-slate-800 dark:text-white">
                  {formatDate(data.expiryDate)}
                </span>
              </div>

              <div className="grid grid-cols-12 gap-x-2 items-start py-0.5 border-b border-slate-200 dark:border-slate-800 pb-4">
                <span className="col-span-5 font-bold text-slate-500 dark:text-slate-400">License Number</span>
                <span className="col-span-1 text-center text-slate-400">:</span>
                <span className="col-span-6 font-mono font-bold text-slate-800 dark:text-white">
                  {data.registrationNo || "N/A"}
                </span>
              </div>

            </div>

            <div className="text-center pt-2">
              <Button variant="outline" className="w-full text-xs h-10 rounded-lg cursor-pointer" onClick={() => setStep("form")}>
                Verify Another Package
              </Button>
            </div>

            {/* Small subtle footer branding */}
            <div className="text-center pt-2">
              <p className="text-[10px] text-slate-400 font-medium">
                Verified dynamically via TraclyTag GS1 Registry.
              </p>
              <p className="text-[9px] text-slate-400 font-mono mt-0.5">
                Ref: TRACLY-{data.id}
              </p>
            </div>

          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-col items-center gap-4 py-8 px-6 w-full mt-auto">
        <div className="text-xs font-bold uppercase tracking-widest text-slate-400">TracelyTag</div>
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs">
          <a className="text-slate-500 hover:text-safety-blue transition-colors font-medium" href="#">Contact Support</a>
          <a className="text-slate-500 hover:text-safety-blue transition-colors font-medium" href="#">Privacy Policy</a>
          <a className="text-slate-500 hover:text-safety-blue transition-colors font-medium" href="#">Report Issue</a>
        </div>
      </footer>
    </div>
  );
}
