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
  password: string;
}

export const DEMO_USERS: AppUser[] = [
  { id: 'u1', name: 'Dr. Marie Claire Uwase', role: 'lecturer', department: 'Computer Science', email: 'mcuwase@auca.ac.rw', password: 'demo1234' },
  { id: 'u2', name: 'Dr. Emmanuel Kayitesi', role: 'committee', department: 'Disciplinary Committee (Chair)', email: 'ekayitesi@auca.ac.rw', password: 'demo1234' },
  { id: 'u3', name: 'Jean Bosco Habimana', role: 'student', studentId: '21045', email: 'jbhabimana@student.auca.ac.rw', password: 'demo1234' },
  { id: 'u4', name: 'Alice Mutoni', role: 'admin', department: 'Registrar Office', email: 'amutoni@auca.ac.rw', password: 'demo1234' },
];

export const INITIAL_CASES: DisciplinaryCase[] = [
  {
    id: 'CF-2026-001',
    studentName: 'Jean Bosco Habimana',
    studentId: '21045',
    reportedBy: 'Dr. Marie Claire Uwase',
    reporterDepartment: 'Computer Science',
    offenseType: 'Exam Cheating',
    description: 'Student was found in possession of unauthorized notes during the COMP301 Final Examination on June 5, 2026. The notes contained pre-written formulas and answers. The invigilator confiscated the material and submitted it as evidence.',
    evidence: 'Recovered cheat sheet (physical copy submitted), Invigilator written statement',
    reportDate: '2026-06-05',
    status: 'Under Review',
    notes: [
      { id: 'n1', author: 'Dr. Emmanuel Kayitesi', text: 'Evidence reviewed. The cheat sheet contains course-specific formulas clearly written in advance. Will proceed to full committee deliberation.', timestamp: '2026-06-08 10:30' },
      { id: 'n2', author: 'Dr. Amina Nziza', text: 'I concur with the Chair. Student should be given an opportunity to respond before a final decision is made.', timestamp: '2026-06-09 14:15' },
    ],
    auditTrail: [
      { action: 'Incident Reported', by: 'Dr. Marie Claire Uwase', timestamp: '2026-06-05 11:00' },
      { action: 'Case CF-2026-001 Created', by: 'System', timestamp: '2026-06-05 11:01' },
      { action: 'Committee Chair Notified', by: 'System', timestamp: '2026-06-05 11:01' },
      { action: 'Status set to: Under Review', by: 'Dr. Emmanuel Kayitesi', timestamp: '2026-06-08 09:00' },
      { action: 'Note Added', by: 'Dr. Emmanuel Kayitesi', timestamp: '2026-06-08 10:30' },
      { action: 'Note Added', by: 'Dr. Amina Nziza', timestamp: '2026-06-09 14:15' },
    ],
    appealSubmitted: false,
    registrationStatus: 'Flagged',
  },
  {
    id: 'CF-2026-002',
    studentName: 'Solange Ingabire',
    studentId: '22118',
    reportedBy: 'Prof. Patrick Nkurunziza',
    reporterDepartment: 'Business Administration',
    offenseType: 'Academic Plagiarism',
    description: 'Student submitted a final year project found to be 78% similar to a 2023 publication from a Kenyan university per Turnitin analysis. No attribution was included in the submitted work.',
    evidence: 'Turnitin report (78% similarity score), Original publication DOI reference',
    reportDate: '2026-05-20',
    status: 'Under Appeal',
    decision: 'Semester Suspension',
    decisionDate: '2026-06-01',
    suspensionStart: '2026-07-01',
    suspensionEnd: '2026-12-31',
    notes: [
      { id: 'n3', author: 'Dr. Emmanuel Kayitesi', text: 'Committee finds this a serious breach of academic integrity. Turnitin report is conclusive. Semester suspension imposed effective July 2026.', timestamp: '2026-05-28 09:00' },
    ],
    auditTrail: [
      { action: 'Incident Reported', by: 'Prof. Patrick Nkurunziza', timestamp: '2026-05-20 14:00' },
      { action: 'Case CF-2026-002 Created', by: 'System', timestamp: '2026-05-20 14:01' },
      { action: 'Status set to: Under Review', by: 'Dr. Emmanuel Kayitesi', timestamp: '2026-05-22 09:00' },
      { action: 'Decision Recorded: Semester Suspension', by: 'Dr. Emmanuel Kayitesi', timestamp: '2026-06-01 16:00' },
      { action: 'Registration Status: RESTRICTED', by: 'System', timestamp: '2026-06-01 16:01' },
      { action: 'Student Notified via Email', by: 'System', timestamp: '2026-06-01 16:02' },
      { action: 'Appeal Submitted by Student', by: 'Solange Ingabire', timestamp: '2026-06-10 11:00' },
      { action: 'Status set to: Under Appeal', by: 'System', timestamp: '2026-06-10 11:01' },
    ],
    appealSubmitted: true,
    appealText: 'I respectfully contest this decision. While I acknowledge some similarity in sections, I was not fully aware that reformatting published content without explicit attribution constituted plagiarism at this level. I request the committee to reconsider the severity of the sanction given that this is my first offense.',
    appealStatus: 'Pending',
    registrationStatus: 'Restricted',
  },
  {
    id: 'CF-2026-003',
    studentName: 'Eric Nshimiyimana',
    studentId: '20387',
    reportedBy: 'Dr. Grace Uwimana',
    reporterDepartment: 'Theology',
    offenseType: 'Disruptive Behavior',
    description: 'Student repeatedly disrupted a lecture on June 12, 2026, by shouting at the lecturer and refusing to leave the classroom when asked. Campus security was called to escort the student out of the building.',
    evidence: 'Security incident report, Written statements from 3 classmates',
    reportDate: '2026-06-12',
    status: 'Reported',
    notes: [],
    auditTrail: [
      { action: 'Incident Reported', by: 'Dr. Grace Uwimana', timestamp: '2026-06-12 15:30' },
      { action: 'Case CF-2026-003 Created', by: 'System', timestamp: '2026-06-12 15:31' },
      { action: 'Committee Chair Notified', by: 'System', timestamp: '2026-06-12 15:31' },
    ],
    appealSubmitted: false,
    registrationStatus: 'Flagged',
  },
  {
    id: 'CF-2025-047',
    studentName: 'Diane Mukamana',
    studentId: '19234',
    reportedBy: 'Dr. Samuel Bigirimana',
    reporterDepartment: 'Information Technology',
    offenseType: 'Exam Cheating',
    description: 'Student was found using a mobile phone during the INFT401 final exam. Forensic analysis of the phone revealed photographs of exam questions from a previous session, indicating premeditated intent.',
    evidence: 'Confiscated mobile phone (submitted for forensics), Invigilator report, Forensic analysis report',
    reportDate: '2025-11-15',
    status: 'Resolved',
    decision: 'Semester Suspension',
    decisionDate: '2025-11-30',
    suspensionStart: '2026-01-01',
    suspensionEnd: '2026-06-30',
    notes: [
      { id: 'n4', author: 'Dr. Emmanuel Kayitesi', text: 'Evidence is conclusive. Student admitted to the offense during hearing. One semester suspension imposed. Re-integration approved after suspension period ended.', timestamp: '2025-11-28 11:00' },
    ],
    auditTrail: [
      { action: 'Incident Reported', by: 'Dr. Samuel Bigirimana', timestamp: '2025-11-15 10:00' },
      { action: 'Case CF-2025-047 Created', by: 'System', timestamp: '2025-11-15 10:01' },
      { action: 'Status set to: Under Review', by: 'Dr. Emmanuel Kayitesi', timestamp: '2025-11-18 09:00' },
      { action: 'Decision Recorded: Semester Suspension', by: 'Dr. Emmanuel Kayitesi', timestamp: '2025-11-30 14:00' },
      { action: 'Registration Status: RESTRICTED', by: 'System', timestamp: '2025-11-30 14:01' },
      { action: 'Re-integration Approved', by: 'Dr. Emmanuel Kayitesi', timestamp: '2026-07-01 09:00' },
      { action: 'Registration Status: ACTIVE', by: 'System', timestamp: '2026-07-01 09:01' },
      { action: 'Case Closed', by: 'Alice Mutoni', timestamp: '2026-07-01 09:05' },
    ],
    appealSubmitted: false,
    registrationStatus: 'Active',
  },
  {
    id: 'CF-2026-004',
    studentName: 'Pacifique Ishimwe',
    studentId: '23012',
    reportedBy: 'Dr. Marie Claire Uwase',
    reporterDepartment: 'Computer Science',
    offenseType: 'Unauthorized Collaboration',
    description: 'Two students submitted identical programming assignments for COMP201. Source code comparison detected 97% similarity despite the assignment explicitly requiring independent work.',
    evidence: 'Source code comparison report (97% similarity), Assignment submission logs',
    reportDate: '2026-06-18',
    status: 'Reported',
    notes: [],
    auditTrail: [
      { action: 'Incident Reported', by: 'Dr. Marie Claire Uwase', timestamp: '2026-06-18 09:00' },
      { action: 'Case CF-2026-004 Created', by: 'System', timestamp: '2026-06-18 09:01' },
      { action: 'Committee Chair Notified', by: 'System', timestamp: '2026-06-18 09:01' },
    ],
    appealSubmitted: false,
    registrationStatus: 'Active',
  },
  {
    id: 'CF-2026-005',
    studentName: 'Claudine Uwera',
    studentId: '22456',
    reportedBy: 'Prof. Jean Claude Rugamba',
    reporterDepartment: 'Nursing',
    offenseType: 'Document Forgery',
    description: 'Student was found to have forged a clinical practicum attendance sheet, signing off on hours she did not complete. The supervising nurse reported the discrepancy after comparing the sheet with hospital records.',
    evidence: 'Forged attendance sheet, Hospital practicum records, Supervising nurse statement',
    reportDate: '2026-06-20',
    status: 'Decided',
    decision: 'Probation',
    decisionDate: '2026-06-25',
    notes: [
      { id: 'n5', author: 'Dr. Emmanuel Kayitesi', text: 'Given this is a first offense and student expressed remorse, committee decided on formal probation. Student must re-complete clinical hours under direct supervision.', timestamp: '2026-06-24 10:00' },
    ],
    auditTrail: [
      { action: 'Incident Reported', by: 'Prof. Jean Claude Rugamba', timestamp: '2026-06-20 08:30' },
      { action: 'Case CF-2026-005 Created', by: 'System', timestamp: '2026-06-20 08:31' },
      { action: 'Status set to: Under Review', by: 'Dr. Emmanuel Kayitesi', timestamp: '2026-06-21 09:00' },
      { action: 'Decision Recorded: Probation', by: 'Dr. Emmanuel Kayitesi', timestamp: '2026-06-25 14:00' },
      { action: 'Student Notified via Email', by: 'System', timestamp: '2026-06-25 14:01' },
    ],
    appealSubmitted: false,
    registrationStatus: 'Active',
  },
];
