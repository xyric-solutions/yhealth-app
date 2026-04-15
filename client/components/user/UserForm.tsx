"use client";

import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import {
  User,
  Mail,
  Lock,
  Phone,
  Calendar,
  Shield,
  CheckCircle2,
  XCircle,
  Loader2,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "react-hot-toast";
import { api, ApiError } from "@/lib/api-client";

interface Role {
  id: string;
  name: string;
  slug: string;
}

interface UserFormData {
  email: string;
  password?: string;
  first_name: string;
  last_name: string;
  role_id: string;
  is_active: boolean;
  is_email_verified: boolean;
  phone: string;
  date_of_birth: string;
  gender: "male" | "female" | "other" | "";
}

interface UserFormProps {
  initialData?: Partial<UserFormData>;
  onSubmit: (data: UserFormData) => Promise<void>;
  isLoading?: boolean;
  mode?: "create" | "edit";
}

const DEFAULT_ROLE_ID = "11111111-1111-1111-1111-111111111101";

export function UserForm({
  initialData,
  onSubmit,
  isLoading = false,
  mode = "create",
}: UserFormProps) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const res = await api.get<Role[]>("/admin/roles", { params: { limit: "100" } });
        if (res.success && res.data && Array.isArray(res.data)) {
          setRoles(res.data);
        }
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Failed to load roles");
      } finally {
        setLoadingRoles(false);
      }
    };
    fetchRoles();
  }, []);

  // Compute initial form data from initialData using useMemo
  const initialFormData = useMemo<UserFormData>(() => ({
    email: initialData?.email || "",
    password: "",
    first_name: initialData?.first_name || "",
    last_name: initialData?.last_name || "",
    role_id: initialData?.role_id || DEFAULT_ROLE_ID,
    is_active: initialData?.is_active ?? true,
    is_email_verified: initialData?.is_email_verified ?? false,
    phone: initialData?.phone || "",
    date_of_birth: initialData?.date_of_birth || "",
    gender: (initialData?.gender as "male" | "female" | "other" | "") || "",
  }), [
    initialData?.email,
    initialData?.first_name,
    initialData?.last_name,
    initialData?.role_id,
    initialData?.is_active,
    initialData?.is_email_verified,
    initialData?.phone,
    initialData?.date_of_birth,
    initialData?.gender,
  ]);

  const resetKey = useMemo(() => {
    return `${mode}-${initialData?.email || "new"}-${initialData?.first_name || ""}-${initialData?.last_name || ""}-${initialData?.role_id || ""}`;
  }, [mode, initialData?.email, initialData?.first_name, initialData?.last_name, initialData?.role_id]);

  // Use lazy initializer with resetKey to reset form when key changes
  const [formData, setFormData] = useState<UserFormData>(() => initialFormData);
  const [errors, setErrors] = useState<Partial<Record<keyof UserFormData, string>>>({});
  const [touched, setTouched] = useState<Set<keyof UserFormData>>(new Set());
  const [lastResetKey, setLastResetKey] = useState(resetKey);

  // Reset form when resetKey changes - using a pattern that React can batch
  if (lastResetKey !== resetKey) {
    setLastResetKey(resetKey);
    setFormData(initialFormData);
    setErrors({});
    setTouched(new Set());
  }

  const validateField = (name: keyof UserFormData, value: string | boolean | undefined): string | null => {
    switch (name) {
      case "email":
        if (!value || typeof value !== "string") return "Email is required";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Invalid email address";
        return null;
      case "password":
        if (mode === "create" && (!value || typeof value !== "string")) return "Password is required";
        if (typeof value === "string" && value.length < 8) return "Password must be at least 8 characters";
        return null;
      case "first_name":
        if (!value || typeof value !== "string") return "First name is required";
        if (value.length > 100) return "First name must be less than 100 characters";
        return null;
      case "last_name":
        if (!value || typeof value !== "string") return "Last name is required";
        if (value.length > 100) return "Last name must be less than 100 characters";
        return null;
      case "phone":
        if (typeof value === "string" && value.length > 20) return "Phone number must be less than 20 characters";
        return null;
      default:
        return null;
    }
  };

  const handleChange = (name: keyof UserFormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    setTouched((prev) => new Set(prev).add(name));

    const error = validateField(name, value);
    setErrors((prev) => ({ ...prev, [name]: error || undefined }));
  };

  const handleBlur = (name: keyof UserFormData) => {
    setTouched((prev) => new Set(prev).add(name));
    const error = validateField(name, formData[name]);
    setErrors((prev) => ({ ...prev, [name]: error || undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields
    const newErrors: Partial<Record<keyof UserFormData, string>> = {};
    Object.keys(formData).forEach((key) => {
      const error = validateField(key as keyof UserFormData, formData[key as keyof UserFormData]);
      if (error) {
        newErrors[key as keyof UserFormData] = error;
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error("Please fix the errors in the form");
      return;
    }

    // Remove password if empty in edit mode
    const submitData = { ...formData };
    if (mode === "edit" && !submitData.password) {
      delete submitData.password;
    }

    await onSubmit(submitData);
  };

  const getFieldError = (name: keyof UserFormData) => {
    return touched.has(name) ? errors[name] : undefined;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-slate-900/40 border border-slate-800/60 backdrop-blur-sm p-6 space-y-6"
      >
        {/* Basic Information */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-emerald-400" />
            <h2 className="text-xl font-semibold text-white">Basic Information</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* First Name */}
            <div className="space-y-2">
              <Label htmlFor="first_name" className="text-slate-300">
                First Name <span className="text-red-400">*</span>
              </Label>
              <Input
                id="first_name"
                value={formData.first_name}
                onChange={(e) => handleChange("first_name", e.target.value)}
                onBlur={() => handleBlur("first_name")}
                placeholder="John"
                className={cn(
                  "bg-slate-800/60 border-slate-700/50 text-white placeholder:text-slate-500",
                  getFieldError("first_name") && "border-red-500/50"
                )}
              />
              {getFieldError("first_name") && (
                <p className="text-xs text-red-400">{getFieldError("first_name")}</p>
              )}
            </div>

            {/* Last Name */}
            <div className="space-y-2">
              <Label htmlFor="last_name" className="text-slate-300">
                Last Name <span className="text-red-400">*</span>
              </Label>
              <Input
                id="last_name"
                value={formData.last_name}
                onChange={(e) => handleChange("last_name", e.target.value)}
                onBlur={() => handleBlur("last_name")}
                placeholder="Doe"
                className={cn(
                  "bg-slate-800/60 border-slate-700/50 text-white placeholder:text-slate-500",
                  getFieldError("last_name") && "border-red-500/50"
                )}
              />
              {getFieldError("last_name") && (
                <p className="text-xs text-red-400">{getFieldError("last_name")}</p>
              )}
            </div>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-300">
              Email <span className="text-red-400">*</span>
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                onBlur={() => handleBlur("email")}
                placeholder="john.doe@example.com"
                className={cn(
                  "bg-slate-800/60 border-slate-700/50 text-white placeholder:text-slate-500 pl-10",
                  getFieldError("email") && "border-red-500/50"
                )}
              />
            </div>
            {getFieldError("email") && (
              <p className="text-xs text-red-400">{getFieldError("email")}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-slate-300">
              Password {mode === "create" && <span className="text-red-400">*</span>}
              {mode === "edit" && <span className="text-slate-500 text-xs ml-2">(leave blank to keep current)</span>}
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => handleChange("password", e.target.value)}
                onBlur={() => handleBlur("password")}
                placeholder={mode === "create" ? "Enter password" : "Enter new password (optional)"}
                className={cn(
                  "bg-slate-800/60 border-slate-700/50 text-white placeholder:text-slate-500 pl-10",
                  getFieldError("password") && "border-red-500/50"
                )}
              />
            </div>
            {getFieldError("password") && (
              <p className="text-xs text-red-400">{getFieldError("password")}</p>
            )}
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl bg-slate-900/40 border border-slate-800/60 backdrop-blur-sm p-6 space-y-6"
      >
        {/* Contact & Personal Information */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Phone className="w-5 h-5 text-emerald-400" />
            <h2 className="text-xl font-semibold text-white">Contact & Personal Information</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-slate-300">
                Phone Number
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  onBlur={() => handleBlur("phone")}
                  placeholder="+1 234 567 8900"
                  className={cn(
                    "bg-slate-800/60 border-slate-700/50 text-white placeholder:text-slate-500 pl-10",
                    getFieldError("phone") && "border-red-500/50"
                  )}
                />
              </div>
              {getFieldError("phone") && (
                <p className="text-xs text-red-400">{getFieldError("phone")}</p>
              )}
            </div>

            {/* Date of Birth */}
            <div className="space-y-2">
              <Label htmlFor="date_of_birth" className="text-slate-300">
                Date of Birth
              </Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  id="date_of_birth"
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => handleChange("date_of_birth", e.target.value)}
                  className="bg-slate-800/60 border-slate-700/50 text-white placeholder:text-slate-500 pl-10"
                />
              </div>
            </div>
          </div>

          {/* Gender */}
          <div className="space-y-2">
            <Label htmlFor="gender" className="text-slate-300">
              Gender
            </Label>
            <Select
              value={formData.gender || "not_specified"}
              onValueChange={(value) => handleChange("gender", value === "not_specified" ? "" : value)}
            >
              <SelectTrigger className="bg-slate-800/60 border-slate-700/50 text-white w-full">
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800">
                <SelectItem value="not_specified">Not specified</SelectItem>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl bg-slate-900/40 border border-slate-800/60 backdrop-blur-sm p-6 space-y-6"
      >
        {/* Role & Permissions */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-emerald-400" />
            <h2 className="text-xl font-semibold text-white">Role & Permissions</h2>
          </div>

          {/* Role */}
          <div className="space-y-2">
            <Label htmlFor="role" className="text-slate-300">
              Role <span className="text-red-400">*</span>
            </Label>
            <Select
              value={formData.role_id}
              onValueChange={(value) => handleChange("role_id", value)}
              disabled={loadingRoles}
            >
              <SelectTrigger className="bg-slate-800/60 border-slate-700/50 text-white w-full">
                <SelectValue placeholder={loadingRoles ? "Loading roles..." : "Select role"} />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 w-full">
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status Toggles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
            {/* Active Status */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
              <div className="space-y-1">
                <Label htmlFor="is_active" className="text-slate-300 cursor-pointer">
                  Account Status
                </Label>
                <p className="text-xs text-slate-500">
                  {formData.is_active ? "User can access the system" : "User account is disabled"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {formData.is_active ? (
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Active
                  </Badge>
                ) : (
                  <Badge className="bg-red-500/10 text-red-400 border-red-500/20">
                    <XCircle className="w-3 h-3 mr-1" />
                    Inactive
                  </Badge>
                )}
                <Checkbox
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => handleChange("is_active", checked === true)}
                  className="border-slate-600 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                />
              </div>
            </div>

            {/* Email Verified */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
              <div className="space-y-1">
                <Label htmlFor="is_email_verified" className="text-slate-300 cursor-pointer">
                  Email Verified
                </Label>
                <p className="text-xs text-slate-500">
                  {formData.is_email_verified
                    ? "Email address is verified"
                    : "Email address is not verified"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {formData.is_email_verified ? (
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Verified
                  </Badge>
                ) : (
                  <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">
                    <XCircle className="w-3 h-3 mr-1" />
                    Unverified
                  </Badge>
                )}
                <Checkbox
                  id="is_email_verified"
                  checked={formData.is_email_verified}
                  onCheckedChange={(checked) => handleChange("is_email_verified", checked === true)}
                  className="border-slate-600 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                />
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Submit Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex items-center justify-end gap-4 pt-4"
      >
        <Button
          type="submit"
          disabled={isLoading}
          className="bg-linear-to-r from-emerald-500 to-sky-500 hover:from-emerald-600 hover:to-sky-600 text-white shadow-lg shadow-emerald-500/20 min-w-32"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {mode === "create" ? "Creating..." : "Updating..."}
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              {mode === "create" ? "Create User" : "Update User"}
            </>
          )}
        </Button>
      </motion.div>
    </form>
  );
}
