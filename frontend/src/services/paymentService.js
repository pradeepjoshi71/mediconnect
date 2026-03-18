import api from "./apiClient";

export async function createCheckout({ appointmentId, provider, amountCents, currency }) {
  const res = await api.post("/payments/checkout", {
    appointmentId,
    provider,
    amountCents,
    currency,
  });
  return res.data;
}

export async function listPayments() {
  const res = await api.get("/payments");
  return res.data;
}

export async function markPaid(id) {
  const res = await api.post(`/payments/${id}/mark-paid`);
  return res.data;
}

