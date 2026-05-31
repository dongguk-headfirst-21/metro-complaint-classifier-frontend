/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { ComplaintEntry } from "./src/types.js";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));

interface ServerFile {
  id: string;
  name: string;
  capacity: number;
  uploadedAt: string;
  status: 'UPLOADING' | 'PENDING' | 'COMPLETED' | 'ERROR';
  complaintCount: number;
  confirmedDepartments: string[];
  totalDepartments: number;
}

function toApiFile(f: ServerFile) {
  return {
    id: f.id,
    name: f.name,
    capacity: f.capacity,
    uploadedAt: f.uploadedAt,
    status: f.status,
    complaintCount: f.complaintCount,
    checkedDepartCount: `${f.confirmedDepartments.length}/${f.totalDepartments}`
  };
}

// In-memory data store for files and complaints
let files: ServerFile[] = [];
let complaints: ComplaintEntry[] = [];

// Helper to generate a random 6-digit complaint code
function generateComplaintCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (aiClient) return aiClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    console.warn("GEMINI_API_KEY not set. Using rule-based fallback.");
    return null;
  }
  try {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } },
    });
    return aiClient;
  } catch (err) {
    console.error("Failed to initialize GoogleGenAI client:", err);
    return null;
  }
}

function fallbackClassifyText(title: string, content: string): string {
  const text = `${title} ${content}`;

  const rules = [
    {
      dept: "경영지원실 정보운영센터",
      keywords: ["앱", "홈페이지", "전산", "시스템", "Wi-Fi", "와이파이", "전광판", "정보", "모바일", "연동", "데이터", "오류", "장애", "CCTV 시스템"]
    },
    {
      dept: "영업본부 영업사업소",
      keywords: ["분실물", "불친절", "환불", "장애인", "노약자", "고객센터", "안내", "역무원", "유아차", "민원처리", "표지판", "역무실"]
    },
    {
      dept: "차량본부 차량사업소",
      keywords: ["좌석", "손잡이", "스크린도어", "냉방", "난방", "낙서", "음식물", "악취", "차량", "열차 내", "차내"]
    },
    {
      dept: "승무본부 승무사업소",
      keywords: ["지연", "배차", "급정차", "혼잡", "막차", "취소", "출발", "도착", "간격", "운행", "승무원", "취객", "위협"]
    },
    {
      dept: "기술본부 기계처",
      keywords: ["에스컬레이터", "엘리베이터", "누수", "조명", "발매기", "환기", "미끄러", "CCTV", "고장", "시설", "설비", "기계", "전기"]
    }
  ];

  for (const rule of rules) {
    if (rule.keywords.some(keyword => text.includes(keyword))) {
      return rule.dept;
    }
  }

  return "미분류";
}

