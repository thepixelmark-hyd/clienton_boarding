"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Milestone } from "lucide-react";
import { useTasks, useProject, type TaskItem, type MilestoneItem } from "@/lib/projects";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_DOT: Record<TaskItem["status"], string> = {
  TODO: "bg-text-muted",
  IN_PROGRESS: "bg-info",
  IN_REVIEW: "bg-warning",
  BLOCKED: "bg-danger",
  DONE: "bg-success",
};

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function dateKeyFromValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return dateKey(date.getFullYear(), date.getMonth(), date.getDate());
}

interface DayCell {
  key: string;
  day: number;
  inCurrentMonth: boolean;
  isToday: boolean;
}

function buildMonthGrid(year: number, month: number): DayCell[] {
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const today = new Date();
  const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());

  const cells: DayCell[] = [];

  for (let i = startOffset - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const key = dateKey(prevYear, prevMonth, day);
    cells.push({ key, day, inCurrentMonth: false, isToday: key === todayKey });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const key = dateKey(year, month, day);
    cells.push({ key, day, inCurrentMonth: true, isToday: key === todayKey });
  }

  const trailingCount = (7 - (cells.length % 7)) % 7;
  for (let day = 1; day <= trailingCount; day++) {
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    const key = dateKey(nextYear, nextMonth, day);
    cells.push({ key, day, inCurrentMonth: false, isToday: key === todayKey });
  }

  return cells;
}

export function ProjectCalendar({ projectId }: { projectId: string }) {
  const { data: tasks, isLoading: tasksLoading, isError: tasksError, refetch: refetchTasks } = useTasks(projectId);
  const { data: project, isLoading: projectLoading, isError: projectError, refetch: refetchProject } = useProject(projectId);

  const now = useMemo(() => new Date(), []);
  const [monthOffset, setMonthOffset] = useState(0);

  const viewDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const isLoading = tasksLoading || projectLoading;
  const isError = tasksError || projectError;

  const tasksByDay = useMemo(() => {
    const map = new Map<string, TaskItem[]>();
    for (const task of tasks ?? []) {
      const key = dateKeyFromValue(task.dueDate);
      if (!key) continue;
      const existing = map.get(key);
      if (existing) existing.push(task);
      else map.set(key, [task]);
    }
    return map;
  }, [tasks]);

  const milestonesByDay = useMemo(() => {
    const map = new Map<string, MilestoneItem[]>();
    for (const milestone of project?.milestones ?? []) {
      const key = dateKeyFromValue(milestone.dueDate);
      if (!key) continue;
      const existing = map.get(key);
      if (existing) existing.push(milestone);
      else map.set(key, [milestone]);
    }
    return map;
  }, [project]);

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (isError) {
    return (
      <ErrorState
        description="We couldn't load the project calendar."
        onRetry={() => {
          refetchTasks();
          refetchProject();
        }}
      />
    );
  }

  const cells = buildMonthGrid(year, month);
  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(viewDate);

  return (
    <Card>
      <CardContent className="py-4">
        <div className="mb-4 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => setMonthOffset((v) => v - 1)} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold text-text-primary">{monthLabel}</span>
          <Button variant="ghost" size="icon" onClick={() => setMonthOffset((v) => v + 1)} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border border-border bg-border text-xs">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="bg-surface-secondary px-2 py-1.5 text-center font-medium text-text-muted">
              {label}
            </div>
          ))}

          {cells.map((cell) => {
            const dayTasks = tasksByDay.get(cell.key) ?? [];
            const dayMilestones = milestonesByDay.get(cell.key) ?? [];
            return (
              <div
                key={cell.key}
                className={cn(
                  "min-h-[88px] bg-surface p-1.5 align-top",
                  !cell.inCurrentMonth && "bg-surface text-text-muted",
                  cell.isToday && "ring-2 ring-inset ring-accent",
                )}
              >
                <div
                  className={cn(
                    "mb-1 text-[11px]",
                    cell.inCurrentMonth ? "text-text-secondary" : "text-text-muted/60",
                    cell.isToday && "font-semibold text-accent",
                  )}
                >
                  {cell.day}
                </div>
                <div className="space-y-1">
                  {dayMilestones.map((milestone) => (
                    <div
                      key={milestone.id}
                      className="flex items-center gap-1 truncate rounded-sm bg-accent/10 px-1 py-0.5 text-[10px] text-accent"
                      title={milestone.name}
                    >
                      <Milestone className="h-2.5 w-2.5 shrink-0" aria-hidden />
                      <span className="truncate">{milestone.name}</span>
                    </div>
                  ))}
                  {dayTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-1 truncate rounded-sm bg-surface-secondary px-1 py-0.5 text-[10px] text-text-secondary"
                      title={task.title}
                    >
                      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT[task.status])} />
                      <span className="truncate">{task.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
