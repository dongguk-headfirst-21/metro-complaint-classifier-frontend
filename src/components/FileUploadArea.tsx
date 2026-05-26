/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { UploadCloud, FileText, CheckCircle } from "lucide-react";

interface FileUploadAreaProps {
  onFileUploaded: (filename: string, size: number, textContent: string) => void;
}

export default function FileUploadArea({ onFileUploaded }: FileUploadAreaProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [lastUploaded, setLastUploaded] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string || "";
      onFileUploaded(file.name, file.size, text);
      setLastUploaded(file.name);
      setTimeout(() => setLastUploaded(null), 4000);
    };
    // For TXT or log files read as text, otherwise just send empty string which triggers name-based generation
    if (file.type.startsWith("text/") || file.name.endsWith(".txt") || file.name.endsWith(".json") || file.name.endsWith(".csv")) {
      reader.readAsText(file);
    } else {
      // Just execute drop action with empty text content
      onFileUploaded(file.name, file.size, "");
      setLastUploaded(file.name);
      setTimeout(() => setLastUploaded(null), 4000);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div
      onClick={() => fileInputRef.current?.click()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative flex flex-col items-center justify-center h-48 px-6 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300 group
        ${
          isDragging
            ? "border-blue-500 bg-blue-50/50"
            : "border-slate-200 hover:border-slate-300 bg-white"
        }`}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".txt,.csv,.json,.pdf,.doc,.docx"
      />

      <div className="flex flex-col items-center text-center">
        {lastUploaded ? (
          <>
            <div className="flex items-center justify-center w-12 h-12 mb-3 rounded-full bg-emerald-50 text-emerald-500">
              <CheckCircle className="w-6 h-6 animate-bounce" />
            </div>
            <p className="text-sm font-semibold text-slate-800 font-display">
              업로드 완료!
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-[250px] truncate font-mono">
              {lastUploaded}
            </p>
          </>
        ) : (
          <>
            <div className={`flex items-center justify-center w-12 h-12 mb-3 rounded-full transition-transform duration-300 group-hover:scale-110
              ${isDragging ? "bg-blue-100 text-blue-600" : "bg-slate-50 text-slate-400"}`}
            >
              <UploadCloud className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-slate-700">
              <span className="font-semibold text-slate-900 font-display">클릭하여 업로드</span> 또는 드래그 앤 드롭
            </p>
            <p className="text-xs text-slate-400 mt-1">
              .txt, .csv, .json, .pdf 파일 지원 (최대 10MB)
            </p>
          </>
        )}
      </div>
    </div>
  );
}
