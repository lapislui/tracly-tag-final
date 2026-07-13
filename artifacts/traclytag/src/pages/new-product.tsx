import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  useGetCurrentUser,
  useCreateProduct,
  useListCompanies,
  getListProductsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { format } from "date-fns";
import { 
  Package, 
  FileText, 
  Layers, 
  CloudUpload, 
  Flame, 
  Skull, 
  Leaf, 
  Snowflake,
  Ban,
  Loader2,
  Trash2,
  Plus
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";

const productSchema = z.object({
  skuId: z.string().min(1, "SKU ID required"),
  name: z.string().min(1, "Name required"),
  skuSize: z.string().min(1, "SKU size required"),
  marketedBy: z.string().min(1, "Marketed by required"),
  sapDescription: z.string().optional().or(z.literal("")),
  mrp: z.coerce.number().positive("MRP must be positive"),
  registrationNo: z.string().optional().or(z.literal("")),
  hsnCode: z.string().optional().or(z.literal("")),
  gstRate: z.coerce.number().min(0).max(100).optional().or(z.null()),
  unit: z.string().optional().or(z.literal("")),
  weightValue: z.coerce.number().min(0).optional().or(z.null()),
  weightUnit: z.string().optional().or(z.literal("")),
  packagingType: z.string().optional().or(z.literal("")),
  shelfLifeDays: z.coerce.number().int().min(0).optional().or(z.null()),
  countryOfOrigin: z.string().default("IND"),
  isGs1Compliant: z.boolean().default(false),
  l1Size: z.coerce.number().int().min(1),
  l2Size: z.coerce.number().int().min(1),
  shipperSize: z.coerce.number().int().min(1),
  cautionLogoUrl: z.string().optional().or(z.literal("")),
  productLogoUrl: z.string().optional().or(z.literal("")),
  labelPdfUrl: z.string().optional().or(z.literal("")),
  expiryDate: z.date({ required_error: "Expiry date is required" }),
  companyId: z.coerce.number().optional(),
});

type ProductForm = z.infer<typeof productSchema>;

export default function NewProduct() {
  const { data: currentUser } = useGetCurrentUser();
  const isMaster = currentUser?.role === "master" || currentUser?.role === "super_master";
  const { data: companies = [] } = useListCompanies({ query: { enabled: isMaster } } as any);

  const createProduct = useCreateProduct();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Local/UI Mock States for layout alignment
  const [antidote, setAntidote] = useState("");
  const [leafletPdf, setLeafletPdf] = useState<{ name: string; url: string } | null>(null);
  const [shipperQty, setShipperQty] = useState("");
  const [palletQty, setPalletQty] = useState("");
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  const form = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      skuId: "",
      name: "",
      skuSize: "",
      marketedBy: "Tracely Global Logistics",
      sapDescription: "",
      mrp: 0,
      registrationNo: "",
      hsnCode: "",
      gstRate: 18,
      unit: "Piece",
      weightValue: 0,
      weightUnit: "g",
      packagingType: "Bottle",
      shelfLifeDays: 365,
      countryOfOrigin: "IND",
      isGs1Compliant: false,
      l1Size: 10,
      l2Size: 100,
      shipperSize: 5,
      cautionLogoUrl: "Flammable",
      productLogoUrl: "",
      labelPdfUrl: "",
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Default 1 year from now
      companyId: undefined,
    },
  });

  const watchName = form.watch("name");

  useEffect(() => {
    if (currentUser?.companyName && !isMaster) {
      form.setValue("marketedBy", currentUser.companyName);
    }
  }, [currentUser, isMaster, form]);

  useEffect(() => {
    const generatedSku = (watchName || "")
      .toUpperCase()
      .replace(/[^A-Z0-9\s-]/g, "")
      .trim()
      .replace(/[\s-]+/g, "-");
    form.setValue("skuId", generatedSku, { shouldValidate: true });
  }, [watchName, form]);

  const watchL1Size = form.watch("l1Size") || 10;
  const watchShipperSize = form.watch("shipperSize") || 5;
  const watchCautionLogo = form.watch("cautionLogoUrl");

  const handleUpload = (fieldName: "productLogoUrl" | "labelPdfUrl" | "leafletPdf") => {
    const input = document.createElement("input");
    input.type = "file";
    if (fieldName === "labelPdfUrl" || fieldName === "leafletPdf") {
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

        if (fieldName === "leafletPdf") {
          setLeafletPdf({ name: file.name, url: absoluteUrl });
        } else {
          form.setValue(fieldName, absoluteUrl);
        }
        toast.success(`${file.name} uploaded successfully`);
      } catch (error: any) {
        toast.error(error.message || "Error uploading file");
      } finally {
        setUploadingField(null);
      }
    };
    input.click();
  };

  const onSubmit = (values: ProductForm) => {
    if (isMaster && !values.companyId) {
      toast.error("Please select a company to allocate this product to.");
      return;
    }
    const payload = {
      ...values,
      companyId: isMaster ? values.companyId : currentUser?.companyId || 1,
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
          toast.success("Product created successfully");
          setLocation("/products");
        },
        onError: (error: any) => {
          toast.error(error?.data?.error || "Failed to create product");
        },
      }
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 max-w-[1200px] mx-auto pb-12 font-sans">
        {/* Header Block */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-[32px] font-bold text-[#0F172A] tracking-tight">Add Product Master Data</h1>
            <p className="text-slate-500 text-[14px] mt-1">Populate GS1 compliant product specifications for unique serialization tagging.</p>
          </div>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLocation("/products")}
              className="px-6 py-2 border border-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-colors h-11"
            >
              Discard
            </Button>
            <Button
              type="submit"
              disabled={createProduct.isPending}
              className="px-6 py-2 bg-[#2563EB] hover:bg-[#2563EB]/90 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-[#2563EB]/20 transition-all flex items-center gap-2 active:scale-95 h-11"
            >
              <span className="material-symbols-outlined text-[20px] font-bold">save</span>
              Save Product
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* LEFT COLUMN */}
          <div className="col-span-12 lg:col-span-8 space-y-6">
            
            {/* Card 1: Product Identification */}
            <section className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                  <Package className="w-5 h-5" />
                </div>
                <h3 className="text-[16px] font-bold text-[#0F172A]">Product Identification</h3>
              </div>

              <div className="space-y-5">
                {isMaster && (
                  <FormField
                    control={form.control}
                    name="companyId"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                          COMPANY <span className="text-[#EF4444]">*</span>
                        </FormLabel>
                        <Select 
                          onValueChange={(val) => field.onChange(Number(val))} 
                          value={field.value?.toString()}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full bg-[#F8FAFC] border-[#E2E8F0] focus:border-[#2563EB] focus:ring-0 rounded-lg py-2.5 px-4 text-sm text-slate-900 transition-all h-auto">
                              <SelectValue placeholder="Select target company node" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {companies.map((company: any) => (
                              <SelectItem key={company.id} value={company.id.toString()}>
                                {company.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="isGs1Compliant"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5 col-span-2">
                        <FormLabel className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                          SERIALIZATION COMPLIANCE MODE
                        </FormLabel>
                        <Select 
                          onValueChange={(val) => field.onChange(val === "true")} 
                          value={String(field.value)}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full bg-[#F8FAFC] border border-[#E2E8F0] focus:border-[#2563EB] focus:ring-0 rounded-lg py-2.5 px-4 text-sm text-slate-900 transition-all h-auto">
                              <SelectValue placeholder="Select serialization mode" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="false">TracelyTag Internal Compliance (Generates secure non-GS1 serial codes)</SelectItem>
                            <SelectItem value="true">Official GS1 Compliant Mode (Requires GTIN or Company GST)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="skuId"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                          SKU ID <span className="text-[#EF4444]">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input 
                            readOnly
                            placeholder="Automatically generated from product name" 
                            className="w-full bg-[#F1F5F9] border-[#E2E8F0] text-slate-500 rounded-lg py-2.5 px-4 text-sm transition-all cursor-not-allowed focus-visible:ring-0 placeholder:text-slate-400 font-semibold"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                      COMPANY GST
                    </label>
                    <Input 
                      value={companies.find((c: any) => c.id === form.watch("companyId"))?.gstin || (currentUser as any)?.companyGstin || (currentUser as any)?.company?.gstin || ""}
                      readOnly
                      placeholder="Selected company GST" 
                      className="w-full bg-[#F1F5F9] border-[#E2E8F0] text-slate-500 rounded-lg py-2.5 px-4 text-sm transition-all font-mono cursor-not-allowed focus-visible:ring-0"
                    />
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                        PRODUCT NAME
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter formal product commercial name" 
                          className="w-full bg-[#F8FAFC] border-[#E2E8F0] focus-visible:border-[#2563EB] focus-visible:ring-0 rounded-lg py-2.5 px-4 text-sm text-slate-900 transition-all placeholder:text-slate-400"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="skuSize"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                          SKU SIZE / VOLUME
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input 
                              placeholder="e.g. 500ml / 1kg" 
                              className="w-full bg-[#F8FAFC] border-[#E2E8F0] focus-visible:border-[#2563EB] focus-visible:ring-0 rounded-lg py-2.5 px-4 pr-10 text-sm text-slate-900 transition-all placeholder:text-slate-400"
                              {...field} 
                            />
                            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">scale</span>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="mrp"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                          MRP (UNIT PRICE)
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                            <Input 
                              type="number"
                              placeholder="0.00" 
                              className="w-full bg-[#F8FAFC] border-[#E2E8F0] focus-visible:border-[#2563EB] focus-visible:ring-0 rounded-lg py-2.5 pl-8 pr-4 text-sm text-slate-900 transition-all placeholder:text-slate-400"
                              {...field} 
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="sapDescription"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                        SAP DESCRIPTION
                      </FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Technical system description from SAP ERP..." 
                          rows={3}
                          className="w-full bg-[#F8FAFC] border-[#E2E8F0] focus-visible:border-[#2563EB] focus-visible:ring-0 rounded-lg py-2.5 px-4 text-sm text-slate-900 transition-all placeholder:text-slate-400 resize-none"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            {/* Card 2: Regulatory Information */}
            <section className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                  <FileText className="w-5 h-5" />
                </div>
                <h3 className="text-[16px] font-bold text-[#0F172A]">Regulatory Information</h3>
              </div>

              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="registrationNo"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                          REGISTRATION NO.
                        </FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="ISO/REG/9920/1" 
                            className="w-full bg-[#F8FAFC] border-[#E2E8F0] focus-visible:border-[#2563EB] focus-visible:ring-0 rounded-lg py-2.5 px-4 text-sm text-slate-900 transition-all placeholder:text-slate-400"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="marketedBy"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                          MARKETED BY
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger className="w-full bg-[#F8FAFC] border border-[#E2E8F0] focus:border-[#2563EB] focus:ring-0 rounded-lg py-2.5 px-4 text-sm text-slate-900 transition-all h-[42px]">
                              <SelectValue placeholder="Select company" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {isMaster ? (
                              companies.map((c) => (
                                <SelectItem key={c.id} value={c.name}>
                                  {c.name}
                                </SelectItem>
                              ))
                            ) : (
                              currentUser?.companyName && (
                                <SelectItem value={currentUser.companyName}>
                                  {currentUser.companyName}
                                </SelectItem>
                              )
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                    ANTIDOTE STATEMENT
                  </label>
                  <Textarea 
                    placeholder="Specify emergency procedures and antidote requirements for hazardous handling..." 
                    rows={3}
                    value={antidote}
                    onChange={(e) => setAntidote(e.target.value)}
                    className="w-full bg-[#F8FAFC] border-[#E2E8F0] focus-visible:border-[#2563EB] focus-visible:ring-0 rounded-lg py-2.5 px-4 text-sm text-slate-900 transition-all placeholder:text-slate-400 resize-none"
                  />
                </div>

                <FormField
                  control={form.control}
                  name="cautionLogoUrl"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                        CAUTION LOGO SELECTION
                      </FormLabel>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        {[
                          { name: "N/A", icon: Ban, color: "text-slate-400", bg: "bg-slate-100" },
                          { name: "Flammable", icon: Flame, color: "text-red-500", bg: "bg-red-50" },
                          { name: "Toxic", icon: Skull, color: "text-slate-600", bg: "bg-slate-50" },
                          { name: "Eco-Hazard", icon: Leaf, color: "text-emerald-500", bg: "bg-emerald-50" },
                          { name: "Cold Chain", icon: Snowflake, color: "text-blue-500", bg: "bg-blue-50" }
                        ].map((logo) => {
                          const IconComponent = logo.icon;
                          const isActive = watchCautionLogo === logo.name;
                          return (
                            <button
                              key={logo.name}
                              type="button"
                              onClick={() => field.onChange(logo.name)}
                              className={cn(
                                "flex flex-col items-center justify-center p-4 border rounded-xl gap-2 transition-all cursor-pointer",
                                isActive 
                                  ? "border-[#2563EB] bg-[#F0F6FF] ring-1 ring-[#2563EB]" 
                                  : "border-[#E2E8F0] bg-white hover:bg-slate-50"
                              )}
                            >
                              <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", logo.bg)}>
                                <IconComponent className={cn("w-4 h-4", logo.color)} />
                              </div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">{logo.name}</span>
                            </button>
                          );
                        })}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            {/* Card 3: Tax, Physical Metrics & Packaging */}
            <section className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-green-600">
                  <Layers className="w-5 h-5" />
                </div>
                <h3 className="text-[16px] font-bold text-[#0F172A]">Tax, Physical Metrics & Packaging</h3>
              </div>

              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="hsnCode"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                          HSN CODE (TAX CLASSIFICATION)
                        </FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g. 38089190" 
                            className="w-full bg-[#F8FAFC] border-[#E2E8F0] focus-visible:border-[#2563EB] focus-visible:ring-0 rounded-lg py-2.5 px-4 text-sm text-slate-900 transition-all font-mono"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="gstRate"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                          GST RATE (%)
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            placeholder="e.g. 18" 
                            className="w-full bg-[#F8FAFC] border-[#E2E8F0] focus-visible:border-[#2563EB] focus-visible:ring-0 rounded-lg py-2.5 px-4 text-sm text-slate-900 transition-all"
                            {...field} 
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="unit"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                          UNIT OF MEASUREMENT
                        </FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="w-full bg-[#F8FAFC] border border-[#E2E8F0] focus:border-[#2563EB] focus:ring-0 rounded-lg py-2.5 px-4 text-sm text-slate-900 transition-all h-auto">
                              <SelectValue placeholder="Select Unit" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Piece">Piece (Pc)</SelectItem>
                            <SelectItem value="Box">Box (Bx)</SelectItem>
                            <SelectItem value="Bottle">Bottle (Bt)</SelectItem>
                            <SelectItem value="Kg">Kilogram (Kg)</SelectItem>
                            <SelectItem value="Litre">Litre (L)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="weightValue"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                          WEIGHT / VOLUME VALUE
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            placeholder="e.g. 500" 
                            className="w-full bg-[#F8FAFC] border-[#E2E8F0] focus-visible:border-[#2563EB] focus-visible:ring-0 rounded-lg py-2.5 px-4 text-sm text-slate-900 transition-all"
                            {...field} 
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="weightUnit"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                          WEIGHT / VOLUME UNIT
                        </FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="w-full bg-[#F8FAFC] border border-[#E2E8F0] focus:border-[#2563EB] focus:ring-0 rounded-lg py-2.5 px-4 text-sm text-slate-900 transition-all h-auto">
                              <SelectValue placeholder="Select Unit" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="g">Grams (g)</SelectItem>
                            <SelectItem value="kg">Kilograms (kg)</SelectItem>
                            <SelectItem value="ml">Millilitres (ml)</SelectItem>
                            <SelectItem value="l">Litres (L)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="packagingType"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                          PACKAGING TYPE
                        </FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="w-full bg-[#F8FAFC] border border-[#E2E8F0] focus:border-[#2563EB] focus:ring-0 rounded-lg py-2.5 px-4 text-sm text-slate-900 transition-all h-auto">
                              <SelectValue placeholder="Select Type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Bottle">Bottle</SelectItem>
                            <SelectItem value="Can">Can</SelectItem>
                            <SelectItem value="Carton">Carton</SelectItem>
                            <SelectItem value="Pouch">Pouch</SelectItem>
                            <SelectItem value="Jar">Jar</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="shelfLifeDays"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                          SHELF LIFE (DAYS)
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            placeholder="e.g. 365" 
                            className="w-full bg-[#F8FAFC] border-[#E2E8F0] focus-visible:border-[#2563EB] focus-visible:ring-0 rounded-lg py-2.5 px-4 text-sm text-slate-900 transition-all"
                            {...field} 
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="countryOfOrigin"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                          COUNTRY OF ORIGIN
                        </FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="IND" 
                            className="w-full bg-[#F8FAFC] border-[#E2E8F0] focus-visible:border-[#2563EB] focus-visible:ring-0 rounded-lg py-2.5 px-4 text-sm text-slate-900 transition-all uppercase font-mono"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </section>
          </div>

          {/* RIGHT COLUMN */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            
            {/* Card 3: Packaging Hierarchy */}
            <section className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-[#F0F6FF] flex items-center justify-center text-blue-600">
                  <Layers className="w-5 h-5" />
                </div>
                <h3 className="text-[16px] font-bold text-[#0F172A]">Packaging Hierarchy</h3>
              </div>

              <div className="space-y-6">
                
                {/* Shipper Section */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-800">SHIPPER</span>
                    <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full uppercase tracking-wider">QR/SHIPPER</span>
                  </div>
                  <p className="text-xs text-slate-500">How many QR codes should be entered for 1 Shipper?</p>
                  
                  <div className="flex items-center gap-3">
                    <FormField
                      control={form.control}
                      name="l1Size"
                      render={({ field }) => (
                        <FormItem className="w-24">
                          <FormControl>
                            <Input 
                              type="number"
                              className="bg-[#F8FAFC] border-[#E2E8F0] focus-visible:border-[#2563EB] focus-visible:ring-0 text-center font-semibold text-sm"
                              {...field}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <span className="text-xs text-slate-400 font-medium">QR</span>
                    <span className="text-slate-400 font-bold">=</span>
                    <div className="w-16 bg-slate-100 border border-slate-200 text-center font-semibold text-sm py-2 rounded-lg text-slate-500 select-none">
                      1
                    </div>
                    <span className="text-xs text-slate-400 font-medium">SHP</span>
                  </div>
                  <p className="text-[10px] text-slate-400 italic font-medium">{watchL1Size} QR Codes = 1 Shipper</p>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <label className="text-[10px] font-bold tracking-wider text-slate-500 uppercase block">SHIPPER REQUEST</label>
                  <p className="text-xs text-slate-500 mb-1">How many shippers do you need?</p>
                  <div className="relative">
                    <Input 
                      placeholder="Enter quantity"
                      value={shipperQty}
                      onChange={(e) => setShipperQty(e.target.value)}
                      className="w-full bg-[#F8FAFC] border-[#E2E8F0] focus-visible:border-[#2563EB] focus-visible:ring-0 rounded-lg py-2 px-4 pr-12 text-sm text-slate-900 transition-all placeholder:text-slate-400"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">QTY</span>
                  </div>
                </div>

                {/* Pallet Section */}
                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-800">PALLET</span>
                    <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full uppercase tracking-wider">SHIPPERS/PALLET</span>
                  </div>
                  <p className="text-xs text-slate-500">How many Shipper codes should be entered for 1 Pallet?</p>
                  
                  <div className="flex items-center gap-3">
                    <FormField
                      control={form.control}
                      name="shipperSize"
                      render={({ field }) => (
                        <FormItem className="w-24">
                          <FormControl>
                            <Input 
                              type="number"
                              className="bg-[#F8FAFC] border-[#E2E8F0] focus-visible:border-[#2563EB] focus-visible:ring-0 text-center font-semibold text-sm"
                              {...field}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <span className="text-xs text-slate-400 font-medium">SHP</span>
                    <span className="text-slate-400 font-bold">=</span>
                    <div className="w-16 bg-slate-100 border border-slate-200 text-center font-semibold text-sm py-2 rounded-lg text-slate-500 select-none">
                      1
                    </div>
                    <span className="text-xs text-slate-400 font-medium">PLT</span>
                  </div>
                  <p className="text-[10px] text-slate-400 italic font-medium">{watchShipperSize} Shipper Codes = 1 Pallet</p>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <label className="text-[10px] font-bold tracking-wider text-slate-500 uppercase block">PALLET REQUEST</label>
                  <p className="text-xs text-slate-500 mb-1">How many pallets do you need?</p>
                  <div className="relative">
                    <Input 
                      placeholder="Enter quantity"
                      value={palletQty}
                      onChange={(e) => setPalletQty(e.target.value)}
                      className="w-full bg-[#F8FAFC] border-[#E2E8F0] focus-visible:border-[#2563EB] focus-visible:ring-0 rounded-lg py-2 px-4 pr-12 text-sm text-slate-900 transition-all placeholder:text-slate-400"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">QTY</span>
                  </div>
                </div>

              </div>
            </section>

            {/* Card 4: Digital Assets */}
            <section className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                  <CloudUpload className="w-5 h-5" />
                </div>
                <h3 className="text-[16px] font-bold text-[#0F172A]">Digital Assets</h3>
              </div>

              {/* Product Logo upload zone */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">PRODUCT LOGO (.SVG, .PNG)</label>
                <FormField
                  control={form.control}
                  name="productLogoUrl"
                  render={({ field }) => (
                    <FormItem>
                      {field.value ? (
                        <div className="border border-slate-200 rounded-xl p-3 flex items-center justify-between bg-slate-50">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <img src={field.value} alt="Product Logo" className="w-8 h-8 object-contain rounded border bg-white" />
                            <span className="text-xs text-slate-600 truncate">{field.value.split("/").pop()}</span>
                          </div>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => field.onChange("")}
                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div 
                          onClick={() => handleUpload("productLogoUrl")}
                          className="border-2 border-dashed border-slate-200 rounded-xl py-6 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-slate-50 transition-colors"
                        >
                          {uploadingField === "productLogoUrl" ? (
                            <Loader2 className="h-6 w-6 animate-spin text-[#2563EB]" />
                          ) : (
                            <CloudUpload className="h-6 w-6 text-slate-400" />
                          )}
                          <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                            {uploadingField === "productLogoUrl" ? "Uploading..." : "DRAG OR CLICK TO UPLOAD"}
                          </span>
                        </div>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Label PDF file block */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">LABEL PDF</label>
                <FormField
                  control={form.control}
                  name="labelPdfUrl"
                  render={({ field }) => (
                    <FormItem>
                      {field.value ? (
                        <div className="border border-slate-200 rounded-xl p-3 flex items-center justify-between bg-slate-50">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <span className="material-symbols-outlined text-red-500">picture_as_pdf</span>
                            <div className="flex flex-col overflow-hidden">
                              <span className="text-xs font-semibold text-slate-700 truncate">{field.value.split("/").pop()}</span>
                              <span className="text-[10px] text-slate-400 font-medium">Uploaded</span>
                            </div>
                          </div>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => field.onChange("")}
                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div 
                          onClick={() => handleUpload("labelPdfUrl")}
                          className="border border-[#E2E8F0] rounded-xl p-3 flex items-center justify-between bg-[#F8FAFC] hover:bg-slate-50 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-slate-400">picture_as_pdf</span>
                            <span className="text-xs text-slate-400">No file selected</span>
                          </div>
                          {uploadingField === "labelPdfUrl" ? (
                            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                          ) : (
                            <Plus className="h-4 w-4 text-slate-400" />
                          )}
                        </div>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Leaflet PDF file block */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">LEAFLET PDF</label>
                {leafletPdf ? (
                  <div className="border border-slate-200 rounded-xl p-3 flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="material-symbols-outlined text-red-500">picture_as_pdf</span>
                      <div className="flex flex-col overflow-hidden">
                        <span className="text-xs font-semibold text-slate-700 truncate">{leafletPdf.name}</span>
                        <span className="text-[10px] text-slate-400 font-medium">Uploaded</span>
                      </div>
                    </div>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => setLeafletPdf(null)}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div 
                    onClick={() => handleUpload("leafletPdf")}
                    className="border border-[#E2E8F0] rounded-xl p-3 flex items-center justify-between bg-[#F8FAFC] hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-slate-400">picture_as_pdf</span>
                      <span className="text-xs text-slate-400">No file selected</span>
                    </div>
                    {uploadingField === "leafletPdf" ? (
                      <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                    ) : (
                      <Plus className="h-4 w-4 text-slate-400" />
                    )}
                  </div>
                )}
              </div>

            </section>
          </div>
        </div>
      </form>
    </Form>
  );
}
