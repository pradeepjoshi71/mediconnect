import { KpiCard } from "./KpiCard";

export function StatCard({ icon, label, value, helper, accent = "brand" }) {
  return (
    <KpiCard
      icon={icon}
      label={label}
      value={value}
      helper={helper}
      accent={accent}
    />
  );
}

