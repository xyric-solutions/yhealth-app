"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoleForm } from "../components/RoleForm";
import { api, ApiError } from "@/lib/api-client";
import { useAuth } from "@/app/context/AuthContext";
import Link from "next/link";
import { toast } from "react-hot-toast";

export default function CreateRolePageContent() {
  const router = useRouter();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  if (user?.role !== "admin") {
    return null;
  }

  const handleSubmit = async (
    data: { name: string; slug: string; description: string },
    permissionIds: string[]
  ) => {
    setIsLoading(true);
    try {
      const createRes = await api.post("/admin/roles", {
        name: data.name,
        slug: data.slug || data.name.toLowerCase().replace(/\s+/g, "-"),
        description: data.description || null,
      });

      if (!createRes.success || !createRes.data) {
        throw new Error("Failed to create role");
      }

      const roleId = (createRes.data as { id: string }).id;

      if (permissionIds.length > 0) {
        await api.put(`/admin/roles/${roleId}/permissions`, {
          permission_ids: permissionIds,
        });
      }

      toast.success("Role created successfully!");
      router.push("/admin/roles");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create role");
    } finally {
      setIsLoading(false);
    }
  };

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
          <h1 className="text-3xl font-bold text-white">Create Role</h1>
          <p className="text-slate-400 mt-2">
            Create a new role and assign permissions
          </p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <RoleForm onSubmit={handleSubmit} isLoading={isLoading} mode="create" />
      </motion.div>
    </div>
  );
}
