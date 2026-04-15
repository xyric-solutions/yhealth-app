"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import PhoneInput, { isValidPhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { format, isValid } from "date-fns";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Save,
  Loader2,
  CheckCircle,
  Sparkles,
  Shield,

  Pencil,
  X,
  Check,
  Calendar,
  Heart,
  Users,
  CalendarDays,
  UserCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { AvatarUploader } from "@/components/common/avatar-uploader";
import { useAuth } from "@/app/context/AuthContext";
import { api, ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { MainLayout } from "@/components/layout";

// Gender options with icons
const GENDER_OPTIONS = [
  { value: "male", label: "Male", icon: "♂️" },
  { value: "female", label: "Female", icon: "♀️" },
  { value: "non_binary", label: "Non-Binary", icon: "⚧️" },
  { value: "prefer_not_to_say", label: "Prefer not to say", icon: "🔒" },
];

// Form validation schema with phone validation
const profileFormSchema = z.object({
  firstName: z
    .string()
    .min(2, "First name must be at least 2 characters")
    .max(50, "First name must be less than 50 characters"),
  lastName: z
    .string()
    .min(2, "Last name must be at least 2 characters")
    .max(50, "Last name must be less than 50 characters"),
  phone: z
    .string()
    .optional()
    .refine(
      (val) => !val || isValidPhoneNumber(val),
      "Please enter a valid phone number"
    ),
  dateOfBirth: z.date().optional().nullable(),
  gender: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

function EditProfileSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="flex items-center gap-4 mb-8">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>
        <Skeleton className="h-[800px] w-full rounded-3xl" />
      </div>
    </div>
  );
}

// Hydration-safe hook
const emptySubscribe = () => () => {};
function useHydrated() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

// Custom Phone Input Component with styling
function StyledPhoneInput({
  value,
  onChange,
  error,
}: {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  error?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative flex items-center rounded-xl transition-all duration-200",
        "bg-muted/50 hover:bg-muted/70 focus-within:bg-muted/70",
        "ring-2 ring-transparent focus-within:ring-primary/50",
        error && "ring-destructive/50"
      )}
    >
      <PhoneInput
        international
        countryCallingCodeEditable={false}
        defaultCountry="US"
        value={value}
        onChange={onChange}
        className="flex-1 phone-input-custom text-white "
      />
    </div>
  );
}

// Animated Section Header
function SectionHeader({
  icon: Icon,
  iconColor,
  iconBg,
  title,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <motion.div
        whileHover={{ scale: 1.1, rotate: 5 }}
        className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center",
          iconBg
        )}
      >
        <Icon className={cn("w-6 h-6", iconColor)} />
      </motion.div>
      <div>
        <h3 className="font-semibold text-lg">{title}</h3>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

