"use client";

import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { User, ArrowLeft } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";

// Placeholder for public profile view
// This page would fetch user data by ID from the API

function _ProfileSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Skeleton className="h-48 w-full rounded-3xl mb-16" />
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    </div>
  );
}

export default function PublicProfilePageContent() {
  const params = useParams();
  const userId = params.id as string;

  // TODO: Fetch user data from API by userId
  // For now, show a placeholder

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 mb-8"
        >
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="rounded-full"
          >
            <Link href="/">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">User Profile</h1>
            <p className="text-sm text-muted-foreground">
              Viewing user: {userId}
            </p>
          </div>
        </motion.div>

        {/* Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="border-0 bg-card/50 backdrop-blur-sm shadow-xl overflow-hidden">
            {/* Cover */}
            <div className="relative h-32 bg-gradient-to-br from-primary/80 via-purple-500/80 to-pink-500/80">
              <div className="absolute -bottom-12 left-1/2 -translate-x-1/2">
                <Avatar className="h-24 w-24 ring-4 ring-background shadow-xl">
                  <AvatarImage src={undefined} alt="User" />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-purple-500 text-white font-bold text-2xl">
                    <User className="w-8 h-8" />
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>

            <CardContent className="pt-16 pb-8 px-6 text-center">
              <h2 className="text-xl font-bold mb-1">User Profile</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Profile information is private
              </p>
              <p className="text-sm text-muted-foreground">
                Public profile viewing is coming soon.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
