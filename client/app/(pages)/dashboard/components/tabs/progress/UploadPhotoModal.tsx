'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Camera, Upload, Calendar, FileImage } from 'lucide-react';
import { api } from '@/lib/api-client';
import toast from 'react-hot-toast';

interface UploadPhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type PhotoType = 'front' | 'side' | 'back';
type PhotoCategory = 'before' | 'after';

export function UploadPhotoModal({ isOpen, onClose, onSuccess }: UploadPhotoModalProps) {
  const [photoType, setPhotoType] = useState<PhotoType>('front');
  const [photoCategory, setPhotoCategory] = useState<PhotoCategory>('after');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Image size must be less than 10MB');
        return;
      }
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Image size must be less than 10MB');
        return;
      }
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a photo');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('photo', selectedFile);
      formData.append('photoType', photoType);
      formData.append('date', date);
      if (notes.trim()) {
        formData.append('notes', notes.trim());
      }
      // Add before/after category to notes for now (backend can be updated later)
      if (photoCategory) {
        formData.append('notes', `${notes ? notes + ' | ' : ''}Category: ${photoCategory}`);
      }

      // Don't set Content-Type header - browser will set it with boundary for FormData
      const response = await api.post('/progress/photos', formData);

      if (response.success) {
        toast.success(`${photoCategory === 'before' ? 'Before' : 'After'} photo uploaded successfully!`);
        resetForm();
        onSuccess();
        onClose();
      } else {
        toast.error('Failed to upload photo');
      }
    } catch (err: unknown) {
      console.error('Failed to upload photo:', err);
      const errObj = err as Record<string, unknown>;
      const respData = (errObj?.response as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
      const errorMessage = (respData?.error as string) || (errObj?.message as string) || 'Failed to upload photo';
      toast.error(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setPreview(null);
    setNotes('');
    setDate(new Date().toISOString().split('T')[0]);
    setPhotoType('front');
    setPhotoCategory('after');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          onClick={handleClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto z-50"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/30 to-teal-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Camera className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Upload Progress Photo</h3>
                <p className="text-sm text-slate-400">Track your visual transformation</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-6">
            {/* Photo Category (Before/After) */}
            <div>
              <label className="text-sm font-medium text-slate-300 mb-3 block">Photo Category</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPhotoCategory('before')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    photoCategory === 'before'
                      ? 'border-orange-500 bg-orange-500/20 text-orange-400'
                      : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
                  }`}
                >
                  <div className="font-medium">Before</div>
                  <div className="text-xs mt-1">Starting point</div>
                </button>
                <button
                  type="button"
                  onClick={() => setPhotoCategory('after')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    photoCategory === 'after'
                      ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                      : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
                  }`}
                >
                  <div className="font-medium">After</div>
                  <div className="text-xs mt-1">Current progress</div>
                </button>
              </div>
            </div>

            {/* Photo Type */}
            <div>
              <label className="text-sm font-medium text-slate-300 mb-3 block">Photo Type</label>
              <div className="grid grid-cols-3 gap-3">
                {(['front', 'side', 'back'] as PhotoType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setPhotoType(type)}
                    className={`p-3 rounded-xl border-2 transition-all capitalize ${
                      photoType === type
                        ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                        : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
                <Calendar className="w-4 h-4" />
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* File Upload */}
            <div>
              <label className="text-sm font-medium text-slate-300 mb-3 block">Photo</label>
              {preview ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preview}
                    alt="Preview"
                    className="w-full h-64 object-cover rounded-xl border border-white/10"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      setPreview(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                    className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/70 rounded-lg text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center hover:border-emerald-500/50 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FileImage className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                  <p className="text-slate-400 mb-1">Click to upload or drag and drop</p>
                  <p className="text-xs text-slate-500">PNG, JPG up to 10MB</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="text-sm font-medium text-slate-300 mb-2 block">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this photo..."
                rows={3}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={isUploading || !selectedFile}
                className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    Upload Photo
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

