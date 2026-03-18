const { z } = require("zod");
const notificationRepository = require("../repositories/notificationRepository");
const { asyncHandler } = require("../middlewares/asyncHandler");

const listNotifications = asyncHandler(async (req, res) => {
  res.json(await notificationRepository.listNotifications(req.user.id));
});

const markRead = asyncHandler(async (req, res) => {
  const params = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
  const result = await notificationRepository.markRead(params.id, req.user.id);
  if (!result) {
    return res.status(404).json({ message: "Notification not found" });
  }
  return res.json(result);
});

const markAllRead = asyncHandler(async (req, res) => {
  await notificationRepository.markAllRead(req.user.id);
  res.status(204).send();
});

module.exports = {
  listNotifications,
  markRead,
  markAllRead,
};
