import { useState } from "react";
import { useLocation } from "wouter";
import {
  useCreateBatch,
  getListBatchesQueryKey,
  useListProducts,
  useListLocations,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { format } from "date-fns";
import { Package, CalendarIcon, Loader2, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

const batchSchema = z.object({
  productId: z.coerce.number().min(1, "Product is required"),
  batchNumber: z.string().min(1, "Batch number is required"),
  mfgDate: z.date({ required_error: "Manufacturing date is required" }),
  expiryDate: z.date({ required_error: "Expiry date is required" }),
});

type BatchForm = z.infer<typeof batchSchema>;

export default function NewBatch() {
  const { data: products = [] } = useListProducts();
  const { data: locations = [] } = useListLocations();
  const factories = locations;
  const createBatch = useCreateBatch();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Local/UI Mock States
  const [factoryLocation, setFactoryLocation] = useState("");

  const form = useForm<BatchForm>({
    resolver: zodResolver(batchSchema),
    defaultValues: {
      productId: undefined,
      batchNumber: "",
      mfgDate: undefined as any,
      expiryDate: undefined as any,
    },
  });

  const watchBatchNumber = form.watch("batchNumber") || "";

  const onSubmit = (values: BatchForm) => {
    const payload = {
      productId: values.productId,
      batchNumber: values.batchNumber,
      mfgDate: format(values.mfgDate, "yyyy-MM-dd"),
      expiryDate: format(values.expiryDate, "yyyy-MM-dd"),
    };

    createBatch.mutate(
      { data: payload as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getListBatchesQueryKey(),
          });
          toast.success("Batch created successfully");
          setLocation("/production/batches");
        },
        onError: (error: any) => {
          toast.error(error?.data?.error || "Failed to create batch");
        },
      }
    );
  };

  return (
    <div className="max-w-[1200px] mx-auto space-y-6 pb-12 font-sans">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-slate-500">
        <a className="text-[11px] font-bold hover:text-[#2563EB] transition-colors uppercase tracking-wider cursor-pointer" onClick={() => setLocation("/dashboard")}>Master Data</a>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <a className="text-[11px] font-bold hover:text-[#2563EB] transition-colors uppercase tracking-wider cursor-pointer" onClick={() => setLocation("/production/batches")}>Batches</a>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-[11px] text-[#2563EB] uppercase tracking-wider font-bold">Add Batch</span>
      </nav>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* Header Section */}
          <div className="flex justify-between items-end">
            <div>
              <h2 className="text-[30px] leading-[36px] font-bold text-[#0F172A] tracking-[-0.02em]">Add New Batch</h2>
              <p className="text-[16px] text-slate-600 mt-1">Initialize a new production lot for GS1 serialization tracking.</p>
            </div>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setLocation("/production/batches")}
                className="px-6 py-2.5 border border-slate-200 text-[#0F172A] font-semibold rounded-lg hover:bg-slate-50 transition-colors h-auto cursor-pointer"
              >
                Discard
              </Button>
              <Button
                type="submit"
                disabled={createBatch.isPending}
                className="px-6 py-2.5 bg-[#2563EB] hover:bg-[#2563EB]/90 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-[#2563EB]/20 transition-all flex items-center gap-2 active:scale-95 h-auto cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">save</span>
                Save Batch
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-6">
            {/* Left Column: Form Fields */}
            <div className="col-span-12 lg:col-span-8">
              <section className="bg-white border border-[#E2E8F0] rounded-xl p-8 shadow-sm">
                <h3 className="text-lg font-bold text-[#0F172A] mb-6 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#2563EB]" style={{ fontVariationSettings: "'FILL' 1" }}>inventory_2</span>
                  Batch Identification & Manufacturing
                </h3>
                <div className="space-y-6">
                  {/* Select Product */}
                  <FormField
                    control={form.control}
                    name="productId"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                          Select Product <span className="text-[#EF4444]">*</span>
                        </FormLabel>
                        <Select 
                          onValueChange={(val) => field.onChange(Number(val))} 
                          value={field.value?.toString()}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full bg-[#F8FAFC] border border-[#E2E8F0] focus:border-[#2563EB] focus:ring-0 rounded-lg py-3 px-4 text-sm text-slate-900 transition-all h-auto">
                              <SelectValue placeholder="Choose a registered product..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {products.map((p) => (
                              <SelectItem key={p.id} value={p.id.toString()}>
                                {p.name} (ID: {p.skuId})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Batch Name/No */}
                  <FormField
                    control={form.control}
                    name="batchNumber"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                          Unique Batch Name/No <span className="text-[#EF4444]">*</span>
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input 
                              placeholder="e.g., BN-2023-OCT-004" 
                              className="w-full bg-[#F8FAFC] border-[#E2E8F0] focus-visible:border-[#2563EB] focus-visible:ring-0 rounded-lg py-3 px-4 text-sm text-slate-900 transition-all font-mono"
                              {...field} 
                            />
                            {watchBatchNumber.length > 5 && (
                              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500 text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                                check_circle
                              </span>
                            )}
                          </div>
                        </FormControl>
                        <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-1">
                          <span className="material-symbols-outlined text-[14px]">info</span>
                          Recommended format: [REGION]-[YEAR]-[TYPE]-[SEQ]
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Dates Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="mfgDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col space-y-2">
                          <FormLabel className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                            Manufacturing Date <span className="text-[#EF4444]">*</span>
                          </FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className={cn(
                                    "w-full pl-3 text-left font-normal bg-[#F8FAFC] border-[#E2E8F0] hover:bg-slate-50 rounded-lg py-3 px-4 text-sm text-slate-900 h-auto",
                                    !field.value && "text-slate-500"
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "PPP")
                                  ) : (
                                    <span>Pick manufacturing date</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) =>
                                  date > new Date()
                                }
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="expiryDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col space-y-2">
                          <FormLabel className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                            Expiry Date <span className="text-[#EF4444]">*</span>
                          </FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className={cn(
                                    "w-full pl-3 text-left font-normal bg-[#F8FAFC] border-[#E2E8F0] hover:bg-slate-50 rounded-lg py-3 px-4 text-sm text-slate-900 h-auto",
                                    !field.value && "text-slate-500"
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "PPP")
                                  ) : (
                                    <span>Pick expiry date</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) =>
                                  date < new Date()
                                }
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Factory Location */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold tracking-wider text-slate-500 uppercase block">
                      Facility Location
                    </label>
                    <Select onValueChange={setFactoryLocation} value={factoryLocation || ""}>
                      <SelectTrigger className="w-full bg-[#F8FAFC] border border-[#E2E8F0] focus:border-[#2563EB] focus:ring-0 rounded-lg py-3 px-4 text-sm text-slate-900 transition-all h-auto">
                        <SelectValue placeholder="Select facility location..." />
                      </SelectTrigger>
                      <SelectContent>
                        {factories.length > 0 ? (
                          factories.map((loc) => (
                            <SelectItem key={loc.id} value={loc.locationName}>
                              {loc.locationName} ({loc.locationType})
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="none" disabled>
                            No locations registered. Please add one on the Locations page.
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Compliance Note */}
                <div className="mt-10 p-4 bg-[#2563EB]/5 border border-[#2563EB]/20 rounded-lg">
                  <h4 className="text-[11px] font-bold text-[#2563EB] mb-2 uppercase tracking-widest">
                    Compliance Note
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed italic">
                    Once saved, batch serialization parameters are locked for GS1 auditing. Ensure all manufacturing dates align with localized facility logs to prevent synchronization errors during Level 2 aggregation.
                  </p>
                </div>
              </section>
            </div>

            {/* Right Column: Context/Audits */}
            <div className="col-span-12 lg:col-span-4 space-y-6">
              <section className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <span className="material-symbols-outlined text-[#2563EB]" style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span>
                  <h3 className="text-lg font-bold text-[#0F172A]">GS1 Aggregation</h3>
                </div>
                <div className="p-4 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    This batch will generate unique barcodes matching GS1 compliance layouts. Standard formatting binds packaging hierarchies (L1, L2, Shipper, Pallet) cryptographically inside node 04 registers.
                  </p>
                </div>
              </section>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
