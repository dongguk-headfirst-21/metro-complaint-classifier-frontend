/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface FileEntry {
  id: string;
  name: string;
  capacity: number; // in MB
  uploadedAt: string; // YYYY-MM-DD
  status: 'UPLOADING' | 'PENDING' | 'COMPLETED' | 'ERROR';
  checkedDepartCount: string; // e.g. "1/3"
  complaintCount: number;
}

export interface ComplaintEntry {
  id: string;
  fileId: string | null; // null for manual complaints
  title: string;
  content: string;
  department: string; // e.g. 'Transportation & Roads', 'Environmental Health', etc.
  complaintCode: string; // unique system code e.g. COMP-1029481
  status: 'Pending' | 'Confirmed';
  createdAt: string;
}

export interface DepartmentSummary {
  department: string;
  count: number;
  status: 'Confirmed' | 'Pending';
}

export const DEPARTMENTS = [
  'Transportation & Roads',
  'Environmental Health',
  'Housing & Building Safety',
  'Public Safety & Policing',
  'Parks & Recreation',
  'Social Services',
  'Finance & Taxation'
];

export const UNCLASSIFIED = 'Unclassified';
