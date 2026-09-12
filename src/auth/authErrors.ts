type AuthFailure = { name?: string; status?: number; code?: string };

/**
 * Plain language for Supabase Auth failures on the sign-in screen (FR-18).
 * `sending` is asking for the email; `verifying` is typing the code from it.
 */
export function describeAuthError(error: AuthFailure, step: 'sending' | 'verifying'): string {
  if (error.name === 'AuthRetryableFetchError' || error.status === 0) {
    return 'FrameCue could not be reached. Check the internet connection and try again.';
  }
  if (error.status === 429 || error.code === 'over_email_send_rate_limit') {
    return 'Too many sign-in emails were sent. Wait a minute, then try again.';
  }
  if (step === 'verifying') {
    // Supabase reports a wrong code and an expired one identically.
    return 'That code did not work. Check it, or send a new email for a fresh one.';
  }
  return 'The sign-in email could not be sent. Check the address and try again.';
}
