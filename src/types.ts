/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface FileEntry {
  id: string;
  filename: string;
  size: number; // in bytes
  uploadTimestamp: string;
  status: 'Uploading' | 'Classifying' | 'Classification Complete';
  confirmedDepartments: string[]; // names of departments that are confirmed
  totalDepartments: number; // total unique departments (including Unclassified, or as classified)
  totalComplaints: number;
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
