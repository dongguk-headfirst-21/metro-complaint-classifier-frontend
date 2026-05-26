/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { FileEntry } from "./types";
import FileUploadArea from "./components/FileUploadArea";
import ManualProcessingPanel from "./components/ManualProcessingPanel";
import ComplaintListTable from "./components/ComplaintListTable";
import DetailPage from "./components/DetailPage";
import ConfirmModal from "./components/ConfirmModal";
import { Building2, ShieldEllipsis } from "lucide-react";

export default function App() {
  const [view, setView] = useState<"dashboard" | "detail">("dashboard");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  
  // Modal states for delete confirmation
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [fileIdToDelete, setFileIdToDelete] = useState<string | null>(null);

  // Load files list on startup
  const fetchFiles = async () => {
    try {
      const response = await fetch("/api/files");
      if (response.ok) {
        const data = await response.json();
        setFiles(data);
      }
    } catch (err) {
      console.error("Failed to load files ledger:", err);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  // Handle uploaded file triggering client-side visual transitions
  const handleFileUploaded = async (filename: string, size: number, textContent: string) => {
    const tempId = `temp_${Date.now()}`;
    const timestampStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

    // 1. Initial State: Uploading
    const tempUploadingEntry: FileEntry = {
      id: tempId,
      filename,
      size,
      uploadTimestamp: timestampStr,
      status: "Uploading",
      confirmedDepartments: [],
      totalDepartments: 0,
      totalComplaints: 0
    };

    setFiles(prev => [tempUploadingEntry, ...prev]);

    // Dispatch raw file to backend for real classification
    let fetchPromise = fetch("/api/upload-file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename, size, textContent }),
    });

    // 2. Scheduled transition: Transition to 'Classifying' after 1.5 seconds
    setTimeout(() => {
      setFiles(prev =>
        prev.map(f => (f.id === tempId ? { ...f, status: "Classifying" } : f))
      );
    }, 1500);

    // 3. Final Transition: Apply complete backend parsed data after 3.5 seconds total
    setTimeout(async () => {
      try {
        const res = await fetchPromise;
        if (res.ok) {
          const finalResult = await res.json();
          const serverCreatedFile: FileEntry = finalResult.file;
          
          setFiles(prev =>
            prev.map(f => (f.id === tempId ? serverCreatedFile : f))
          );
        } else {
          // Fallback if network had an issue
          setFiles(prev => prev.filter(f => f.id !== tempId));
        }
      } catch (err) {
        console.error("Error finalizing file processing:", err);
        setFiles(prev => prev.filter(f => f.id !== tempId));
      }
    }, 3500);
  };

  // Delete Action Initiator
  const handleDeleteRequest = (fileId: string) => {
    setFileIdToDelete(fileId);
    setIsDeleteModalOpen(true);
  };

  // Delete Executor (after Confirmation Dialogue accepted)
  const handleDeleteConfirm = async () => {
    if (!fileIdToDelete) return;

    try {
      const response = await fetch(`/api/files/${fileIdToDelete}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setFiles(prev => prev.filter(f => f.id !== fileIdToDelete));
        if (activeFileId === fileIdToDelete) {
          setView("dashboard");
          setActiveFileId(null);
        }
      }
    } catch (err) {
      console.error("Failed to delete complaint file record:", err);
    } finally {
      setIsDeleteModalOpen(false);
      setFileIdToDelete(null);
    }
  };

  const activeFile = files.find(f => f.id === activeFileId);

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col antialiased">
      
      {/* Top Professional Municipal Header Branding */}
      <header className="sticky top-0 z-40 w-full bg-[#0f172a] text-white border-b border-slate-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center bg-white">
              <img src="/seoul-metro-logo.png" alt="서울교통공사" className="w-10 h-10 object-contain" />
            </div>
            <div>
              <span className="text-[10px] font-bold tracking-widest text-slate-400 block font-sans uppercase">
                서울교통공사
              </span>
              <h1 className="text-md font-bold tracking-tight text-white font-display">
                민원 자동배부시스템
              </h1>
            </div>
          </div>
          
          <div className="hidden sm:flex items-center gap-5 text-xs text-slate-400 font-medium">
            {/* <div className="flex items-center gap-1.5 bg-slate-800/40 px-3 py-1.5 rounded-lg border border-slate-800">
              <Building2 className="w-3.5 h-3.5 text-blue-400" />
              <span>본사 민원 데스크</span>
            </div>
            <div className="h-4 w-[1px] bg-slate-800" />
            <div className="flex items-center gap-1.5">
              <ShieldEllipsis className="w-4 h-4 text-emerald-500" />
              <span>보안 인증: 관리자</span>
            </div> */}
          </div>
        </div>
      </header>

      {/* Main Body Layout Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8">
        {view === "dashboard" ? (
          <div className="space-y-8">
            
            {/* Top Row: File Upload (Left) and Manual Input Panel (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              
              {/* Upper Left: File Upload Area */}
              <div className="lg:col-span-6 flex flex-col justify-between space-y-4">
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex-1 flex flex-col justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-800 tracking-tight font-display mb-1 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-600 block animate-ping"></span>
                      파일 업로드 패널
                    </h2>
                    <p className="text-xs text-slate-400 leading-relaxed mb-4">
                      민원 목록 파일을 업로드하면 AI를 통해 각 민원을 자동으로 분류하여 담당 부서에 배부합니다.
                    </p>
                  </div>
                  <FileUploadArea onFileUploaded={handleFileUploaded} />
                </div>
              </div>

              {/* Upper Right: Manual input Processing Panel */}
              <div className="lg:col-span-6">
                <ManualProcessingPanel />
              </div>

            </div>

            {/* Bottom Row: Civil Complaint Ledger List Table */}
            <ComplaintListTable
              files={files}
              onDeleteRequest={handleDeleteRequest}
              onSelectFile={(fileId) => {
                setActiveFileId(fileId);
                setView("detail");
              }}
            />
          </div>
        ) : (
          /* Detail breakdown view of singular selected file category split rows */
          activeFile && (
            <DetailPage
              file={activeFile}
              onBack={() => {
                setView("dashboard");
                setActiveFileId(null);
              }}
              onRefresh={fetchFiles}
            />
          )
        )}
      </main>

      {/* Footer copyright */}
      <footer className="py-6 border-t border-slate-200 bg-white text-center text-xs text-slate-400 shrink-0">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <span>© 2026 Civil Dispatch Desk. Authorized Municipal Personnel Only.</span>
          <span className="font-mono text-[10px]">VER: 3.1.25 // AGENT DESIGNATED DISPATCH ENGINE</span>
        </div>
      </footer>

      {/* Custom delete warning dialog, requested with exact confirmation copy phrase */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="파일 삭제"
        message="정말로 삭제하시겠습니까?"
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          setIsDeleteModalOpen(false);
          setFileIdToDelete(null);
        }}
      />

    </div>
  );
}