export default function EditProfilePageContent() {
  const router = useRouter();
  const { user, isLoading, getInitials, updateUser } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const isHydrated = useHydrated();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
      dateOfBirth: null,
      gender: "",
    },
  });

  // Update form when user data is available - prefill all fields
  useEffect(() => {
    if (user) {
      let dateOfBirth: Date | null = null;
      if (user.dateOfBirth) {
        const parsedDate = new Date(user.dateOfBirth);
        if (isValid(parsedDate)) {
          dateOfBirth = parsedDate;
        }
      }

      form.reset({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        phone: user.phone || "",
        dateOfBirth: dateOfBirth,
        gender: user.gender || "",
      });
    }
  }, [user, form]);

  const handleAvatarUpload = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("avatar", file);

    try {
      const response = await api.upload<{ publicUrl?: string; url?: string }>(
        "/upload/avatar",
        formData
      );

      const avatarUrl = response.data?.publicUrl || response.data?.url;

      if (avatarUrl) {
        await api.patch("/auth/profile", { avatar: avatarUrl });
        updateUser({ avatarUrl });
        toast.success("Avatar updated successfully");
      }

      return avatarUrl || "";
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Failed to upload avatar";
      toast.error(message);
      throw new Error(message);
    }
  };

  const handleAvatarRemove = async (): Promise<void> => {
    try {
      await api.patch("/auth/profile", { avatar: null });
      updateUser({ avatarUrl: null });
      toast.success("Avatar removed");
    } catch {
      toast.error("Failed to remove avatar");
      throw new Error("Failed to remove avatar");
    }
  };

  const onSubmit = async (data: ProfileFormValues) => {
    setIsSubmitting(true);

    try {
      const updateData: Record<string, string | Date | undefined | null> = {
        firstName: data.firstName,
        lastName: data.lastName,
      };

      if (data.phone) {
        updateData.phone = data.phone;
      }
      if (data.dateOfBirth) {
        updateData.dateOfBirth = data.dateOfBirth;
      }
      if (data.gender) {
        updateData.gender = data.gender;
      }

      await api.patch("/auth/profile", updateData);

      updateUser({
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone || null,
        dateOfBirth: data.dateOfBirth?.toISOString() || null,
        gender: data.gender || null,
      });

      toast.success("Profile updated successfully");
      router.push("/profile");
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error("Failed to update profile");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isHydrated || isLoading) {
    return <EditProfileSkeleton />;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-muted/50 flex items-center justify-center">
            <User className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">
            Please sign in to edit your profile.
          </p>
          <Button asChild>
            <Link href="/auth/signin">Sign In</Link>
          </Button>
        </div>
      </div>
    );
  }

  const completionItems = [
    { label: "Profile Photo", done: !!user.avatarUrl },
    { label: "Full Name", done: !!(user.firstName && user.lastName) },
    { label: "Date of Birth", done: !!user.dateOfBirth },
    { label: "Gender", done: !!user.gender },
    { label: "Email Verified", done: user.isEmailVerified },
  ];
  const completionPercentage = Math.round(
    (completionItems.filter((i) => i.done).length / completionItems.length) *
      100
  );

  return (
    <MainLayout>
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      {/* Decorative Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{
            y: [0, -8, 0],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-primary/10 to-purple-500/10 rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            y: [0, -8, 0],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0.5,
          }}
          className="absolute top-1/3 -left-40 w-80 h-80 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            y: [0, -8, 0],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1,
          }}
          className="absolute -bottom-40 right-1/4 w-96 h-96 bg-gradient-to-br from-pink-500/10 to-rose-500/10 rounded-full blur-3xl"
        />
      </div>

      <div className="relative container mx-auto px-4 py-8 max-w-3xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              asChild
              className="rounded-full hover:bg-primary/10 hover:text-primary transition-all duration-300 hover:scale-110"
            >
              <Link href="/profile">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text">
                Edit Profile
              </h1>
              <p className="text-sm text-muted-foreground">
                Customize your personal information
              </p>
            </div>
          </div>

          {/* Profile Completion Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            whileHover={{ scale: 1.05 }}
            className="hidden md:flex items-center gap-3 px-4 py-2 rounded-2xl bg-gradient-to-r from-primary/10 to-purple-500/10 border border-primary/20 backdrop-blur-sm"
          >
            <div className="relative w-10 h-10">
              <svg className="w-10 h-10 -rotate-90">
                <circle
                  cx="20"
                  cy="20"
                  r="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="text-muted/30"
                />
                <motion.circle
                  cx="20"
                  cy="20"
                  r="16"
                  fill="none"
                  stroke="url(#progressGradient)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  initial={{ strokeDasharray: "0 100.53" }}
                  animate={{
                    strokeDasharray: `${
                      (completionPercentage / 100) * 100.53
                    } 100.53`,
                  }}
                  transition={{ duration: 1, delay: 0.5 }}
                />
                <defs>
                  <linearGradient
                    id="progressGradient"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="0%"
                  >
                    <stop offset="0%" stopColor="hsl(var(--primary))" />
                    <stop offset="100%" stopColor="#a855f7" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                {completionPercentage}%
              </span>
            </div>
            <div className="text-xs">
              <p className="font-semibold text-primary">Profile</p>
              <p className="text-muted-foreground">Complete</p>
            </div>
          </motion.div>
        </motion.div>

        {/* Main Content */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-6"
        >
          {/* Avatar Section */}
          <motion.div variants={itemVariants}>
            <Card className="border-0 bg-card/60 backdrop-blur-xl pt-0 shadow-2xl shadow-primary/5 overflow-hidden">
              {/* Gradient Header with Pattern */}
              <div className="relative h-40 md:h-48">
                <div className="absolute inset-0 bg-gradient-to-br from-primary via-purple-500 to-pink-500" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.1),transparent_50%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(255,255,255,0.08),transparent_50%)]" />

                {/* Animated Shapes */}
                <motion.div
                  animate={{
                    y: [0, -15, 0],
                    rotate: [0, 10, 0],
                  }}
                  transition={{
                    duration: 5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="absolute top-4 right-8 w-24 h-24 rounded-3xl bg-white/10 backdrop-blur-sm border border-white/20"
                />
                <motion.div
                  animate={{
                    y: [0, 15, 0],
                    rotate: [0, -10, 0],
                  }}
                  transition={{
                    duration: 6,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="absolute bottom-8 right-28 w-16 h-16 rounded-full bg-white/10 backdrop-blur-sm border border-white/20"
                />
                <motion.div
                  animate={{
                    scale: [1, 1.2, 1],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="absolute top-12 right-48 w-8 h-8 rounded-full bg-white/20"
                />

                {/* Avatar */}
                <div className="absolute -bottom-16 left-8 md:left-12">
                  <div className="relative">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", delay: 0.3 }}
                    >
                      <AvatarUploader
                        currentAvatar={user.avatarUrl}
                        fallback={getInitials()}
                        onUpload={handleAvatarUpload}
                        onRemove={handleAvatarRemove}
                        size="xl"
                      />
                    </motion.div>
                   
                  </div>
                </div>
              </div>

              {/* User Info Preview */}
              <CardContent className="pt-20 pb-6 px-8">
                <div className="flex items-start justify-between">
                  <div>
                    <motion.h2
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 }}
                      className="text-xl font-bold"
                    >
                      {user.firstName} {user.lastName}
                    </motion.h2>
                    <motion.p
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 }}
                      className="text-sm text-muted-foreground flex items-center gap-2 mt-1"
                    >
                      {user.email}
                      {user.isEmailVerified && (
                        <Badge
                          variant="secondary"
                          className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px] px-1.5 py-0"
                        >
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Verified
                        </Badge>
                      )}
                    </motion.p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Form Section */}
          <motion.div variants={itemVariants}>
            <Card className="border-0 bg-card/60 backdrop-blur-xl shadow-2xl shadow-primary/5">
              <CardContent className="p-6 md:p-8">
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-10"
                  >
                    {/* Personal Information Section */}
                    <div className="space-y-6">
                      <SectionHeader
                        icon={UserCircle}
                        iconColor="text-primary"
                        iconBg="bg-gradient-to-br from-primary/20 to-purple-500/20"
                        title="Personal Information"
                        subtitle="Your basic profile details"
                      />

                      <div className="grid gap-6 md:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="firstName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium flex items-center gap-2">
                                First Name
                                <span className="text-destructive">*</span>
                              </FormLabel>
                              <FormControl>
                                <div className="relative group">
                                  <Input
                                    placeholder="Enter your first name"
                                    className={cn(
                                      "h-12 pl-4 pr-10 rounded-xl border-0 bg-muted/50",
                                      "transition-all duration-300",
                                      "hover:bg-muted/70 focus:bg-muted/70",
                                      "focus-visible:ring-2 focus-visible:ring-primary/50",
                                      "group-hover:shadow-md",
                                      activeField === "firstName" &&
                                        "ring-2 ring-primary/50 shadow-lg shadow-primary/10"
                                    )}
                                    {...field}
                                    onFocus={() => setActiveField("firstName")}
                                    onBlur={(_e) => {
                                      field.onBlur();
                                      setActiveField(null);
                                    }}
                                  />
                                  <Pencil className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="lastName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium flex items-center gap-2">
                                Last Name
                                <span className="text-destructive">*</span>
                              </FormLabel>
                              <FormControl>
                                <div className="relative group">
                                  <Input
                                    placeholder="Enter your last name"
                                    className={cn(
                                      "h-12 pl-4 pr-10 rounded-xl border-0 bg-muted/50",
                                      "transition-all duration-300",
                                      "hover:bg-muted/70 focus:bg-muted/70",
                                      "focus-visible:ring-2 focus-visible:ring-primary/50",
                                      "group-hover:shadow-md",
                                      activeField === "lastName" &&
                                        "ring-2 ring-primary/50 shadow-lg shadow-primary/10"
                                    )}
                                    {...field}
                                    onFocus={() => setActiveField("lastName")}
                                    onBlur={(_e) => {
                                      field.onBlur();
                                      setActiveField(null);
                                    }}
                                  />
                                  <Pencil className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {/* Demographics Section */}
                    <div className="space-y-6">
                      <SectionHeader
                        icon={Heart}
                        iconColor="text-rose-500"
                        iconBg="bg-gradient-to-br from-rose-500/20 to-pink-500/20"
                        title="Demographics"
                        subtitle="Help us personalize your health journey"
                      />

                      <div className="grid gap-6 md:grid-cols-2">
                        {/* Date of Birth */}
                        <FormField
                          control={form.control}
                          name="dateOfBirth"
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel className="text-sm font-medium flex items-center gap-2">
                                <CalendarDays className="w-4 h-4 text-rose-500" />
                                Date of Birth
                              </FormLabel>
                              <Popover
                                open={calendarOpen}
                                onOpenChange={setCalendarOpen}
                              >
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant="outline"
                                      className={cn(
                                        "h-12 w-full justify-start text-left font-normal rounded-xl border-0 bg-muted/50",
                                        "hover:bg-muted/70 focus:bg-muted/70",
                                        "transition-all duration-300",
                                        "focus-visible:ring-2 focus-visible:ring-primary/50",
                                        !field.value && "text-muted-foreground"
                                      )}
                                    >
                                      <Calendar className="mr-3 h-4 w-4 text-rose-500" />
                                      {field.value ? (
                                        format(field.value, "MMMM d, yyyy")
                                      ) : (
                                        <span>Select your birth date</span>
                                      )}
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent
                                  className="w-auto p-0 rounded-xl"
                                  align="start"
                                >
                                  <CalendarComponent
                                    mode="single"
                                    selected={field.value || undefined}
                                    onSelect={(date) => {
                                      field.onChange(date);
                                      setCalendarOpen(false);
                                    }}
                                    disabled={(date) =>
                                      date > new Date() ||
                                      date < new Date("1900-01-01")
                                    }
                                    initialFocus
                                    captionLayout="dropdown"
                                    fromYear={1900}
                                    toYear={new Date().getFullYear()}
                                    className="rounded-xl"
                                  />
                                </PopoverContent>
                              </Popover>
                              <FormDescription className="text-xs">
                                Used for age-appropriate health recommendations
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Gender */}
                        <FormField
                          control={form.control}
                          name="gender"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium flex items-center gap-2">
                                <Users className="w-4 h-4 text-rose-500" />
                                Gender
                              </FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger
                                    className={cn(
                                      "h-12 w-full rounded-xl border-0 bg-muted/50",
                                      "hover:bg-muted/70 focus:bg-muted/70",
                                      "transition-all duration-300",
                                      "focus:ring-2 focus:ring-primary/50"
                                    )}
                                  >
                                    <SelectValue placeholder="Select your gender" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="rounded-xl">
                                  {GENDER_OPTIONS.map((option) => (
                                    <SelectItem
                                      key={option.value}
                                      value={option.value}
                                      className="rounded-lg"
                                    >
                                      <span className="flex items-center gap-2">
                                        <span>{option.icon}</span>
                                        <span>{option.label}</span>
                                      </span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormDescription className="text-xs">
                                Helps personalize health insights
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {/* Contact Information Section */}
                    <div className="space-y-6">
                      <SectionHeader
                        icon={Mail}
                        iconColor="text-blue-500"
                        iconBg="bg-gradient-to-br from-blue-500/20 to-cyan-500/20"
                        title="Contact Information"
                        subtitle="How we can reach you"
                      />

                      {/* Email (Read-only) */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium flex items-center gap-2">
                          <Mail className="w-4 h-4 text-blue-500" />
                          Email Address
                        </Label>
                        <div className="relative">
                          <div className="h-12 px-4 rounded-xl bg-muted/30 border border-dashed border-muted-foreground/20 flex items-center justify-between">
                            <span className="text-muted-foreground">
                              {user.email}
                            </span>
                            <div className="flex items-center gap-2">
                              {user.isEmailVerified && (
                                <span className="flex items-center gap-1 text-xs text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full">
                                  <CheckCircle className="w-3 h-3" />
                                  Verified
                                </span>
                              )}
                              <Shield className="w-4 h-4 text-muted-foreground/50" />
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                            <Shield className="w-3 h-3" />
                            Email is linked to your account and cannot be
                            changed
                          </p>
                        </div>
                      </div>

                      {/* Phone with Country Code */}
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium flex items-center gap-2">
                              <Phone className="w-4 h-4 text-blue-500" />
                              Phone Number
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 font-normal"
                              >
                                Optional
                              </Badge>
                            </FormLabel>
                            <FormControl>
                              <StyledPhoneInput
                                value={field.value}
                                onChange={field.onChange}
                                error={!!form.formState.errors.phone}
                              />
                            </FormControl>
                            <FormDescription className="text-xs">
                              Used for WhatsApp coaching notifications and
                              account recovery
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Completion Tips Card */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/5 via-purple-500/5 to-pink-500/5 border border-primary/10 p-6"
                    >
                      <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-primary/20 to-purple-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                      <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-br from-pink-500/20 to-rose-500/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

                      <div className="relative flex items-start gap-4">
                        <motion.div
                          animate={{ rotate: [0, 10, -10, 0] }}
                          transition={{ duration: 2, repeat: Infinity }}
                          className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary/30"
                        >
                          <Sparkles className="w-6 h-6 text-white" />
                        </motion.div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-sm mb-1">
                            Complete Your Profile
                          </h4>
                          <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                            A complete profile helps your AI health coach
                            provide personalized recommendations tailored to
                            your unique journey.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {completionItems.map((item, index) => (
                              <motion.span
                                key={index}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.1 * index }}
                                className={cn(
                                  "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-all duration-300",
                                  item.done
                                    ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                    : "bg-muted/50 text-muted-foreground border border-muted-foreground/10"
                                )}
                              >
                                {item.done ? (
                                  <Check className="w-3 h-3" />
                                ) : (
                                  <X className="w-3 h-3" />
                                )}
                                {item.label}
                              </motion.span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>

                    {/* Action Buttons */}
                    <div className="flex gap-4 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => router.back()}
                        className="flex-1 h-12 rounded-xl border-muted-foreground/20 hover:bg-muted/50 transition-all duration-300 hover:shadow-lg"
                        disabled={isSubmitting}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={isSubmitting || !form.formState.isDirty}
                        className={cn(
                          "flex-1 h-12 rounded-xl",
                          "bg-gradient-to-r from-primary via-purple-500 to-pink-500",
                          "hover:opacity-90 transition-all duration-300",
                          "shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30",
                          "disabled:opacity-50 disabled:cursor-not-allowed"
                        )}
                      >
                        <AnimatePresence mode="wait">
                          {isSubmitting ? (
                            <motion.div
                              key="loading"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="flex items-center"
                            >
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Saving...
                            </motion.div>
                          ) : (
                            <motion.div
                              key="save"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="flex items-center"
                            >
                              <Save className="w-4 h-4 mr-2" />
                              Save Changes
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </motion.div>

          {/* Quick Links */}
          <motion.div
            variants={itemVariants}
            className="flex flex-wrap justify-center gap-4 text-sm pb-8"
          >
            <Link
              href="/settings"
              className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 group"
            >
              Account Settings
              <ArrowLeft className="w-3 h-3 rotate-180 group-hover:translate-x-1 transition-transform" />
            </Link>
            <span className="text-muted-foreground/30">|</span>
            <Link
              href="/settings/privacy"
              className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 group"
            >
              Privacy Settings
              <ArrowLeft className="w-3 h-3 rotate-180 group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>
        </motion.div>
      </div>

      {/* Custom styles for phone input */}
      <style jsx global>{`
        .phone-input-custom {
          width: 100%;
        }
        .phone-input-custom .PhoneInputInput {
          background: transparent;
          border: none;
          outline: none;
          padding: 0.75rem 1rem;
          font-size: 0.875rem;
          width: 100%;
          height: 3rem;
        }
        .phone-input-custom .PhoneInputInput::placeholder {
          color: hsl(var(--muted-foreground));
          opacity: 0.5;
        }
        .phone-input-custom .PhoneInputCountry {
          padding-left: 1rem;
          margin-right: 0;
        }
        .phone-input-custom .PhoneInputCountrySelect {
          background: transparent;
          border: none;
          cursor: pointer;
        }
        .phone-input-custom .PhoneInputCountryIcon {
          width: 1.5rem;
          height: 1.125rem;
          border-radius: 0.25rem;
          overflow: hidden;
        }
        .phone-input-custom .PhoneInputCountrySelectArrow {
          margin-left: 0.5rem;
          opacity: 0.5;
        }
      `}</style>
    </div>
    </MainLayout>
  );
}
