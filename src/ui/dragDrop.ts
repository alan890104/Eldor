// Pointer drag and drop (shared by mouse and touch): a mouse starts dragging after moving a few pixels; touch needs a long press, to avoid clashing with scrolling.
// Drop targets are marked with data-drop="<key>"; the ghost shown while dragging is a copy of the source element (or the part of it picked by ghostOf), with its center following the pointer.

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';

const MOUSE_SLOP = 6;
const TOUCH_SLOP = 10;
const HOLD_MS = 260;
/** How many pixels from the edge of a scroll area the pointer must be before it auto-scrolls */
const EDGE = 44;

export type DragState<S> = { src: S; over: string | null };

/** A drop target's key follows the convention "kind:arg", e.g. slot:0, tile:<uid> */
export function parseDrop(t: string): { kind: string; arg: string } {
  const i = t.indexOf(':');
  return i < 0 ? { kind: t, arg: '' } : { kind: t.slice(0, i), arg: t.slice(i + 1) };
}

type Opts<S> = {
  canDrop: (src: S, target: string) => boolean;
  onDrop: (src: S, target: string) => void;
  onStart?: (src: S) => void;
  /** After a touch long press, released without moving: treated as an ordinary tap */
  onTap?: (src: S) => void;
  /** The ghost copies only the part of the source element that matches this selector (e.g. the avatar), so it doesn't cover the drop target */
  ghostOf?: string;
};

export function useDragDrop<S>(opts: Opts<S>) {
  const o = useRef(opts);
  o.current = opts;
  const [drag, setDrag] = useState<DragState<S> | null>(null);
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const active = useRef<{ dragging: boolean; end: () => void } | null>(null);

  // After a long press picks it up, touch scrolling has to be blocked; the listener must be attached before touchstart and be non-passive, or the browser won't allow cancelling
  useEffect(() => {
    if (!root) return;
    const block = (e: TouchEvent) => {
      if (active.current?.dragging && e.cancelable) e.preventDefault();
    };
    root.addEventListener('touchmove', block, { passive: false });
    return () => root.removeEventListener('touchmove', block);
  }, [root]);
  useEffect(() => () => active.current?.end(), []);

  const bind = (src: S) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      if (e.button !== 0 || active.current) return;
      const el = e.currentTarget;
      const id = e.pointerId;
      const touch = e.pointerType === 'touch';
      const sx = e.clientX;
      const sy = e.clientY;
      let x = sx;
      let y = sy;
      let over: string | null = null;
      let ghost: Ghost | null = null;
      let raf = 0;
      const timer = touch ? window.setTimeout(() => begin(), HOLD_MS) : 0;

      const hover = () => {
        const hit = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drop]');
        let key = hit && root?.contains(hit) ? (hit.dataset.drop ?? null) : null;
        if (key && !o.current.canDrop(src, key)) key = null;
        if (key !== over) {
          over = key;
          setDrag({ src, over });
        }
      };
      const tick = () => {
        autoScroll(x, y, root);
        hover();
        raf = requestAnimationFrame(tick);
      };
      const begin = () => {
        if (!state.dragging && el.isConnected) {
          state.dragging = true;
          ghost = makeGhost(el, o.current.ghostOf);
          place();
          window.getSelection()?.removeAllRanges();
          if (touch) navigator.vibrate?.(12);
          o.current.onStart?.(src);
          setDrag({ src, over: null });
          raf = requestAnimationFrame(tick);
        }
      };
      // The ghost floats a little above the pointer; on touch it is lifted higher so the finger doesn't cover it
      const lift = touch ? 0.8 : 0.3;
      const place = () => {
        // Use the translate property instead of transform: the lift animation's scale would scale the offset inside transform too, and the ghost would drift away from the pointer
        if (ghost) ghost.node.style.translate = `${(x - ghost.w / 2) / ghost.z}px ${(y - ghost.h * (0.5 + lift)) / ghost.z}px`;
      };
      const move = (ev: PointerEvent) => {
        if (ev.pointerId !== id) return;
        x = ev.clientX;
        y = ev.clientY;
        if (state.dragging) {
          place();
          return;
        }
        const d = Math.hypot(x - sx, y - sy);
        // Touch that moves before the long press: treat it as scrolling and give up the drag
        if (touch ? d > TOUCH_SLOP : d > MOUSE_SLOP) {
          if (touch) end();
          else begin();
        }
      };
      const up = (ev: PointerEvent) => {
        if (ev.pointerId !== id) return;
        if (!state.dragging) {
          end();
          return;
        }
        x = ev.clientX;
        y = ev.clientY;
        hover();
        const target = over;
        const still = Math.hypot(x - sx, y - sy) < TOUCH_SLOP;
        swallowClick();
        const g = ghost;
        ghost = null;
        end();
        if (target) o.current.onDrop(src, target);
        else if (touch && still) o.current.onTap?.(src);
        if (g) settle(g, !target);
      };
      const end = () => {
        window.clearTimeout(timer);
        cancelAnimationFrame(raf);
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', cancel);
        ghost?.node.remove();
        ghost = null;
        if (state.dragging) setDrag(null);
        state.dragging = false;
        active.current = null;
      };
      const cancel = (ev: PointerEvent) => {
        if (ev.pointerId !== id) return;
        const g = ghost;
        ghost = null;
        end();
        if (g) settle(g, true);
      };
      const state = { dragging: false, end };
      active.current = state;
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', cancel);
    },
    // No system menu on long press
    onContextMenu: (e: ReactMouseEvent) => e.preventDefault(),
  });

  return { drag, bind, rootRef: setRoot };
}

