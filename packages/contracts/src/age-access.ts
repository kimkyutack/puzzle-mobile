export type AgeBand = 'child' | 'teen' | 'adult';

export interface AgeAdmission {
  band: AgeBand;
  state: 'contact' | 'waiting' | 'approved' | 'declined' | 'expired';
}

export function ageBandAt(birthDate: string, now: number): AgeBand | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const birthday = new Date(birthDate + 'T00:00:00Z');
  if (!Number.isFinite(birthday.getTime()) || birthday.toISOString().slice(0, 10) !== birthDate) return null;
  const today = new Date(now + 9 * 3_600_000).toISOString().slice(0, 10);
  const years = Number(today.slice(0, 4)) - birthday.getUTCFullYear();
  const age = years - Number(today.slice(5) < birthDate.slice(5));
  if (age < 0 || age > 120) return null;
  return age < 14 ? 'child' : age < 19 ? 'teen' : 'adult';
}
