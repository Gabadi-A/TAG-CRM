"use client";

import { useState, useTransition, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { moveCalendarItem } from "@/lib/actions/tasks";

export type CalItem = {
  id: string;
  kind: "fu" | "task" | "due";
  label: string;
  href?: string;
  title?: string;
  icon?: string;
  done?: boolean;
};
type Cell = { day: number; key: string } | null;

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function FollowUpCalendar({
  cells,
  itemsByDate,
  todayKey,
  canEdit,
}: {
  cells: Cell[];
  itemsByDate: Record<string, CalItem[]>;
  todayKey: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [overKey, setOverKey] = useState<string | null>(null);

  function onDrop(e: DragEvent<HTMLElement>, targetKey: string) {
    e.preventDefault();
    setOverKey(null);
    const raw = e.dataTransfer.getData("text/plain");
    if (!raw) return;
    const [kind, id, fromKey] = raw.split("|");
    if (!id || fromKey === targetKey) return; // same day — nothing to do
    start(async () => {
      await moveCalendarItem(kind, id, targetKey);
      router.refresh();
    });
  }

  return (
    <div className="table-wrap" style={{ opacity: pending ? 0.6 : 1 }}>
      <div className="cal-grid">
        {DOW.map((d) => (
          <div key={d} className="cal-dow">{d}</div>
        ))}
        {cells.map((c, i) => {
          if (!c) return <div key={i} className="cal-cell empty" />;
          const items = itemsByDate[c.key] || [];
          const isToday = c.key === todayKey;
          const isPast = c.key < todayKey;
          return (
            <div
              key={i}
              className={
                "cal-cell" +
                (isToday ? " today" : "") +
                (isPast ? " past" : "") +
                (overKey === c.key ? " dragover" : "")
              }
              onDragOver={canEdit ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (overKey !== c.key) setOverKey(c.key); } : undefined}
              onDragLeave={canEdit ? () => setOverKey((k) => (k === c.key ? null : k)) : undefined}
              onDrop={canEdit ? (e) => onDrop(e, c.key) : undefined}
            >
              <div className="cal-daynum">{c.day}</div>
              {items.map((it) => {
                const cls =
                  "cal-item " + it.kind + (isPast && !it.done ? " overdue" : "") + (it.done ? " done" : "");
                const text = (it.icon ? it.icon + " " : "") + it.label;
                const common = {
                  draggable: canEdit,
                  onDragStart: canEdit
                    ? (e: DragEvent<HTMLElement>) => { e.dataTransfer.setData("text/plain", `${it.kind}|${it.id}|${c.key}`); e.dataTransfer.effectAllowed = "move"; }
                    : undefined,
                  onDragEnd: () => setOverKey(null),
                  title: (it.title || it.label) + (canEdit ? " — drag to another day to reschedule" : ""),
                };
                const k = it.kind + it.id;
                return it.href ? (
                  <a key={k} href={it.href} className={cls} {...common}>{text}</a>
                ) : (
                  <div key={k} className={cls} {...common}>{text}</div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
