import { API_BASE_URL } from '../config';
import type {
  AppUser,
  AppealStatus,
  AuditFeedEntry,
  CaseStats,
  CaseStatus,
  DecisionType,
  DisciplinaryCase,
  MonthlyCaseCount,
  Note,
  AuditEntry,
  RegistrationStatus,
  Role,
  UserImpact,
  UserStats,
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
    throw new ApiError(res.status, await errorMessage(res));
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/**
 * Multipart sibling of request(). Kept separate because FormData must NOT get a Content-Type header —
 * the browser has to set it itself so it can append the multipart boundary. Shared by evidence and
 * profile-picture uploads so their auth and error handling can't drift apart.
 */
async function requestFormData<T>(path: string, body: FormData): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, { method: 'POST', headers: authHeader(), body });
  if (res.status === 401) {
    clearToken();
    onUnauthorized?.();
  }
  if (!res.ok) {
    throw new ApiError(res.status, await errorMessage(res));
  }
  return res.json() as Promise<T>;
}

/** Server error bodies are {"message": "..."}; fall back to the status text when there's no body. */
async function errorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (body?.message) return body.message as string;
  } catch {
    // response had no JSON body
  }
  return res.statusText;
}

// ---- Wire shapes (raw JSON as returned by CaseFlow-BE) ----
interface UserDto {
  id: number;
  name: string;
  role: Role;
  department: string | null;
  studentId: string | null;
  email: string;
  active: boolean;
  mustChangePassword: boolean;
  profilePictureUrl: string | null;
}

/** Envelope returned by every paginated endpoint. Mirrors the backend's PageResponse record. */
export interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

interface AuditFeedEntryDto {
  kind: 'CASE' | 'USER';
  id: number;
  action: string;
  by: string;
  timestamp: string;
  caseId: string | null;
  targetUserId: number | null;
  targetUserName: string | null;
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
    active: dto.active,
    mustChangePassword: dto.mustChangePassword,
    // Same convention as evidence files: the backend returns a path, we prefix the API origin.
    profilePictureUrl: dto.profilePictureUrl ? `${API_BASE_URL}${dto.profilePictureUrl}` : undefined,
  };
}

function mapAuditFeedEntry(dto: AuditFeedEntryDto): AuditFeedEntry {
  return {
    kind: dto.kind,
    id: dto.id,
    action: dto.action,
    by: dto.by,
    timestamp: formatTimestamp(dto.timestamp),
    caseId: dto.caseId ?? undefined,
    targetUserId: dto.targetUserId === null ? undefined : String(dto.targetUserId),
    targetUserName: dto.targetUserName ?? undefined,
  };
}

function mapPage<D, T>(page: Page<D>, mapItem: (dto: D) => T): Page<T> {
  return { ...page, content: page.content.map(mapItem) };
}

/** Drops empty values and expands arrays into repeated keys (?status=A&status=B). */
function toQuery(params: Record<string, string | number | boolean | string[] | undefined>): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === '') return;
    if (Array.isArray(value)) {
      value.forEach(v => v !== '' && query.append(key, v));
    } else {
      query.append(key, String(value));
    }
  });
  return query.toString();
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
  department: string;
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

export async function sendPasswordResetOtp(email: string): Promise<void> {
  await request<void>('/auth/password/reset/otp', { method: 'POST', body: JSON.stringify({ email }) });
}

export async function resetPassword(email: string, otp: string, newPassword: string): Promise<AppUser> {
  const { token, user } = await request<AuthDto>('/auth/password/reset', {
    method: 'POST',
    body: JSON.stringify({ email, otp, newPassword }),
  });
  storeToken(token, false);
  return mapUser(user);
}

// ---- Users ----
export interface UserQuery {
  search?: string;
  role?: Role;
  active?: boolean;
  page?: number;
  size?: number;
  sort?: string;
}

export async function fetchUsersPage(query: UserQuery = {}): Promise<Page<AppUser>> {
  return mapPage(await request<Page<UserDto>>(`/users?${toQuery({ ...query })}`), mapUser);
}

export async function fetchUserStats(): Promise<UserStats> {
  return request<UserStats>('/users/stats');
}

/** What deleting this account would orphan — cases reference people by name, not by foreign key. */
export async function fetchUserImpact(id: string): Promise<UserImpact> {
  return request<UserImpact>(`/users/${id}/impact`);
}

/**
 * The backend generates and emails a temporary password for admin-created accounts, so no password is
 * sent from here. (The `password` field still exists on the request for the zero-users bootstrap path,
 * which the UI never exercises.)
 */
