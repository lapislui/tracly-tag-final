import { useLocation } from "wouter";
import { useGetCurrentUser, useListCompanies, getListCompaniesQueryKey, useDeleteCompany } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2, Plus, Building2, Globe, Info, Edit } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function Companies() {
  const { data: user } = useGetCurrentUser();
  const { data: companies = [], isLoading } = useListCompanies();
  const deleteCompany = useDeleteCompany();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  if (user?.role !== "master" && user?.role !== "super_master" && user?.role !== "admin") {
    return <div className="p-8 text-center text-destructive">Access denied. Master or Admin role required.</div>;
  }

  const handleDelete = (id: number) => {
    deleteCompany.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCompaniesQueryKey() });
        toast.success("Company deleted successfully");
      },
      onError: (error: any) => {
        toast.error(error?.data?.error || "Failed to delete company");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="mb-4 flex items-center gap-2 text-slate-500">
        <a className="text-[11px] font-bold hover:text-[#2563EB] transition-colors uppercase tracking-wider cursor-pointer" href="#">Master Data</a>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-[11px] text-[#2563EB] uppercase tracking-wider font-bold">Companies</span>
      </div>
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-[30px] leading-[36px] font-bold text-[#0F172A] tracking-[-0.02em]">Companies</h2>
          <p className="text-[16px] text-slate-600 mt-1">Manage tenant companies and their regulatory information.</p>
        </div>
        <Button 
          onClick={() => setLocation("/companies/new")} 
          className="px-6 py-2.5 bg-[#2563EB] hover:bg-[#2563EB]/90 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-[#2563EB]/20 transition-all flex items-center gap-2 active:scale-95 h-auto cursor-pointer"
        >
          <Plus className="h-5 w-5" />
          Add Company
        </Button>
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 border-b border-[#E2E8F0] bg-[#faf8ff] flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <span className="text-[18px] font-semibold text-[#0F172A]">Active Tenants</span>
            <span className="bg-[#ededf9] text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest">Live</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-slate-50 rounded-lg transition-colors text-slate-500">
              <span className="material-symbols-outlined">filter_list</span>
            </button>
            <button className="p-2 hover:bg-slate-50 rounded-lg transition-colors text-slate-500">
              <span className="material-symbols-outlined">download</span>
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table className="w-full text-left table-fixed">
            <TableHeader>
              <TableRow className="border-b border-[#E2E8F0] bg-slate-50/50 hover:bg-slate-50/50">
                <TableHead className="text-slate-500 tracking-wider w-[25%] text-[11px] font-bold px-6 py-4 uppercase">NAME</TableHead>
                <TableHead className="text-slate-500 tracking-wider w-[20%] text-[11px] font-bold px-6 py-4 uppercase">EMAIL</TableHead>
                <TableHead className="text-slate-500 tracking-wider w-[15%] text-[11px] font-bold px-6 py-4 uppercase">GSTIN</TableHead>
                <TableHead className="text-slate-500 tracking-wider w-[20%] text-[11px] font-bold px-6 py-4 uppercase">PORTAL URL</TableHead>
                <TableHead className="text-slate-500 tracking-wider w-[10%] text-[11px] font-bold px-6 py-4 uppercase">ADDRESS</TableHead>
                <TableHead className="text-slate-500 tracking-wider w-[10%] text-[11px] font-bold px-6 py-4 uppercase text-right">ACTIONS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-[#E2E8F0]">
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : companies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Building2 className="h-8 w-8 opacity-50" />
                      <p>No companies found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                companies.map((company) => (
                  <TableRow key={company.id} className="hover:bg-slate-50 transition-colors group border-0">
                    <TableCell className="align-middle px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-[#0F172A] truncate font-bold text-[14px]">{company.name}</span>
                        <span className="text-[11px] text-slate-500 opacity-70 font-semibold tracking-wide">UID: {company.id}</span>
                      </div>
                    </TableCell>
                    <TableCell className="align-middle px-6 py-5 text-[14px]">
                      <span className="text-slate-600 truncate block">{company.email}</span>
                    </TableCell>
                    <TableCell className="align-middle px-6 py-5 text-[14px]">
                      <span className="font-semibold tracking-wide text-slate-600">{company.gstin || '—'}</span>
                    </TableCell>
                    <TableCell className="align-middle px-6 py-5 text-[14px]">
                      {company.companyUrl ? (
                        <div className="flex items-center gap-1.5 text-blue-600 font-medium font-mono text-xs">
                          <Globe className="h-3.5 w-3.5" />
                          <span className="truncate">{company.companyUrl}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Not set</span>
                      )}
                    </TableCell>
                    <TableCell className="align-middle px-6 py-5 text-[14px]">
                      <span className="text-slate-600 truncate block" title={company.address}>{company.address}</span>
                    </TableCell>
                    <TableCell className="align-middle px-6 py-5">
                      <div className="flex items-center justify-end gap-1">
                        {company.companyUrl && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <button className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="View DNS Setup Instructions">
                                <Info className="h-5 w-5" />
                              </button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[550px] bg-white border border-[#E2E8F0] rounded-xl shadow-lg p-6 font-sans">
                              <DialogHeader className="border-b border-[#E2E8F0] pb-3">
                                <DialogTitle className="text-lg font-bold text-midnight-navy flex items-center gap-2">
                                  <Globe className="h-5 w-5 text-blue-600" />
                                  DNS Config: {company.name}
                                </DialogTitle>
                                <DialogDescription className="text-sm text-slate-600 mt-1">
                                  Point the custom domain to the TracelyTag verification platform.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-4 text-slate-800 text-sm">
                                <p>
                                  To show verification pages under <strong className="font-mono text-blue-600">https://{company.companyUrl}</strong>, the company needs to add one of the following DNS records in their domain registrar panel:
                                </p>
                                
                                <div className="border border-[#E2E8F0] rounded-xl overflow-hidden shadow-sm">
                                  <div className="bg-slate-50 px-4 py-2 border-b border-[#E2E8F0] font-bold text-xs uppercase text-slate-500 tracking-wider">
                                    Option A: Subdomain setup (Recommended)
                                  </div>
                                  <div className="p-4 space-y-2.5 font-mono text-xs">
                                    <div className="grid grid-cols-3 gap-2 border-b border-slate-100 pb-1.5">
                                      <span className="font-bold text-slate-500">Record Type</span>
                                      <span className="font-bold text-slate-500">Host/Name</span>
                                      <span className="font-bold text-slate-500">Value/Target</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                      <span className="font-bold text-blue-700">CNAME</span>
                                      <span className="font-semibold text-slate-800">{company.companyUrl.split('.')[0]}</span>
                                      <span className="text-slate-800 break-all">{window.location.hostname}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="border border-[#E2E8F0] rounded-xl overflow-hidden shadow-sm">
                                  <div className="bg-slate-50 px-4 py-2 border-b border-[#E2E8F0] font-bold text-xs uppercase text-slate-500 tracking-wider">
                                    Option B: Apex domain setup
                                  </div>
                                  <div className="p-4 space-y-2.5 font-mono text-xs">
                                    <div className="grid grid-cols-3 gap-2 border-b border-slate-100 pb-1.5">
                                      <span className="font-bold text-slate-500">Record Type</span>
                                      <span className="font-bold text-slate-500">Host/Name</span>
                                      <span className="font-bold text-slate-500">Value/Target</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                      <span className="font-bold text-blue-700">A</span>
                                      <span className="font-semibold text-slate-800">@</span>
                                      <span className="text-slate-800">76.76.21.21</span>
                                    </div>
                                  </div>
                                </div>
                                
                                <p className="text-xs text-slate-500 italic mt-2">
                                  Note: DNS changes can take up to 24-48 hours to propagate worldwide. Once configured, visiting the URL will automatically redirect visitors to this company's product verification portal.
                                </p>
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                        
                        <button
                          onClick={() => setLocation(`/companies/${company.id}/edit`)}
                          className="p-2 text-slate-500 hover:text-[#2563EB] hover:bg-blue-50 rounded-lg transition-all"
                          title="Edit Company"
                        >
                          <Edit className="h-5 w-5" />
                        </button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Delete Company">
                              <Trash2 className="h-5 w-5" />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete {company.name} and all associated data.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(company.id)} className="bg-red-500 text-white hover:bg-red-600">
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
