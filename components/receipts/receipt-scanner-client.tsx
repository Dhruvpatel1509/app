'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Camera,
  Upload,
  Sparkles,
  FileText,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReceiptScannerClientProps {
  currentUserId: string;
}

export function ReceiptScannerClient({ currentUserId }: ReceiptScannerClientProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setErrorMessage('Please upload an image (JPG, PNG) or PDF receipt.');
      return;
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setErrorMessage(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const processReceipt = async (fileToProcess?: File, isSample = false) => {
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      setProcessingStep('Uploading receipt securely...');
      await new Promise((r) => setTimeout(r, 600));

      setProcessingStep('AI OCR is reading merchant & items...');
      await new Promise((r) => setTimeout(r, 800));

      setProcessingStep('Calculating subtotal, tax, and tip...');

      const formData = new FormData();
      if (fileToProcess) {
        formData.append('file', fileToProcess);
      }
      if (isSample) {
        formData.append('is_sample', 'true');
      }

      const res = await fetch('/api/receipts/process', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to process receipt.');
      }

      const data = await res.json();
      setProcessingStep('Extraction complete! Redirecting to review...');
      await new Promise((r) => setTimeout(r, 500));

      router.push(`/receipts/${data.receiptId}/review`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error occurred while scanning receipt.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in pb-16">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-200">
          <Sparkles size={14} className="text-emerald-600 animate-pulse" />
          AI Receipt Scanner
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-stone-900 tracking-tight">
          Scan & Split Receipts in Seconds
        </h1>
        <p className="text-sm text-stone-500 max-w-md mx-auto">
          Upload a dining receipt or grocery bill. Our AI extracts every item so each friend pays only for what they ordered.
        </p>
      </div>

      {/* Main Upload Box */}
      <div className="card p-6 md:p-8 space-y-6">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFile(e.target.files[0]);
            }
          }}
        />

        {!previewUrl ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-2xl p-8 md:p-12 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-4',
              isDragging
                ? 'border-emerald-500 bg-emerald-50/50 scale-[1.01]'
                : 'border-stone-200 hover:border-emerald-400 bg-stone-50/50 hover:bg-emerald-50/20'
            )}
          >
            <div className="w-16 h-16 rounded-2xl bg-emerald-100/60 text-emerald-700 flex items-center justify-center shadow-inner">
              <Camera size={32} />
            </div>

            <div>
              <p className="font-semibold text-stone-900 text-base">
                Click to upload or drag & drop receipt
              </p>
              <p className="text-xs text-stone-400 mt-1">
                Supports JPG, PNG, WEBP, or PDF
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 bg-white px-3.5 py-2 rounded-xl border border-stone-200 shadow-sm">
              <Upload size={14} /> Browse from Device or Camera
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative rounded-xl overflow-hidden border border-stone-200 max-h-80 flex items-center justify-center bg-stone-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Receipt preview"
                className="max-h-80 object-contain"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-stone-500">
              <span className="font-medium truncate max-w-xs">{selectedFile?.name}</span>
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  setPreviewUrl(null);
                }}
                className="text-stone-500 hover:text-red-600 font-semibold transition-colors"
              >
                Change Image
              </button>
            </div>
          </div>
        )}

        {/* Processing State */}
        {isProcessing && (
          <div className="p-6 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-center space-y-3 animate-fade-in">
            <div className="w-10 h-10 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <div>
              <p className="font-bold text-emerald-950 text-sm">
                Processing Receipt with AI
              </p>
              <p className="text-xs text-emerald-700 mt-1 animate-pulse">
                {processingStep}
              </p>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3 pt-2">
          {previewUrl && !isProcessing && (
            <button
              onClick={() => selectedFile && processReceipt(selectedFile, false)}
              className="btn btn-primary w-full py-3 text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/20"
            >
              <Sparkles size={16} /> Scan Receipt Now
            </button>
          )}

          {/* Quick Demo with Sample Receipt Button */}
          {!isProcessing && (
            <button
              type="button"
              onClick={() => processReceipt(undefined, true)}
              className="w-full py-2.5 px-4 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <Zap size={14} className="text-amber-500" />
              Try Demo with Sample Restaurant Receipt
            </button>
          )}
        </div>
      </div>

      {/* Feature Highlights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-stone-600">
        <div className="p-4 bg-white rounded-xl border border-stone-200 flex items-start gap-2.5">
          <ShieldCheck size={18} className="text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-stone-900">Item-by-Item Splitting</p>
            <p className="text-stone-500 mt-0.5">Assign each item only to the people who shared it.</p>
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-stone-200 flex items-start gap-2.5">
          <Zap size={18} className="text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-stone-900">Proportional Tax & Tip</p>
            <p className="text-stone-500 mt-0.5">Taxes and tips are automatically distributed proportionally.</p>
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-stone-200 flex items-start gap-2.5">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-stone-900">Penny-Exact Rounding</p>
            <p className="text-stone-500 mt-0.5">Largest-remainder algorithm guarantees zero rounding drift.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