export async function createUser(payload: {
  name: string;
  role: Role;
  department?: string;
  studentId?: string;
  email: string;
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

export async function updateUserStatus(id: string, active: boolean): Promise<AppUser> {
  return mapUser(await request<UserDto>(`/users/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ active }),
  }));
}

/** Multipart, so it bypasses request() the same way uploadEvidence does. */
export async function uploadProfilePicture(id: string, file: File): Promise<AppUser> {
  const body = new FormData();
  body.append('file', file);
  return mapUser(await requestFormData<UserDto>(`/users/${id}/picture`, body));
}

export async function removeProfilePicture(id: string): Promise<AppUser> {
  return mapUser(await request<UserDto>(`/users/${id}/picture`, { method: 'DELETE' }));
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
export interface CaseQuery {
  search?: string;
  status?: CaseStatus[];
  registrationStatus?: RegistrationStatus;
  offenseType?: string;
  decision?: DecisionType;
  reporterDepartment?: string;
  reportedByExact?: string;
  reportDateFrom?: string;
  reportDateTo?: string;
  suspensionEndFrom?: string;
  suspensionEndTo?: string;
  page?: number;
  size?: number;
  sort?: string;
}

export async function fetchCasesPage(query: CaseQuery = {}): Promise<Page<DisciplinaryCase>> {
  return mapPage(await request<Page<CaseDto>>(`/cases?${toQuery({ ...query })}`), mapCase);
}

export async function fetchCase(id: string): Promise<DisciplinaryCase> {
  return mapCase(await request<CaseDto>(`/cases/${id}`));
}

/**
 * Global counts for dashboard badges and stat tiles.
 *
 * <p>Separate from a list's totalElements on purpose: a badge answers "how many exist", while
 * totalElements answers "how many match the current view" — computing badges from a page would make
 * them silently wrong.
 */
export async function fetchCaseStats(): Promise<CaseStats> {
  return request<CaseStats>('/cases/stats');
}

export async function fetchMonthlyCaseCounts(): Promise<MonthlyCaseCount[]> {
  return request<MonthlyCaseCount[]>('/cases/stats/monthly');
}

export async function fetchAuditFeed(query: { kind?: 'CASE' | 'USER'; page?: number; size?: number } = {}):
    Promise<Page<AuditFeedEntry>> {
  return mapPage(await request<Page<AuditFeedEntryDto>>(`/audit?${toQuery({ ...query })}`), mapAuditFeedEntry);
}

/** Legal next statuses from the case's current one, so the UI never offers a move the server rejects. */
export async function fetchAllowedStatuses(caseId: string): Promise<CaseStatus[]> {
  return request<CaseStatus[]>(`/cases/${caseId}/allowed-statuses`);
}

export async function updateCaseStatus(caseId: string, status: CaseStatus, by: string): Promise<DisciplinaryCase> {
  return mapCase(await request<CaseDto>(`/cases/${caseId}/status`, {
    method: 'POST',
    body: JSON.stringify({ status, by }),
  }));
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
  return mapCase(await requestFormData<CaseDto>(`/cases/${caseId}/evidence`, body));
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

export interface CaseReportFilters {
  format: 'pdf' | 'csv';
  reportDateFrom?: string;
  reportDateTo?: string;
  offenseType?: string;
  status?: CaseStatus;
  decision?: DecisionType;
  reporterDepartment?: string;
  reportedBy?: string;
}

// Bypasses request() like uploadEvidence() does: these return a file, not JSON, so they need the
// auth header attached directly. Shared by every file-download/preview endpoint below.
async function fetchBlob(path: string, fallbackFilename: string): Promise<{ blob: Blob; filename: string }> {
  const res = await fetch(`${API_BASE_URL}${path}`, { headers: authHeader() });
  if (res.status === 401) {
    clearToken();
    onUnauthorized?.();
  }
  if (!res.ok) {
    throw new ApiError(res.status, await errorMessage(res));
  }

  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const filenameMatch = disposition.match(/filename="?([^";]+)"?/);
  const filename = filenameMatch ? filenameMatch[1] : fallbackFilename;
  return { blob, filename };
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function reportQuery(filters: CaseReportFilters): string {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  return query.toString();
}

export async function downloadCasesReport(filters: CaseReportFilters): Promise<void> {
  const { blob, filename } = await fetchBlob(
    `/cases/report?${reportQuery(filters)}`, `caseflow-report.${filters.format}`);
  saveBlob(blob, filename);
}

export async function previewCasesReport(filters: CaseReportFilters): Promise<Blob> {
  const { blob } = await fetchBlob(`/cases/report?${reportQuery(filters)}`, `caseflow-report.${filters.format}`);
  return blob;
}

export async function downloadClearanceCertificate(caseId: string): Promise<void> {
  const { blob, filename } = await fetchBlob(
    `/cases/${caseId}/clearance-certificate`, `clearance-${caseId}.pdf`);
  saveBlob(blob, filename);
}
