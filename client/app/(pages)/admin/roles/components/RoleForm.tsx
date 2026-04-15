"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Loader2, Save, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "react-hot-toast";
import {
  PermissionMatrix,
  type Permission,
  type PermissionGroup,
} from "./PermissionMatrix";

interface RoleFormData {
  name: string;
  slug: string;
  description: string;
}

interface RoleFormProps {
  initialData?: Partial<RoleFormData> & { id?: string };
  onSubmit: (data: RoleFormData, permissionIds: string[]) => Promise<void>;
  isLoading?: boolean;
  mode?: "create" | "edit";
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export function RoleForm({
  initialData,
  onSubmit,
  isLoading = false,
  mode = "create",
}: RoleFormProps) {
  const [formData, setFormData] = useState<RoleFormData>({
    name: initialData?.name || "",
    slug: initialData?.slug || "",
    description: initialData?.description || "",
  });
  const [permissionGroups, setPermissionGroups] = useState<PermissionGroup[]>([]);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<Set<string>>(new Set());
  const [loadingPermissions, setLoadingPermissions] = useState(true);
  const [errors, setErrors] = useState<Partial<Record<keyof RoleFormData, string>>>({});


  useEffect(() => {
    if (formData.name && mode === "create") {
      setFormData((prev) => ({ ...prev, slug: slugify(formData.name) }));
    }
  }, [formData.name, mode]);

  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        setLoadingPermissions(true);
        const res = await api.get<PermissionGroup[]>("/admin/roles/permissions");
        if (res.success && res.data) {
          setPermissionGroups(Array.isArray(res.data) ? res.data : []);
        }
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Failed to load permissions");
      } finally {
        setLoadingPermissions(false);
      }
    };
    fetchPermissions();
  }, []);

  useEffect(() => {
    if (mode === "edit" && initialData?.id) {
      const fetchRolePermissions = async () => {
        try {
          const res = await api.get<Permission[]>(`/admin/roles/${initialData.id}/permissions`);
          if (res.success && res.data && Array.isArray(res.data)) {
            setSelectedPermissionIds(new Set(res.data.map((p) => p.id)));
          }
        } catch {
          // Role may have no permissions
        }
      };
      fetchRolePermissions();
    }
  }, [mode, initialData?.id]);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof RoleFormData, string>> = {};
    if (!formData.name?.trim()) newErrors.name = "Name is required";
    if (!formData.slug?.trim()) newErrors.slug = "Slug is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    await onSubmit(formData, Array.from(selectedPermissionIds));
  };

  const togglePermission = (id: string) => {
    setSelectedPermissionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleResource = (resource: string, checked: boolean) => {
    const group = permissionGroups.find((g) => g.resource === resource);
    if (!group) return;

    setSelectedPermissionIds((prev) => {
      const next = new Set(prev);
      group.permissions.forEach((p) => {
        if (checked) next.add(p.id);
        else next.delete(p.id);
      });
      return next;
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-slate-900/40 border border-slate-800/60 p-6 space-y-4"
      >
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Shield className="w-5 h-5 text-violet-400" />
          Role Details
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-slate-300">
              Name
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Content Manager"
              disabled={false}
              className="bg-slate-800/60 border-slate-700/50 text-white"
            />
            {errors.name && <p className="text-xs text-red-400">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug" className="text-slate-300">
              Slug
            </Label>
            <Input
              id="slug"
              value={formData.slug}
              onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
              placeholder="e.g. content-manager"
              disabled={false}
              className="bg-slate-800/60 border-slate-700/50 text-white font-mono"
            />
            {errors.slug && <p className="text-xs text-red-400">{errors.slug}</p>}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description" className="text-slate-300">
            Description
          </Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Brief description of this role..."
            disabled={false}
            rows={3}
            className="bg-slate-800/60 border-slate-700/50 text-white resize-none"
          />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl bg-slate-900/40 border border-slate-800/60 p-6 space-y-4"
      >
        <h3 className="text-lg font-semibold text-white">Page Permissions</h3>
        <p className="text-sm text-slate-400">
          Select which pages and actions this role can access.
        </p>

        {loadingPermissions ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
          </div>
        ) : (
          <PermissionMatrix
            groups={permissionGroups}
            selectedIds={selectedPermissionIds}
            onToggle={togglePermission}
            onToggleResource={toggleResource}
            disabled={false}
          />
        )}
      </motion.div>

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          disabled={isLoading}
          className="bg-gradient-to-r from-emerald-500 to-sky-500 hover:from-emerald-600 hover:to-sky-600 text-white shadow-lg shadow-emerald-500/20"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {mode === "create" ? "Create Role" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
