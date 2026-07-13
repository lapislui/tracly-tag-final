import { useState } from "react";
import { useLocation } from "wouter";
import {
  useListProducts,
  getListProductsQueryKey,
  useCreateProduct,
  useDeleteProduct,
  useGetCurrentUser,
  useListCompanies,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Trash2, Plus, Package, CalendarIcon, Upload, Loader2, ChevronRight, Search, Filter, Download } from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

const productSchema = z.object({
  skuId: z.string().min(1, "SKU ID required"),
  name: z.string().min(1, "Name required"),
  skuSize: z.string().min(1, "SKU size required"),
  marketedBy: z.string().min(1, "Marketed by required"),
  sapDescription: z.string().optional().or(z.literal("")),
  gtin: z.string().regex(/^\d{13,14}$/, "GTIN must be 13–14 digits"),
  mrp: z.coerce.number().positive("MRP must be positive"),
  registrationNo: z.string().optional().or(z.literal("")),
  l1Size: z.coerce.number().int().min(1),
  l2Size: z.coerce.number().int().min(1),
  shipperSize: z.coerce.number().int().min(1),
  cautionLogoUrl: z
    .string()
    .url("Must be a URL")
    .optional()
    .or(z.literal("")),
  productLogoUrl: z
    .string()
    .url("Must be a URL")
    .optional()
    .or(z.literal("")),
  labelPdfUrl: z.string().url("Must be a URL").optional().or(z.literal("")),
  expiryDate: z.date({ required_error: "Expiry date is required" }),
  companyId: z.coerce.number().optional(),
});

type ProductForm = z.infer<typeof productSchema>;