// Generate fallback dummy complaints if the file uploaded has no parsed text
function generateFallbacksForFilename(_filename: string): Array<{ title: string; content: string; department: string }> {
  return [
    { title: "또타 앱 강제 종료", content: "서울교통공사 또타 앱이 열차 정보 조회 중 자주 강제 종료되어 이용에 불편합니다.", department: "경영지원실 정보운영센터" },
    { title: "홈페이지 접속 장애", content: "서울교통공사 공식 홈페이지가 업무 시간 중 자주 다운됩니다.", department: "경영지원실 정보운영센터" },
    { title: "역내 공공 Wi-Fi 불량", content: "지하철 역사 내 공공 와이파이가 자주 끊겨 이용이 어렵습니다.", department: "경영지원실 정보운영센터" },
    { title: "분실물 미처리", content: "열차 내에 지갑을 두고 내렸는데 분실물 센터에 문의해도 처리가 되지 않고 있습니다.", department: "영업본부 영업사업소" },
    { title: "역무원 불친절 응대", content: "역사 내 문의 사항을 물어봤더니 역무원이 무례하게 응대하였습니다.", department: "영업본부 영업사업소" },
    { title: "역사 화장실 청결 불량", content: "수원역 지하 화장실이 오염되어 있어 즉시 청소가 필요합니다.", department: "영업본부 영업사업소" },
    { title: "열차 냉방 고장", content: "운행 중인 2호선 열차 내 냉방이 작동하지 않아 매우 덥습니다.", department: "차량본부 차량사업소" },
    { title: "스크린도어 오작동", content: "잠실역 2호선 승강장 스크린도어가 제대로 열리지 않아 승객들이 불편을 겪습니다.", department: "차량본부 차량사업소" },
    { title: "열차 내 낙서 훼손", content: "4호선 열차 좌석 및 창문에 낙서가 심하게 되어 있어 미관을 해치고 있습니다.", department: "차량본부 차량사업소" },
    { title: "출근 시간대 열차 지연", content: "2호선 오전 출근 시간대에 자주 10분 이상 지연이 발생하여 직장인들에게 큰 불편을 주고 있습니다.", department: "승무본부 승무사업소" },
    { title: "열차 급정차", content: "5호선 열차가 역 사이 구간에서 갑자기 급정차하여 서 있던 승객이 넘어질 뻔했습니다.", department: "승무본부 승무사업소" },
    { title: "사전 공지 없는 운행 취소", content: "사전 공지 없이 열차가 갑자기 운행 취소되어 많은 승객이 불편을 겪었습니다.", department: "승무본부 승무사업소" },
    { title: "에스컬레이터 고장", content: "강남역 3번 출구 에스컬레이터가 이틀째 고장난 상태입니다. 노약자 승객이 이용하기 매우 불편합니다.", department: "기술본부 기계처" },
    { title: "역사 내 누수", content: "당산역 지하 통로 천장에서 누수가 발생하고 있어 바닥이 젖어 미끄럼 사고 위험이 있습니다.", department: "기술본부 기계처" },
    { title: "자동발매기 고장", content: "종로3가역 1번 출구 앞 자동발매기가 고장나 있어 교통카드 충전이 불가능합니다.", department: "기술본부 기계처" }
  ];
}

// Direct mock base data for testing
const SEED_FILES: ServerFile[] = [
  {
    id: "f1",
    name: "서울교통공사_민원목록_2026년5월.xlsx",
    capacity: 0.024,
    uploadedAt: "2026-05-26",
    status: "COMPLETED",
    confirmedDepartments: [],
    totalDepartments: 5,
    complaintCount: 51
  }
];

