/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { Send, CheckCircle2, AlertCircle, Loader2, XCircle } from "lucide-react";

interface ManualResult {
  success: boolean;
  department: string;
  complaintCode: string;
  failureReason: string | null;
}

export default function ManualProcessingPanel({ disabled = false }: { disabled?: boolean }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ManualResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const isProcessingRef = useRef(false);
  const pendingResultData = useRef<{ department: string; complaintCode: string } | null>(null);
  const lastSseData = useRef<{ departId: number; code: number; failureReason: string | null } | null>(null);

  const applyResult = (sseData: { departId: number; code: number; failureReason: string | null }, postData?: { department: string; complaintCode: string }) => {
    const stored = postData ?? pendingResultData.current;
    setResult({
      success: !sseData.failureReason,
      department: stored?.department || String(sseData.departId ?? ""),
      complaintCode: stored?.complaintCode || String(sseData.code ?? ""),
      failureReason: sseData.failureReason,
    });
    isProcessingRef.current = false;
    pendingResultData.current = null;
    lastSseData.current = null;
    setIsProcessing(false);
    setTitle("");
    setContent("");
  };

  useEffect(() => {
    const handler = (e: Event) => {
      if (!isProcessingRef.current) return;
      const raw = (e as CustomEvent).detail;
      const data = JSON.parse(raw) as {
        complaintId: string | number;
        departId: number;
        code: number;
        failureReason: string | null;
      };
      // POST 응답이 이미 왔으면 부서명/코드 포함해서 표시
      // 아직 안 왔으면 SSE 데이터만 표시 후 lastSseData에 저장
      if (pendingResultData.current) {
        applyResult(data);
      } else {
        lastSseData.current = data;
        setResult({
          success: !data.failureReason,
          department: "",
          complaintCode: "",
          failureReason: data.failureReason,
        });
        isProcessingRef.current = false;
        setIsProcessing(false);
        setTitle("");
        setContent("");
      }
    };

    window.addEventListener("complaint-sse", handler);
    return () => window.removeEventListener("complaint-sse", handler);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setErrorMsg("민원 제목과 민원 내용을 모두 입력해주세요.");
      return;
    }

    setErrorMsg("");
    isProcessingRef.current = true;
    setIsProcessing(true);
    setResult(null);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/complaints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });

      if (!response.ok) throw new Error("민원 처리에 실패했습니다.");

      const data = await response.json();

      const postResult = {
        department: data.department ?? "",
        complaintCode: data.complaintCode ?? "",
      };

      if (lastSseData.current) {
        // SSE가 먼저 왔으면 부서명/코드 업데이트
        setResult(prev => prev ? { ...prev, department: postResult.department, complaintCode: postResult.complaintCode } : prev);
        lastSseData.current = null;
      } else {
        pendingResultData.current = postResult;
      }

    } catch (err) {
      console.error(err);
      setErrorMsg("분류 서버 연결 중 오류가 발생했습니다.");
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
            disabled={isProcessing || disabled}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed rounded-lg shadow-xs transition"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                분류 중...
              </>
            ) : disabled ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                파일 분류 중...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                접수
              </>
            )}
          </button>
        </form>

        {result && (
          <div className={`mt-4 p-4 rounded-xl border space-y-3 ${
            result.success ? "border-blue-100 bg-blue-50/20" : "border-rose-100 bg-rose-50/20"
          }`}>
            <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
              {result.success
                ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                : <XCircle className="w-4 h-4 text-rose-500" />
              }
              배부 결과
            </h4>

            <div className="space-y-2">
              <div>
                <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wide">처리 상태</span>
                <span className={`text-sm font-semibold block ${result.success ? "text-slate-800" : "text-rose-600"}`}>
                  {result.success ? "처리 완료" : "처리 실패"}
                </span>
              </div>

              {result.success && (
                <div>
                  <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wide">배부 부서</span>
                  <span className="text-sm font-bold text-slate-900 block font-display">{result.department}</span>
                </div>
              )}

              <div>
                <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wide">민원 코드</span>
                <span className="text-xs font-mono font-bold text-blue-700 bg-blue-100/60 px-1.5 py-0.5 rounded block w-max">
                  {result.complaintCode}
                </span>
              </div>

              {result.failureReason && (
                <div>
                  <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wide">실패 사유</span>
                  <span className="text-xs text-rose-600 block">{result.failureReason}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
