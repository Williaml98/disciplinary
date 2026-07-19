import { API_BASE_URL } from '../config';
import type {
  AppUser,
  DisciplinaryCase,
  Note,
  AuditEntry,
  Role,
  CaseStatus,
  DecisionType,
  RegistrationStatus,
  AppealStatus,
} from '../app/components/mockData';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      if (body?.message) message = body.message;
    } catch {
      // response had no JSON body
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ---- Wire shapes (raw JSON as returned by CaseFlow-BE) ----
interface UserDto {
  id: number;
  name: string;
  role: Role;
  department: string | null;
  studentId: string | null;
  email: string;
}

interface NoteDto {
  id: number;
  author: string;
  text: string;
  timestamp: string;
}

interface AuditEntryDto {
  id: number;
  action: string;
  by: string;
  timestamp: string;
}

interface CaseDto {
  id: string;
  studentName: string;
  studentId: string;
  reportedBy: string;
  reporterDepartment: string | null;
  offenseType: string;
  description: string;
  evidence: string;
  reportDate: string;
  status: CaseStatus;
  decision: DecisionType | null;
  decisionDate: string | null;
  suspensionStart: string | null;
  suspensionEnd: string | null;
  appealSubmitted: boolean;
  appealText: string | null;
  appealStatus: AppealStatus | null;
  registrationStatus: RegistrationStatus;
  notes: NoteDto[];
  auditTrail: AuditEntryDto[];
}

// BE timestamps are ISO instants; the FE displays them as "YYYY-MM-DD HH:MM" everywhere.
function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function mapUser(dto: UserDto): AppUser {
  return {
    id: String(dto.id),
    name: dto.name,
    role: dto.role,
    department: dto.department ?? undefined,
    studentId: dto.studentId ?? undefined,
    email: dto.email,
  };
}

function mapNote(dto: NoteDto): Note {
  return { id: String(dto.id), author: dto.author, text: dto.text, timestamp: formatTimestamp(dto.timestamp) };
}

function mapAuditEntry(dto: AuditEntryDto): AuditEntry {
  return { action: dto.action, by: dto.by, timestamp: formatTimestamp(dto.timestamp) };
}

function mapCase(dto: CaseDto): DisciplinaryCase {
  return {
    id: dto.id,
    studentName: dto.studentName,
    studentId: dto.studentId,
    reportedBy: dto.reportedBy,
    reporterDepartment: dto.reporterDepartment ?? '',
    offenseType: dto.offenseType,
    description: dto.description,
    evidence: dto.evidence,
    reportDate: dto.reportDate,
    status: dto.status,
    decision: dto.decision ?? undefined,
    decisionDate: dto.decisionDate ?? undefined,
    suspensionStart: dto.suspensionStart ?? undefined,
    suspensionEnd: dto.suspensionEnd ?? undefined,
    notes: dto.notes.map(mapNote),
    auditTrail: dto.auditTrail.map(mapAuditEntry),
    appealSubmitted: dto.appealSubmitted,
    appealText: dto.appealText ?? undefined,
    appealStatus: dto.appealStatus ?? undefined,
    registrationStatus: dto.registrationStatus,
  };
}

// ---- Auth ----
export async function login(email: string, password: string): Promise<AppUser> {
  return mapUser(await request<UserDto>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }));
}

export async function register(payload: {
  name: string;
  studentId: string;
  email: string;
  password: string;
}): Promise<AppUser> {
  return mapUser(await request<UserDto>('/auth/register', { method: 'POST', body: JSON.stringify(payload) }));
}

// ---- Users ----
export async function fetchUsers(): Promise<AppUser[]> {
  return (await request<UserDto[]>('/users')).map(mapUser);
}

export async function createUser(payload: {
  name: string;
  role: Role;
  department?: string;
  studentId?: string;
  email: string;
  password: string;
}): Promise<AppUser> {
  return mapUser(await request<UserDto>('/users', { method: 'POST', body: JSON.stringify(payload) }));
}

export async function updateUserProfile(id: string, payload: {
  name: string;
  email: string;
  department?: string;
  studentId?: string;
}): Promise<AppUser> {
  return mapUser(await request<UserDto>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }));
}

export async function updateUserRole(id: string, role: Role): Promise<AppUser> {
  return mapUser(await request<UserDto>(`/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }));
}

export async function changePassword(id: string, currentPassword: string, newPassword: string): Promise<void> {
  await request<UserDto>(`/users/${id}/password`, {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export async function deleteUser(id: string): Promise<void> {
  await request<void>(`/users/${id}`, { method: 'DELETE' });
}

// ---- Cases ----
export async function fetchCases(): Promise<DisciplinaryCase[]> {
  return (await request<CaseDto[]>('/cases')).map(mapCase);
}

export async function reportCase(payload: {
  studentName: string;
  studentId: string;
  reportedBy: string;
  reporterDepartment: string;
  offenseType: string;
  description: string;
  evidence: string;
}): Promise<DisciplinaryCase> {
  return mapCase(await request<CaseDto>('/cases', { method: 'POST', body: JSON.stringify(payload) }));
}

export async function addCaseNote(caseId: string, author: string, text: string): Promise<DisciplinaryCase> {
  return mapCase(
    await request<CaseDto>(`/cases/${caseId}/notes`, { method: 'POST', body: JSON.stringify({ author, text }) }),
  );
}

export async function recordDecision(caseId: string, payload: {
  decision: DecisionType;
  suspensionStart?: string;
  suspensionEnd?: string;
  by: string;
}): Promise<DisciplinaryCase> {
  return mapCase(await request<CaseDto>(`/cases/${caseId}/decision`, { method: 'POST', body: JSON.stringify(payload) }));
}

export async function submitAppeal(caseId: string, appealText: string): Promise<DisciplinaryCase> {
  return mapCase(
    await request<CaseDto>(`/cases/${caseId}/appeal`, { method: 'POST', body: JSON.stringify({ appealText }) }),
  );
}

export async function resolveAppeal(caseId: string, resolution: AppealStatus, by: string): Promise<DisciplinaryCase> {
  return mapCase(
    await request<CaseDto>(`/cases/${caseId}/appeal/resolution`, {
      method: 'POST',
      body: JSON.stringify({ resolution, by }),
    }),
  );
}

export async function approveReintegration(caseId: string, by: string): Promise<DisciplinaryCase> {
  return mapCase(
    await request<CaseDto>(`/cases/${caseId}/reintegration`, { method: 'POST', body: JSON.stringify({ by }) }),
  );
}