const SEED_COMPLAINTS: ComplaintEntry[] = [
  // 경영지원실 정보운영센터 (10건)
  { id: "c1",  fileId: "f1", title: "또타 앱 강제 종료", content: "서울교통공사 또타 앱이 열차 정보 조회 중 자주 강제 종료되어 이용에 큰 불편이 있습니다.", department: "경영지원실 정보운영센터", complaintCode: "492101", status: "Pending", createdAt: "2026-05-26 08:05:00" },
  { id: "c2",  fileId: "f1", title: "홈페이지 접속 장애", content: "서울교통공사 공식 홈페이지가 업무 시간 중 자주 다운되어 정보 조회가 불가능합니다.", department: "경영지원실 정보운영센터", complaintCode: "492102", status: "Pending", createdAt: "2026-05-26 08:10:00" },
  { id: "c3",  fileId: "f1", title: "역내 공공 Wi-Fi 불량", content: "지하철 역사 내 공공 와이파이가 자주 끊겨 업무용 데이터 이용에 불편합니다.", department: "경영지원실 정보운영센터", complaintCode: "492103", status: "Pending", createdAt: "2026-05-26 08:15:00" },
  { id: "c4",  fileId: "f1", title: "전광판 열차 도착 정보 오류", content: "승강장 전광판의 열차 도착 시간이 실제와 다르게 표시되어 승객이 혼란을 겪고 있습니다.", department: "경영지원실 정보운영센터", complaintCode: "492104", status: "Pending", createdAt: "2026-05-26 08:20:00" },
  { id: "c5",  fileId: "f1", title: "실시간 혼잡도 정보 부정확", content: "앱에 표시되는 실시간 혼잡도 정보가 실제 상황과 크게 달라 신뢰하기 어렵습니다.", department: "경영지원실 정보운영센터", complaintCode: "492105", status: "Pending", createdAt: "2026-05-26 08:25:00" },
  { id: "c6",  fileId: "f1", title: "모바일 교통카드 이중 결제", content: "모바일 교통카드 결제 후 요금이 이중으로 차감되는 오류가 발생하여 환불을 요청합니다.", department: "경영지원실 정보운영센터", complaintCode: "492106", status: "Pending", createdAt: "2026-05-26 08:30:00" },
  { id: "c7",  fileId: "f1", title: "자동 안내방송 시스템 오류", content: "역내 자동 안내방송 시스템이 잘못된 역명을 반복 안내하고 있습니다.", department: "경영지원실 정보운영센터", complaintCode: "492107", status: "Pending", createdAt: "2026-05-26 08:35:00" },
  { id: "c8",  fileId: "f1", title: "CCTV 영상 저장 오류", content: "CCTV 영상 저장 시스템에 오류가 발생하여 특정 구간 영상이 누락되고 있다고 합니다.", department: "경영지원실 정보운영센터", complaintCode: "492108", status: "Pending", createdAt: "2026-05-26 08:40:00" },
  { id: "c9",  fileId: "f1", title: "앱-발매기 연동 오류", content: "스마트폰 앱과 자동발매기 연동 시 오류가 빈번하게 발생하여 승차권 구매가 어렵습니다.", department: "경영지원실 정보운영센터", complaintCode: "492109", status: "Pending", createdAt: "2026-05-26 08:45:00" },
  { id: "c10", fileId: "f1", title: "민원 처리 시스템 미업데이트", content: "민원 처리 현황 시스템이 갱신되지 않아 처리 결과를 온라인으로 확인할 수 없습니다.", department: "경영지원실 정보운영센터", complaintCode: "492110", status: "Pending", createdAt: "2026-05-26 08:50:00" },
  // 영업본부 영업사업소 (10건)
  { id: "c11", fileId: "f1", title: "분실물 미처리", content: "열차 내에 지갑을 두고 내렸는데 분실물 센터에 문의해도 처리가 되지 않고 있습니다.", department: "영업본부 영업사업소", complaintCode: "492111", status: "Pending", createdAt: "2026-05-26 09:00:00" },
  { id: "c12", fileId: "f1", title: "역무원 불친절 응대", content: "역사 내 문의 사항을 물어봤더니 역무원이 무례하고 불친절하게 응대하였습니다.", department: "영업본부 영업사업소", complaintCode: "492112", status: "Pending", createdAt: "2026-05-26 09:05:00" },
  { id: "c13", fileId: "f1", title: "교통카드 환불 지연", content: "교통카드 환불 신청 후 2주가 지났음에도 처리가 완료되지 않았습니다.", department: "영업본부 영업사업소", complaintCode: "492113", status: "Pending", createdAt: "2026-05-26 09:10:00" },
  { id: "c14", fileId: "f1", title: "장애인 서비스 안내 부족", content: "휠체어 이용 승객을 위한 안내 및 서비스가 부족하여 이동에 불편함이 있습니다.", department: "영업본부 영업사업소", complaintCode: "492114", status: "Pending", createdAt: "2026-05-26 09:15:00" },
  { id: "c15", fileId: "f1", title: "노약자 좌석 배려 안내 미흡", content: "노약자 좌석 배려 안내가 부족하여 노인 승객이 서서 이동하는 경우가 많습니다.", department: "영업본부 영업사업소", complaintCode: "492115", status: "Pending", createdAt: "2026-05-26 09:20:00" },
  { id: "c16", fileId: "f1", title: "고객센터 연결 지연", content: "고객센터 전화 연결이 30분 이상 걸려 긴급 문의 시 도움을 받기 어렵습니다.", department: "영업본부 영업사업소", complaintCode: "492116", status: "Pending", createdAt: "2026-05-26 09:25:00" },
  { id: "c17", fileId: "f1", title: "환승 안내 표지판 부족", content: "대형 환승역에서 환승 안내 표지판이 부족하여 초행 승객이 길을 찾기 어렵습니다.", department: "영업본부 영업사업소", complaintCode: "492117", status: "Pending", createdAt: "2026-05-26 09:30:00" },
  { id: "c18", fileId: "f1", title: "역무실 장시간 공석", content: "역무실에 직원이 장시간 자리를 비워 도움이 필요한 승객이 응대를 받지 못하는 경우가 있습니다.", department: "영업본부 영업사업소", complaintCode: "492118", status: "Pending", createdAt: "2026-05-26 09:35:00" },
  { id: "c19", fileId: "f1", title: "역사 화장실 청결 불량", content: "수원역 지하 화장실이 심하게 오염되어 있어 이용하기 매우 불쾌합니다. 즉시 청소가 필요합니다.", department: "영업본부 영업사업소", complaintCode: "492119", status: "Pending", createdAt: "2026-05-26 09:40:00" },
  { id: "c20", fileId: "f1", title: "승강장 쓰레기 방치", content: "합정역 승강장에 쓰레기가 하루 종일 방치되어 있습니다. 청소 주기를 늘려주시기 바랍니다.", department: "영업본부 영업사업소", complaintCode: "492120", status: "Pending", createdAt: "2026-05-26 09:45:00" },
  // 차량본부 차량사업소 (10건)
  { id: "c21", fileId: "f1", title: "열차 냉방 고장", content: "운행 중인 2호선 열차 내 냉방이 작동하지 않아 한여름 매우 덥습니다.", department: "차량본부 차량사업소", complaintCode: "492121", status: "Pending", createdAt: "2026-05-26 10:00:00" },
  { id: "c22", fileId: "f1", title: "열차 좌석 파손", content: "5호선 열차 좌석 등받이가 부러져 있어 탑승 시 부상 위험이 있습니다.", department: "차량본부 차량사업소", complaintCode: "492122", status: "Pending", createdAt: "2026-05-26 10:05:00" },
  { id: "c23", fileId: "f1", title: "열차 손잡이 파손", content: "2호선 열차 손잡이 일부가 끊어져 있어 혼잡 시간대 승객 안전에 위협이 됩니다.", department: "차량본부 차량사업소", complaintCode: "492123", status: "Pending", createdAt: "2026-05-26 10:10:00" },
  { id: "c24", fileId: "f1", title: "스크린도어 오작동", content: "잠실역 2호선 승강장 스크린도어가 제대로 열리지 않아 승객들이 불편을 겪고 있습니다.", department: "차량본부 차량사업소", complaintCode: "492124", status: "Pending", createdAt: "2026-05-26 10:15:00" },
  { id: "c25", fileId: "f1", title: "열차 내 악취 발생", content: "특정 열차 칸에서 심한 악취가 지속적으로 발생하여 탑승 환경이 매우 불쾌합니다.", department: "차량본부 차량사업소", complaintCode: "492125", status: "Pending", createdAt: "2026-05-26 10:20:00" },
  { id: "c26", fileId: "f1", title: "열차 내 낙서 훼손", content: "4호선 열차 좌석 및 창문에 낙서가 심하게 되어 있어 미관을 심각하게 해치고 있습니다.", department: "차량본부 차량사업소", complaintCode: "492126", status: "Pending", createdAt: "2026-05-26 10:25:00" },
  { id: "c27", fileId: "f1", title: "열차 내 음식물 냄새", content: "분당선 열차 내에서 음식물 냄새가 심하여 탑승 환경이 불쾌합니다. 음식물 섭취 금지 안내 강화가 필요합니다.", department: "차량본부 차량사업소", complaintCode: "492127", status: "Pending", createdAt: "2026-05-26 10:30:00" },
  { id: "c28", fileId: "f1", title: "열차 난방 불량", content: "겨울철 운행 중인 열차 내 난방이 작동하지 않아 매우 춥습니다.", department: "차량본부 차량사업소", complaintCode: "492128", status: "Pending", createdAt: "2026-05-26 10:35:00" },
  { id: "c29", fileId: "f1", title: "열차 내 조명 불량", content: "1호선 열차 내 조명 일부가 꺼져 있어 어두워 불편합니다.", department: "차량본부 차량사업소", complaintCode: "492129", status: "Pending", createdAt: "2026-05-26 10:40:00" },
  { id: "c30", fileId: "f1", title: "차량 내 안내방송 불량", content: "열차 내 안내방송 볼륨이 너무 낮아 정거장 이름을 듣기 어렵습니다.", department: "차량본부 차량사업소", complaintCode: "492130", status: "Pending", createdAt: "2026-05-26 10:45:00" },
  // 승무본부 승무사업소 (10건)
  { id: "c31", fileId: "f1", title: "출근 시간대 열차 지연", content: "2호선 오전 출근 시간대에 자주 10분 이상 지연이 발생하여 직장인들에게 큰 불편을 주고 있습니다.", department: "승무본부 승무사업소", complaintCode: "492131", status: "Pending", createdAt: "2026-05-26 11:00:00" },
  { id: "c32", fileId: "f1", title: "9호선 배차 간격 과다", content: "9호선 급행 배차 간격이 너무 넓어 승강장에서 장시간 대기해야 합니다. 배차 확대가 필요합니다.", department: "승무본부 승무사업소", complaintCode: "492132", status: "Pending", createdAt: "2026-05-26 11:05:00" },
  { id: "c33", fileId: "f1", title: "열차 급정차", content: "5호선 열차가 역 사이 구간에서 갑자기 급정차하여 서 있던 승객이 넘어질 뻔했습니다.", department: "승무본부 승무사업소", complaintCode: "492133", status: "Pending", createdAt: "2026-05-26 11:10:00" },
  { id: "c34", fileId: "f1", title: "출퇴근 열차 극심한 혼잡", content: "출퇴근 시간대 1호선 열차가 너무 혼잡하여 도저히 탑승이 불가능한 상황입니다. 증차가 필요합니다.", department: "승무본부 승무사업소", complaintCode: "492134", status: "Pending", createdAt: "2026-05-26 11:15:00" },
  { id: "c35", fileId: "f1", title: "막차 시간 이른 문제", content: "3호선 막차 시간이 너무 일러서 심야 시간대 귀가가 매우 불편합니다.", department: "승무본부 승무사업소", complaintCode: "492135", status: "Pending", createdAt: "2026-05-26 11:20:00" },
  { id: "c36", fileId: "f1", title: "사전 공지 없는 운행 취소", content: "사전 공지 없이 열차가 갑자기 운행 취소되어 많은 승객이 불편을 겪었습니다.", department: "승무본부 승무사업소", complaintCode: "492136", status: "Pending", createdAt: "2026-05-26 11:25:00" },
  { id: "c37", fileId: "f1", title: "환승역 연결 열차 지연", content: "특정 역에서 환승 열차 출발이 지연되어 다음 연결 열차를 자주 놓치고 있습니다.", department: "승무본부 승무사업소", complaintCode: "492137", status: "Pending", createdAt: "2026-05-26 11:30:00" },
  { id: "c38", fileId: "f1", title: "열차 도착 간격 불규칙", content: "7호선 열차 도착 간격이 불규칙하여 승강장에서 예측 없이 오래 기다리는 경우가 많습니다.", department: "승무본부 승무사업소", complaintCode: "492138", status: "Pending", createdAt: "2026-05-26 11:35:00" },
  { id: "c39", fileId: "f1", title: "취객 승객 미조치", content: "2호선 열차에서 취객이 소란을 피우는데 승무원이 아무 조치를 취하지 않아 불안했습니다.", department: "승무본부 승무사업소", complaintCode: "492139", status: "Pending", createdAt: "2026-05-26 11:40:00" },
  { id: "c40", fileId: "f1", title: "위협 행위 승무원 미대응", content: "열차 내 위협 행위가 있었으나 승무원이 대응하지 않아 승객들이 불안감을 느꼈습니다.", department: "승무본부 승무사업소", complaintCode: "492140", status: "Pending", createdAt: "2026-05-26 11:45:00" },
  // 기술본부 기계처 (10건)
  { id: "c41", fileId: "f1", title: "에스컬레이터 고장", content: "강남역 3번 출구 에스컬레이터가 이틀째 고장난 상태입니다. 노약자 및 장애인 승객이 이용하기 매우 불편합니다.", department: "기술본부 기계처", complaintCode: "492141", status: "Pending", createdAt: "2026-05-26 12:00:00" },
  { id: "c42", fileId: "f1", title: "엘리베이터 작동 불량", content: "홍대입구역 1번 출구 엘리베이터가 자주 멈추고 있습니다. 긴급 점검이 필요합니다.", department: "기술본부 기계처", complaintCode: "492142", status: "Pending", createdAt: "2026-05-26 12:05:00" },
  { id: "c43", fileId: "f1", title: "역사 내 누수", content: "당산역 지하 통로 천장에서 누수가 발생하고 있어 바닥이 젖어 미끄럼 사고 위험이 있습니다.", department: "기술본부 기계처", complaintCode: "492143", status: "Pending", createdAt: "2026-05-26 12:10:00" },
  { id: "c44", fileId: "f1", title: "역내 조명 불량", content: "천호역 지하 통로 조명 여러 개가 꺼져 있어 통로가 어둡습니다. 조속한 교체가 필요합니다.", department: "기술본부 기계처", complaintCode: "492144", status: "Pending", createdAt: "2026-05-26 12:15:00" },
  { id: "c45", fileId: "f1", title: "자동발매기 고장", content: "종로3가역 1번 출구 앞 자동발매기가 고장나 있어 교통카드 충전이 불가능합니다.", department: "기술본부 기계처", complaintCode: "492145", status: "Pending", createdAt: "2026-05-26 12:20:00" },
  { id: "c46", fileId: "f1", title: "역사 냉방 시설 미흡", content: "신촌역 대합실 냉방 시스템이 작동하지 않아 한여름 역사 내부가 매우 덥습니다.", department: "기술본부 기계처", complaintCode: "492146", status: "Pending", createdAt: "2026-05-26 12:25:00" },
  { id: "c47", fileId: "f1", title: "역사 난방 불량", content: "동대문역 대합실 난방이 작동하지 않아 겨울철 역사 내부가 매우 춥습니다.", department: "기술본부 기계처", complaintCode: "492147", status: "Pending", createdAt: "2026-05-26 12:30:00" },
  { id: "c48", fileId: "f1", title: "미끄러운 역사 바닥", content: "비가 오는 날 신림역 입구 바닥이 매우 미끄러워 노약자 낙상 사고 위험이 높습니다.", department: "기술본부 기계처", complaintCode: "492148", status: "Pending", createdAt: "2026-05-26 12:35:00" },
  { id: "c49", fileId: "f1", title: "역사 환기 불량", content: "녹사평역 지하 통로 환기가 잘 되지 않아 공기가 탁하고 두통이 유발됩니다.", department: "기술본부 기계처", complaintCode: "492149", status: "Pending", createdAt: "2026-05-26 12:40:00" },
  { id: "c50", fileId: "f1", title: "역내 CCTV 하드웨어 고장", content: "구로역 승강장 CCTV 카메라 3대가 물리적으로 고장나 사각지대가 발생하고 있습니다.", department: "기술본부 기계처", complaintCode: "492150", status: "Pending", createdAt: "2026-05-26 12:45:00" },
  // 미분류 (1건)
  { id: "c51", fileId: "f1", title: "기타 건의사항", content: "역사 내 편의점 입점을 요청합니다. 출퇴근 시 간단한 물품 구매가 가능하면 좋겠습니다.", department: "미분류", complaintCode: "492151", status: "Pending", createdAt: "2026-05-26 13:00:00" }
];