export default function Products() {
  const [, setLocation] = useLocation();
  const { data: currentUser } = useGetCurrentUser();
  const isMaster = currentUser?.role === "master" || currentUser?.role === "super_master";
  const { data: companies = [] } = useListCompanies({ query: { enabled: isMaster } } as any);

  const { data: products = [], isLoading } = useListProducts();
  const createProduct = useCreateProduct();
  const deleteProduct = useDeleteProduct();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  // Search and filter states
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All Categories");

  const filteredProducts = products.filter((product) => {
    const companyGstin = companies.find((c: any) => c.id === product.companyId)?.gstin || 
      (currentUser as any)?.companyGstin || 
      (currentUser as any)?.company?.gstin || 
      "";
    const matchesSearch =
      !search ||
      product.skuId.toLowerCase().includes(search.toLowerCase()) ||
      product.name.toLowerCase().includes(search.toLowerCase()) ||
      (product.gtin && product.gtin.toLowerCase().includes(search.toLowerCase())) ||
      (companyGstin && companyGstin.toLowerCase().includes(search.toLowerCase())) ||
      (product.marketedBy && product.marketedBy.toLowerCase().includes(search.toLowerCase()));
    return matchesSearch;
  });

  const handleUpload = (fieldName: "cautionLogoUrl" | "productLogoUrl" | "labelPdfUrl") => {
    const input = document.createElement("input");
    input.type = "file";
    if (fieldName === "labelPdfUrl") {
      input.accept = ".pdf";
    } else {
      input.accept = "image/*";
    }
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setUploadingField(fieldName);

      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to upload file");
        }

        const data = await response.json();
        const absoluteUrl = window.location.origin + data.url;
        form.setValue(fieldName, absoluteUrl);
        toast.success("File uploaded successfully");
      } catch (error: any) {
        toast.error(error.message || "Error uploading file");
      } finally {
        setUploadingField(null);
      }
    };
    input.click();
  };

  const form = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      skuId: "",
      name: "",
      skuSize: "",
      marketedBy: "",
      sapDescription: "",
      gtin: "",
      mrp: 0,
      registrationNo: "",
      l1Size: 10,
      l2Size: 100,
      shipperSize: 1000,
      cautionLogoUrl: "",
      productLogoUrl: "",
      labelPdfUrl: "",
      expiryDate: undefined as any,
      companyId: undefined,
    },
  });

  const onSubmit = (values: ProductForm) => {
    const payload = {
      ...values,
      companyId: isMaster ? values.companyId : undefined,
      sapDescription: values.sapDescription || undefined,
      registrationNo: values.registrationNo || undefined,
      cautionLogoUrl: values.cautionLogoUrl || undefined,
      productLogoUrl: values.productLogoUrl || undefined,
      labelPdfUrl: values.labelPdfUrl || undefined,
      expiryDate: format(values.expiryDate, "yyyy-MM-dd"),
    };
    createProduct.mutate(
      { data: payload },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getListProductsQueryKey(),
          });
          toast.success("Product created");
          setIsCreateOpen(false);
          form.reset();
        },
        onError: (error: any) => {
          toast.error(error?.data?.error || "Failed to create product");
        },
      },
    );
  };

  const handleDelete = (id: number) => {
    deleteProduct.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getListProductsQueryKey(),
          });
          toast.success("Product deleted");
        },
        onError: (error: any) => {
          toast.error(
            error?.data?.error || "Failed to delete product (it may be in use)",
          );
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header (Breadcrumbs + Title) */}
      <div className="mb-4 flex items-center gap-2 text-slate-500">
        <a className="text-[11px] font-bold hover:text-[#2563EB] transition-colors uppercase tracking-wider cursor-pointer" href="#">Master Data</a>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-[11px] text-[#2563EB] uppercase tracking-wider font-bold">Products</span>
      </div>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h2 className="text-[30px] leading-[36px] font-bold text-[#0F172A] tracking-[-0.02em]">Products</h2>
          <p className="text-[16px] text-slate-600 mt-1">Manage product master data and GS1 compliance parameters.</p>
        </div>
        <Button 
          onClick={() => setLocation("/products/new")}
          className="flex items-center gap-2 bg-[#2563EB] hover:bg-[#2563EB]/90 text-white px-6 py-3 h-11 rounded-lg font-semibold hover:shadow-lg hover:shadow-safety-blue/20 transition-all transform active:scale-95 cursor-pointer"
        >
          <Plus className="h-4 w-4" /> ADD PRODUCT
        </Button>
      </div>

      {/* Filters Section */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 mb-6 flex flex-wrap items-center gap-4 shadow-sm">
        <div className="flex-1 min-w-[240px]">
          <label className="text-[10px] font-bold text-[#737686] mb-1.5 block uppercase tracking-widest">Search Product</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#737686]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg py-2 pl-10 pr-4 text-sm text-[#0F172A] focus:border-[#2563EB] focus:ring-0 outline-none transition-all"
              placeholder="Search by SKU, Name, GTIN or GST..."
            />
          </div>
        </div>
        <div className="flex-1 min-w-[240px]">
          <label className="text-[10px] font-bold text-[#737686] mb-1.5 block uppercase tracking-widest">Category</label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg py-2 h-10 focus:ring-0 focus:ring-offset-0 text-sm text-[#0F172A]">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All Categories">All Categories</SelectItem>
              <SelectItem value="Pharmaceuticals">Pharmaceuticals</SelectItem>
              <SelectItem value="Medical Devices">Medical Devices</SelectItem>
              <SelectItem value="Safety Equipment">Safety Equipment</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end h-full">
          <Button variant="outline" className="p-2.5 h-10 border border-[#E2E8F0] bg-white hover:bg-slate-50 cursor-pointer">
            <Filter className="h-4 w-4 text-[#434655]" />
          </Button>
        </div>
        <div className="flex items-end h-full ml-auto">
          <Button variant="outline" className="flex items-center gap-2 h-10 border border-[#E2E8F0] bg-white hover:bg-slate-50 font-bold text-[#0F172A] px-4 cursor-pointer">
            <Download className="h-4 w-4" /> Export XLSX
          </Button>
        </div>
      </div>

      {/* Data Table Card */}
      {/* Data Table Container */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 border-b border-[#E2E8F0] bg-[#faf8ff] flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <span className="text-[18px] font-semibold text-[#0F172A]">Product Master</span>
            <span className="bg-[#ededf9] text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest">Active</span>
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
                <TableHead className="text-slate-500 tracking-wider w-[15%] text-[11px] font-bold px-6 py-4 uppercase">SKU</TableHead>
                <TableHead className="text-slate-500 tracking-wider w-[20%] text-[11px] font-bold px-6 py-4 uppercase">NAME</TableHead>
                <TableHead className="text-slate-500 tracking-wider w-[15%] text-[11px] font-bold px-6 py-4 uppercase">GTIN / GST</TableHead>
                <TableHead className="text-slate-500 tracking-wider w-[10%] text-[11px] font-bold px-6 py-4 uppercase text-right">MRP</TableHead>
                <TableHead className="text-slate-500 tracking-wider w-[20%] text-[11px] font-bold px-6 py-4 uppercase">PACK (L1/L2/SHIPPER)</TableHead>
                <TableHead className="text-slate-500 tracking-wider w-[10%] text-[11px] font-bold px-6 py-4 uppercase">EXPIRY</TableHead>
                <TableHead className="text-slate-500 tracking-wider w-[10%] text-[11px] font-bold px-6 py-4 uppercase text-right">ACTIONS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-[#E2E8F0]">
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-[#434655]">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-[#2563EB] mb-2" />
                    <span>Loading products master...</span>
                  </TableCell>
                </TableRow>
              ) : filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="h-8 w-8 text-slate-300" />
                      <p className="text-[14px] font-semibold text-slate-500">No products found matching criteria</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.map((product) => (
                  <TableRow key={product.id} className="hover:bg-slate-50 transition-colors group border-0">
                    <TableCell className="align-middle px-6 py-5">
                      <span className="font-semibold text-[#2563EB] text-[14px]">{product.skuId}</span>
                    </TableCell>
                    <TableCell className="align-middle px-6 py-5">
                      <span className="font-bold text-[#0F172A] text-[14px] block">{product.name}</span>
                      <span className="text-[12px] font-semibold text-slate-500 block mt-0.5">{product.skuSize}</span>
                    </TableCell>
                    <TableCell className="align-middle px-6 py-5">
                      <span className="font-mono text-[13px] font-semibold tracking-wider text-slate-600">
                        {product.gtin || 
                          companies.find((c: any) => c.id === product.companyId)?.gstin || 
                          (currentUser as any)?.companyGstin || 
                          (currentUser as any)?.company?.gstin || 
                          "-"}
                      </span>
                    </TableCell>
                    <TableCell className="align-middle px-6 py-5 text-right">
                      <span className="font-bold text-[#0F172A] text-[14px]">₹{product.mrp.toFixed(2)}</span>
                    </TableCell>
                    <TableCell className="align-middle px-6 py-5">
                      <span className="text-[14px] font-medium text-slate-600">{product.l1Size} / {product.l2Size} / {product.shipperSize}</span>
                    </TableCell>
                    <TableCell className="align-middle px-6 py-5">
                      <span className="text-[13px] font-medium text-slate-600">
                        {product.expiryDate ? format(new Date(product.expiryDate), "MMM d, yyyy") : "-"}
                      </span>
                    </TableCell>
                    <TableCell className="align-middle px-6 py-5 text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-white border border-[#E2E8F0]">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-lg font-bold text-[#0F172A]">Delete product</AlertDialogTitle>
                            <AlertDialogDescription className="text-sm text-[#434655]">
                              Permanently remove {product.name}. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(product.id)}
                              className="bg-red-600 hover:bg-red-700 text-white cursor-pointer"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      
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

