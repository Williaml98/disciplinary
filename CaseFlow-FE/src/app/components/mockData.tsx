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
}
