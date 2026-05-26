/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { FileEntry, ComplaintEntry, DepartmentSummary, UNCLASSIFIED } from "../types";
import { ArrowLeft, CheckSquare, Square, FolderCheck, XSquare, Info, ShieldAlert, Loader2, Send } from "lucide-react";

interface DetailPageProps {
  file: FileEntry;
  onBack: () => void;
  onRefresh: () => void;
}

export default function DetailPage({ file, onBack, onRefresh }: DetailPageProps) {
  const [complaints, setComplaints] = useState<ComplaintEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [activeDept, setActiveDept] = useState<string | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const [showDispatchAnimation, setShowDispatchAnimation] = useState(false);

  // Load complaints for this file
  useEffect(() => {
    const fetchComplaints = async () => {
      try {
        const response = await fetch(`/api/complaints?fileId=${file.id}`);
        if (response.ok) {
          const data = await response.json();
          setComplaints(data);
          
          // Compute unique classified departments (excluding Unclassified for the main list, as requested)
          // Setup initial selected departments from the file's confirmed departments list
          setSelectedDepts(file.confirmedDepartments || []);
          
          // Auto-select the first department (non-unclassified) to display in the right panel
          const depts = Array.from(
            new Set(
              data
                .filter((c: ComplaintEntry) => c.department !== UNCLASSIFIED)
                .map((c: ComplaintEntry) => c.department)
            )
          ) as string[];
          
          if (depts.length > 0) {
            setActiveDept(depts[0]);
          }
        }
      } catch (err) {
        console.error("Failed to load complaints:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchComplaints();
  }, [file.id, file.confirmedDepartments]);

  // Group complaints by department
  const nonUnclassifiedComplaints = complaints.filter(c => c.department !== UNCLASSIFIED);
  const unclassifiedComplaints = complaints.filter(c => c.department === UNCLASSIFIED);

  // Group into department summary rows
  const deptMap: { [key: string]: number } = {};
  nonUnclassifiedComplaints.forEach(c => {
    deptMap[c.department] = (deptMap[c.department] || 0) + 1;
  });

  const departmentSummaries: DepartmentSummary[] = Object.keys(deptMap).map(dept => ({
    department: dept,
    count: deptMap[dept],
    status: file.confirmedDepartments.includes(dept) ? "Confirmed" : "Pending"
  }));

  const allDeptsList = departmentSummaries.map(s => s.department);

  // Select all checkbox handlers
  const isSelectAllChecked = departmentSummaries.length > 0 && selectedDepts.length === departmentSummaries.length;
  
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

  // Right panel complaints
  const activeDeptComplaints = activeDept 
    ? complaints.filter(c => c.department === activeDept)
    : [];

  // Confirm Final classification results
  const handleConfirm = async () => {
    setIsFinishing(true);
    try {
      const response = await fetch(`/api/files/${file.id}/confirm-departments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmedDepartments: selectedDepts }),
      });

      if (response.ok) {
        // Trigger a gorgeous success modal dispatching state
        setShowDispatchAnimation(true);
        setTimeout(() => {
          setShowDispatchAnimation(false);
          setIsFinishing(false);
          onRefresh(); // refresh the parent state info in dashboards
          onBack(); // go back to dashboard
        }, 3200);
      } else {
        setIsFinishing(false);
      }
    } catch (err) {
      console.error(err);
      setIsFinishing(false);
    }
  };

  // Cancel Confirm resets selections
  const handleCancelConfirm = async () => {
    setIsFinishing(true);
    try {
      const response = await fetch(`/api/files/${file.id}/reset`, {
        method: "POST",
      });

      if (response.ok) {
        setSelectedDepts([]);
        onRefresh();
        onBack();
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
      {/* Dispatching Animation Backdrop Overlay */}
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

      {/* Header bar */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="flex items-center justify-center p-2.5 rounded-xl border border-slate-200 bg-white shadow-xs text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition"
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <span className="text-xs font-mono font-bold text-blue-600 uppercase tracking-widest block">
            파일 상세 내역
          </span>
          <h1 className="text-xl font-bold text-slate-900 font-display flex items-center gap-2">
            {file.filename}
          </h1>
        </div>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch flex-1">
        
        {/* LEFT COLUMN: Department Classification List (span 5) */}
        <div className="lg:col-span-5 flex flex-col justify-between bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden h-[630px]">
          
          <div className="flex-1 flex flex-col min-h-0">
            {/* Header / Select All */}
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
              <button
                onClick={handleSelectAll}
                disabled={departmentSummaries.length === 0}
                className="text-slate-500 hover:text-slate-700 transition"
                aria-label="Select all departments"
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

            {/* Department List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {departmentSummaries.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  분류된 부서가 없습니다.
                </div>
              ) : (
                departmentSummaries.map((summary) => {
                  const isChecked = selectedDepts.includes(summary.department);
                  const isActive = activeDept === summary.department;
                  return (
                    <div
                      key={summary.department}
                      onClick={() => setActiveDept(summary.department)}
                      className={`flex items-center justify-between px-6 py-3.5 cursor-pointer transition ${
                        isActive
                          ? "bg-slate-50"
                          : "hover:bg-slate-50/50"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleDeptCheckboxToggle(summary.department)}
                          className="text-slate-400 hover:text-slate-600 transition"
                        >
                          {isChecked ? (
                            <CheckSquare className="w-5 h-5 text-blue-600" />
                          ) : (
                            <Square className="w-5 h-5" />
                          )}
                        </button>
                        <span className={`text-sm font-semibold truncate ${
                          isActive ? "text-blue-700" : "text-slate-700"
                        }`}>
                          {summary.department}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                          {summary.count} 건
                        </span>
                        
                        {/* Status tag */}
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          summary.status === "Confirmed"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-600"
                        }`}>
                          {summary.status === "Confirmed" ? "확인됨" : "대기 중"}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* UNCLASSIFIED COMPLAINTS: Fixed box at bottom of left column */}
            <div className="p-5 border-t border-slate-200 bg-slate-50/70">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 uppercase tracking-widest mb-3">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                미분류 민원함 (읽기 전용)
              </div>
              
              <div className="max-h-[130px] overflow-y-auto space-y-3 bg-white border border-slate-150 p-3 rounded-lg shadow-2xs">
                {unclassifiedComplaints.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">미분류 민원이 없습니다.</p>
                ) : (
                  unclassifiedComplaints.map((c, idx) => (
                    <div key={c.id} className="text-left border-b border-slate-100 last:border-b-0 pb-2 last:pb-0">
                      <h5 className="text-xs font-bold text-slate-800 font-display">
                        {idx + 1}. {c.title}
                      </h5>
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed text-wrap">
                        {c.content}
                      </p>
                      <span className="text-[9px] font-mono font-bold text-slate-400 mt-1 block">
                        코드: {c.complaintCode}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

          {/* ACTION BUTTONS PANEL: Fixed at the very bottom of the page container left column */}
          <div className="p-4 border-t border-slate-100 bg-slate-50 bg-slate-100/55 flex items-center justify-end gap-3 shrink-0">
            <button
              onClick={handleCancelConfirm}
              disabled={isFinishing}
              className="flex-1 px-4 py-2.5 text-xs font-semibold text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-slate-200 bg-white rounded-lg transition"
            >
              확인 취소
            </button>
            <button
              onClick={handleConfirm}
              disabled={isFinishing}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition disabled:bg-blue-400"
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

        {/* RIGHT COLUMN: Complaint Detail list panel (span 7) */}
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
            {activeDeptComplaints.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-400">
                <Info className="w-8 h-8 text-slate-350 stroke-[1.5] mb-2" />
                <p className="text-sm font-medium">왼쪽에서 부서를 선택하세요</p>
                <p className="text-xs text-slate-400 mt-1">해당 부서의 분류된 민원을 확인하세요</p>
              </div>
            ) : (
              activeDeptComplaints.map((c) => (
                <div
                  key={c.id}
                  className="p-5 rounded-xl border border-slate-150 bg-white shadow-2xs hover:border-blue-200 transition-all duration-300 relative group overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-600 opacity-60"></div>
                  
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <h3 className="text-sm font-bold text-slate-800 font-display">
                      {c.title}
                    </h3>
                    <span className="font-mono text-[10px] font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                      {c.complaintCode}
                    </span>
                  </div>
                  
                  <p className="text-xs text-slate-600 leading-relaxed text-wrap whitespace-pre-wrap">
                    {c.content}
                  </p>
                  
                  <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400 font-mono">
                    <span>접수: {c.createdAt}</span>
                    <span className={`font-bold px-1.5 py-0.5 rounded ${
                      c.status === "Confirmed" 
                        ? "bg-emerald-50 text-emerald-600" 
                        : "bg-slate-100 text-slate-500"
                    }`}>
                      {c.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
