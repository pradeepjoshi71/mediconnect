import api from "./apiClient";
import { downloadProtectedFile } from "./downloadService";

export async function listPayments() {
  const response = await api.get("/payments");
  return response.data;
}

export async function createCheckout(paymentId, provider) {
  const response = await api.post(`/payments/${paymentId}/checkout`, { provider });
  return response.data;
}

export async function updatePaymentStatus(paymentId, status) {
  const response = await api.patch(`/payments/${paymentId}/status`, { status });
  return response.data;
}

export async function downloadInvoicePdf(paymentId) {
  await downloadProtectedFile(`/payments/${paymentId}/invoice-pdf`, `invoice-${paymentId}.pdf`);
}
