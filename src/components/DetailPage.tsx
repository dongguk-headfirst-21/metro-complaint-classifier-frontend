/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { FileEntry } from "../types";
import { ArrowLeft, CheckSquare, Square, FolderCheck, Info, Loader2, Send } from "lucide-react";

interface DepartSummary {
  departId: string;
  name: string;
  row: number;
  isChecked: boolean;
}

interface DepartComplaint {
  title: string;
  content: string;
  code: string;
}

interface DetailPageProps {
  file: FileEntry;
  onBack: () => void;
  onRefresh: () => void;
}

export default function DetailPage({ file, onBack, onRefresh }: DetailPageProps) {
  const [departSummaries, setDepartSummaries] = useState<DepartSummary[]>([]);
  const [activeDeptComplaints, setActiveDeptComplaints] = useState<DepartComplaint[]>([]);
  const [isLoadingComplaints, setIsLoadingComplaints] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [activeDept, setActiveDept] = useState<string | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const [showDispatchAnimation, setShowDispatchAnimation] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const fileRes = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/files/${file.id}`);

        if (fileRes.ok) {
          const fileData = await fileRes.json();
          const departs: DepartSummary[] = fileData.departs ?? [];
          setDepartSummaries(departs);
          setSelectedDepts(departs.filter(d => d.isChecked).map(d => d.name));
          if (departs.length > 0) setActiveDept(departs[0].name);
        }
      } catch (err) {
        console.error("Failed to load file detail:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [file.id]);

  const allDeptsList = departSummaries.map(s => s.name);

  const isSelectAllChecked = departSummaries.length > 0 && selectedDepts.length === departSummaries.length;

  const hasPendingSelected = selectedDepts.some(name =>
    departSummaries.find(d => d.name === name && !d.isChecked)
  );
  const hasCheckedSelected = selectedDepts.some(name =>
    departSummaries.find(d => d.name === name && d.isChecked)
  );

  const handleSelectAll = () => {
    if (isSelectAllChecked) {
      setSelectedDepts([]);
    } else {
      setSelectedDepts(allDeptsList);
    }
  };

  const handleDeptCheckboxToggle = (dept: string) => {
    setSelectedDepts(prev =>
      prev.includes(dept) ? prev.filter(d => d !== dept) : [...prev, dept]
    );
  };

  useEffect(() => {
    if (!activeDept) return;
    const summary = departSummaries.find(d => d.name === activeDept);
    if (!summary) return;

    setIsLoadingComplaints(true);
    fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/departs/${summary.departId}?page=0&size=50`)
      .then(res => res.json())
      .then(data => setActiveDeptComplaints(data.complaints ?? []))
      .catch(console.error)
      .finally(() => setIsLoadingComplaints(false));
  }, [activeDept, departSummaries]);

  const handleConfirm = async () => {
    setIsFinishing(true);
    try {
      const selectedDepartIds = departSummaries
        .filter(d => selectedDepts.includes(d.name))
        .map(d => d.departId);

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/files/${file.id}/departs/check`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ departIds: selectedDepartIds }),
      });

      if (response.ok) {
        setShowDispatchAnimation(true);
        setTimeout(async () => {
          setShowDispatchAnimation(false);
          setIsFinishing(false);
          const fileRes = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/files/${file.id}`);
          if (fileRes.ok) {
            const fileData = await fileRes.json();
            const departs = fileData.departs ?? [];
            setDepartSummaries(departs);
            setSelectedDepts([]);
          }
          onRefresh();
        }, 3200);
      } else {
        setIsFinishing(false);
      }
    } catch (err) {
      console.error(err);
      setIsFinishing(false);
    }
  };

  const handleCancelConfirm = async () => {
    setIsFinishing(true);
    try {
      const checkedDepartIds = departSummaries
        .filter(d => d.isChecked && selectedDepts.includes(d.name))
        .map(d => d.departId);

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/files/${file.id}/departs/uncheck`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ departIds: checkedDepartIds }),
      });

      if (response.ok) {
        const fileRes = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/files/${file.id}`);
        if (fileRes.ok) {
          const fileData = await fileRes.json();
          const departs = fileData.departs ?? [];
          setDepartSummaries(departs);
        }
        setSelectedDepts([]);
        onRefresh();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsFinishing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
        <p className="text-sm font-semibold text-slate-800 font-display">분류 데이터를 불러오는 중...</p>
        <p className="text-xs text-slate-400 mt-1">AI 분류 결과를 불러오고 있습니다</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-[600px] flex flex-col">
      {showDispatchAnimation && (
        <div className="fixed inset-0 z-55 bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center text-center p-6 text-white">
          <div className="relative w-24 h-24 mb-6 flex items-center justify-center">
            <div className="absolute inset-0 border-4 border-t-blue-500 border-r-transparent border-slate-800 rounded-full animate-spin"></div>
            <Send className="w-10 h-10 text-blue-400 animate-pulse" />
          </div>
          <h3 className="text-2xl font-bold font-display text-white mb-2">분류 결과 확정 중</h3>
          <p className="text-slate-400 text-sm max-w-md mb-4 font-sans leading-relaxed">
            분류된 민원을 담당 부서에 배부하고 있습니다...
          </p>
          <div className="flex flex-wrap gap-2 justify-center max-w-sm">
            {selectedDepts.map(d => (
              <span key={d} className="px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 text-xs font-semibold rounded-full text-blue-300">
                ✓ {d}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="flex items-center justify-center p-2.5 rounded-xl border border-slate-200 bg-white shadow-xs text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition"
          aria-label="대시보드로 돌아가기"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <span className="text-xs font-mono font-bold text-blue-600 uppercase tracking-widest block">
            파일 상세 내역
          </span>
          <h1 className="text-xl font-bold text-slate-900 font-display flex items-center gap-2">
            {file.name}
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch flex-1">

        <div className="lg:col-span-5 flex flex-col justify-between bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden h-[630px]">
          <div className="flex-1 flex flex-col min-h-0">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
              <button
                onClick={handleSelectAll}
                disabled={departSummaries.length === 0}
                className="text-slate-500 hover:text-slate-700 transition"
                aria-label="전체 부서 선택"
              >
                {isSelectAllChecked ? (
                  <CheckSquare className="w-5 h-5 text-blue-600" />
                ) : (
                  <Square className="w-5 h-5" />
                )}
              </button>
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                전체 부서 선택
              </span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {departSummaries.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">분류된 부서가 없습니다.</div>
              ) : (
                departSummaries.map((summary) => {
                  const isChecked = selectedDepts.includes(summary.name);
                  const isActive = activeDept === summary.name;
                  return (
                    <div
                      key={summary.departId}
                      onClick={() => setActiveDept(summary.name)}
                      className={`flex items-center justify-between px-6 py-3.5 cursor-pointer transition ${isActive ? "bg-slate-50" : "hover:bg-slate-50/50"}`}
                    >
                      <div className="flex items-center gap-3 min-w-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleDeptCheckboxToggle(summary.name)}
                          className="text-slate-400 hover:text-slate-600 transition"
                        >
                          {isChecked ? (
                            <CheckSquare className="w-5 h-5 text-blue-600" />
                          ) : (
                            <Square className="w-5 h-5" />
                          )}
                        </button>
                        <span className={`text-sm font-semibold truncate ${isActive ? "text-blue-700" : "text-slate-700"}`}>
                          {summary.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                          {summary.row} 건
                        </span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          summary.isChecked
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-600"
                        }`}>
                          {summary.isChecked ? "확인됨" : "대기 중"}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>

          <div className="p-4 border-t border-slate-100 bg-slate-50 bg-slate-100/55 flex items-center justify-end gap-3 shrink-0">
            <button
              onClick={handleCancelConfirm}
              disabled={isFinishing || !hasCheckedSelected}
              className="flex-1 px-4 py-2.5 text-xs font-semibold text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-slate-200 bg-white rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              확인 취소
            </button>
            <button
              onClick={handleConfirm}
              disabled={isFinishing || !hasPendingSelected}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition disabled:bg-blue-400 disabled:cursor-not-allowed"
            >
              {isFinishing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  처리 중...
                </>
              ) : (
                <>
                  <FolderCheck className="w-4 h-4" />
                  확인
                </>
              )}
            </button>
          </div>
        </div>

        <div className="lg:col-span-7 flex flex-col bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden h-[630px]">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800 tracking-tight font-display flex items-center gap-2">
              <span className="w-1.5 h-4 bg-blue-600 rounded-full block"></span>
              분류 민원 검토
            </h2>
            {activeDept && (
              <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full font-mono border border-blue-100/60 max-w-[200px] truncate">
                {activeDept}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {isLoadingComplaints ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mb-2" />
                <p className="text-xs">민원 불러오는 중...</p>
              </div>
            ) : activeDeptComplaints.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-400">
                <Info className="w-8 h-8 text-slate-350 stroke-[1.5] mb-2" />
                <p className="text-sm font-medium">왼쪽에서 부서를 선택하세요</p>
                <p className="text-xs text-slate-400 mt-1">해당 부서의 분류된 민원을 확인하세요</p>
              </div>
            ) : (
              activeDeptComplaints.map((c, idx) => (
                <div
                  key={idx}
                  className="p-5 rounded-xl border border-slate-150 bg-white shadow-2xs hover:border-blue-200 transition-all duration-300 relative group overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-600 opacity-60"></div>
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <h3 className="text-sm font-bold text-slate-800 font-display">{c.title}</h3>
                    <span className="font-mono text-[10px] font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                      {typeof c.code === "object" ? (c.code as any)?.text ?? (c.code as any)?.code : c.code}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                    {c.content}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
