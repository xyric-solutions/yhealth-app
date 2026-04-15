"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserForm } from "@/components/user/UserForm";
import { api, ApiError } from "@/lib/api-client";
import { useAuth } from "@/app/context/AuthContext";
import Link from "next/link";
import { toast } from "react-hot-toast";

export default function CreateUserPageContent() {
  const router = useRouter();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (formData: { email: string; password?: string; first_name: string; last_name: string; role_id: string; is_active: boolean; is_email_verified: boolean; phone: string; date_of_birth: string; gender: string }) => {
    if (!user || user.role !== "admin") {
      setError("Unauthorized");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        email: formData.email,
        password: formData.password,
        first_name: formData.first_name,
        last_name: formData.last_name,
        role_id: formData.role_id,
        is_active: formData.is_active,
        is_email_verified: formData.is_email_verified,
        phone: formData.phone || null,
        date_of_birth: formData.date_of_birth || null,
        gender: formData.gender || null,
      };

      const response = await api.post<{ id: string }>("/admin/users", payload);

      if (response.success && response.data) {
        toast.success("User created successfully!");
        router.push(`/admin/users/${response.data.id}/edit`);
      } else {
        throw new Error("Failed to create user");
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
        toast.error(err.message);
      } else {
        const errorMessage = "Failed to create user. Please try again.";
        setError(errorMessage);
        toast.error(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (user?.role !== "admin") {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" asChild className="mb-4 text-slate-400 hover:text-white">
            <Link href="/admin/users">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Users
            </Link>
          </Button>
          <h1 className="text-3xl font-bold text-white">Create New User</h1>
          <p className="text-slate-400 mt-2">
            Fill out the form below to create a new user account
          </p>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400"
        >
          {error}
        </motion.div>
      )}

      {/* Form */}
      <UserForm onSubmit={handleSubmit} isLoading={isLoading} mode="create" />
    </div>
  );
}
