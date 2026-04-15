"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import {
  Settings,
  User,
  Shield,

  Link as LinkIcon,
  Unlink,
  Download,
  Trash2,
  LogOut,
  ChevronRight,
  ExternalLink,
  Key,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/app/context/AuthContext";
import { useProductTour } from "@/hooks/use-product-tour";

interface Integration {
  id: string;
  name: string;
  icon: string;
  connected: boolean;
  lastSync?: string;
}

const mockIntegrations: Integration[] = [
  { id: "fitbit", name: "Fitbit", icon: "⌚", connected: true, lastSync: "2 hours ago" },
  { id: "apple_health", name: "Apple Health", icon: "🍎", connected: false },
  { id: "google_fit", name: "Google Fit", icon: "🏃", connected: false },
  { id: "strava", name: "Strava", icon: "🚴", connected: true, lastSync: "1 day ago" },
  { id: "myfitnesspal", name: "MyFitnessPal", icon: "🥗", connected: false },
];

export function SettingsTab() {
  const { logout } = useAuth();
  const { resetTour, startTour } = useProductTour();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [integrations, setIntegrations] = useState(mockIntegrations);

  const handleLogout = async () => {
    await logout();
  };

  const toggleIntegration = (id: string) => {
    setIntegrations((prev) =>
      prev.map((int) =>
        int.id === id
          ? { ...int, connected: !int.connected, lastSync: int.connected ? undefined : "Just now" }
          : int
      )
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-slate-400" />
          Settings
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Manage your account and connected services
        </p>
      </motion.div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Account Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden"
        >
          <div className="p-5 border-b border-white/10">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-blue-400" />
              <h3 className="font-semibold text-white">Account</h3>
            </div>
          </div>

          <div className="divide-y divide-white/5">
            <Link
              href="/profile/edit"
              className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
            >
              <div>
                <p className="font-medium text-white">Edit Profile</p>
                <p className="text-sm text-slate-400">Update your personal information</p>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400" />
            </Link>

            <Link
              href="/profile"
              className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
            >
              <div>
                <p className="font-medium text-white">View Profile</p>
                <p className="text-sm text-slate-400">See your public profile</p>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400" />
            </Link>

            <button className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors">
              <div className="text-left">
                <p className="font-medium text-white">Change Password</p>
                <p className="text-sm text-slate-400">Update your password</p>
              </div>
              <Key className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </motion.div>

        {/* Privacy & Security */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden"
        >
          <div className="p-5 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-400" />
              <h3 className="font-semibold text-white">Privacy & Security</h3>
            </div>
          </div>

          <div className="divide-y divide-white/5">
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium text-white">Two-Factor Authentication</p>
                <p className="text-sm text-slate-400">Add an extra layer of security</p>
              </div>
              <button className="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-sm font-medium">
                Enable
              </button>
            </div>

            <div className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium text-white">Profile Visibility</p>
                <p className="text-sm text-slate-400">Control who can see your profile</p>
              </div>
              <select className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white outline-none">
                <option>Private</option>
                <option>Friends</option>
                <option>Public</option>
              </select>
            </div>

            <div className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium text-white">Activity Sharing</p>
                <p className="text-sm text-slate-400">Share progress with others</p>
              </div>
              <button className="relative w-12 h-6 rounded-full bg-slate-600 transition-colors">
                <div className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Connected Apps */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2 rounded-2xl bg-white/5 border border-white/10 overflow-hidden"
          data-tour="integrations"
        >
          <div className="p-5 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LinkIcon className="w-5 h-5 text-purple-400" />
                <h3 className="font-semibold text-white">Connected Apps</h3>
              </div>
              <span className="text-sm text-slate-400">
                {integrations.filter((i) => i.connected).length} connected
              </span>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
            {integrations.map((integration) => (
              <div
                key={integration.id}
                className={`p-4 rounded-xl border transition-all ${
                  integration.connected
                    ? "bg-purple-500/10 border-purple-500/30"
                    : "bg-white/5 border-white/10"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="text-2xl">{integration.icon}</span>
                  {integration.connected && (
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  )}
                </div>
                <h4 className="font-medium text-white mb-1">{integration.name}</h4>
                {integration.connected ? (
                  <>
                    <p className="text-xs text-slate-400 mb-3">
                      Last sync: {integration.lastSync}
                    </p>
                    <button
                      onClick={() => toggleIntegration(integration.id)}
                      className="w-full py-2 rounded-lg bg-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/30 transition-colors flex items-center justify-center gap-2"
                    >
                      <Unlink className="w-4 h-4" />
                      Disconnect
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-slate-400 mb-3">Not connected</p>
                    <button
                      onClick={() => toggleIntegration(integration.id)}
                      className="w-full py-2 rounded-lg bg-purple-500/20 text-purple-400 text-sm font-medium hover:bg-purple-500/30 transition-colors flex items-center justify-center gap-2"
                    >
                      <LinkIcon className="w-4 h-4" />
                      Connect
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Data & Export */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden"
        >
          <div className="p-5 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Download className="w-5 h-5 text-cyan-400" />
              <h3 className="font-semibold text-white">Data & Export</h3>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <button className="w-full p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors text-left">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-white">Export All Data</p>
                  <p className="text-sm text-slate-400">Download your complete history</p>
                </div>
                <Download className="w-5 h-5 text-cyan-400" />
              </div>
            </button>

            <button className="w-full p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors text-left">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-white">Export Goals</p>
                  <p className="text-sm text-slate-400">Download goal data as CSV</p>
                </div>
                <ExternalLink className="w-5 h-5 text-slate-400" />
              </div>
            </button>

            <button className="w-full p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors text-left">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-white">Export Activity Log</p>
                  <p className="text-sm text-slate-400">Download activity history</p>
                </div>
                <ExternalLink className="w-5 h-5 text-slate-400" />
              </div>
            </button>
          </div>
        </motion.div>

        {/* Help & Support */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden"
        >
          <div className="p-5 border-b border-white/10">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-blue-400" />
              <h3 className="font-semibold text-white">Help & Support</h3>
            </div>
          </div>
          <div className="p-5 space-y-3">
            <button
              onClick={() => {
                resetTour();
                startTour();
              }}
              className="w-full p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors text-left"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-white">Replay Product Tour</p>
                  <p className="text-sm text-slate-400">
                    Take a guided walkthrough of Balencia features
                  </p>
                </div>
                <Sparkles className="w-5 h-5 text-cyan-400" />
              </div>
            </button>
          </div>
        </motion.div>

        {/* Danger Zone */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl bg-red-500/5 border border-red-500/20 overflow-hidden"
        >
          <div className="p-5 border-b border-red-500/20">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <h3 className="font-semibold text-white">Danger Zone</h3>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <button
              onClick={handleLogout}
              className="w-full p-4 rounded-xl bg-white/5 border border-white/10 hover:border-red-500/30 hover:bg-red-500/10 transition-colors text-left"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-white">Sign Out</p>
                  <p className="text-sm text-slate-400">Log out of your account</p>
                </div>
                <LogOut className="w-5 h-5 text-red-400" />
              </div>
            </button>

            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full p-4 rounded-xl bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 transition-colors text-left"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-red-400">Delete Account</p>
                    <p className="text-sm text-slate-400">
                      Permanently delete your account and all data
                    </p>
                  </div>
                  <Trash2 className="w-5 h-5 text-red-400" />
                </div>
              </button>
            ) : (
              <div className="p-4 rounded-xl bg-red-500/20 border border-red-500/30">
                <p className="text-sm text-red-400 mb-4">
                  Are you sure? This action cannot be undone. All your data will be
                  permanently deleted.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 py-2 rounded-lg bg-white/10 text-white text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button className="flex-1 py-2 rounded-lg bg-red-500 text-white text-sm font-medium">
                    Delete Forever
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
