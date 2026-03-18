export function formatDateTime(value) {
  if (!value) return "N/A";
  return new Date(value).toLocaleString();
}

export function formatDate(value) {
  if (!value) return "N/A";
  return new Date(value).toLocaleDateString();
}

export function formatCurrency(amountCents, currency = "INR") {
  const amount = Number(amountCents || 0) / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function statusTone(status = "") {
  if (["paid", "completed", "confirmed"].includes(status)) return "teal";
  if (["processing", "checked_in", "in_consultation", "urgent"].includes(status)) return "amber";
  if (["cancelled", "failed", "no_show"].includes(status)) return "rose";
  return "brand";
}
