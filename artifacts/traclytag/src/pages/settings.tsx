import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings as SettingsIcon, Link2, ShieldAlert, Database } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useMappingCodeVisibility } from "@/hooks/use-mapping-code-visibility";
import { useDevOptionsVisibility } from "@/hooks/use-dev-options-visibility";
import { useDatamatrixUrlMode } from "@/hooks/use-datamatrix-url-mode";
import { useGetCurrentUser } from "@workspace/api-client-react";

export default function Settings() {
  const { hideMappingCode, toggleVisibility } = useMappingCodeVisibility();
  const { hideDevOptions, hideSsoOptions, setDevVisibility, setSsoVisibility } = useDevOptionsVisibility();
  const { datamatrixUrlMode, setUrlMode } = useDatamatrixUrlMode();
  const { data: currentUser } = useGetCurrentUser();

  const [hideRecentSerialization, setHideRecentSerialization] = useState(() => {
    return localStorage.getItem("traclytag_hide_recent_serialization") === "true";
  });

  const toggleRecentSerialization = (checked: boolean) => {
    localStorage.setItem("traclytag_hide_recent_serialization", String(checked));
    setHideRecentSerialization(checked);
    window.dispatchEvent(new Event("traclytag_recent_serialization_visibility_changed"));
  };

  const isSuperMaster = currentUser?.role === "super_master";

  return (
    <div className="space-y-6 max-w-6xl mx-auto font-sans">
      <div className="flex items-center gap-4 text-outline font-bold text-[10px] uppercase tracking-widest mb-6">
        <span>System Settings</span>
      </div>
      <Card className="border border-border-subtle shadow-sm bg-white dark:bg-slate-900">
        <CardHeader>
          <div className="flex items-center gap-3">
            <SettingsIcon className="h-6 w-6 text-safety-blue" />
            <div>
              <CardTitle className="text-xl font-bold text-midnight-navy dark:text-white">Global Configuration</CardTitle>
              <CardDescription className="dark:text-slate-400">Manage your industrial interface settings here.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {!isSuperMaster && (
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-6 font-semibold">
              Only Super Master users can configure global system settings.
            </p>
          )}

          {isSuperMaster && (
            <>
              <div className="flex items-center justify-between p-4 border border-slate-100 rounded-xl bg-slate-50/50 dark:bg-slate-950/20 dark:border-slate-800">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-safety-blue/10 rounded-lg text-safety-blue mt-0.5">
                    <Link2 className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="mapping-code-toggle" className="text-sm font-bold text-midnight-navy dark:text-white cursor-pointer">
                      Hide Mapping Code Link
                    </Label>
                    <p className="text-xs text-on-surface-variant dark:text-slate-400">
                      When enabled, the "Mapping Code" link will be hidden from the sidebar navigation.
                    </p>
                  </div>
                </div>
                <Switch
                  id="mapping-code-toggle"
                  checked={hideMappingCode}
                  onCheckedChange={toggleVisibility}
                />
              </div>

              <div className="flex items-center justify-between p-4 border border-slate-100 rounded-xl bg-slate-50/50 dark:bg-slate-950/20 dark:border-slate-800">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-safety-blue/10 rounded-lg text-safety-blue mt-0.5">
                    <Link2 className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="datamatrix-url-toggle" className="text-sm font-bold text-midnight-navy dark:text-white cursor-pointer">
                      Use URL-based DataMatrix Codes
                    </Label>
                    <p className="text-xs text-on-surface-variant dark:text-slate-400">
                      When enabled, scanning the generated DataMatrix barcodes will direct scanners/phones to the product verification URL.
                    </p>
                  </div>
                </div>
                <Switch
                  id="datamatrix-url-toggle"
                  checked={datamatrixUrlMode}
                  onCheckedChange={setUrlMode}
                />
              </div>

              <div className="flex items-center justify-between p-4 border border-slate-100 rounded-xl bg-slate-50/50 dark:bg-slate-950/20 dark:border-slate-800">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-rose-500/10 rounded-lg text-rose-500 mt-0.5">
                    <Database className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="recent-serialization-toggle" className="text-sm font-bold text-midnight-navy dark:text-white cursor-pointer">
                      Hide Recent Product Serialization on Dashboard
                    </Label>
                    <p className="text-xs text-on-surface-variant dark:text-slate-400">
                      When enabled, the "Recent Product Serialization" table will be hidden from the executive dashboard.
                    </p>
                  </div>
                </div>
                <Switch
                  id="recent-serialization-toggle"
                  checked={hideRecentSerialization}
                  onCheckedChange={toggleRecentSerialization}
                />
              </div>

              <div className="flex items-center justify-between p-4 border border-slate-100 rounded-xl bg-slate-50/50 dark:bg-slate-950/20 dark:border-slate-800">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500 mt-0.5">
                    <ShieldAlert className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="dev-options-toggle" className="text-sm font-bold text-midnight-navy dark:text-white cursor-pointer">
                      Hide Developer & Demo Options on Login Page
                    </Label>
                    <p className="text-xs text-on-surface-variant dark:text-slate-400">
                      When enabled, the "Device Sim", "Passkey Sign In", "Demo Credentials", and "SMTP Test" options will be hidden from the login screen.
                    </p>
                  </div>
                </div>
                <Switch
                  id="dev-options-toggle"
                  checked={hideDevOptions}
                  onCheckedChange={setDevVisibility}
                />
              </div>

              <div className="flex items-center justify-between p-4 border border-slate-100 rounded-xl bg-slate-50/50 dark:bg-slate-950/20 dark:border-slate-800">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500 mt-0.5">
                    <ShieldAlert className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="sso-options-toggle" className="text-sm font-bold text-midnight-navy dark:text-white cursor-pointer">
                      Hide Microsoft & GitHub SSO Options on Login Page
                    </Label>
                    <p className="text-xs text-on-surface-variant dark:text-slate-400">
                      When enabled, the Microsoft and GitHub SSO buttons will be hidden from the login screen.
                    </p>
                  </div>
                </div>
                <Switch
                  id="sso-options-toggle"
                  checked={hideSsoOptions}
                  onCheckedChange={setSsoVisibility}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
