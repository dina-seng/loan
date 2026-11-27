const base = {
  viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2,
  strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
};

export function HomeIcon({ className = 'w-5 h-5' }) {
  return <svg {...base} className={className}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M9.5 21v-6h5v6" /></svg>;
}

export function ListIcon({ className = 'w-5 h-5' }) {
  return <svg {...base} className={className}><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="3.5" cy="6" r="1" /><circle cx="3.5" cy="12" r="1" /><circle cx="3.5" cy="18" r="1" /></svg>;
}

export function ScaleIcon({ className = 'w-5 h-5' }) {
  return <svg {...base} className={className}><path d="M12 3v18M7 21h10M5 7h14M5 7l-3 7h6L5 7Zm14 0-3 7h6l-3-7Z" /></svg>;
}

export function ClockIcon({ className = 'w-5 h-5' }) {
  return <svg {...base} className={className}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
}

export function UserIcon({ className = 'w-5 h-5' }) {
  return <svg {...base} className={className}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.5-6 8-6s8 2 8 6" /></svg>;
}