files = [...SEED_FILES];
complaints = [...SEED_COMPLAINTS];

// --- API ROUTES ---

// List files
app.get("/api/v1/files", (_req, res) => {
  res.json({ files: files.map(toApiFile) });
});

// File detail — department summaries
app.get("/api/v1/files/:fileId", (req, res) => {
  const { fileId } = req.params;
  const file = files.find(f => f.id === fileId);
  if (!file) {
    return res.status(404).json({ success: false, message: "파일을 찾을 수 없습니다." });
  }

  const fileComplaints = complaints.filter(c => c.fileId === fileId && c.department !== "미분류");

  const deptMap: { [dept: string]: number } = {};
  fileComplaints.forEach(c => {
    deptMap[c.department] = (deptMap[c.department] || 0) + 1;
  });

  const departs = Object.keys(deptMap).map((dept, idx) => ({
    departId: `dept_${idx + 1}`,
    name: dept,
    row: deptMap[dept],
    isChecked: file.confirmedDepartments.includes(dept)
  }));

  res.json({ departs });
});

app.get("/api/complaints", (req, res) => {
  const { fileId } = req.query;
  if (fileId) {
    res.json(complaints.filter(c => c.fileId === fileId));
  } else {
    res.json(complaints);
  }
});

app.delete("/api/files/:id", (req, res) => {
  const fileId = req.params.id;
  files = files.filter(f => f.id !== fileId);
  complaints = complaints.filter(c => c.fileId !== fileId);
  res.json({ success: true, message: `File ${fileId} deleted.` });
});

