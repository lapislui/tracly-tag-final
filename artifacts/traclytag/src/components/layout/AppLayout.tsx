import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useGetCurrentUser, useLogout, getGetCurrentUserQueryKey, customFetch } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./ThemeToggle";
import { useMappingCodeVisibility } from "@/hooks/use-mapping-code-visibility";
import { 
  LayoutDashboard, Building2, Users, Package, MapPin, 
  Layers, QrCode, FileText, PackageCheck, BarChart3, ListOrdered, LogOut, Menu,
  Link as LinkIcon, ScanBarcode, Settings, HelpCircle, Lock, Copy, User, Terminal, Eye, UserCheck,
  Search, Bell, Plus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: user } = useGetCurrentUser();
  const logoutMutation = useLogout();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [requiredTier, setRequiredTier] = useState("");
  const { hideMappingCode } = useMappingCodeVisibility();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
        setLocation("/login");
      }
    });
  };

  const handleStopImpersonation = async () => {
    try {
      await customFetch("/api/auth/stop-impersonation", {
        method: "POST",
      });
      toast({
        title: "Exited Impersonation Mode",
        description: "Restored Super Master session",
      });
      await queryClient.invalidateQueries();
      setLocation("/users");
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to exit impersonation mode",
        variant: "destructive",
      });
    }
  };

  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem("traclytag_sidebar_collapsed") === "true";
  });

  if (!user) return null;

  const isMaster = user.role === "master" || user.role === "super_master";
  const isMasterOrAdmin = isMaster || user.role === "admin";
  const currentPlan = isMaster ? "enterprise" : (user as any).subscriptionPlan || "free";

  const getRequiredPlan = (href: string) => {
    if (href.startsWith("/production/codes") || href.startsWith("/production/summary") || href.startsWith("/reports")) {
      return "enterprise";
    }
    if (href.startsWith("/production/batches") || href.startsWith("/mapping-code") || href.startsWith("/customer-scan")) {
      return "standard";
    }
    return "free";
  };

  const isPlanSufficient = (required: string, current: string) => {
    if (current === "enterprise") return true;
    if (current === "standard") return required !== "enterprise";
    return required === "free";
  };

  const userModulesRaw = (user.enabledModules || "").split(",");
  if (user.role === "admin" && !userModulesRaw.includes("companies")) {
    userModulesRaw.push("companies");
  }

  const userModules = isMaster 
    ? ["dashboard", "companies", "users", "products", "locations", "batches", "generate_codes", "mapping_code", "customer_scan", "summary", "reports"]
    : userModulesRaw;

  const navigation = [
    { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, module: "dashboard" },
    { title: "Products", href: "/products", icon: Package, module: "products" },
    { title: "Batches", href: "/production/batches", icon: Layers, module: "batches" },
    { title: "Generate Codes", href: "/production/codes", icon: QrCode, module: "generate_codes" },
    ...(!hideMappingCode ? [{ title: "Mapping Code", href: "/mapping-code", icon: LinkIcon, module: "mapping_code" }] : []),
    { title: "Customer Scan", href: "/customer-scan", icon: ScanBarcode, module: "customer_scan" },
    { title: "Summary", href: "/production/summary", icon: PackageCheck, module: "summary" },
    { title: "Reports", href: "/reports", icon: BarChart3, module: "reports" },
  ].filter(item => userModules.includes(item.module));

  const bottomNavigation = [
    ...(isMasterOrAdmin ? [{ title: "Companies", href: "/companies", icon: Building2, module: "companies" }] : []),
    { title: "Users", href: "/users", icon: Users, module: "users" },
    { title: "Locations", href: "/locations", icon: MapPin, module: "locations" },
    { title: "Profile", href: "/profile", icon: User },
    { title: "Settings", href: "/settings", icon: Settings },
    ...(user.role === "super_master" ? [{ title: "System", href: "/system", icon: Terminal }] : []),
    { title: "Support", href: "/support", icon: HelpCircle },
  ].filter(item => !item.module || userModules.includes(item.module));


  const toggleSidebar = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    localStorage.setItem("traclytag_sidebar_collapsed", String(nextState));
  };

  return (
    <div className="relative min-h-screen md:h-screen md:overflow-hidden bg-background flex flex-col md:flex-row">
      <aside className={cn(
        "border-r border-white/10 bg-midnight-navy text-white flex-shrink-0 flex flex-col hidden md:flex transition-all duration-300 ease-in-out",
        isCollapsed ? "w-20" : "w-64"
      )}>
        <div className="h-14 border-b border-white/10 flex items-center px-4 justify-between overflow-hidden">
          <div className="flex items-center gap-2 w-full justify-center md:justify-start">
            <img 
              src={isCollapsed ? "/logo-icon.png" : "/logo.png"} 
              alt="Logo" 
              className={cn("object-contain transition-all duration-300", isCollapsed ? "h-7 w-7" : "h-7")} 
            />
          </div>
          {!isCollapsed && <span className="text-[10px] text-white/40 font-mono">v2.4</span>}
        </div>
        <div className="p-3 flex-1 overflow-y-auto space-y-6">
          <div className="space-y-3">
            <div className="space-y-1">
              {navigation.map((item, i) => {
                const isActive = location === item.href || location.startsWith(item.href + "/");
                const required = getRequiredPlan(item.href);
                const allowed = isPlanSufficient(required, currentPlan) || userModules.includes(item.module);

                if (!allowed) {
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        setRequiredTier(required);
                        setUpgradeModalOpen(true);
                      }}
                      className={cn(
                        "w-full flex items-center rounded-lg text-sm font-medium transition-all duration-200 text-white/40 hover:bg-white/5 cursor-pointer",
                        isCollapsed ? "justify-center p-2.5 mx-auto w-10 h-10" : "px-4 py-2.5 gap-3 justify-between"
                      )}
                      title={isCollapsed ? `${item.title} (Requires ${required.toUpperCase()})` : undefined}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!isCollapsed && <span>{item.title}</span>}
                      </div>
                      {!isCollapsed && <Lock className="h-3.5 w-3.5 text-amber-500/80 shrink-0" />}
                    </button>
                  );
                }

                return (
                  <Link key={i} href={item.href} className={cn(
                    "flex items-center rounded-lg text-sm font-medium transition-all duration-200",
                    isCollapsed ? "justify-center p-2.5 mx-auto w-10 h-10" : "px-4 py-2.5 gap-3",
                    isActive ? "bg-safety-blue text-white shadow-lg shadow-safety-blue/20" : "text-white/70 hover:bg-white/5 hover:text-white"
                  )} title={isCollapsed ? item.title : undefined}>
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!isCollapsed && <span>{item.title}</span>}
                  </Link>
                );
              })}
            </div>
            
            <div className="pt-2 border-t border-white/10 space-y-1">
              {bottomNavigation.map((item, i) => {
                const isActive = location === item.href || location.startsWith(item.href + "/");
                return (
                  <Link key={i} href={item.href} className={cn(
                    "flex items-center rounded-lg text-sm font-medium transition-all duration-200",
                    isCollapsed ? "justify-center p-2.5 mx-auto w-10 h-10" : "px-4 py-2.5 gap-3",
                    isActive ? "bg-safety-blue text-white shadow-lg shadow-safety-blue/20" : "text-white/70 hover:bg-white/5 hover:text-white"
                  )} title={isCollapsed ? item.title : undefined}>
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!isCollapsed && <span>{item.title}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
        
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-slate-50/50 dark:bg-slate-950/20">
        {user.isImpersonating && (
          <div className="bg-amber-500 text-slate-950 px-6 py-2.5 flex flex-wrap items-center justify-between shadow-md text-xs font-bold font-sans gap-2 border-b border-amber-600 sticky top-0 z-30">
            <div className="flex items-center gap-2.5">
              <span className="bg-slate-950 text-amber-400 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                <Eye className="h-3 w-3" /> IMPERSONATION MODE
              </span>
              <span>
                You are inspecting the system as <strong>{user.username}</strong> ({user.role.replace('_', ' ')}){user.companyName ? ` • Company: ${user.companyName}` : ''}.
              </span>
            </div>
            <Button
              size="sm"
              onClick={handleStopImpersonation}
              className="bg-slate-950 hover:bg-slate-900 text-white text-xs px-3.5 py-1.5 h-7 font-bold rounded-lg cursor-pointer transition-all shadow-sm flex items-center gap-1.5 ml-auto"
            >
              <LogOut className="h-3.5 w-3.5 text-amber-400" />
              <span>Return to {user.impersonatorUsername || "Super Master"}</span>
            </Button>
          </div>
        )}
        <header className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between px-6 sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="h-8 w-8 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hidden md:flex cursor-pointer"
            >
              <Menu className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2 md:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64 bg-midnight-navy text-white p-0 border-r border-white/10 flex flex-col h-full font-sans">
                  {/* Mobile Sidebar Header */}
                  <div className="h-14 border-b border-white/10 flex items-center px-4 justify-between overflow-hidden shrink-0">
                    <img src="/logo.png" alt="Logo" className="h-7 object-contain" />
                    <span className="text-[10px] text-white/40 font-mono">v2.4</span>
                  </div>
                  {/* Mobile Navigation Links */}
                  <div className="p-3 flex-1 overflow-y-auto space-y-3">
                    <div className="space-y-1">
                      {navigation.map((item, i) => {
                        const isActive = location === item.href || location.startsWith(item.href + "/");
                        const required = getRequiredPlan(item.href);
                        const allowed = isPlanSufficient(required, currentPlan) || userModules.includes(item.module);

                        if (!allowed) {
                          return (
                            <button
                              key={i}
                              onClick={() => {
                                setRequiredTier(required);
                                setUpgradeModalOpen(true);
                              }}
                              className="w-full flex items-center rounded-lg text-sm font-medium transition-all duration-200 text-white/40 hover:bg-white/5 cursor-pointer px-4 py-2.5 gap-3 justify-between"
                            >
                              <div className="flex items-center gap-3">
                                <item.icon className="h-4 w-4 shrink-0" />
                                <span>{item.title}</span>
                              </div>
                              <Lock className="h-3.5 w-3.5 text-amber-500/80 shrink-0" />
                            </button>
                          );
                        }

                        return (
                          <SheetClose asChild key={i}>
                            <Link 
                              href={item.href} 
                              className={cn(
                                "flex items-center rounded-lg text-sm font-medium transition-all duration-200 px-4 py-2.5 gap-3 w-full",
                                isActive ? "bg-safety-blue text-white shadow-lg shadow-safety-blue/20" : "text-white/70 hover:bg-white/5 hover:text-white"
                              )}
                            >
                              <item.icon className="h-4 w-4 shrink-0" />
                              <span>{item.title}</span>
                            </Link>
                          </SheetClose>
                        );
                      })}
                    </div>

                    <div className="pt-2 border-t border-white/10 space-y-1">
                      {bottomNavigation.map((item, i) => {
                        const isActive = location === item.href || location.startsWith(item.href + "/");
                        return (
                          <SheetClose asChild key={i}>
                            <Link 
                              href={item.href} 
                              className={cn(
                                "flex items-center rounded-lg text-sm font-medium transition-all duration-200 px-4 py-2.5 gap-3 w-full",
                                isActive ? "bg-safety-blue text-white shadow-lg shadow-safety-blue/20" : "text-white/70 hover:bg-white/5 hover:text-white"
                              )}
                            >
                              <item.icon className="h-4 w-4 shrink-0" />
                              <span>{item.title}</span>
                            </Link>
                          </SheetClose>
                        );
                      })}
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
              <img src="/logo.png" alt="Logo" className="h-6 object-contain ml-1" />
            </div>
            {location.startsWith("/reports") ? (
              <div className="flex items-center gap-3">
                <span className="text-base font-bold text-slate-900 dark:text-white">Reports</span>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <div className="flex items-center gap-4 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <span className="text-slate-900 dark:text-white font-semibold cursor-pointer">Overview</span>
                  <span className="hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer">Deployments</span>
                  <span className="hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer">Health</span>
                </div>
              </div>
            ) : (
              <div className="hidden md:flex items-center text-sm font-medium text-slate-500 dark:text-slate-400">
                {user.companyName ? `Company: ${user.companyName}` : "Global Admin"}
              </div>
            )}
          </div>

          {location.startsWith("/reports") && (
            <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 bg-slate-100/90 dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700 w-64 lg:w-80 shadow-inner">
              <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search terminal..."
                className="bg-transparent text-xs text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none w-full"
              />
            </div>
          )}

          <div className="flex items-center gap-3 ml-auto">
            {location.startsWith("/reports") ? (
              <>
                <button 
                  onClick={() => toast({ title: "Notifications", description: "Terminal alerts & GS1 scan exceptions" })}
                  className="relative p-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 rounded-lg cursor-pointer"
                  title="Terminal Alerts"
                >
                  <Bell className="h-4 w-4" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-blue-600 rounded-full"></span>
                </button>
                <Link href="/companies/new">
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-3 py-1.5 h-8 rounded-lg flex items-center gap-1.5 shadow-sm shadow-blue-500/20 cursor-pointer">
                    <Plus className="h-3.5 w-3.5" />
                    <span>Create Tenant</span>
                  </Button>
                </Link>
                <img
                  src="/user-avatar.png"
                  alt="User Avatar"
                  className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 object-cover shadow-sm"
                />
                <ThemeToggle />
              </>
            ) : (
              <>
                <ThemeToggle />
                <div className="flex items-center gap-3 border-l pl-4 border-slate-200 dark:border-slate-800">
                  <Link href="/profile" className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer">
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-semibold leading-none text-midnight-navy dark:text-white">{user.username}</span>
                      <Badge variant="outline" className="mt-1 text-[9px] uppercase h-4 px-1.5 border-safety-blue/30 text-safety-blue bg-safety-blue/5">{user.role === 'client_admin' ? 'manager' : user.role.replace('_', ' ')}</Badge>
                    </div>
                    <Avatar className="h-8 w-8 border border-safety-blue/20">
                      <AvatarFallback className="bg-safety-blue/10 text-safety-blue text-xs font-semibold">
                        {user.username.substring(0,2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Link>
                  <Button variant="ghost" size="icon" onClick={handleLogout} className="ml-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                    <LogOut className="h-4 w-4" />
                    <span className="sr-only">Log out</span>
                  </Button>
                </div>
              </>
            )}
          </div>
        </header>
        <div className="flex-1 p-6 md:p-8 overflow-y-auto">
          <div className={cn("mx-auto", location.startsWith("/reports") ? "max-w-7xl" : "max-w-6xl")}>
            {children}
          </div>
        </div>
      </main>

      <Dialog open={upgradeModalOpen} onOpenChange={setUpgradeModalOpen}>
        <DialogContent className="sm:max-w-[420px] bg-slate-900 border border-slate-800 text-white font-sans p-6 rounded-2xl shadow-2xl">
          <DialogHeader className="flex flex-col items-center text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-md">
              <Lock className="w-6 h-6 animate-pulse" />
            </div>
            <DialogTitle className="text-xl font-bold tracking-tight">Feature Locked</DialogTitle>
            <DialogDescription className="text-slate-400 text-sm">
              This module requires an active <strong className="text-amber-400 capitalize">{requiredTier} Plan</strong> subscription or higher. Upgrade your plan on the TracelyTag website to unlock access.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-6">
            <a
              href="http://localhost:5000/pricing"
              className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold py-3 rounded-xl text-sm transition-all shadow-lg hover:shadow-teal-500/20 active:scale-[0.98] text-center"
            >
              View Pricing & Upgrade
            </a>
            <Button
              variant="ghost"
              onClick={() => setUpgradeModalOpen(false)}
              className="w-full h-11 border border-slate-800 bg-transparent text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl text-sm"
            >
              Dismiss
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}