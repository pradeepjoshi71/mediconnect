const deviceTokenRepo = require('../repositories/deviceTokenRepository');
const firebaseService = require('../services/firebaseService');
const { AppError } = require('../utils/http');

async function registerToken(req, res, next) {
  try {
    const { fcmToken, platform } = req.body;
    if (!fcmToken) throw new AppError(400, 'fcmToken is required');
    const token = await deviceTokenRepo.upsertDeviceToken({
      userId: req.user.id,
      hospitalId: req.user.hospitalId,
      fcmToken,
      platform: platform || 'web',
    });
    res.status(201).json({ success: true, token });
  } catch (err) {
    next(err);
  }
}

async function deregisterToken(req, res, next) {
  try {
    const { fcmToken } = req.body;
    if (!fcmToken) throw new AppError(400, 'fcmToken is required');
    await deviceTokenRepo.deactivateToken(req.user.id, fcmToken);
    res.json({ success: true, message: 'Token deregistered' });
  } catch (err) {
    next(err);
  }
}

/**
 * Admin-only: send a push notification to a user by ID.
 */
async function sendPush(req, res, next) {
  try {
    const { userId, title, body, data } = req.body;
    if (!userId || !title || !body) throw new AppError(400, 'userId, title and body are required');
    const result = await firebaseService.sendToUser({ userId: parseInt(userId, 10), title, body, data });
    res.json({ success: true, result });
  } catch (err) {
    next(err);
  }
}

module.exports = { registerToken, deregisterToken, sendPush };