app.post("/api/v1/complaints", async (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) {
    return res.status(400).json({ success: false, message: "제목과 내용이 필요합니다." });
  }

  const ai = getGeminiClient();
  let assignedDept = "미분류";

  if (ai) {
    try {
      const prompt = `다음 지하철 민원을 분류하세요.
      제목: "${title}"
      내용: "${content}"

      아래 부서 중 가장 적합한 하나를 선택하세요:
      - 경영지원실 정보운영센터
      - 영업본부 영업사업소
      - 차량본부 차량사업소
      - 승무본부 승무사업소
      - 기술본부 기계처
      - 미분류

      부서명만 텍스트로 응답하세요.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt
      });

      const resText = response.text ? response.text.trim() : "";
      const validDepts = [
        "경영지원실 정보운영센터",
        "영업본부 영업사업소",
        "차량본부 차량사업소",
        "승무본부 승무사업소",
        "기술본부 기계처",
        "미분류"
      ];
      const match = validDepts.find(d => resText.includes(d));
      assignedDept = match || "미분류";
    } catch (err) {
      console.error("Gemini manual classification failed, falling back:", err);
      assignedDept = fallbackClassifyText(title, content);
    }
  } else {
    assignedDept = fallbackClassifyText(title, content);
  }

  const newCode = generateComplaintCode();
  const success = assignedDept !== "미분류";

  const newComplaint: ComplaintEntry = {
    id: `c_manual_${Date.now()}`,
    fileId: null,
    title,
    content,
    department: assignedDept,
    complaintCode: newCode,
    status: "Confirmed",
    createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19)
  };

  complaints.push(newComplaint);

  res.json({
    complaintId: newComplaint.id,
    success,
    department: assignedDept,
    complaintCode: newCode
  });
});

app.post("/api/upload-file", async (req, res) => {
  const { filename, size, textContent } = req.body;
  if (!filename) {
    return res.status(400).json({ success: false, message: "파일명이 필요합니다." });
  }

  const fileId = `f_${Date.now()}`;
  let parsedComplaints: Array<{ title: string; content: string; department: string }> = [];

  const ai = getGeminiClient();

  if (ai && textContent && textContent.trim().length > 30) {
    try {
      const prompt = `당신은 지하철 민원 파일 파서입니다. 아래 텍스트에서 개별 민원을 추출하고 분류하세요.
      각 민원에 대해 다음을 추출하세요:
      1. 간결한 제목
      2. 민원 내용 전체
      3. 아래 부서 중 정확히 하나를 선택:
         - 경영지원실 정보운영센터
         - 영업본부 영업사업소
         - 차량본부 차량사업소
         - 승무본부 승무사업소
         - 기술본부 기계처
         - 미분류

      파일 내용:
      ${textContent}

      가능한 많은 민원을 추출하세요. 일반적으로 텍스트 크기에 따라 2~6개의 민원이 있습니다.`;

      const schema = {
        type: Type.OBJECT,
        properties: {
          complaints: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                content: { type: Type.STRING },
                department: {
                  type: Type.STRING,
                  description: "반드시 다음 중 하나여야 합니다: '경영지원실 정보운영센터', '영업본부 영업사업소', '차량본부 차량사업소', '승무본부 승무사업소', '기술본부 기계처', '미분류'"
                }
              },
              required: ["title", "content", "department"]
            }
          }
        },
        required: ["complaints"]
      };

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: schema
        }
      });

      const resText = response.text ? response.text.trim() : "";
      const parsed = JSON.parse(resText);
      if (parsed && Array.isArray(parsed.complaints)) {
        parsedComplaints = parsed.complaints;
      }
    } catch (err) {
      console.error("Gemini bulk file parsing failed, falling back:", err);
    }
  }

  if (parsedComplaints.length === 0 && textContent && textContent.trim().length > 10) {
    const blocks = textContent.split(/\n\s*\n/).filter((b: string) => b.trim().length > 10);
    if (blocks.length > 0) {
      parsedComplaints = blocks.map((block: string, idx: number) => {
        const lines = block.split("\n").map((l: string) => l.trim()).filter(Boolean);
        const title = lines[0] ? (lines[0].length > 60 ? lines[0].substring(0, 57) + "..." : lines[0]) : `민원 #${idx + 1}`;
        const department = fallbackClassifyText(title, block);
        return { title, content: block, department };
      });
    }
  }

  if (parsedComplaints.length === 0) {
    parsedComplaints = generateFallbacksForFilename(filename);
  }

  const processedComplaints: ComplaintEntry[] = parsedComplaints.map((pc, idx) => ({
    id: `c_${fileId}_${idx}`,
    fileId,
    title: pc.title,
    content: pc.content,
    department: pc.department,
    complaintCode: generateComplaintCode(),
    status: "Pending",
    createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19)
  }));

  complaints.push(...processedComplaints);

  const uniqueDepts = Array.from(new Set(processedComplaints.map(c => c.department)));

  const newFileEntry: ServerFile = {
    id: fileId,
    name: filename,
    capacity: parseFloat(((size || 1024) / (1024 * 1024)).toFixed(3)),
    uploadedAt: new Date().toISOString().substring(0, 10),
    status: "COMPLETED",
    confirmedDepartments: [],
    totalDepartments: uniqueDepts.length,
    complaintCount: processedComplaints.length
  };

  files.push(newFileEntry);

  res.json({
    success: true,
    file: toApiFile(newFileEntry),
    complaints: processedComplaints
  });
});

app.post("/api/files/:id/confirm-departments", (req, res) => {
  const fileId = req.params.id;
  const { confirmedDepartments } = req.body;

  const file = files.find(f => f.id === fileId);
  if (!file) {
    return res.status(404).json({ success: false, message: "파일을 찾을 수 없습니다." });
  }

  file.confirmedDepartments = confirmedDepartments || [];

  complaints.forEach(c => {
    if (c.fileId === fileId) {
      c.status = confirmedDepartments.includes(c.department) ? "Confirmed" : "Pending";
    }
  });

  res.json({ success: true, file: toApiFile(file) });
});

app.post("/api/files/:id/reset", (req, res) => {
  const fileId = req.params.id;
  const file = files.find(f => f.id === fileId);
  if (!file) {
    return res.status(404).json({ success: false, message: "파일을 찾을 수 없습니다." });
  }

  file.confirmedDepartments = [];
  complaints.forEach(c => {
    if (c.fileId === fileId) c.status = "Pending";
  });

  res.json({ success: true, file: toApiFile(file) });
});

// --- SERVER SETUP ---

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server starting on port ${PORT}`);
  });
}

startServer();
