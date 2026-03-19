const paymentRepository = require("../repositories/paymentRepository");
const patientRepository = require("../repositories/patientRepository");
const appointmentRepository = require("../repositories/appointmentRepository");
const auditService = require("./auditService");
const { buildPdfBuffer } = require("../utils/pdf");
const { AppError } = require("../utils/http");

function nextInvoiceNumber() {
  return `INV-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
}

function providerCheckoutUrl(provider, paymentId) {
  if (provider === "stripe") {
    return `https://checkout.stripe.com/pay/mock_${paymentId}`;
  }
  if (provider === "razorpay") {
    return `https://razorpay.com/payment/mock_${paymentId}`;
  }
  return `https://payments.local/mock/${paymentId}`;
}

async function createInvoiceForAppointment({
  appointment,
  initiatedByUserId,
  hospitalId,
  provider = "stripe",
  currency = "INR",
}) {
  return paymentRepository.createPayment({
    hospitalId,
    appointmentId: appointment.id,
    patientId: appointment.patientId,
    initiatedByUserId,
    provider,
    amountCents: appointment.consultationFeeCents || 5000,
    currency,
    invoiceNumber: nextInvoiceNumber(),
    paymentMethodLabel: provider === "stripe" ? "Card" : "Gateway",
    metadata: {
      appointmentType: appointment.appointmentType,
      priority: appointment.priority,
    },
  });
}

async function listPayments(user, context) {
  const patient = user.role === "patient"
    ? await patientRepository.findPatientByUserId(user.id, user.hospitalId)
    : null;

  const payments = await paymentRepository.listPayments({
    hospitalId: user.hospitalId,
    role: user.role,
    patientId: patient?.id,
  });

  if (context) {
    await auditService.recordAuditEvent({
      user,
      action: "billing.payments.view",
      entityType: "payment",
      entityId: patient?.id || "hospital",
      metadata: {
        paymentCount: payments.length,
        role: user.role,
      },
      context,
    });
  }

  return payments;
}

async function createCheckout(user, paymentId, provider, context) {
  const payment = await paymentRepository.findPaymentById(paymentId, user.hospitalId);
  if (!payment) {
    throw new AppError(404, "Payment not found");
  }

  if (user.role === "patient") {
    const patient = await patientRepository.findPatientByUserId(user.id, user.hospitalId);
    if (!patient || patient.id !== payment.patientId) {
      throw new AppError(403, "Forbidden");
    }
  }

  const updated = await paymentRepository.updatePayment(paymentId, user.hospitalId, {
    status: "processing",
    paymentMethodLabel: provider === "razorpay" ? "Razorpay checkout" : "Stripe checkout",
  });

  await auditService.recordAuditEvent({
    user,
    action: "billing.checkout.create",
    entityType: "payment",
    entityId: paymentId,
    metadata: { provider },
    context,
  });

  return {
    payment: updated,
    checkoutUrl: providerCheckoutUrl(provider, paymentId),
    note: "External payment gateway integration is scaffolded with a placeholder URL.",
  };
}

async function markPaymentStatus(user, paymentId, status, context) {
  const payment = await paymentRepository.findPaymentById(paymentId, user.hospitalId);
  if (!payment) {
    throw new AppError(404, "Payment not found");
  }

  if (user.role === "patient") {
    const patient = await patientRepository.findPatientByUserId(user.id, user.hospitalId);
    if (!patient || patient.id !== payment.patientId) {
      throw new AppError(403, "Forbidden");
    }
  }

  const updated = await paymentRepository.updatePayment(paymentId, user.hospitalId, { status });

  await auditService.recordAuditEvent({
    user,
    action: "billing.payment.status",
    entityType: "payment",
    entityId: paymentId,
    metadata: { status },
    context,
  });

  return updated;
}

async function buildInvoicePdf(user, paymentId, context) {
  const payment = await paymentRepository.findPaymentById(paymentId, user.hospitalId);
  if (!payment) {
    throw new AppError(404, "Payment not found");
  }

  if (user.role === "patient") {
    const patient = await patientRepository.findPatientByUserId(user.id, user.hospitalId);
    if (!patient || patient.id !== payment.patientId) {
      throw new AppError(403, "Forbidden");
    }
  }

  const appointment = payment.appointmentId
    ? await appointmentRepository.findAppointmentById(payment.appointmentId, user.hospitalId)
    : null;

  await auditService.recordAuditEvent({
    user,
    action: "billing.invoice.download",
    entityType: "payment",
    entityId: paymentId,
    metadata: { invoiceNumber: payment.invoiceNumber },
    context,
  });

  return {
    fileName: `${payment.invoiceNumber}.pdf`,
    buffer: buildPdfBuffer({
      title: `Invoice ${payment.invoiceNumber}`,
      subtitle: "MediConnect Hospital Billing",
      sections: [
        {
          heading: "Patient",
          lines: [
            `Name: ${payment.patientName}`,
            `Doctor: ${payment.doctorName || "N/A"}`,
            `Appointment: ${appointment?.scheduledStart ? new Date(appointment.scheduledStart).toLocaleString() : "N/A"}`,
          ],
        },
        {
          heading: "Payment",
          lines: [
            `Status: ${payment.status}`,
            `Provider: ${payment.provider}`,
            `Amount: ${(payment.amountCents / 100).toFixed(2)} ${payment.currency}`,
            `Paid at: ${payment.paidAt ? new Date(payment.paidAt).toLocaleString() : "Pending"}`,
          ],
        },
      ],
    }),
  };
}

module.exports = {
  createInvoiceForAppointment,
  listPayments,
  createCheckout,
  markPaymentStatus,
  buildInvoicePdf,
};
