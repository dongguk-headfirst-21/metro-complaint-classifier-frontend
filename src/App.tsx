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

export default function App() {
  const [view, setView] = useState<"dashboard" | "detail">("dashboard");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [fileIdToDelete, setFileIdToDelete] = useState<string | null>(null);

  const fetchFiles = async () => {
    try {
      const response = await fetch("/api/v1/files");
      if (response.ok) {
        const data = await response.json();
        setFiles(data.files);
      }
    } catch (err) {
      console.error("Failed to load files ledger:", err);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleFileUploaded = async (filename: string, size: number, textContent: string) => {
    const tempId = `temp_${Date.now()}`;

    const tempUploadingEntry: FileEntry = {
      id: tempId,
      name: filename,
      capacity: parseFloat((size / (1024 * 1024)).toFixed(3)),
      uploadedAt: new Date().toISOString().substring(0, 10),
      status: "UPLOADING",
      checkedDepartCount: "0/0",
      complaintCount: 0
    };

    setFiles(prev => [tempUploadingEntry, ...prev]);

    const fetchPromise = fetch("/api/upload-file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename, size, textContent }),
    });

    setTimeout(() => {
      setFiles(prev =>
        prev.map(f => (f.id === tempId ? { ...f, status: "PENDING" as const } : f))
      );
    }, 1500);

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
          setFiles(prev => prev.filter(f => f.id !== tempId));
        }
      } catch (err) {
        console.error("Error finalizing file processing:", err);
        setFiles(prev => prev.filter(f => f.id !== tempId));
      }
    }, 3500);
  };

  const handleDeleteRequest = (fileId: string) => {
    setFileIdToDelete(fileId);
    setIsDeleteModalOpen(true);
  };

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
          <div className="hidden sm:flex items-center gap-5 text-xs text-slate-400 font-medium" />
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8">
        {view === "dashboard" ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
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
                  <FileUploadArea
                    onFileUploaded={handleFileUploaded}
                    disabled={files.some(f => f.status === "UPLOADING" || f.status === "PENDING")}
                  />
                </div>
              </div>
              <div className="lg:col-span-6">
                <ManualProcessingPanel />
              </div>
            </div>

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

      <footer className="py-6 border-t border-slate-200 bg-white text-center text-xs text-slate-400 shrink-0">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <span>© 2026 서울교통공사 민원 자동배부시스템. 내부 직원 전용.</span>
          <span className="font-mono text-[10px]">VER: 3.1.25 // AGENT DESIGNATED DISPATCH ENGINE</span>
        </div>
      </footer>

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
