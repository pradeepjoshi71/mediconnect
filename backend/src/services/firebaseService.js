const admin = require('firebase-admin');
const deviceTokenRepo = require('../repositories/deviceTokenRepository');
const logger = require('../utils/logger');

let firebaseApp = null;

function getFirebaseApp() {
  if (firebaseApp) return firebaseApp;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    logger.warn('Firebase: FIREBASE_SERVICE_ACCOUNT_JSON not set – push notifications disabled');
    return null;
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountJson);
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    logger.info('Firebase Admin SDK initialised');
  } catch (err) {
    logger.error('Firebase: failed to initialise Admin SDK', { error: err.message });
    return null;
  }

  return firebaseApp;
}

/**
 * Send a push notification to all active FCM tokens of a user.
 */
async function sendToUser({ userId, title, body, data = {} }) {
  const app = getFirebaseApp();
  if (!app) return { sent: 0, errors: [] };

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
  for (const r of results) {
    if (r.status === 'fulfilled') {
      sent++;
    } else {
      errors.push(r.reason?.message || 'Unknown error');
      logger.warn('Firebase push failed', { error: r.reason?.message });
    }
  }
  return { sent, errors };
}

/**
 * Send push notifications to multiple users (bulk).
 */
async function sendToUsers({ userIds, title, body, data = {} }) {
  const app = getFirebaseApp();
  if (!app) return { sent: 0 };

  const tokenRows = await deviceTokenRepo.getActiveTokensForUsers(userIds);
  if (tokenRows.length === 0) return { sent: 0 };

  const messaging = admin.messaging(app);
  const message = {
    notification: { title, body },
    data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
    tokens: tokenRows.map((r) => r.fcm_token),
  };

  const response = await messaging.sendEachForMulticast(message);
  logger.info(`Firebase multicast: ${response.successCount} sent, ${response.failureCount} failed`);
  return { sent: response.successCount, failed: response.failureCount };
}

module.exports = { getFirebaseApp, sendToUser, sendToUsers };
