import api from "./apiClient";
import { downloadProtectedFile } from "./downloadService";

export async function listInvoices(filters = {}) {
  const response = await api.get("/invoices", { params: filters });
  return response.data;
}

export async function getInvoiceById(id) {
  const response = await api.get(`/invoices/${id}`);
  return response.data;
}

export async function createInvoice(data) {
  const response = await api.post("/invoices", data);
  return response.data;
}

export async function updateInvoice(id, data) {
  const response = await api.put(`/invoices/${id}`, data);
  return response.data;
}

export async function cancelInvoice(id) {
  const response = await api.delete(`/invoices/${id}`);
  return response.data;
}

export async function getRevenueReports() {
  const response = await api.get("/invoices/reports/revenue");
  return response.data;
}

export async function downloadInvoicePdf(invoiceId) {
  await downloadProtectedFile(`/payments/${invoiceId}/invoice-pdf`, `invoice-${invoiceId}.pdf`);
}
