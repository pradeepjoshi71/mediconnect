const notificationRepository = require("../repositories/notificationRepository");
const { safeEmitToUser } = require("../realtime/io");
const logger = require("../utils/logger");

async function notifyUser({
  userId,
  title,
  body,
  eventType,
  data,
  channels = ["in_app"],
}) {
  let inAppNotification = null;

  for (const channel of channels) {
    const notification = await notificationRepository.createNotification({
      userId,
      channel,
      eventType,
      title,
      body,
      data,
      status: channel === "in_app" ? "sent" : "queued",
    });

    if (channel === "in_app") {
      inAppNotification = notification;
      safeEmitToUser(userId, "notification:new", notification);
    } else {
      logger.info("Placeholder outbound notification queued", {
        channel,
        userId,
        eventType,
      });
    }
  }

  return inAppNotification;
}

module.exports = { notifyUser };
