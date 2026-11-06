'use client';

import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

const KEY = 'scoobydao:theme';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    // Sync with what the inline head script applied before paint.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
  }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* storage unavailable: theme still applies for this visit */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      className="border-line text-muted hover:text-text grid h-9 w-9 place-items-center rounded-full border"
    >
      {theme === 'dark' ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
    </button>
  );
}

/** Runs before hydration so the saved theme applies without a flash. */
export const themeInitScript = `try{var t=localStorage.getItem('${KEY}');if(t==='light')document.documentElement.dataset.theme='light'}catch(e){}`;
