import { Video, Calendar, User, CheckCircle, ExternalLink } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { PaginatedTable } from "../components/ui/PaginatedTable";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import toast from "react-hot-toast";

export default function PatientTelemedicine() {
  const sessions = [
    { id: 1, doctor: "Dr. Rohan Mehta", specialty: "Cardiology", date: "Today at 05:00 PM", status: "ready", url: "https://meet.mediconnect.local/room/cardio-consult" },
    { id: 2, doctor: "Dr. Rohan Mehta", specialty: "Cardiology", date: "2026-05-10 10:00 AM", status: "completed", url: "#" }
  ];

  const handleJoin = (url) => {
    toast.success("Redirecting to WebRTC secure meeting space...");
    window.open(url, "_blank");
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Virtual Consultations"
        title="Telemedicine Workspace"
        description="Connect with your clinical specialists via secure in-app audio-video consultations."
      />

      <div className="rounded-[28px] border border-slate-200/50 bg-white/85 p-6 shadow-premium backdrop-blur-md dark:border-neutral-200/10 dark:bg-neutral-100/70">
        <h2 className="mb-4 text-base font-bold tracking-tight text-slate-900 dark:text-white">
          Telemedicine Sessions Log
        </h2>
        <PaginatedTable
          rows={sessions}
          pageSize={5}
          columns={[
            {
              key: "doctor",
              label: "Clinician Specialist",
              render: (row) => (
                <div className="flex items-center gap-2 font-semibold">
                  <User className="h-4 w-4 text-slate-400" />
                  <div>
                    <div className="text-slate-900 dark:text-white">{row.doctor}</div>
                    <div className="text-xxs font-bold text-slate-400 uppercase">{row.specialty}</div>
                  </div>
                </div>
              )
            },
            {
              key: "date",
              label: "Consultation Date & Time",
              render: (row) => (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <span>{row.date}</span>
                </div>
              )
            },
            {
              key: "status",
              label: "Connection Status",
              render: (row) => (
                <Badge tone={row.status === "ready" ? "success" : "slate"}>
                  {row.status.toUpperCase()}
                </Badge>
              )
            },
            {
              key: "actions",
              label: "Connection Link",
              render: (row) => (
                row.status === "ready" ? (
                  <Button size="sm" onClick={() => handleJoin(row.url)}>
                    <Video className="h-3.5 w-3.5 mr-1" /> Join Call
                  </Button>
                ) : (
                  <span className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> Finished
                  </span>
                )
              )
            }
          ]}
        />
      </div>
    </div>
  );
}
