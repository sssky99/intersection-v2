"use client";

import { type RefObject, useEffect, useRef } from "react";

type DragScrollOptions = {
  disabled?: boolean;
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  startTop: number;
  dragging: boolean;
};

const desktopDragQuery = "(hover: hover) and (pointer: fine)";
const dragStartThreshold = 5;
const formControlSelector =
  "input, textarea, select, option, [contenteditable='true'], [role='listbox'], [data-drag-scroll-ignore]";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function canScroll(element: HTMLElement) {
  return element.scrollHeight > element.clientHeight + 1;
}

function isScrollableStyle(value: string) {
  return value === "auto" || value === "scroll";
}

function shouldIgnoreDragTarget(target: EventTarget | null, root: HTMLElement) {
  if (!(target instanceof Element)) return false;
  if (target.closest(formControlSelector)) return true;

  let current: Element | null = target;
  while (current && current !== root) {
    if (current instanceof HTMLElement) {
      const style = window.getComputedStyle(current);
      const hasOwnScroll =
        (isScrollableStyle(style.overflowY) &&
          current.scrollHeight > current.clientHeight + 1) ||
        (isScrollableStyle(style.overflowX) &&
          current.scrollWidth > current.clientWidth + 1);

      if (hasOwnScroll) return true;
    }

    current = current.parentElement;
  }

  return false;
}

export function useDragScroll<T extends HTMLElement>(
  ref: RefObject<T | null>,
  { disabled = false }: DragScrollOptions = {},
) {
  const dragStateRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || disabled) return;

    const desktopDrag = window.matchMedia(desktopDragQuery);
    if (!desktopDrag.matches) return;

    const restoreDragStyles = () => {
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      element.style.cursor = "";
    };

    const finishDrag = () => {
      const wasDragging = dragStateRef.current?.dragging === true;
      dragStateRef.current = null;
      restoreDragStyles();

      if (wasDragging) {
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState || event.pointerId !== dragState.pointerId) return;

      const deltaX = event.clientX - dragState.startX;
      const deltaY = event.clientY - dragState.startY;

      if (!dragState.dragging) {
        const distance = Math.hypot(deltaX, deltaY);
        if (distance < dragStartThreshold) return;
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          finishDrag();
          return;
        }

        dragState.dragging = true;
        suppressClickRef.current = true;
        document.body.style.userSelect = "none";
        document.body.style.cursor = "grabbing";
        element.style.cursor = "grabbing";
      }

      const maxScrollTop = Math.max(0, element.scrollHeight - element.clientHeight);
      element.scrollTop = clamp(dragState.startTop - deltaY, 0, maxScrollTop);
      event.preventDefault();
    };

    const handlePointerUp = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState || event.pointerId !== dragState.pointerId) return;

      finishDrag();
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.button !== 0 ||
        event.pointerType !== "mouse" ||
        !canScroll(element) ||
        shouldIgnoreDragTarget(event.target, element)
      ) {
        return;
      }

      dragStateRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startTop: element.scrollTop,
        dragging: false,
      };
      element.style.cursor = "grab";
    };

    const handleClick = (event: MouseEvent) => {
      if (!suppressClickRef.current) return;

      suppressClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
    };

    element.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    element.addEventListener("click", handleClick, true);

    return () => {
      element.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      element.removeEventListener("click", handleClick, true);
      restoreDragStyles();
      dragStateRef.current = null;
      suppressClickRef.current = false;
    };
  }, [disabled, ref]);
}
