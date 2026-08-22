export type Role = 'lecturer' | 'committee' | 'student' | 'admin';
export type CaseStatus = 'Reported' | 'Under Review' | 'Decided' | 'Under Appeal' | 'Resolved';
export type DecisionType = 'Warning' | 'Probation' | 'Semester Suspension' | 'Expulsion' | 'Cleared';
export type RegistrationStatus = 'Active' | 'Restricted' | 'Flagged';
export type AppealStatus = 'Pending' | 'Upheld' | 'Overturned';

export interface Note {
  id: string;
  author: string;
  text: string;
  timestamp: string;
}

export interface AuditEntry {
  action: string;
  by: string;
  timestamp: string;
}

export interface DisciplinaryCase {
  id: string;
  studentName: string;
  studentId: string;
  reportedBy: string;
  reporterDepartment: string;
  offenseType: string;
  description: string;
  evidence: string;
  evidenceFiles: string[];
  reportDate: string;
  status: CaseStatus;
  decision?: DecisionType;
  decisionDate?: string;
  suspensionStart?: string;
  suspensionEnd?: string;
  notes: Note[];
  auditTrail: AuditEntry[];
  appealSubmitted: boolean;
  appealText?: string;
  appealStatus?: AppealStatus;
  registrationStatus: RegistrationStatus;
}

export interface AppUser {
  id: string;
  name: string;
  role: Role;
  department?: string;
  studentId?: string;
  email: string;
  /** Deactivated accounts cannot sign in; used instead of deletion for staff who have cases. */
  active: boolean;
  /** Set when an admin created the account with a generated temporary password. */
  mustChangePassword: boolean;
  /** Absolute URL to the uploaded avatar, or undefined when the user has none. */
  profilePictureUrl?: string;
}

/** One entry in the admin audit feed, covering both case actions and user-management actions. */
export interface AuditFeedEntry {
  kind: 'CASE' | 'USER';
  id: number;
  action: string;
  by: string;
  timestamp: string;
  caseId?: string;
  targetUserId?: string;
  targetUserName?: string;
}

export interface CaseStats {
  total: number;
  reported: number;
  underReview: number;
  decided: number;
  underAppeal: number;
  resolved: number;
  open: number;
  flagged: number;
  restricted: number;
  activeSuspensions: number;
  expiredSuspensions: number;
  registrationHolds: number;
}

export interface UserStats {
  total: number;
  admin: number;
  committee: number;
  lecturer: number;
  student: number;
}

export interface MonthlyCaseCount {
  year: number;
  month: number;
  label: string;
  count: number;
}

/** What a hard delete of a user account would leave dangling. */
export interface UserImpact {
  casesReported: number;
  casesAsStudent: number;
  notesAuthored: number;
  isSelf: boolean;
}
