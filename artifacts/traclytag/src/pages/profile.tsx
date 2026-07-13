import { useState, useEffect } from "react";
import { useGetCurrentUser } from "@workspace/api-client-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { User, Shield, Phone, Mail, Building, KeyRound, Award, Calendar, CheckCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const profileSchema = z.object({
  email: z.string().email("Invalid email address"),
  phone: z.string().optional().or(z.literal("")),
  currentPassword: z.string().optional().or(z.literal("")),
  password: z.string().optional().or(z.literal("")),
  confirmPassword: z.string().optional().or(z.literal("")),
}).refine((data) => {
  if (data.password && data.password.length > 0) {
    return !!data.currentPassword && data.currentPassword.length > 0;
  }
  return true;
}, {
  message: "Current password is required to set a new password",
  path: ["currentPassword"]
}).refine((data) => {
  if (data.password && data.password.length > 0) {
    return data.password.length >= 6;
  }
  return true;
}, {
  message: "Password must be at least 6 characters",
  path: ["password"]
}).refine((data) => {
  if (data.password && data.password.length > 0) {
    return data.password === data.confirmPassword;
  }
  return true;
}, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function Profile() {
  const { data: user } = useGetCurrentUser();
  const queryClient = useQueryClient();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      email: "",
      phone: "",
      currentPassword: "",
      password: "",
      confirmPassword: "",
    },
  });

  // Pre-fill form when user data is available
  useEffect(() => {
    if (user) {
      form.reset({
        email: user.email || "",
        phone: (user as any).phone || "",
        currentPassword: "",
        password: "",
        confirmPassword: "",
      });
    }
  }, [user, form]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormValues) => {
      const res = await fetch("/api/users/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: data.email,
          phone: data.phone || null,
          currentPassword: data.currentPassword || null,
          password: data.password || null,
        }),
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to update profile settings.");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
      toast.success("Profile updated successfully!");
      form.setValue("currentPassword", "");
      form.setValue("password", "");
      form.setValue("confirmPassword", "");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update profile.");
    }
  });

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-slate-500">Loading user profile...</p>
      </div>
    );
  }

  const onSubmit = (values: ProfileFormValues) => {
    updateProfileMutation.mutate(values);
  };

  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Breadcrumbs */}
      <div className="mb-4 flex items-center gap-2 text-slate-500">
        <span className="text-[11px] font-bold uppercase tracking-wider">User Account</span>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-[11px] text-[#2563EB] uppercase tracking-wider font-bold">Profile</span>
      </div>

      <div className="mb-8">
        <h2 className="text-[30px] leading-[36px] font-bold text-[#0F172A] tracking-[-0.02em]">Account Profile</h2>
        <p className="text-[16px] text-slate-600 mt-1">Manage details and credentials of your operator session.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Form Panel */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 rounded-xl">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-midnight-navy dark:text-white">
                <User className="h-5 w-5 text-safety-blue" />
                Profile Settings
              </CardTitle>
              <CardDescription>Update your contact details and session credentials below.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 dark:text-slate-300 font-semibold">Email Address</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                              <Input type="email" className="pl-10 h-11" placeholder="email@example.com" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 dark:text-slate-300 font-semibold">Phone Number</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Phone className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                              <Input className="pl-10 h-11" placeholder="+1 (555) 000-0000" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                      <KeyRound className="h-4 w-4 text-amber-500" />
                      Change Password
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <FormField
                        control={form.control}
                        name="currentPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-700 dark:text-slate-300 font-semibold">Current Password</FormLabel>
                            <FormControl>
                              <Input type="password" className="h-11" placeholder="Enter current password" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-700 dark:text-slate-300 font-semibold">New Password</FormLabel>
                            <FormControl>
                              <Input type="password" className="h-11" placeholder="Minimum 6 characters" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-700 dark:text-slate-300 font-semibold">Confirm Password</FormLabel>
                            <FormControl>
                              <Input type="password" className="h-11" placeholder="Re-enter new password" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
                    <Button 
                      type="submit" 
                      className="px-6 py-2.5 bg-[#2563EB] hover:bg-[#2563EB]/90 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-[#2563EB]/20 transition-all flex items-center gap-2 active:scale-95 h-11"
                      disabled={updateProfileMutation.isPending}
                    >
                      {updateProfileMutation.isPending ? "Saving changes..." : "Save Changes"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        {/* Right Info Sidebar Panel */}
        <div className="space-y-6">
          <Card className="border border-slate-200 dark:border-slate-800 shadow-sm bg-gradient-to-b from-slate-50/50 to-white dark:from-slate-900 dark:to-slate-950 rounded-xl overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-safety-blue via-teal-500 to-indigo-600"></div>
            <CardContent className="pt-8 flex flex-col items-center text-center space-y-6">
              <Avatar className="h-24 w-24 border-2 border-safety-blue/20 ring-4 ring-safety-blue/5">
                <AvatarFallback className="bg-safety-blue/15 text-safety-blue text-3xl font-bold">
                  {getInitials(user.username)}
                </AvatarFallback>
              </Avatar>

              <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white leading-tight">{user.username}</h3>
                <Badge variant="outline" className="mt-1.5 text-[9px] uppercase px-2 py-0.5 border-safety-blue/30 text-safety-blue bg-safety-blue/5">
                  {user.role === "client_admin" ? "manager" : user.role.replace("_", " ")}
                </Badge>
              </div>

              <div className="w-full border-t border-slate-100 dark:border-slate-800 pt-6 space-y-4 text-left">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-lg">
                    <Building className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Company</p>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {user.companyName || "Global Administration"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-lg">
                    <Shield className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">User Role Scope</p>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {user.role === "master" || user.role === "super_master" ? "Full system capabilities" : "Standard operations permissions"}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Subscription Tier Details Card */}
          <Card className="border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 rounded-xl overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2">
                <Award className="h-4 w-4 text-amber-500" />
                Subscription Plan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                <span className="text-xs text-slate-500 font-bold">Active Tier</span>
                <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-500 text-white border-none shadow-none uppercase font-black text-[10px] tracking-wider">
                  {(user as any).subscriptionPlan || "Standard"}
                </Badge>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <CheckCircle className="h-3.5 w-3.5 text-success-emerald" /> Status
                  </span>
                  <span className="font-bold text-success-emerald uppercase">
                    {(user as any).subscriptionStatus || "Active"}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" /> Renew Date
                  </span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {(user as any).subscriptionExpiresAt 
                      ? new Date((user as any).subscriptionExpiresAt).toLocaleDateString()
                      : "Never (Lifetime)"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