type Ghost = { node: HTMLElement; part: HTMLElement; w: number; h: number; z: number };

/** The ghost goes on the screen root node (avoiding .panel's backdrop-filter, so fixed is relative to the viewport), keeping the screen-level styles */
function makeGhost(el: HTMLElement, sel?: string): Ghost {
  const part = (sel && el.querySelector<HTMLElement>(sel)) || el;
  const r = part.getBoundingClientRect();
  const node = part.cloneNode(true) as HTMLElement;
  node.classList.remove('sel', 'drag-src', 'drop-ok', 'drop-over', 'landed');
  node.classList.add('drag-ghost');
  node.removeAttribute('data-drop');
  node.setAttribute('aria-hidden', 'true');
  // When the source is in a panel scaled by zoom, the ghost keeps the same ratio (size takes the unscaled offset value; the translation is divided by the ratio)
  const z = part.offsetWidth ? r.width / part.offsetWidth : 1;
  Object.assign(node.style, { width: `${r.width / z}px`, height: `${r.height / z}px`, zoom: String(z) });
  (el.closest('.screen') ?? document.body).appendChild(node);
  return { node, part, w: r.width, h: r.height, z };
}

/** How the ghost wraps up after a drop: if it wasn't dropped on a target it flies back to its place; on a successful drop it fades out in place */
function settle(g: Ghost, back: boolean): void {
  g.node.classList.add(back ? 'drag-back' : 'drag-drop');
  if (back && g.part.isConnected) {
    const r = g.part.getBoundingClientRect();
    g.node.style.translate = `${(r.left + r.width / 2 - g.w / 2) / g.z}px ${(r.top + r.height / 2 - g.h / 2) / g.z}px`;
  }
  window.setTimeout(() => g.node.remove(), 220);
}

/** The browser still sends a click after a drag ends; swallow it so it isn't taken as a tap */
function swallowClick(): void {
  const stop = (e: Event) => {
    e.stopPropagation();
    e.preventDefault();
  };
  window.addEventListener('click', stop, { capture: true, once: true });
  window.setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 0);
}

/** When the pointer nears the edge of a scrollable area, scroll in that direction */
function autoScroll(x: number, y: number, root: HTMLElement | null): void {
  let el = document.elementFromPoint(x, y) as HTMLElement | null;
  while (el && el !== root?.parentElement) {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight) {
      const dy = y < r.top + EDGE ? -1 : y > r.bottom - EDGE ? 1 : 0;
      if (dy) {
        el.scrollTop += dy * speed(dy < 0 ? y - r.top : r.bottom - y);
        return;
      }
    }
    if (/(auto|scroll)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth) {
      const dx = x < r.left + EDGE ? -1 : x > r.right - EDGE ? 1 : 0;
      if (dx) {
        el.scrollLeft += dx * speed(dx < 0 ? x - r.left : r.right - x);
        return;
      }
    }
    el = el.parentElement;
  }
}

function speed(dist: number): number {
  return 2 + 12 * Math.max(0, 1 - dist / EDGE);
}
