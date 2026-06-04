const notificationRepository = require("../repositories/notificationRepository");
const firebaseService = require("./firebaseService");
const deviceTokenRepo = require("../repositories/deviceTokenRepository");
const { safeEmitToUser } = require("../realtime/io");
const logger = require("../utils/logger");

const NOTIFICATION_TYPES = {
  APPOINTMENT_REMINDER: "APPOINTMENT_REMINDER",
  INVOICE_GENERATED: "INVOICE_GENERATED",
  LAB_REPORT_AVAILABLE: "LAB_REPORT_AVAILABLE",
  PRESCRIPTION_READY: "PRESCRIPTION_READY",
};

/**
 * Send a notification to a single user via both 'in_app' and 'push' (FCM).
 */
async function sendToUser({ userId, hospitalId, title, body, eventType, data = {} }) {
  // 1. Create DB notification for in_app
  const inAppNotification = await notificationRepository.createNotification({
    hospitalId,
    userId,
    channel: "in_app",
    eventType,
    title,
    body,
    data,
    status: "sent",
  });
  
  // Realtime emit
  safeEmitToUser(userId, "notification:new", inAppNotification);

  // 2. Create DB notification for push
  let pushStatus = "queued";
  let fcmResult = null;
  
  try {
    fcmResult = await firebaseService.sendToUser({ userId, title, body, data });
    pushStatus = fcmResult.sent > 0 ? "sent" : "failed";
  } catch (err) {
    logger.error("Failed to send push notification via Firebase", { userId, error: err.message });
    pushStatus = "failed";
  }

  await notificationRepository.createNotification({
    hospitalId,
    userId,
    channel: "push",
    eventType,
    title,
    body,
    data,
    status: pushStatus,
  });

  return { inAppNotification, fcmResult };
}

/**
 * Send a notification to multiple users via both 'in_app' and 'push' (FCM).
 */
async function sendToMultipleUsers({ userIds, hospitalId, title, body, eventType, data = {} }) {
  const results = [];
  
  for (const userId of userIds) {
    const res = await sendToUser({ userId, hospitalId, title, body, eventType, data });
    results.push({ userId, ...res });
  }
  
  return results;
}

/**
 * Send a notification to all users with active tokens in a hospital.
 */
async function sendToHospital({ hospitalId, title, body, eventType, data = {} }) {
  // 1. Get all active tokens for the hospital
  const tokenRows = await deviceTokenRepo.getActiveTokensForHospital(hospitalId);
  if (tokenRows.length === 0) {
    logger.info("No active device tokens found for hospital", { hospitalId });
    return { sent: 0 };
  }

  // Get unique user IDs
  const uniqueUserIds = [...new Set(tokenRows.map((r) => r.user_id))];

  // 2. Record notifications in DB for all unique users
  for (const userId of uniqueUserIds) {
    // In-app DB notification
    const inAppNotification = await notificationRepository.createNotification({
      hospitalId,
      userId,
      channel: "in_app",
      eventType,
      title,
      body,
      data,
      status: "sent",
    });
    safeEmitToUser(userId, "notification:new", inAppNotification);
  }

  // 3. Low-level Firebase send to hospital
  let fcmResult = null;
  try {
    fcmResult = await firebaseService.sendToHospital({ hospitalId, title, body, data });
  } catch (err) {
    logger.error("Failed to send push notifications to hospital via Firebase", { hospitalId, error: err.message });
  }

  // 4. Record push notification entry in DB for all unique users
  for (const userId of uniqueUserIds) {
    await notificationRepository.createNotification({
      hospitalId,
      userId,
      channel: "push",
      eventType,
      title,
      body,
      data,
      status: fcmResult && fcmResult.sent > 0 ? "sent" : "failed",
    });
  }

  return { uniqueUserIdsCount: uniqueUserIds.length, fcmResult };
}

/**
 * Legacy support / generic notifier
 */
async function notifyUser({
  hospitalId,
  userId,
  title,
  body,
  eventType,
  data,
  channels = ["in_app"],
}) {
  let inAppNotification = null;

  for (const channel of channels) {
    let status = channel === "in_app" ? "sent" : "queued";
    
    if (channel === "push") {
      try {
        const fcmResult = await firebaseService.sendToUser({ userId, title, body, data });
        status = fcmResult.sent > 0 ? "sent" : "failed";
      } catch (err) {
        logger.error("Failed to send push notification via Firebase in notifyUser", { userId, error: err.message });
        status = "failed";
      }
    }

    const notification = await notificationRepository.createNotification({
      hospitalId,
      userId,
      channel,
      eventType,
      title,
      body,
      data,
      status,
    });

    if (channel === "in_app") {
      inAppNotification = notification;
      safeEmitToUser(userId, "notification:new", notification);
    }
  }

  return inAppNotification;
}

module.exports = {
  NOTIFICATION_TYPES,
  sendToUser,
  sendToMultipleUsers,
  sendToHospital,
  notifyUser,
};
