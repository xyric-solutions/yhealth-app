"use client";

import { useState, useRef, useEffect, Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Loader2, Mail, Lock, User, ArrowRight, Calendar, CheckCircle2, Sparkles, Shield, AlertCircle, X, Check, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import toast from "react-hot-toast";

const signupSchema = z
  .object({
    firstName: z.string().min(2, "First name must be at least 2 characters"),
    lastName: z.string().min(2, "Last name must be at least 2 characters"),
    email: z.string().email("Please enter a valid email"),
    dateOfBirth: z.string().min(1, "Date of birth is required"),
    gender: z.string().min(1, "Please select your gender"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Password must contain uppercase, lowercase, and number"
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  })
  .refine((data) => {
    const birthDate = new Date(data.dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 18;
  }, {
    message: "You must be 18 years or older to register",
    path: ["dateOfBirth"],
  });

type SignupFormData = z.infer<typeof signupSchema>;

// Password strength checker
function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z\d]/.test(password)) score++;

  if (score <= 2) return { score, label: "Weak", color: "bg-destructive" };
  if (score <= 4) return { score, label: "Fair", color: "bg-yellow-500" };
  if (score <= 5) return { score, label: "Good", color: "bg-blue-500" };
  return { score, label: "Strong", color: "bg-green-500" };
}

