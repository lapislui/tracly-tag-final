import { useLocation } from "wouter";
import { 
  useGetCurrentUser, 
  useCreateUser, 
  useListCompanies, 
  getListUsersQueryKey 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const userSchema = z.object({
  username: z.string().min(1, "Username is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional().or(z.literal("")),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["super_master", "master", "admin", "client_admin", "operator"]),
  companyId: z.coerce.number().optional(),
});

export default function NewUser() {
  const { data: currentUser } = useGetCurrentUser();
  const createUser = useCreateUser();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const isMaster = currentUser?.role === "master" || currentUser?.role === "super_master";

  const { data: companies = [] } = useListCompanies({
    query: { enabled: isMaster },
  } as any);

  const form = useForm<z.infer<typeof userSchema>>({
    resolver: zodResolver(userSchema),
    defaultValues: { 
      username: "", 
      email: "", 
      phone: "", 
      password: "", 
      role: "operator",
      companyId: isMaster ? undefined : currentUser?.companyId || undefined
    },
  });

  const onSubmit = (values: z.infer<typeof userSchema>) => {
    // Force companyId for non-master users to prevent creation outside their company
    if (!isMaster && currentUser?.companyId) {
      values.companyId = currentUser.companyId;
    }

    createUser.mutate({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        toast.success("User created successfully");
        setLocation("/users");
      },
      onError: (error: any) => {
        toast.error(error?.data?.error || "Failed to create user");
      }
    });
  };

  if (currentUser && currentUser.role === "operator") {
    return (
      <div className="p-8 text-center text-destructive font-semibold">
        Access denied. Manager or Master role required.
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-slate-500">
        <a className="text-[11px] font-bold hover:text-[#2563EB] transition-colors uppercase tracking-wider cursor-pointer" onClick={() => setLocation("/dashboard")}>Master Data</a>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <a className="text-[11px] font-bold hover:text-[#2563EB] transition-colors uppercase tracking-wider cursor-pointer" onClick={() => setLocation("/users")}>Users</a>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-[11px] text-[#2563EB] uppercase tracking-wider font-bold">Add New User</span>
      </nav>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* Header Section */}
          <div className="flex justify-between items-end">
            <div>
              <h2 className="text-[30px] leading-[36px] font-bold text-[#0F172A] tracking-[-0.02em]">Add New User</h2>
              <p className="text-[16px] text-slate-600 mt-1">Register a new user node with role-based access controls.</p>
            </div>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setLocation("/users")}
                className="px-6 py-2.5 border border-slate-200 text-[#0F172A] font-semibold rounded-lg hover:bg-slate-50 transition-colors h-auto cursor-pointer"
              >
                Discard
              </Button>
              <Button
                type="submit"
                disabled={createUser.isPending}
                className="px-6 py-2.5 bg-[#2563EB] hover:bg-[#2563EB]/90 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-[#2563EB]/20 transition-all flex items-center gap-2 active:scale-95 h-auto cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">save</span>
                Save User
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-6">
            {/* Left Column: Primary Details */}
            <div className="col-span-12 lg:col-span-8 space-y-6">
              {/* Section 1: Basic Account Details */}
              <section className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <span className="material-symbols-outlined text-[#2563EB]" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
                  <h3 className="text-lg font-bold text-[#0F172A]">Basic Account Details</h3>
                </div>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <FormLabel className="text-[11px] font-bold tracking-wider text-slate-500 flex items-center gap-1 uppercase">
                            USERNAME <span className="text-[#EF4444]">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="e.g., john.doe" 
                              className="w-full bg-[#F8FAFC] border-[#E2E8F0] focus-visible:border-[#2563EB] focus-visible:ring-0 rounded-lg py-2.5 px-4 text-sm text-slate-900 transition-all"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage className="text-[11px] text-[#EF4444]" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <FormLabel className="text-[11px] font-bold tracking-wider text-slate-500 flex items-center gap-1 uppercase">
                            PASSWORD <span className="text-[#EF4444]">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input 
                              type="password"
                              placeholder="Min. 6 characters" 
                              className="w-full bg-[#F8FAFC] border-[#E2E8F0] focus-visible:border-[#2563EB] focus-visible:ring-0 rounded-lg py-2.5 px-4 text-sm text-slate-900 transition-all"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage className="text-[11px] text-[#EF4444]" />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <FormLabel className="text-[11px] font-bold tracking-wider text-slate-500 flex items-center gap-1 uppercase">
                            EMAIL ADDRESS <span className="text-[#EF4444]">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input 
                              type="email"
                              placeholder="john.doe@company.com" 
                              className="w-full bg-[#F8FAFC] border-[#E2E8F0] focus-visible:border-[#2563EB] focus-visible:ring-0 rounded-lg py-2.5 px-4 text-sm text-slate-900 transition-all"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage className="text-[11px] text-[#EF4444]" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <FormLabel className="text-[11px] font-bold tracking-wider text-slate-500 flex items-center gap-1 uppercase">
                            PHONE NUMBER (OPTIONAL)
                          </FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="+91 98765 43210" 
                              className="w-full bg-[#F8FAFC] border-[#E2E8F0] focus-visible:border-[#2563EB] focus-visible:ring-0 rounded-lg py-2.5 px-4 text-sm text-slate-900 transition-all"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage className="text-[11px] text-[#EF4444]" />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </section>

              {/* Section 2: Authorization & Placement */}
              <section className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <span className="material-symbols-outlined text-[#2563EB]" style={{ fontVariationSettings: "'FILL' 1" }}>rule</span>
                  <h3 className="text-lg font-bold text-[#0F172A]">Authorization & Placement</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel className="text-[11px] font-bold tracking-wider text-slate-500 flex items-center gap-1 uppercase">
                          ROLE <span className="text-[#EF4444]">*</span>
                        </FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="w-full bg-[#F8FAFC] border-[#E2E8F0] focus:border-[#2563EB] focus:ring-0 rounded-lg py-2.5 px-4 text-sm text-slate-900 transition-all h-auto">
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="operator">Operator</SelectItem>
                            {(isMaster || currentUser?.role === "admin") && <SelectItem value="client_admin">Manager</SelectItem>}
                            {(isMaster || currentUser?.role === "admin") && <SelectItem value="admin">Admin</SelectItem>}
                            {isMaster && <SelectItem value="master">Master</SelectItem>}
                            {currentUser?.role === "super_master" && <SelectItem value="super_master">Super Master</SelectItem>}
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-[11px] text-[#EF4444]" />
                      </FormItem>
                    )}
                  />

                  {isMaster && ["admin", "client_admin", "operator"].includes(form.watch("role")) && (
                    <FormField
                      control={form.control}
                      name="companyId"
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <FormLabel className="text-[11px] font-bold tracking-wider text-slate-500 flex items-center gap-1 uppercase">
                            COMPANY <span className="text-[#EF4444]">*</span>
                          </FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            value={field.value?.toString()}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full bg-[#F8FAFC] border-[#E2E8F0] focus:border-[#2563EB] focus:ring-0 rounded-lg py-2.5 px-4 text-sm text-slate-900 transition-all h-auto">
                                <SelectValue placeholder="Select company node" />
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
                          <FormMessage className="text-[11px] text-[#EF4444]" />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </section>
            </div>

            {/* Right Column: Security Accent */}
            <div className="col-span-12 lg:col-span-4">
              <section className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <span className="material-symbols-outlined text-[#2563EB]" style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span>
                  <h3 className="text-lg font-bold text-[#0F172A]">Identity Controls</h3>
                </div>
                <div className="p-4 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0] space-y-4">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Users require active security clearance to log in. Multi-Factor Authentication (MFA) OTP codes will be generated automatically for any client administration or operator login.
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Ensure the email address is valid to prevent login blocks.
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
