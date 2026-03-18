const { z } = require("zod");
const telemedicineService = require("../services/telemedicineService");
const { asyncHandler } = require("../middlewares/asyncHandler");

const getSession = asyncHandler(async (req, res) => {
  const params = z.object({ appointmentId: z.coerce.number().int().positive() }).parse(req.params);
  res.json(await telemedicineService.getOrCreateSession(req.user, params.appointmentId));
});

const listMessages = asyncHandler(async (req, res) => {
  const params = z.object({ appointmentId: z.coerce.number().int().positive() }).parse(req.params);
  res.json(await telemedicineService.listMessages(req.user, params.appointmentId));
});

const sendMessage = asyncHandler(async (req, res) => {
  const params = z.object({ appointmentId: z.coerce.number().int().positive() }).parse(req.params);
  const payload = z.object({ body: z.string().min(1).max(1000) }).parse(req.body);
  res.status(201).json(
    await telemedicineService.sendMessage(req.user, params.appointmentId, payload.body)
  );
});

module.exports = {
  getSession,
  listMessages,
  sendMessage,
};
