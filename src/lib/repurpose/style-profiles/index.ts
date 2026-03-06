import singleSubject from './single-subject.json';
import multiSubject from './multi-subject.json';
import type { ScriptType } from '@/types';

export const STYLE_PROFILES = {
  'single-subject': singleSubject,
  'multi-subject': multiSubject,
} as const;

export function getStyleProfile(scriptType: ScriptType) {
  return STYLE_PROFILES[scriptType];
}
