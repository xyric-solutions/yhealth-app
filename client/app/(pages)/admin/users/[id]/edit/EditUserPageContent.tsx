"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserForm } from "@/components/user/UserForm";
import { api, ApiError } from "@/lib/api-client";
import { useAuth } from "@/app/context/AuthContext";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { Skeleton } from "@/components/ui/skeleton";

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  role_id: string;
  is_active: boolean;
  is_email_verified: boolean;
  phone: string | null;
  date_of_birth: Date | null;
  gender: string | null;
}

export default function EditUserPageContent() {
  const params = useParams();
  const { user } = useAuth();
  const userId = params?.id as string;

  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userData, setUserData] = useState<User | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      if (!user || user.role !== "admin" || !userId) {
        return;
      }

      setIsFetching(true);
      try {
        const response = await api.get<User>(`/admin/users/${userId}`);

        if (response.success && response.data) {
          setUserData(response.data);
        } else {
          throw new Error("Failed to fetch user");
        }
      } catch (err: unknown) {
        if (err instanceof ApiError) {
          setError(err.message);
          toast.error(err.message);
        } else {
          setError("Failed to load user. Please try again.");
          toast.error("Failed to load user");
        }
      } finally {
        setIsFetching(false);
      }
    };

    fetchUser();
  }, [user, userId]);

  const handleSubmit = async (formData: { email: string; password?: string; first_name: string; last_name: string; role_id: string; is_active: boolean; is_email_verified: boolean; phone: string; date_of_birth: string; gender: string }) => {
    if (!user || user.role !== "admin" || !userId) {
      setError("Unauthorized");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        email: formData.email,
        first_name: formData.first_name,
        last_name: formData.last_name,
        role_id: formData.role_id,
        is_active: formData.is_active,
        is_email_verified: formData.is_email_verified,
        phone: formData.phone || null,
        date_of_birth: formData.date_of_birth || null,
        gender: formData.gender || null,
      };

      // Only include password if it's provided
      if (formData.password) {
        payload.password = formData.password;
      }

      const response = await api.put<User>(`/admin/users/${userId}`, payload);

      if (response.success && response.data) {
        toast.success("User updated successfully!");
        setUserData(response.data);
      } else {
        throw new Error("Failed to update user");
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
        toast.error(err.message);
      } else {
        const errorMessage = "Failed to update user. Please try again.";
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

  if (isFetching) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-10 w-48 bg-slate-800" />
            <Skeleton className="h-8 w-64 bg-slate-800" />
          </div>
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-2xl bg-slate-800" />
          ))}
        </div>
      </div>
    );
  }

  if (error && !userData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Button variant="ghost" asChild className="mb-4 text-slate-400 hover:text-white">
              <Link href="/admin/users">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Users
              </Link>
            </Button>
            <h1 className="text-3xl font-bold text-white">Edit User</h1>
          </div>
        </div>
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

  if (!userData) {
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
          <h1 className="text-3xl font-bold text-white">
            Edit User: {userData.first_name} {userData.last_name}
          </h1>
          <p className="text-slate-400 mt-2">
            Update user information and permissions
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
      <UserForm
        initialData={{
          email: userData.email,
          first_name: userData.first_name,
          last_name: userData.last_name,
          role_id: userData.role_id,
          is_active: userData.is_active,
          is_email_verified: userData.is_email_verified,
          phone: userData.phone || "",
          date_of_birth: userData.date_of_birth
            ? new Date(userData.date_of_birth).toISOString().split("T")[0]
            : "",
          gender: (userData.gender as "male" | "female" | "other" | "") || "",
        }}
        onSubmit={handleSubmit}
        isLoading={isLoading}
        mode="edit"
      />
    </div>
  );
}
