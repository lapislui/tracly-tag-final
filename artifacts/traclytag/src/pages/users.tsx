import { useState } from "react";
import { useLocation } from "wouter";
import { 
  useGetCurrentUser, 
  useListUsers, 
  getListUsersQueryKey, 
  useCreateUser, 
  useDeleteUser, 
  useListCompanies, 
  useUpdateUser 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Trash2, Plus, Users as UsersIcon, Pencil, CheckCircle2, XCircle } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";

const userSchema = z.object({
  username: z.string().min(1, "Username is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().optional().or(z.literal("")),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["super_master", "master", "admin", "client_admin", "operator"]),
  companyId: z.coerce.number().optional(),
});

const AVAILABLE_MODULES = [
  { id: "dashboard", label: "Dashboard" },
  { id: "companies", label: "Companies" },
  { id: "users", label: "Users" },
  { id: "products", label: "Products" },
  { id: "locations", label: "Locations" },
  { id: "batches", label: "Batches" },
  { id: "generate_codes", label: "Generate Codes" },
  { id: "mapping_code", label: "Mapping Code" },
  { id: "customer_scan", label: "Customer Scan" },
  { id: "summary", label: "Summary" },
  { id: "reports", label: "Reports" },
];

export default function Users() {
  const [, setLocation] = useLocation();
  const { data: currentUser } = useGetCurrentUser();
  const { data: users = [], isLoading } = useListUsers();
  const { data: companies = [] } = useListCompanies({ query: { enabled: currentUser?.role === "master" || currentUser?.role === "super_master" } } as any);
  
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const queryClient = useQueryClient();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Edit user state
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRole, setEditRole] = useState<"super_master" | "master" | "admin" | "client_admin" | "operator">("operator");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editModules, setEditModules] = useState<string[]>([]);
  const [editPassword, setEditPassword] = useState("");
  const [editCompanyId, setEditCompanyId] = useState<number | null>(null);

  const isMaster = currentUser?.role === "master" || currentUser?.role === "super_master";

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
        setIsCreateOpen(false);
        form.reset();
      },
      onError: (error: any) => {
        toast.error(error?.data?.error || "Failed to create user");
      }
    });
  };

  const handleOpenEdit = (user: any) => {
    setEditingUser(user);
    setEditEmail(user.email || "");
    setEditPhone(user.phone || "");
    setEditRole(user.role);
    setEditIsActive(user.isActive !== false);
    setEditModules((user.enabledModules || "").split(",").filter(Boolean));
    setEditPassword("");
    setEditCompanyId(user.companyId || null);
    setIsEditOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingUser) return;
    const data: any = {
      email: editEmail,
      phone: editPhone || null,
      role: editRole,
      isActive: editIsActive,
      enabledModules: editModules.join(","),
      companyId: (editRole === "super_master" || editRole === "master") ? null : (editCompanyId || null),
    };
    if (editPassword.trim()) {
      if (editPassword.length < 6) {
        toast.error("Password must be at least 6 characters");
        return;
      }
      data.password = editPassword;
    }

    updateUser.mutate({
      id: editingUser.id,
      data,
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        toast.success("User updated successfully");
        setIsEditOpen(false);
      },
      onError: (error: any) => {
        toast.error(error?.data?.error || "Failed to update user");
      }
    });
  };

  const handleDelete = (id: number) => {
    if (id === currentUser?.id) {
      toast.error("Cannot delete your own account");
      return;
    }
    
    deleteUser.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        toast.success("User deleted successfully");
      },
      onError: (error: any) => {
        toast.error(error?.data?.error || "Failed to delete user");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="mb-4 flex items-center gap-2 text-slate-500">
        <a className="text-[11px] font-bold hover:text-[#2563EB] transition-colors uppercase tracking-wider cursor-pointer" href="#">Master Data</a>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-[11px] text-[#2563EB] uppercase tracking-wider font-bold">Users</span>
      </div>
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-[30px] leading-[36px] font-bold text-[#0F172A] tracking-[-0.02em]">Users</h2>
          <p className="text-[16px] text-slate-600 mt-1">Manage system access and roles.</p>
        </div>
        {(isMaster || currentUser?.role === "client_admin") && (
          <Button 
            onClick={() => setLocation("/users/new")}
            className="px-6 py-2.5 bg-[#2563EB] hover:bg-[#2563EB]/90 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-[#2563EB]/20 transition-all flex items-center gap-2 active:scale-95 h-auto cursor-pointer"
          >
            <Plus className="h-5 w-5" />
            Add User
          </Button>
        )}
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 border-b border-[#E2E8F0] bg-[#faf8ff] flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <span className="text-[18px] font-semibold text-[#0F172A]">System Users</span>
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
                <TableHead className="text-slate-500 tracking-wider w-[20%] text-[11px] font-bold px-6 py-4 uppercase">USERNAME</TableHead>
                <TableHead className="text-slate-500 tracking-wider w-[12%] text-[11px] font-bold px-6 py-4 uppercase">STATUS</TableHead>
                <TableHead className="text-slate-500 tracking-wider w-[13%] text-[11px] font-bold px-6 py-4 uppercase">ROLE</TableHead>
                <TableHead className="text-slate-500 tracking-wider w-[25%] text-[11px] font-bold px-6 py-4 uppercase">CONTACT</TableHead>
                {isMaster && <TableHead className="text-slate-500 tracking-wider w-[20%] text-[11px] font-bold px-6 py-4 uppercase">COMPANY</TableHead>}
                <TableHead className="text-slate-500 tracking-wider w-[10%] text-[11px] font-bold px-6 py-4 uppercase text-right">ACTIONS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-[#E2E8F0]">
              {isLoading ? (
                <TableRow><TableCell colSpan={isMaster ? 6 : 5} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isMaster ? 6 : 5} className="text-center py-12 text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <UsersIcon className="h-8 w-8 opacity-50" />
                      <p>No users found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                users.map((userRow) => {
                  const canEdit = isMaster || 
                    (currentUser?.role === "admin" && userRow.companyId === currentUser.companyId && userRow.role !== "master" && userRow.role !== "super_master") ||
                    (currentUser?.role === "client_admin" && userRow.role === "operator" && userRow.companyId === currentUser.companyId);
                  return (
                    <TableRow key={userRow.id} className="hover:bg-slate-50 transition-colors group border-0">
                      <TableCell className="align-middle px-6 py-5">
                        <div className="flex flex-col">
                          <span className="text-[#0F172A] truncate font-bold text-[14px]">
                            {userRow.username}
                            {userRow.id === currentUser?.id && <Badge variant="outline" className="ml-2 text-[10px] font-bold bg-[#faf8ff] text-[#0F172A]">YOU</Badge>}
                          </span>
                          <span className="text-[11px] text-slate-500 opacity-70 font-semibold tracking-wide">UID: {userRow.id}</span>
                        </div>
                      </TableCell>
                      <TableCell className="align-middle px-6 py-5">
                        {userRow.isActive !== false ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-none shadow-none text-[11px] font-bold flex items-center gap-1 w-fit">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Active
                          </Badge>
                        ) : (
                          <Badge className="bg-red-500/10 text-red-600 hover:bg-red-500/20 border-none shadow-none text-[11px] font-bold flex items-center gap-1 w-fit">
                            <XCircle className="h-3.5 w-3.5 text-red-500" /> Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="align-middle px-6 py-5">
                        <Badge className="text-[11px] font-bold tracking-widest uppercase bg-[#E2E8F0] text-[#0F172A] hover:bg-[#cbd5e1] border-none shadow-none">
                          {userRow.role === "client_admin" ? "manager" : userRow.role.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="align-middle px-6 py-5 text-[14px]">
                        <span className="text-slate-600 block">{userRow.email || '—'}</span>
                        <span className="text-[12px] text-slate-500 mt-0.5 block font-semibold">{userRow.phone || '—'}</span>
                      </TableCell>
                      {isMaster && (
                        <TableCell className="align-middle px-6 py-5 text-[14px]">
                          <span className="text-[#0F172A] font-semibold">{(userRow as any).companyName || '—'}</span>
                        </TableCell>
                      )}
                      <TableCell className="align-middle px-6 py-5">
                        <div className="flex items-center justify-end gap-1">
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenEdit(userRow)}
                              className="h-8 w-8 text-slate-500 hover:text-[#2563EB] hover:bg-slate-100"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {canEdit && userRow.id !== currentUser?.id && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-slate-500 hover:text-red-500 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete User</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete {userRow.username}? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(userRow.id)} className="bg-red-500 text-white hover:bg-red-600">
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit User: {editingUser?.username}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-slate-800 dark:text-slate-200">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Email</label>
                <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} type="email" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Phone</label>
                <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">New Password (optional)</label>
                <Input value={editPassword} onChange={(e) => setEditPassword(e.target.value)} type="password" placeholder="Leave blank to keep same" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Role</label>
                <Select onValueChange={(val: any) => setEditRole(val)} value={editRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {currentUser?.role === "super_master" && <SelectItem value="super_master">Super Master</SelectItem>}
                    {isMaster && <SelectItem value="master">Master Admin</SelectItem>}
                    {(isMaster || currentUser?.role === "admin") && <SelectItem value="client_admin">Manager</SelectItem>}
                    {(isMaster || currentUser?.role === "admin") && <SelectItem value="admin">Admin</SelectItem>}
                    <SelectItem value="operator">Operator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isMaster && (editRole === "admin" || editRole === "client_admin" || editRole === "operator") && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Company Scope</label>
                <Select
                  value={editCompanyId ? editCompanyId.toString() : "none"}
                  onValueChange={(val) => setEditCompanyId(val === "none" ? null : Number(val))}
                >
                  <SelectTrigger><SelectValue placeholder="No Company (Global / Orphaned)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Company (Global / Orphaned)</SelectItem>
                    {companies.map((c: any) => (
                      <SelectItem key={c.id} value={c.id.toString()}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800 rounded-lg">
              <div className="space-y-0.5">
                <label className="text-sm font-semibold">Account Status</label>
                <p className="text-xs text-slate-500">Toggle whether this user can log in</p>
              </div>
              <Switch checked={editIsActive} onCheckedChange={setEditIsActive} />
            </div>

            {editRole !== "master" && (
              <div className="space-y-2 border-t pt-4">
                <label className="text-sm font-bold block mb-1">Enabled Modules</label>
                <p className="text-xs text-slate-500 mb-3">Select which modules this user is allowed to access.</p>
                <div className="grid grid-cols-2 gap-3 max-h-[180px] overflow-y-auto pr-1 border border-slate-100 dark:border-slate-800 rounded-lg p-3">
                  {AVAILABLE_MODULES.filter(m => isMaster || m.id !== "companies").map((mod) => {
                    const isChecked = editModules.includes(mod.id);
                    return (
                      <div key={mod.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`mod-${mod.id}`}
                          checked={isChecked}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setEditModules([...editModules, mod.id]);
                            } else {
                              setEditModules(editModules.filter((m) => m !== mod.id));
                            }
                          }}
                        />
                        <label
                          htmlFor={`mod-${mod.id}`}
                          className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50 cursor-pointer select-none"
                        >
                          {mod.label}
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={updateUser.isPending}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
