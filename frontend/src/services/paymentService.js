import api from "./apiClient";
import { downloadProtectedFile } from "./downloadService";

export async function createOrder(invoiceId, paymentMethod = "UPI") {
  const response = await api.post("/payments/create-order", { invoiceId, paymentMethod });
  return response.data;
}

export async function verifyPayment(data) {
  const response = await api.post("/payments/verify", data);
  return response.data;
}

export async function refundPayment(paymentId, amount) {
  const response = await api.post("/payments/refund", { paymentId, amount });
  return response.data;
}

export async function getHistory() {
  const response = await api.get("/payments/history");
  return response.data;
}

// Legacy backward-compatibility exports
export async function listPayments() {
  const response = await api.get("/payments/history");
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

export async function downloadInvoicePdf(invoiceId) {
  await downloadProtectedFile(`/payments/${invoiceId}/invoice-pdf`, `invoice-${invoiceId}.pdf`);
}
