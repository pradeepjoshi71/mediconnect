import { Heart, Activity, Users, Clock, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { StatCard } from "../components/ui/StatCard";
import { PaginatedTable } from "../components/ui/PaginatedTable";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";

export default function NurseDashboard() {
  const alerts = [
    { room: "Room 102", patient: "Maya Rao", alert: "IV infusion bag empty in 15 mins", priority: "medium" },
    { room: "Room 105", patient: "Rohan Das", alert: "BP vitals check due (post-surgery)", priority: "high" }
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Inpatient Care Operations"
        title="Nurse Command & Care Console"
        description="Monitor assigned ward patients, check hourly vitals logs, document nursing shift care plans, and track medication schedules."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Users}
          label="Assigned Patients"
          value="4"
          helper="Occupying ward beds"
          accent="brand"
        />
        <StatCard
          icon={Activity}
          label="Vitals Pending"
          value="1"
          helper="Due for post-op check"
          accent="teal"
        />
        <StatCard
          icon={Clock}
          label="Schedules Due"
          value="3"
          helper="Medications due this hour"
          accent="amber"
        />
        <StatCard
          icon={Heart}
          label="Shift Status"
          value="On Duty"
          helper="Ward B - Third floor"
          accent="success"
        />
      </div>

      <div className="rounded-[28px] border border-slate-200/50 bg-white/85 p-6 shadow-premium backdrop-blur-md dark:border-neutral-200/10 dark:bg-neutral-100/70">
        <h2 className="mb-4 text-base font-bold tracking-tight text-slate-900 dark:text-white">
          Active Clinical Alerts
        </h2>
        <PaginatedTable
          rows={alerts}
          pageSize={5}
          emptyState={
            <EmptyState
              title="All clear"
              description="No active clinical alerts for your ward."
            />
          }
          columns={[
            { key: "room", label: "Bed / Room" },
            { key: "patient", label: "Patient Name" },
            {
              key: "alert",
              label: "Care Alert details",
              render: (row) => (
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span>{row.alert}</span>
                </div>
              )
            },
            {
              key: "priority",
              label: "Alert Level",
              render: (row) => (
                <Badge tone={row.priority === "high" ? "danger" : "warning"}>
                  {row.priority.toUpperCase()}
                </Badge>
              )
            }
          ]}
        />
      </div>
    </div>
  );
}
