/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { FileEntry } from "../types";
import { Trash2, AlertCircle, FileText, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";

interface ComplaintListTableProps {
  files: FileEntry[];
  onDeleteRequest: (fileId: string) => void;
  onSelectFile: (fileId: string) => void;
}

export default function ComplaintListTable({
  files,
  onDeleteRequest,
  onSelectFile,
}: ComplaintListTableProps) {
  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const getStatusBadge = (status: FileEntry["status"]) => {
    switch (status) {
      case "Uploading":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100 animate-pulse-subtle">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            업로드 중
          </span>
        );
      case "Classifying":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            분류 중
          </span>
        );
      case "Classification Complete":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            분류 완료
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800 tracking-tight font-display flex items-center gap-2">
          <FileText className="w-4 h-4 text-slate-500" />
          민원 파일 목록
        </h2>
        <span className="text-xs font-mono font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
          {files.length} 개
        </span>
      </div>

      <div className="overflow-x-auto">
        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-slate-400">
            <FileText className="w-12 h-12 stroke-[1.2] mb-3 text-slate-300" />
            <p className="text-sm font-medium">등록된 민원 파일이 없습니다.</p>
            <p className="text-xs text-slate-400 mt-1">왼쪽에서 파일을 업로드하거나 단건 입력을 이용하세요.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                <th className="px-6 py-3.5">파일명</th>
                <th className="px-6 py-3.5">크기</th>
                <th className="px-6 py-3.5 text-center">민원 수</th>
                <th className="px-6 py-3.5">업로드 시간</th>
                <th className="px-6 py-3.5">분류 상태</th>
                <th className="px-6 py-3.5 text-center">확인 / 전체 부서</th>
                <th className="px-6 py-3.5 text-center">삭제</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {files.map((file) => {
                const isComplete = file.status === "Classification Complete";
                return (
                  <tr
                    key={file.id}
                    onClick={() => {
                      if (isComplete) {
                        onSelectFile(file.id);
                      }
                    }}
                    className={`group transition-colors ${
                      isComplete
                        ? "cursor-pointer hover:bg-slate-50/70"
                        : "opacity-80"
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          isComplete ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-400"
                        }`}>
                          <FileText className="w-4.5 h-4.5" />
                        </div>
                        <div>
                          <span className="text-sm font-semibold text-slate-800 font-display block group-hover:text-blue-700 transition">
                            {file.filename}
                          </span>
                          {isComplete && (
                            <span className="text-[10px] text-blue-600 font-medium group-hover:underline flex items-center gap-0.5 mt-0.5">
                              상세 보기 <ArrowRight className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-500">
                      {formatSize(file.size)}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-center text-slate-800 font-mono">
                      {isComplete ? file.totalComplaints : "—"}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500 font-mono">
                      {file.uploadTimestamp}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(file.status)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {isComplete ? (
                        <div className="inline-flex items-center justify-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 font-mono border border-slate-200">
                          <span className={file.confirmedDepartments.length === file.totalDepartments ? "text-emerald-600 font-bold" : ""}>
                            {file.confirmedDepartments.length}
                          </span>
                          <span>/</span>
                          <span>{file.totalDepartments}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onDeleteRequest(file.id)}
                        className="p-1 px-2 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition"
                        title="파일 삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
