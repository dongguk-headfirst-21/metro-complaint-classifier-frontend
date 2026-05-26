/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Send, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface ManualResult {
  success: boolean;
  department: string;
  complaintCode: string;
}

export default function ManualProcessingPanel() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ManualResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setErrorMsg("민원 제목과 민원 내용을 모두 입력해주세요.");
      return;
    }

    setErrorMsg("");
    setIsProcessing(true);
    setResult(null);

    try {
      const response = await fetch("/api/manual-complaint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });

      if (!response.ok) {
        throw new Error("민원 처리에 실패했습니다.");
      }

      const data = await response.json();
      setResult({
        success: data.success,
        department: data.department,
        complaintCode: data.complaintCode,
      });

      // Clear fields upon successful classification
      setTitle("");
      setContent("");
    } catch (err) {
      console.error(err);
      setErrorMsg("분류 서버 연결 중 오류가 발생했습니다.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs h-full flex flex-col overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
        <h2 className="text-sm font-semibold text-slate-800 tracking-tight font-display flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-600 block"></span>
          단건 민원 처리 패널
        </h2>
      </div>

      <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-600 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
              민원 제목
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예) 가로등 파손, 소음 민원..."
              disabled={isProcessing}
              className="w-full px-3 py-2 text-sm text-slate-800 placeholder-slate-400 bg-slate-50 hover:bg-slate-50/50 focus:bg-white border border-slate-200 focus:border-slate-300 focus:ring-1 focus:ring-slate-300 rounded-lg transition outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
              민원 내용
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              placeholder="민원 내용을 상세히 입력하시면 즉시 분석하여 담당 부서로 배부합니다."
              disabled={isProcessing}
              className="w-full px-3 py-2 text-sm text-slate-800 placeholder-slate-400 bg-slate-50 hover:bg-slate-50/50 focus:bg-white border border-slate-200 focus:border-slate-300 focus:ring-1 focus:ring-slate-300 rounded-lg transition outline-none resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={isProcessing}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg shadow-xs transition"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                처리 중...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                접수
              </>
            )}
          </button>
        </form>

        {/* Processing Results Area */}
        {result && (
          <div className="mt-4 p-4 rounded-xl border border-blue-100 bg-blue-50/20 space-y-3">
            <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-blue-100/55 pb-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              배부 결과
            </h4>

            {/* Crucial Order: success/fail status, assigned department name, unique complaint code */}
            <div className="space-y-2">
              <div>
                <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wide">
                  처리 상태
                </span>
                <span className="text-sm font-semibold text-slate-800 block">
                  {result.success ? "처리 완료" : "실패"}
                </span>
              </div>
              
              <div>
                <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wide">
                  배부 부서
                </span>
                <span className="text-sm font-bold text-slate-900 block font-display">
                  {result.department}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wide">
                  민원 코드
                </span>
                <span className="text-xs font-mono font-bold text-blue-700 bg-blue-100/60 px-1.5 py-0.5 rounded block w-max">
                  {result.complaintCode}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
