import {
  addDays,
  differenceInMinutes,
  endOfWeek,
  format,
  isSameDay,
  startOfWeek,
} from "date-fns";
import { useMemo, useRef, useState } from "react";
import { cn } from "../../utils/cn";

const DAY_START_HOUR = 8;
const DAY_END_HOUR = 18;
const SLOT_MINUTES = 30;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function roundToSlot(date) {
  const d = new Date(date);
  const mins = d.getMinutes();
  const rounded = Math.round(mins / SLOT_MINUTES) * SLOT_MINUTES;
  d.setMinutes(rounded, 0, 0);
  return d;
}

function minutesSinceStart(d) {
  return (d.getHours() - DAY_START_HOUR) * 60 + d.getMinutes();
}

export default function InteractiveWeekCalendar({
  anchorDate = new Date(),
  events = [],
  canDrag = false,
  onRescheduleRequest,
  allowedSlotStarts,
  onDragStart,
  onInvalidDrop,
}) {
  const start = startOfWeek(anchorDate, { weekStartsOn: 1 });
  const end = endOfWeek(anchorDate, { weekStartsOn: 1 });
  const days = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);

  const gridRef = useRef(null);
  const [drag, setDrag] = useState(null); // { id, startX, startY, originalStartsAt, originalEndsAt }
  const [hoverIso, setHoverIso] = useState(null);

  const hours = useMemo(() => {
    const res = [];
    for (let h = DAY_START_HOUR; h <= DAY_END_HOUR; h++) res.push(h);
    return res;
  }, []);

  const byDay = useMemo(() => {
    return days.map((day) =>
      events
        .filter((e) => isSameDay(new Date(e.starts_at), day))
        .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
    );
  }, [events, days]);

  function pointerToDate(clientX, clientY) {
    const el = gridRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const dayWidth = rect.width / 7;
    const dayIndex = clamp(Math.floor(x / dayWidth), 0, 6);
    const day = days[dayIndex];

    const totalMinutes = (DAY_END_HOUR - DAY_START_HOUR) * 60;
    const minutes = clamp(Math.round((y / rect.height) * totalMinutes / SLOT_MINUTES) * SLOT_MINUTES, 0, totalMinutes);

    const d = new Date(day);
    d.setHours(DAY_START_HOUR, 0, 0, 0);
    d.setMinutes(d.getMinutes() + minutes);
    return d;
  }

  function onPointerDown(e, ev) {
    if (!canDrag) return;
    e.preventDefault();
    e.stopPropagation();
    setDrag({
      id: ev.id,
      originalStartsAt: new Date(ev.starts_at),
      originalEndsAt: new Date(ev.ends_at),
    });
    onDragStart?.(ev);
  }

  function onPointerUp(e) {
    if (!drag) return;
    const target = pointerToDate(e.clientX, e.clientY);
    setDrag(null);
    setHoverIso(null);
    if (!target) return;

    const durationMin = differenceInMinutes(drag.originalEndsAt, drag.originalStartsAt);
    const nextStart = roundToSlot(target);
    const nextEnd = new Date(nextStart.getTime() + durationMin * 60 * 1000);
    const nextStartIso = nextStart.toISOString();

    if (allowedSlotStarts && allowedSlotStarts.size && !allowedSlotStarts.has(nextStartIso)) {
      onInvalidDrop?.({ startsAt: nextStartIso, endsAt: nextEnd.toISOString() });
      return;
    }

    onRescheduleRequest?.({
      appointmentId: drag.id,
      startsAt: nextStartIso,
      endsAt: nextEnd.toISOString(),
    });
  }

  const slotCount = (DAY_END_HOUR - DAY_START_HOUR) * (60 / SLOT_MINUTES);
  const slotIndexes = useMemo(() => Array.from({ length: slotCount }, (_, i) => i), [slotCount]);

  function slotIsoForDay(day, slotIndex) {
    const d = new Date(day);
    d.setHours(DAY_START_HOUR, 0, 0, 0);
    d.setMinutes(d.getMinutes() + slotIndex * SLOT_MINUTES);
    return d.toISOString();
  }

  function onPointerMove(e) {
    if (!drag) return;
    const target = pointerToDate(e.clientX, e.clientY);
    if (!target) return setHoverIso(null);
    const nextStartIso = roundToSlot(target).toISOString();
    setHoverIso(nextStartIso);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="grid grid-cols-8 border-b border-slate-200 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <div className="px-3 py-3">Time</div>
        {days.map((d) => (
          <div
            key={d.toISOString()}
            className={cn(
              "px-3 py-3",
              isSameDay(d, new Date()) && "text-brand-700 dark:text-brand-200"
            )}
          >
            <div className="uppercase tracking-wider">{format(d, "EEE")}</div>
            <div className="mt-1 text-sm text-slate-900 dark:text-slate-100">{format(d, "d")}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-8">
        <div className="border-r border-slate-200 dark:border-slate-800">
          {hours.map((h) => (
            <div key={h} className="h-12 border-b border-slate-100 px-3 py-2 text-xs dark:border-slate-900">
              {format(new Date().setHours(h, 0, 0, 0), "ha")}
            </div>
          ))}
        </div>

        <div
          ref={gridRef}
          className="relative col-span-7 grid grid-cols-7"
          onPointerUp={onPointerUp}
          onPointerMove={onPointerMove}
          onPointerLeave={() => setHoverIso(null)}
        >
          {days.map((d, idx) => (
            <div key={d.toISOString()} className="relative border-r border-slate-100 last:border-r-0 dark:border-slate-900">
              {/* hour lines */}
              {hours.map((h) => (
                <div key={h} className="h-12 border-b border-slate-100 dark:border-slate-900" />
              ))}

              {/* invalid zones overlay (when dragging w/ availability) */}
              {drag && allowedSlotStarts && allowedSlotStarts.size ? (
                <div className="pointer-events-none absolute inset-0">
                  {slotIndexes.map((i) => {
                    const iso = slotIsoForDay(d, i);
                    const ok = allowedSlotStarts.has(iso);
                    if (ok) return null;
                    const top = (i / slotCount) * 100;
                    const height = (1 / slotCount) * 100;
                    return (
                      <div
                        key={iso}
                        className="absolute left-0 right-0 opacity-80"
                        style={{
                          top: `${top}%`,
                          height: `${height}%`,
                          backgroundImage: "var(--mc-hatch)",
                        }}
                      />
                    );
                  })}
                </div>
              ) : null}

              {/* hover highlight */}
              {drag && hoverIso ? (
                (() => {
                  const dayIso0 = new Date(d);
                  dayIso0.setHours(DAY_START_HOUR, 0, 0, 0);
                  const slotMinutesFromStart =
                    (new Date(hoverIso).getTime() - dayIso0.getTime()) / (60 * 1000);
                  if (slotMinutesFromStart < 0 || slotMinutesFromStart >= (DAY_END_HOUR - DAY_START_HOUR) * 60) {
                    return null;
                  }
                  const i = Math.round(slotMinutesFromStart / SLOT_MINUTES);
                  const top = (i / slotCount) * 100;
                  const height = (1 / slotCount) * 100;
                  const ok = allowedSlotStarts?.has(hoverIso);
                  return (
                    <div
                      className={cn(
                        "pointer-events-none absolute left-0 right-0",
                        ok
                          ? "bg-tealish-200/35 dark:bg-tealish-500/15"
                          : "bg-rose-200/35 dark:bg-rose-500/10"
                      )}
                      style={{
                        top: `${top}%`,
                        height: `${height}%`,
                        boxShadow: ok
                          ? "inset 0 0 0 1px rgba(13,148,136,0.35)"
                          : "inset 0 0 0 1px rgba(225,29,72,0.25)",
                      }}
                    />
                  );
                })()
              ) : null}

              {/* events */}
              {byDay[idx].map((ev) => {
                const s = new Date(ev.starts_at);
                const e = new Date(ev.ends_at);
                const topMin = minutesSinceStart(s);
                const heightMin = Math.max(30, differenceInMinutes(e, s));
                const top = (topMin / ((DAY_END_HOUR - DAY_START_HOUR) * 60)) * 100;
                const height = (heightMin / ((DAY_END_HOUR - DAY_START_HOUR) * 60)) * 100;

                return (
                  <div
                    key={ev.id}
                    onPointerDown={(pe) => onPointerDown(pe, ev)}
                    className={cn(
                      "absolute left-2 right-2 rounded-2xl border px-3 py-2 text-xs shadow-sm transition",
                      canDrag
                        ? "cursor-grab active:cursor-grabbing"
                        : "cursor-default",
                      "border-brand-200 bg-brand-50 text-brand-900 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-100"
                    )}
                    style={{ top: `${top}%`, height: `${height}%` }}
                    title={canDrag ? "Drag to reschedule" : undefined}
                  >
                    <div className="font-extrabold">{format(s, "p")}</div>
                    <div className="mt-0.5 text-[11px] opacity-90">
                      {ev.doctor_name || ev.patient_name || "Appointment"} • {ev.status}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {canDrag ? (
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
          Tip: drag an appointment to a new time (snaps to 30-minute slots), then confirm.
        </div>
      ) : null}
    </div>
  );
}

