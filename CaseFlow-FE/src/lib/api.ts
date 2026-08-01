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

// ---- Token storage ----
// "Remember me" -> localStorage (survives browser restart); otherwise sessionStorage
// (cleared when the tab closes). Never both at once.
const TOKEN_KEY = 'caseflow.token';

function getStoredToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(TOKEN_KEY);
}

export function hasStoredToken(): boolean {
  return getStoredToken() !== null;
}

function storeToken(token: string, remember: boolean): void {
  if (remember) {
    localStorage.setItem(TOKEN_KEY, token);
    sessionStorage.removeItem(TOKEN_KEY);
  } else {
    sessionStorage.setItem(TOKEN_KEY, token);
    localStorage.removeItem(TOKEN_KEY);
  }
}

function clearToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

export function logout(): void {
  clearToken();
}

// Called by App.tsx so an expired/invalid token bounces the user back to the login screen
// the moment any authenticated request comes back 401, rather than only on next reload.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

function authHeader(): Record<string, string> {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...authHeader(), ...options.headers },
  });

  if (res.status === 401 && path !== '/auth/login') {
    clearToken();
    onUnauthorized?.();
  }

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

interface AuthDto {
  token: string;
  user: UserDto;
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
  evidenceFiles: string[];
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
    evidenceFiles: dto.evidenceFiles.map(f => `${API_BASE_URL}${f}`),
  };
}

// ---- Auth ----
export async function login(email: string, password: string, remember: boolean): Promise<AppUser> {
  const { token, user } = await request<AuthDto>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, remember }),
  });
  storeToken(token, remember);
  return mapUser(user);
}

export async function sendRegistrationOtp(email: string): Promise<void> {
  await request<void>('/auth/register/otp', { method: 'POST', body: JSON.stringify({ email }) });
}

export async function verifyRegistrationOtp(email: string, otp: string): Promise<void> {
  await request<void>('/auth/register/otp/verify', { method: 'POST', body: JSON.stringify({ email, otp }) });
}

export async function register(payload: {
  name: string;
  studentId: string;
  email: string;
  password: string;
  otp: string;
}): Promise<AppUser> {
  const { token, user } = await request<AuthDto>('/auth/register', { method: 'POST', body: JSON.stringify(payload) });
  storeToken(token, false);
  return mapUser(user);
}

export async function fetchCurrentUser(): Promise<AppUser> {
  return mapUser(await request<UserDto>('/auth/me'));
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

export async function uploadEvidence(caseId: string, files: File[], by?: string): Promise<DisciplinaryCase> {
  const body = new FormData();
  files.forEach(file => body.append('files', file));
  if (by) body.append('by', by);

  const res = await fetch(`${API_BASE_URL}/cases/${caseId}/evidence`, { method: 'POST', headers: authHeader(), body });
  if (res.status === 401) {
    clearToken();
    onUnauthorized?.();
  }
  if (!res.ok) {
    let message = res.statusText;
    try {
      const errBody = await res.json();
      if (errBody?.message) message = errBody.message;
    } catch {
      // response had no JSON body
    }
    throw new ApiError(res.status, message);
  }
  return mapCase(await res.json() as CaseDto);
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
