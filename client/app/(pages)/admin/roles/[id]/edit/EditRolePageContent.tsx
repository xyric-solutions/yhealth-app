"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoleForm } from "../../components/RoleForm";
import { api, ApiError } from "@/lib/api-client";
import { useAuth } from "@/app/context/AuthContext";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { Skeleton } from "@/components/ui/skeleton";

interface Role {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_system: boolean;
  user_count: number;
}

export default function EditRolePageContent() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const roleId = params?.id as string;

  const [role, setRole] = useState<Role | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRole = async () => {
      if (!user || user.role !== "admin" || !roleId) return;

      setIsFetching(true);
      try {
        const res = await api.get<Role>(`/admin/roles/${roleId}`);
        if (res.success && res.data) {
          setRole(res.data);
        } else {
          throw new Error("Failed to fetch role");
        }
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to load role");
        toast.error(err instanceof ApiError ? err.message : "Failed to load role");
      } finally {
        setIsFetching(false);
      }
    };

    fetchRole();
  }, [user, roleId]);

  const handleSubmit = async (
    data: { name: string; slug: string; description: string },
    permissionIds: string[]
  ) => {
    if (!user || user.role !== "admin" || !roleId) return;

    setIsLoading(true);
    try {
      await api.put(`/admin/roles/${roleId}`, {
        name: data.name,
        slug: data.slug,
        description: data.description || null,
      });

      await api.put(`/admin/roles/${roleId}/permissions`, {
        permission_ids: permissionIds,
      });

      toast.success("Role updated successfully!");
      router.push("/admin/roles");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update role");
    } finally {
      setIsLoading(false);
    }
  };

  if (user?.role !== "admin") return null;

  if (isFetching) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-10 w-48 bg-slate-800" />
          <Skeleton className="h-8 w-64 bg-slate-800" />
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-2xl bg-slate-800" />
          ))}
        </div>
      </div>
    );
  }

  if (error && !role) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" asChild className="mb-4 text-slate-400 hover:text-white">
          <Link href="/admin/roles">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Roles
          </Link>
        </Button>
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400"
        >
          {error}
        </motion.div>
      </div>
    );
  }

  if (!role) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" asChild className="mb-4 text-slate-400 hover:text-white">
            <Link href="/admin/roles">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Roles
            </Link>
          </Button>
          <h1 className="text-3xl font-bold text-white">
            Edit Role: {role.name}
          </h1>
          <p className="text-slate-400 mt-2">
            Update role details and permissions
          </p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <RoleForm
          initialData={{
            id: role.id,
            name: role.name,
            slug: role.slug,
            description: role.description || "",
          }}
          onSubmit={handleSubmit}
          isLoading={isLoading}
          mode="edit"
        />
      </motion.div>
    </div>
  );
}
