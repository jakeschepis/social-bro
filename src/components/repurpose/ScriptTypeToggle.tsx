'use client';

import type { ScriptType } from '@/types';

interface ScriptTypeToggleProps {
  value: ScriptType;
  onChange: (type: ScriptType) => void;
  disabled?: boolean;
}

export function ScriptTypeToggle({ value, onChange, disabled }: ScriptTypeToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Script type"
      className={`inline-flex items-center rounded-lg border border-white/10 bg-white/5 p-0.5 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
    >
      <button
        role="radio"
        aria-checked={value === 'single-subject'}
        onClick={() => onChange('single-subject')}
        disabled={disabled}
        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 min-h-[36px] text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${
          value === 'single-subject'
            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            : 'text-white/50 hover:text-white/70 border border-transparent'
        }`}
      >
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        Single Subject
      </button>
      <button
        role="radio"
        aria-checked={value === 'multi-subject'}
        onClick={() => onChange('multi-subject')}
        disabled={disabled}
        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 min-h-[36px] text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 ${
          value === 'multi-subject'
            ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
            : 'text-white/50 hover:text-white/70 border border-transparent'
        }`}
      >
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2 2 7l10 5 10-5-10-5Z" />
          <path d="m2 17 10 5 10-5" />
          <path d="m2 12 10 5 10-5" />
        </svg>
        Multi Subject
      </button>
    </div>
  );
}
