/** One place for the values the live views share. Dark by design: a bright UI
 *  around a video stage distracts from the movement being coached. */
export const colors = {
  background: '#0B0F14',
  surface: '#151C24',
  surfaceRaised: '#1E2833',
  border: '#2A3644',
  text: '#F5F7FA',
  textMuted: '#8A97A6',
  live: '#FF4757',
  good: '#2ED573',
  warning: '#FFA502',
  bad: '#FF4757',
  accent: '#3B82F6',
  danger: '#E03131',
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 20, pill: 999 } as const;

/** Minimum touch target. NFR-11, and coaches operate these mid-lesson. */
export const TOUCH_TARGET = 56;
