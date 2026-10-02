"use client";

import { CalendarRange } from "lucide-react";
import { useTasks, usePhases, type TaskItem, type PhaseItem, type TaskStatus } from "@/lib/projects";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { formatDate, cn } from "@/lib/utils";

const STATUS_COLOR: Record<TaskStatus, string> = {
  TODO: "bg-text-muted",
  IN_PROGRESS: "bg-info",
  IN_REVIEW: "bg-warning",
  BLOCKED: "bg-warning",
  DONE: "bg-success",
};

interface Range {
  start: number;
  end: number;
}

function toTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

function percent(value: number, range: Range): number {
  if (range.end === range.start) return 0;
  return ((value - range.start) / (range.end - range.start)) * 100;
}

function barStyle(start: number, end: number, range: Range): { left: string; width: string } {
  const left = Math.max(0, Math.min(100, percent(start, range)));
  const right = Math.max(0, Math.min(100, percent(end, range)));
  const width = Math.max(right - left, 0.75);
  return { left: `${left}%`, width: `${width}%` };
}

export function ProjectTimeline({ projectId }: { projectId: string }) {
  const { data: phases, isLoading: phasesLoading, isError: phasesError, refetch: refetchPhases } = usePhases(projectId);
  const { data: tasks, isLoading: tasksLoading, isError: tasksError, refetch: refetchTasks } = useTasks(projectId);

  const isLoading = phasesLoading || tasksLoading;
  const isError = phasesError || tasksError;

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (isError) {
    return (
      <ErrorState
        description="We couldn't load the project timeline."
        onRetry={() => {
          refetchPhases();
          refetchTasks();
        }}
      />
    );
  }

  const allPhases = phases ?? [];
  const allTasks = tasks ?? [];

  const datedTasks = allTasks.filter((task) => toTime(task.dueDate) !== null);
  const undatedTaskCount = allTasks.length - datedTasks.length;

  const times: number[] = [];
  for (const phase of allPhases) {
    const start = toTime(phase.startDate);
    const end = toTime(phase.endDate);
    if (start !== null) times.push(start);
    if (end !== null) times.push(end);
  }
  for (const task of datedTasks) {
    const start = toTime(task.startDate);
    const due = toTime(task.dueDate);
    if (start !== null) times.push(start);
    if (due !== null) times.push(due);
  }

  if (times.length === 0) {
    return (
      <EmptyState
        icon={CalendarRange}
        title="No dated work yet"
        description="Add start or due dates to phases and tasks to see them laid out on a timeline."
      />
    );
  }

  const range: Range = { start: Math.min(...times), end: Math.max(...times) };
  // Pad a zero-width range so a single-day project still renders a visible bar.
  if (range.start === range.end) {
    range.end = range.start + 1000 * 60 * 60 * 24;
  }

  return (
    <Card>
      <CardContent className="overflow-x-auto py-4">
        <div className="min-w-[640px]">
          <div className="mb-3 flex items-center justify-between text-xs text-text-muted">
            <span>{formatDate(new Date(range.start))}</span>
            <span>{formatDate(new Date(range.end))}</span>
          </div>

          <div className="space-y-2">
            {allPhases.map((phase) => (
              <PhaseRow key={phase.id} phase={phase} range={range} />
            ))}
          </div>

          {allPhases.length > 0 && datedTasks.length > 0 && <div className="my-4 border-t border-border" />}

          <div className="space-y-1.5">
            {datedTasks.map((task) => (
              <TaskRow key={task.id} task={task} range={range} />
            ))}
          </div>

          {undatedTaskCount > 0 && (
            <p className="mt-3 text-xs text-text-muted">
              {undatedTaskCount} task{undatedTaskCount === 1 ? "" : "s"} have no due date and aren&apos;t shown here.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PhaseRow({ phase, range }: { phase: PhaseItem; range: Range }) {
  const start = toTime(phase.startDate) ?? range.start;
  const end = toTime(phase.endDate) ?? start;
  const style = barStyle(start, end, range);

  return (
    <div className="flex items-center gap-3">
      <div className="w-32 shrink-0 truncate text-xs font-medium text-text-primary" title={phase.name}>
        {phase.name}
      </div>
      <div className="relative h-5 flex-1 rounded-sm bg-surface-secondary">
        <div
          className="absolute top-0.5 h-4 rounded-sm bg-accent/70"
          style={style}
          title={`${formatDate(phase.startDate)} – ${formatDate(phase.endDate)}`}
        />
      </div>
    </div>
  );
}

function TaskRow({ task, range }: { task: TaskItem; range: Range }) {
  const due = toTime(task.dueDate)!;
  const start = toTime(task.startDate) ?? due;
  const style = barStyle(start, due, range);

  return (
    <div className="flex items-center gap-3">
      <div className="w-32 shrink-0 truncate text-xs text-text-muted" title={task.title}>
        {task.title}
      </div>
      <div className="relative h-3.5 flex-1">
        <div
          className={cn("absolute top-0.5 h-2.5 rounded-full", STATUS_COLOR[task.status])}
          style={style}
          title={`${task.title} · due ${formatDate(task.dueDate)}`}
        />
      </div>
    </div>
  );
}
