const { z } = require("zod");
const telemedicineService = require("../services/telemedicineService");
const { asyncHandler } = require("../middlewares/asyncHandler");

const getSession = asyncHandler(async (req, res) => {
  const params = z.object({ appointmentId: z.coerce.number().int().positive() }).parse(req.params);
  res.json(
    await telemedicineService.getOrCreateSession(req.user, params.appointmentId, req.auditContext)
  );
});

const listMessages = asyncHandler(async (req, res) => {
  const params = z.object({ appointmentId: z.coerce.number().int().positive() }).parse(req.params);
  res.json(
    await telemedicineService.listMessages(req.user, params.appointmentId, req.auditContext)
  );
});

const sendMessage = asyncHandler(async (req, res) => {
  const params = z.object({ appointmentId: z.coerce.number().int().positive() }).parse(req.params);
  const payload = z.object({ body: z.string().min(1).max(1000) }).parse(req.body);
  res.status(201).json(
    await telemedicineService.sendMessage(
      req.user,
      params.appointmentId,
      payload.body,
      req.auditContext
    )
  );
});
const endSession = asyncHandler(async (req, res) => {
  const params = z.object({ appointmentId: z.coerce.number().int().positive() }).parse(req.params);
  const result = await telemedicineService.endSession(req.user, params.appointmentId, req.auditContext);
  res.json(result);
});

const updateNotes = asyncHandler(async (req, res) => {
  const params = z.object({ appointmentId: z.coerce.number().int().positive() }).parse(req.params);
  const payload = z.object({ notes: z.string().min(1) }).parse(req.body);
  const result = await telemedicineService.updateNotes(req.user, params.appointmentId, payload.notes, req.auditContext);
  res.json(result);
});

const updateRecordingMetadata = asyncHandler(async (req, res) => {
  const params = z.object({ appointmentId: z.coerce.number().int().positive() }).parse(req.params);
  const payload = z.object({ recordingMetadata: z.record(z.string(), z.any()) }).parse(req.body);
  const result = await telemedicineService.updateRecordingMetadata(req.user, params.appointmentId, payload.recordingMetadata, req.auditContext);
  res.json(result);
});

const listSessionHistory = asyncHandler(async (req, res) => {
  const result = await telemedicineService.listSessionHistory(req.user, req.auditContext);
  res.json(result);
});

module.exports = {
  getSession,
  listMessages,
  sendMessage,
  endSession,
  updateNotes,
  updateRecordingMetadata,
  listSessionHistory,
};
