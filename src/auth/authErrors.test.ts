import { describeAuthError } from '@/auth/authErrors';

describe('describeAuthError', () => {
  it('reports an unreachable backend in plain language', () => {
    expect(describeAuthError({ name: 'AuthRetryableFetchError', status: 0 }, 'sending')).toMatch(
      /could not be reached/,
    );
  });

  it('explains the email rate limit', () => {
    expect(
      describeAuthError({ status: 429, code: 'over_email_send_rate_limit' }, 'sending'),
    ).toMatch(/Too many sign-in emails/);
  });

  it('points a failed code at a fresh email', () => {
    expect(describeAuthError({ status: 403, code: 'otp_expired' }, 'verifying')).toMatch(
      /send a new email/,
    );
  });

  it('never shows status codes or jargon', () => {
    for (const step of ['sending', 'verifying'] as const) {
      const copy = describeAuthError({ status: 500, code: 'unexpected_failure' }, step);
      expect(copy).not.toMatch(/\d|otp|jwt|token/i);
    }
  });
});
