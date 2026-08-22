import { toast } from 'sonner';
import { ApiError } from './api';

/**
 * App-wide notification helpers.
 *
 * Every mutating action funnels through these so success and failure look the same everywhere, and so
 * the `err instanceof ApiError ? err.message : '<fallback>'` dance that used to be copy-pasted into
 * every catch block lives in exactly one place.
 *
 * Convention: *action outcomes* are toasts; *field-level validation* stays inline next to the input,
 * where the user is actually looking.
 */

export function notifySuccess(message: string, description?: string): void {
  toast.success(message, { description });
}

export function notifyInfo(message: string, description?: string): void {
  toast(message, { description });
}

/**
 * Turns anything thrown by the API layer into a readable message.
 *
 * A raw `TypeError: Failed to fetch` (backend down, CORS, DNS) is useless to a user, so only an
 * ApiError's server-supplied message is trusted; everything else falls back to the caller's copy.
 */
export function toMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError && err.message ? err.message : fallback;
}

export function notifyError(err: unknown, fallback: string): void {
  // A 401 already bounces the user to the login screen via api.ts's unauthorized handler; a toast on
  // top of that is just noise on a screen they're leaving anyway.
  if (err instanceof ApiError && err.status === 401) return;
  toast.error(toMessage(err, fallback));
}

export { toast };
