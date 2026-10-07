// Hub town menu icons: adventure, bag, Star Gate Summon, Arena, Codex, quests, settings. 24×24 inline SVG, strokes use currentColor.

import type { ReactElement } from 'react';

const PATHS: Record<string, ReactElement> = {
  // Compass: outer ring + four-point star
  adventure: (
    <>
      <circle cx="12" cy="12" r="9.2" fill="none" strokeWidth="1.6" />
      <path d="M12 4.2 13.6 10.4 19.8 12 13.6 13.6 12 19.8 10.4 13.6 4.2 12 10.4 10.4Z" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="#1a1238" stroke="none" />
    </>
  ),
  // Drawstring pouch
  bag: (
    <>
      <path d="M8.6 3h6.8l-1.9 3.4c3.8 1.4 6.5 4.9 6.5 8.6 0 3.8-3.4 6-8 6s-8-2.2-8-6c0-3.7 2.7-7.2 6.5-8.6Z" stroke="none" />
      <path d="M8.4 6.6h7.2" stroke="#1a1238" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 6.6 10.2 9.4M12 6.6l1.8 2.8" stroke="#1a1238" strokeWidth="1.2" strokeLinecap="round" />
    </>
  ),
  // Star Gate: halo + central star
  summon: (
    <>
      <circle cx="12" cy="12" r="9" fill="none" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="6" fill="none" strokeWidth="1" strokeDasharray="1.6 1.8" />
      <path d="M12 6.4c.5 3 2.6 5.1 5.6 5.6-3 .5-5.1 2.6-5.6 5.6-.5-3-2.6-5.1-5.6-5.6 3-.5 5.1-2.6 5.6-5.6Z" stroke="none" />
    </>
  ),
  // Crossed swords
  arena: (
    <>
      <path d="M4 3.5 6.5 3.5 15 12 13.3 13.7 4.5 6Z" stroke="none" />
      <path d="M20 3.5 17.5 3.5 9 12 10.7 13.7 19.5 6Z" stroke="none" />
      <path d="M11.2 15.8 8.2 12.8 6.8 14.2 8.3 15.7 4 20 5 21 9.3 16.7 10.8 18.2Z M12.8 15.8 15.8 12.8 17.2 14.2 15.7 15.7 20 20 19 21 14.7 16.7 13.2 18.2Z" stroke="none" />
    </>
  ),
  // Open book
  dex: (
    <>
      <path d="M12 6.2C9.8 4.6 7 4 3.5 4.2V18c3.4-.2 6.2.4 8.5 2 2.3-1.6 5.1-2.2 8.5-2V4.2C17 4 14.2 4.6 12 6.2Z" stroke="none" />
      <path d="M12 6.4V19.6" stroke="#1a1238" strokeWidth="1.3" />
      <path d="M6 8c1.5 0 2.8.3 4 .9M6 11c1.5 0 2.8.3 4 .9M14 8.9c1.2-.6 2.5-.9 4-.9M14 11.9c1.2-.6 2.5-.9 4-.9" fill="none" stroke="#1a1238" strokeWidth="1" strokeLinecap="round" />
    </>
  ),
  // Commission slip: dog-eared paper with a checklist
  quests: (
    <>
      <path d="M6.5 2.5h8L19.5 7.5V20a1.5 1.5 0 0 1-1.5 1.5H6.5A1.5 1.5 0 0 1 5 20V4a1.5 1.5 0 0 1 1.5-1.5Z" stroke="none" />
      <path d="M14.5 2.5v5h5" fill="#1a1238" fillOpacity=".35" stroke="none" />
      <path d="M7.8 11.4l1.4 1.4 2.3-2.5M7.8 16.4l1.4 1.4 2.3-2.5M13.3 11.8h3.4M13.3 16.8h3.4" fill="none" stroke="#1a1238" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  // Gear
  settings: (
    <>
      <path
        d="M10.3 2.5h3.4l.5 2.6 1.6.7 2.2-1.5 2.4 2.4-1.5 2.2.7 1.6 2.6.5v3.4l-2.6.5-.7 1.6 1.5 2.2-2.4 2.4-2.2-1.5-1.6.7-.5 2.6h-3.4l-.5-2.6-1.6-.7-2.2 1.5-2.4-2.4 1.5-2.2-.7-1.6-2.6-.5v-3.4l2.6-.5.7-1.6-1.5-2.2 2.4-2.4 2.2 1.5 1.6-.7Z"
        stroke="none"
      />
      <circle cx="12" cy="12" r="3.2" fill="#1a1238" stroke="none" />
    </>
  ),
};

export function MenuIcon({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <svg className="menu-ico" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}
