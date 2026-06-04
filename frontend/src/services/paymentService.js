import api from "./apiClient";
import { downloadProtectedFile } from "./downloadService";

export async function createOrder(invoiceId, paymentMethod = "UPI") {
  const response = await api.post("/payments/create-order", { invoiceId, paymentMethod }, {
    baseURL: "/api"
  });
  return response.data;
}

export async function verifyPayment(data) {
  const response = await api.post("/payments/verify", data, {
    baseURL: "/api"
  });
  return response.data;
}

export async function refundPayment(paymentId, amount) {
  const response = await api.post("/payments/refund", { paymentId, amount }, {
    baseURL: "/api"
  });
  return response.data;
}

export async function getHistory() {
  const response = await api.get("/payments/history", {
    baseURL: "/api"
  });
  return response.data;
}

// Legacy backward-compatibility exports
export async function listPayments() {
  const response = await api.get("/payments/history", {
    baseURL: "/api"
  });
  return response.data;
}

export async function createCheckout(paymentId, provider) {
  const response = await api.post(`/payments/${paymentId}/checkout`, { provider }, {
    baseURL: "/api"
  });
  return response.data;
}

export async function updatePaymentStatus(paymentId, status) {
  const response = await api.patch(`/payments/${paymentId}/status`, { status }, {
    baseURL: "/api"
  });
  return response.data;
}

export async function downloadInvoicePdf(invoiceId) {
  await downloadProtectedFile(`/payments/${invoiceId}/invoice-pdf`, `invoice-${invoiceId}.pdf`);
}
