const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const deviceTokenRepo = require('../repositories/deviceTokenRepository');
const logger = require('../utils/logger');

let firebaseApp = null;

function getFirebaseApp() {
  if (firebaseApp) return firebaseApp;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  let serviceAccount = null;

  if (serviceAccountJson && serviceAccountJson.trim()) {
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
      logger.info('Firebase: Loaded configuration from FIREBASE_SERVICE_ACCOUNT_JSON env var');
    } catch (err) {
      logger.error('Firebase: Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON env var', { error: err.message });
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Firebase: invalid service account JSON configuration in production');
      }
    }
  } else if (serviceAccountPath && serviceAccountPath.trim()) {
    try {
      const absolutePath = path.resolve(serviceAccountPath);
      if (fs.existsSync(absolutePath)) {
        const fileContent = fs.readFileSync(absolutePath, 'utf8');
        serviceAccount = JSON.parse(fileContent);
        logger.info(`Firebase: Loaded configuration from service account file: ${absolutePath}`);
      } else {
        logger.error(`Firebase: Service account file not found at path: ${absolutePath}`);
        if (process.env.NODE_ENV === 'production') {
          throw new Error(`Firebase: service account file not found at ${absolutePath} in production`);
        }
      }
    } catch (err) {
      logger.error('Firebase: Failed to read/parse service account file', { error: err.message });
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Firebase: invalid service account file configuration in production');
      }
    }
  }

  if (!serviceAccount) {
    logger.warn('Firebase: FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH not set – push notifications disabled');
    return null;
  }

  try {
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    logger.info('Firebase Admin SDK initialised');
  } catch (err) {
    logger.error('Firebase: failed to initialise Admin SDK', { error: err.message });
    if (process.env.NODE_ENV === 'production') {
      throw err;
    }
    return null;
  }

  return firebaseApp;
}

/**
 * Send a push notification to all active FCM tokens of a user.
 */
async function sendToUser({ userId, title, body, data = {} }) {
  const app = getFirebaseApp();
  if (!app) return { sent: 0, errors: ['Firebase not initialised'] };

  const tokens = await deviceTokenRepo.getActiveTokensForUser(userId);
  if (tokens.length === 0) return { sent: 0, errors: [] };

  const messaging = admin.messaging(app);
  const results = await Promise.allSettled(
    tokens.map((t) =>
      messaging.send({
        token: t.fcm_token,
        notification: { title, body },
        data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      })
    )
  );

  const errors = [];
  let sent = 0;
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === 'fulfilled') {
      sent++;
    } else {
      const errorMsg = r.reason?.message || 'Unknown error';
      const errorCode = r.reason?.code;
      errors.push(errorMsg);
      logger.warn('Firebase push failed', { error: errorMsg, code: errorCode });

      if (errorCode === 'messaging/registration-token-not-registered' || 
          errorCode === 'messaging/invalid-registration-token') {
        try {
          await deviceTokenRepo.deactivateToken(userId, tokens[i].fcm_token);
          logger.info(`Deactivated invalid Firebase token for user ${userId}`, { token: tokens[i].fcm_token });
        } catch (deactErr) {
          logger.error('Failed to deactivate invalid Firebase token', { userId, error: deactErr.message });
        }
      }
    }
  }
  return { sent, errors };
}

/**
 * Send push notifications to multiple users (multicast, batch).
 * Chunked in groups of 500 to adhere to FCM limits.
 */
async function sendToMultipleUsers({ userIds, title, body, data = {} }) {
  const app = getFirebaseApp();
  if (!app) return { sent: 0, failed: 0, errors: ['Firebase not initialised'] };

  const tokenRows = await deviceTokenRepo.getActiveTokensForUsers(userIds);
  if (tokenRows.length === 0) return { sent: 0, failed: 0 };

  const messaging = admin.messaging(app);
  let totalSent = 0;
  let totalFailed = 0;

  for (let i = 0; i < tokenRows.length; i += 500) {
    const chunkRows = tokenRows.slice(i, i + 500);
    const chunkTokens = chunkRows.map((r) => r.fcm_token);
    const message = {
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      tokens: chunkTokens,
    };

    const response = await messaging.sendEachForMulticast(message);
    totalSent += response.successCount;
    totalFailed += response.failureCount;

    // Inspect responses to clean up invalid tokens
    for (let idx = 0; idx < response.responses.length; idx++) {
      const res = response.responses[idx];
      if (!res.success) {
        const errorCode = res.error?.code;
        if (errorCode === 'messaging/registration-token-not-registered' || 
            errorCode === 'messaging/invalid-registration-token') {
          const failedRow = chunkRows[idx];
          try {
            await deviceTokenRepo.deactivateToken(failedRow.user_id, failedRow.fcm_token);
            logger.info(`Deactivated invalid Firebase token for user ${failedRow.user_id}`, { token: failedRow.fcm_token });
          } catch (deactErr) {
            logger.error('Failed to deactivate invalid Firebase token in multicast', { userId: failedRow.user_id, error: deactErr.message });
          }
        }
      }
    }
  }

  logger.info(`Firebase multicast: ${totalSent} sent, ${totalFailed} failed`);
  return { sent: totalSent, failed: totalFailed };
}

/**
 * Send push notifications to a whole hospital (multicast, batch).
 * Chunked in groups of 500 to adhere to FCM limits.
 */
async function sendToHospital({ hospitalId, title, body, data = {} }) {
  const app = getFirebaseApp();
  if (!app) return { sent: 0, failed: 0, errors: ['Firebase not initialised'] };

  const tokenRows = await deviceTokenRepo.getActiveTokensForHospital(hospitalId);
  if (tokenRows.length === 0) return { sent: 0, failed: 0 };

  const messaging = admin.messaging(app);
  let totalSent = 0;
  let totalFailed = 0;

  for (let i = 0; i < tokenRows.length; i += 500) {
    const chunkRows = tokenRows.slice(i, i + 500);
    const chunkTokens = chunkRows.map((r) => r.fcm_token);
    const message = {
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      tokens: chunkTokens,
    };

    const response = await messaging.sendEachForMulticast(message);
    totalSent += response.successCount;
    totalFailed += response.failureCount;

    // Inspect responses to clean up invalid tokens
    for (let idx = 0; idx < response.responses.length; idx++) {
      const res = response.responses[idx];
      if (!res.success) {
        const errorCode = res.error?.code;
        if (errorCode === 'messaging/registration-token-not-registered' || 
            errorCode === 'messaging/invalid-registration-token') {
          const failedRow = chunkRows[idx];
          try {
            await deviceTokenRepo.deactivateToken(failedRow.user_id, failedRow.fcm_token);
            logger.info(`Deactivated invalid Firebase token for user ${failedRow.user_id}`, { token: failedRow.fcm_token });
          } catch (deactErr) {
            logger.error('Failed to deactivate invalid Firebase token in hospital multicast', { userId: failedRow.user_id, error: deactErr.message });
          }
        }
      }
    }
  }

  logger.info(`Firebase hospital multicast for hospital ${hospitalId}: ${totalSent} sent, ${totalFailed} failed`);
  return { sent: totalSent, failed: totalFailed };
}

// Preserve existing name for compatibility
const sendToUsers = sendToMultipleUsers;

module.exports = {
  getFirebaseApp,
  sendToUser,
  sendToUsers,
  sendToMultipleUsers,
  sendToHospital,
};
