import { otherRole, parseRole } from './roles';

describe('parseRole', () => {
  it('accepts the two supported roles', () => {
    expect(parseRole('coach')).toBe('coach');
    expect(parseRole('student')).toBe('student');
  });

  it('rejects anything else, including missing values', () => {
    expect(parseRole('admin')).toBeNull();
    expect(parseRole(undefined)).toBeNull();
    expect(parseRole(['coach'])).toBeNull();
  });
});

describe('otherRole', () => {
  it('pairs the two roles', () => {
    expect(otherRole('coach')).toBe('student');
    expect(otherRole('student')).toBe('coach');
  });
});
