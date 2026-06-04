const deviceTokenRepo = require('../repositories/deviceTokenRepository');
const notificationService = require('../services/notificationService');
const authRepo = require('../repositories/authRepository');
const auditService = require('../services/auditService');
const { AppError } = require('../utils/http');

/**
 * Register or update device token for current user
 */
async function registerToken(req, res, next) {
  try {
    const { fcmToken, deviceToken, platform } = req.body;
    const tokenVal = fcmToken || deviceToken;
    if (!tokenVal) throw new AppError(400, 'deviceToken or fcmToken is required');

    const token = await deviceTokenRepo.upsertDeviceToken({
      userId: req.user.id,
      hospitalId: req.user.hospitalId,
      deviceToken: tokenVal,
      platform: platform || 'web',
    });

    await auditService.recordAuditEvent({
      user: req.user,
      action: 'push.token.register',
      entityType: 'device_token',
      entityId: token.id,
      metadata: { platform: platform || 'web' },
      context: req.auditContext,
    });

    res.status(201).json({ success: true, token });
  } catch (err) {
    next(err);
  }
}

/**
 * Deactivate (remove) device token for current user
 */
async function deregisterToken(req, res, next) {
  try {
    const { fcmToken, deviceToken } = req.body;
    const tokenVal = fcmToken || deviceToken;
    if (!tokenVal) throw new AppError(400, 'deviceToken or fcmToken is required');

    const token = await deviceTokenRepo.deactivateToken(req.user.id, tokenVal);

    if (token) {
      await auditService.recordAuditEvent({
        user: req.user,
        action: 'push.token.remove',
        entityType: 'device_token',
        entityId: token.id,
        metadata: { platform: token.platform },
        context: req.auditContext,
      });
    }

    res.json({ success: true, message: 'Token deregistered', token });
  } catch (err) {
    next(err);
  }
}

/**
 * List device tokens (admin/super_admin only)
 * Enforces tenant isolation: hospital_admin can only list tokens in their own hospital.
 */
async function listTokens(req, res, next) {
  try {
    const { userId, limit, offset } = req.query;
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;

    let hospitalIdFilter = null;
    if (req.user.role !== 'super_admin') {
      hospitalIdFilter = req.user.hospitalId;
    }

    const parsedUserId = userId ? parseInt(userId, 10) : null;

    const tokens = await deviceTokenRepo.listDeviceTokens({
      userId: parsedUserId,
      hospitalId: hospitalIdFilter,
      limit: parsedLimit,
      offset: parsedOffset,
    });

    res.json({ success: true, tokens });
  } catch (err) {
    next(err);
  }
}

/**
 * Send push notification to a user. Admin-only.
 * Enforces tenant isolation: hospital_admin can only notify users from their hospital.
 */
async function sendPush(req, res, next) {
  try {
    const { userId, title, body, eventType, data } = req.body;
    if (!userId || !title || !body) throw new AppError(400, 'userId, title and body are required');

    const targetUserId = parseInt(userId, 10);
    const targetUser = await authRepo.findUserById(targetUserId);

    if (!targetUser) {
      throw new AppError(404, 'User not found');
    }

    // Tenant isolation
    if (req.user.role !== 'super_admin' && targetUser.hospitalId !== req.user.hospitalId) {
      throw new AppError(403, 'Forbidden: You can only notify users from your own hospital');
    }

    const result = await notificationService.sendToUser({
      userId: targetUserId,
      hospitalId: targetUser.hospitalId,
      title,
      body,
      eventType: eventType || 'SYSTEM',
      data: data || {},
    });

    await auditService.recordAuditEvent({
      user: req.user,
      action: 'push.send.single',
      entityType: 'device_token',
      entityId: targetUserId,
      metadata: { eventType: eventType || 'SYSTEM', targetUserId },
      context: req.auditContext,
    });

    res.json({ success: true, result });
  } catch (err) {
    next(err);
  }
}

/**
 * Send push notifications to multiple users. Admin-only.
 * Enforces tenant isolation: hospital_admin can only notify users from their hospital.
 */
async function sendPushBatch(req, res, next) {
  try {
    const { userIds, title, body, eventType, data } = req.body;
    if (!userIds || !Array.isArray(userIds) || !title || !body) {
      throw new AppError(400, 'userIds (array of numbers), title and body are required');
    }

    const parsedUserIds = userIds.map((id) => parseInt(id, 10));

    // Verify all target users exist and belong to caller's hospital if not super_admin
    for (const targetId of parsedUserIds) {
      const targetUser = await authRepo.findUserById(targetId);
      if (!targetUser) {
        throw new AppError(404, `User ${targetId} not found`);
      }
      if (req.user.role !== 'super_admin' && targetUser.hospitalId !== req.user.hospitalId) {
        throw new AppError(403, `Forbidden: You can only notify users from your own hospital. User ${targetId} is not in your hospital.`);
      }
    }

    // Use hospitalId of caller or target user (they are verified to match if not super_admin)
    // If super_admin, we can use the first user's hospitalId or default to super_admin's hospitalId
    let targetHospitalId = req.user.hospitalId;
    if (req.user.role === 'super_admin' && parsedUserIds.length > 0) {
      const firstUser = await authRepo.findUserById(parsedUserIds[0]);
      targetHospitalId = firstUser.hospitalId;
    }

    const result = await notificationService.sendToMultipleUsers({
      userIds: parsedUserIds,
      hospitalId: targetHospitalId,
      title,
      body,
      eventType: eventType || 'SYSTEM',
      data: data || {},
    });

    await auditService.recordAuditEvent({
      user: req.user,
      action: 'push.send.batch',
      entityType: 'device_token',
      entityId: null,
      metadata: { eventType: eventType || 'SYSTEM', targetCount: parsedUserIds.length },
      context: req.auditContext,
    });

    res.json({ success: true, result });
  } catch (err) {
    next(err);
  }
}

/**
 * Send push notifications to all users of a hospital. Admin-only.
 * Enforces tenant isolation: hospital_admin can only notify their own hospital.
 */
async function sendPushHospital(req, res, next) {
  try {
    const { hospitalId, title, body, eventType, data } = req.body;
    if (!hospitalId || !title || !body) throw new AppError(400, 'hospitalId, title and body are required');

    const targetHospitalId = parseInt(hospitalId, 10);

    // Tenant isolation
    if (req.user.role !== 'super_admin' && targetHospitalId !== req.user.hospitalId) {
      throw new AppError(403, 'Forbidden: You can only notify users from your own hospital');
    }

    const result = await notificationService.sendToHospital({
      hospitalId: targetHospitalId,
      title,
      body,
      eventType: eventType || 'SYSTEM',
      data: data || {},
    });

    await auditService.recordAuditEvent({
      user: req.user,
      action: 'push.send.hospital',
      entityType: 'device_token',
      entityId: null,
      metadata: { eventType: eventType || 'SYSTEM', hospitalId: targetHospitalId, targetCount: result.uniqueUserIdsCount || 0 },
      context: req.auditContext,
    });

    res.json({ success: true, result });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  registerToken,
  deregisterToken,
  listTokens,
  sendPush,
  sendPushBatch,
  sendPushHospital,
};