// Password requirements checker
function PasswordRequirements({ password }: { password: string }) {
  const requirements = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "Contains uppercase letter", met: /[A-Z]/.test(password) },
    { label: "Contains lowercase letter", met: /[a-z]/.test(password) },
    { label: "Contains number", met: /\d/.test(password) },
  ];

  return (
    <div className="space-y-1.5 mt-2">
      {requirements.map((req, i) => (
        <motion.div
          key={req.label}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05 }}
          className="flex items-center gap-2 text-xs"
        >
          <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-colors ${
            req.met ? "bg-green-500/20 text-green-500" : "bg-muted text-muted-foreground"
          }`}>
            {req.met ? <Check className="w-2.5 h-2.5" /> : <div className="w-1.5 h-1.5 rounded-full bg-current" />}
          </div>
          <span className={req.met ? "text-green-500" : "text-muted-foreground"}>{req.label}</span>
        </motion.div>
      ))}
    </div>
  );
}

function SignUpContent() {
  const { register: registerUser, verifyRegistration, resendRegistrationOTP, loginWithGoogle, isLoading, error } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showPasswordRequirements, setShowPasswordRequirements] = useState(false);
  const [step, setStep] = useState<"form" | "otp">("form");
  const [activationToken, setActivationToken] = useState<string>("");
  const [otpValues, setOtpValues] = useState<string[]>(["", "", "", ""]);
  const [userEmail, setUserEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const searchParams = useSearchParams();

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Handle URL error params (from OAuth redirects)
  useEffect(() => {
    const error = searchParams.get("error");
    if (error) {
      const decodedError = decodeURIComponent(error);
      setErrorMessage(decodedError);
      toast.error(decodedError, { duration: 5000 });
      window.history.replaceState({}, "", "/auth/signup");
    }
  }, [searchParams]);

  // Sync auth hook error with local state
  useEffect(() => {
    if (error) {
      setErrorMessage(error);
    }
  }, [error]);

  const dismissError = () => {
    setErrorMessage(null);
  };

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const passwordValue = watch("password") || "";
  const passwordStrength = useMemo(() => getPasswordStrength(passwordValue), [passwordValue]);

  const onSubmit = async (data: SignupFormData) => {
    setErrorMessage(null);
    setUserEmail(data.email);
    const result = await registerUser({
      email: data.email,
      password: data.password,
      firstName: data.firstName,
      lastName: data.lastName,
      dateOfBirth: data.dateOfBirth,
      gender: data.gender,
    });

    if (result.success && result.activationToken) {
      setActivationToken(result.activationToken);
      setStep("otp");
      setResendCooldown(60); // Start cooldown
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newOtpValues = [...otpValues];
    newOtpValues[index] = value.slice(-1);
    setOtpValues(newOtpValues);

    // Auto-focus next input
    if (value && index < 3) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otpValues[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").slice(0, 4);
    if (!/^\d+$/.test(pastedData)) return;

    const newOtpValues = [...otpValues];
    pastedData.split("").forEach((char, index) => {
      if (index < 4) newOtpValues[index] = char;
    });
    setOtpValues(newOtpValues);

    // Focus last filled input or the next empty one
    const focusIndex = Math.min(pastedData.length, 3);
    otpRefs.current[focusIndex]?.focus();
  };

  const handleVerifyOtp = async () => {
    const code = otpValues.join("");
    if (code.length !== 4) return;

    await verifyRegistration({
      activationToken,
      activationCode: code,
    });
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isLoading) return;

    const result = await resendRegistrationOTP(activationToken);
    if (result.success && result.activationToken) {
      setActivationToken(result.activationToken);
      setOtpValues(["", "", "", ""]);
      setResendCooldown(60);
      otpRefs.current[0]?.focus();
    }
  };

  return (
    <div className="space-y-5">
      {/* Error Alert */}
      <AnimatePresence>
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="relative p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium">Registration Error</p>
                <p className="text-xs mt-1 opacity-80">{errorMessage}</p>
              </div>
              <button
                onClick={dismissError}
                className="p-1 hover:bg-destructive/10 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {step === "form" ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-5"
          >
            {/* Header */}
            <div className="text-center space-y-2">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-2"
              >
                <Sparkles className="w-3 h-3" />
                <span>Start Free Trial</span>
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-2xl sm:text-3xl font-bold"
              >
                Create Account
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-sm text-muted-foreground"
              >
                Start your health journey today
              </motion.p>
            </div>

            {/* Social Login */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Button
                variant="outline"
                className="w-full h-11 bg-background/50 border-white/10 hover:bg-white/5 transition-all"
                onClick={loginWithGoogle}
                disabled={isLoading}
              >
                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Continue with Google
              </Button>
            </motion.div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  or continue with email
                </span>
              </div>
            </div>

            {/* Form */}
            <motion.form
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-3"
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName" className="text-xs font-medium">First Name</Label>
                  <div className="relative group">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                      id="firstName"
                      placeholder="John"
                      className="pl-10 h-10 bg-background/50 border-white/10 focus:border-primary/50 transition-all text-sm"
                      {...register("firstName")}
                    />
                  </div>
                  {errors.firstName && (
                    <p className="text-[10px] text-destructive">{errors.firstName.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="lastName" className="text-xs font-medium">Last Name</Label>
                  <div className="relative group">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                      id="lastName"
                      placeholder="Doe"
                      className="pl-10 h-10 bg-background/50 border-white/10 focus:border-primary/50 transition-all text-sm"
                      {...register("lastName")}
                    />
                  </div>
                  {errors.lastName && (
                    <p className="text-[10px] text-destructive">{errors.lastName.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium">Email</Label>
                <div className="relative group">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@example.com"
                    className="pl-10 h-10 bg-background/50 border-white/10 focus:border-primary/50 transition-all text-sm"
                    {...register("email")}
                  />
                </div>
                {errors.email && (
                  <p className="text-[10px] text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="dateOfBirth" className="text-xs font-medium">Date of Birth</Label>
                  <div className="relative group">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                      id="dateOfBirth"
                      type="date"
                      className="pl-10 h-10 bg-background/50 border-white/10 focus:border-primary/50 transition-all text-sm"
                      {...register("dateOfBirth")}
                    />
                  </div>
                  {errors.dateOfBirth && (
                    <p className="text-[10px] text-destructive">{errors.dateOfBirth.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="gender" className="text-xs font-medium">Gender</Label>
                  <Select onValueChange={(value) => setValue("gender", value)}>
                    <SelectTrigger className="w-full h-10 bg-background/50 border-white/10 focus:border-primary/50 transition-all text-sm">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="non_binary">Non-binary</SelectItem>
                      <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.gender && (
                    <p className="text-[10px] text-destructive">{errors.gender.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-medium">Password</Label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a strong password"
                    className="pl-10 pr-10 h-10 bg-background/50 border-white/10 focus:border-primary/50 transition-all text-sm"
                    {...register("password")}
                    onFocus={() => setShowPasswordRequirements(true)}
                    onBlur={() => setShowPasswordRequirements(false)}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {/* Password Strength Indicator */}
                {passwordValue && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-2 mt-2"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(passwordStrength.score / 6) * 100}%` }}
                          className={`h-full ${passwordStrength.color} transition-all`}
                        />
                      </div>
                      <span className={`text-[10px] font-medium ${
                        passwordStrength.label === "Weak" ? "text-destructive" :
                        passwordStrength.label === "Fair" ? "text-yellow-500" :
                        passwordStrength.label === "Good" ? "text-blue-500" :
                        "text-green-500"
                      }`}>
                        {passwordStrength.label}
                      </span>
                    </div>

                    <AnimatePresence>
                      {showPasswordRequirements && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                        >
                          <PasswordRequirements password={passwordValue} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}

                {errors.password && (
                  <p className="text-[10px] text-destructive">{errors.password.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-xs font-medium">Confirm Password</Label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm your password"
                    className="pl-10 pr-10 h-10 bg-background/50 border-white/10 focus:border-primary/50 transition-all text-sm"
                    {...register("confirmPassword")}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-[10px] text-destructive">
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>

              <div className="text-[10px] sm:text-xs text-muted-foreground flex items-start gap-2">
                <Shield className="w-3 h-3 mt-0.5 text-primary shrink-0" />
                <span>
                  By creating an account, you agree to our{" "}
                  <Link href="/terms" className="text-primary hover:text-primary/80 transition-colors">
                    Terms
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="text-primary hover:text-primary/80 transition-colors">
                    Privacy Policy
                  </Link>
                  .
                </span>
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90 text-white font-medium shadow-lg shadow-primary/25 transition-all"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Create Account
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </motion.form>

            {/* Sign In Link */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-center text-sm text-muted-foreground"
            >
              Already have an account?{" "}
              <Link
                href="/auth/signin"
                className="font-medium text-primary hover:text-primary/80 transition-colors"
              >
                Sign in
              </Link>
            </motion.p>
          </motion.div>
        ) : (
          <motion.div
            key="otp"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            {/* OTP Header */}
            <div className="text-center space-y-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", duration: 0.5 }}
                className="mx-auto w-20 h-20 bg-gradient-to-br from-primary/20 to-purple-500/20 rounded-full flex items-center justify-center border border-primary/30"
              >
                <CheckCircle2 className="w-10 h-10 text-primary" />
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-2xl sm:text-3xl font-bold"
              >
                Verify Your Email
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-sm text-muted-foreground"
              >
                We sent a 4-digit code to{" "}
                <span className="font-medium text-foreground">{userEmail}</span>
              </motion.p>
            </div>

            {/* OTP Input - Beautiful Design */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex justify-center gap-3 sm:gap-4"
              onPaste={handleOtpPaste}
            >
              {otpValues.map((value, index) => (
                <motion.div
                  key={index}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.4 + index * 0.05, type: "spring" }}
                  className="relative group"
                >
                  {/* Glow effect */}
                  <div className={`absolute -inset-1 bg-gradient-to-r from-primary to-purple-500 rounded-xl blur-md transition-opacity ${
                    value ? "opacity-30" : "opacity-0 group-focus-within:opacity-20"
                  }`} />

                  {/* Input */}
                  <Input
                    ref={(el) => { otpRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={value}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    className={`relative w-14 h-16 sm:w-16 sm:h-18 text-center text-2xl sm:text-3xl font-bold
                      bg-background/80 backdrop-blur-sm
                      border-2 transition-all duration-300 rounded-xl
                      ${value
                        ? "border-primary/50 shadow-lg shadow-primary/20"
                        : "border-white/20 hover:border-white/30"
                      }
                      focus:border-primary focus:shadow-lg focus:shadow-primary/30
                      focus:ring-2 focus:ring-primary/20 focus:outline-none
                    `}
                  />

                  {/* Filled indicator dot */}
                  {value && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-primary"
                    />
                  )}
                </motion.div>
              ))}
            </motion.div>

            {/* Verify Button */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Button
                className="w-full h-12 bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90 text-white font-medium shadow-lg shadow-primary/25 transition-all rounded-xl"
                onClick={handleVerifyOtp}
                disabled={isLoading || otpValues.join("").length !== 4}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <>
                    Verify & Create Account
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
            </motion.div>

            {/* Resend & Back */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-center space-y-3"
            >
              <div className="flex items-center justify-center gap-2">
                <p className="text-sm text-muted-foreground">
                  Didn&apos;t receive the code?
                </p>
                <button
                  type="button"
                  disabled={resendCooldown > 0 || isLoading}
                  className={`inline-flex items-center gap-1.5 text-sm font-medium transition-colors ${
                    resendCooldown > 0 || isLoading
                      ? "text-muted-foreground cursor-not-allowed"
                      : "text-primary hover:text-primary/80"
                  }`}
                  onClick={handleResendOtp}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Code"}
                </button>
              </div>

              <button
                type="button"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => {
                  setOtpValues(["", "", "", ""]);
                  setStep("form");
                }}
              >
                Go back to registration
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function SignUpPageContent() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <SignUpContent />
    </Suspense>
  );
}
