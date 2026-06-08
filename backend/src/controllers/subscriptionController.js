const subRepo = require('../repositories/subscriptionRepository');
const { AppError } = require('../utils/http');

// ─── Plans ───────────────────────────────────────────────────────────────────

async function listPlans(req, res, next) {
  try {
    const includeInactive = req.query.all === 'true';
    const plans = await subRepo.listPlans({ includeInactive });
    res.json({ success: true, plans });
  } catch (err) { next(err); }
}

async function createPlan(req, res, next) {
  try {
    const { name, code, priceCents, doctorLimit, patientLimit, storageGb, durationDays, features } = req.body;
    if (!name || !code) throw new AppError(400, 'name and code are required');
    const plan = await subRepo.createPlan({ name, code, priceCents: priceCents || 0, doctorLimit, patientLimit, storageGb, durationDays, features });
    res.status(201).json({ success: true, plan });
  } catch (err) { next(err); }
}

async function updatePlan(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const plan = await subRepo.updatePlan(id, req.body);
    if (!plan) throw new AppError(404, 'Plan not found');
    res.json({ success: true, plan });
  } catch (err) { next(err); }
}

async function disablePlan(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const plan = await subRepo.setPlanActive(id, false);
    if (!plan) throw new AppError(404, 'Plan not found');
    res.json({ success: true, plan });
  } catch (err) { next(err); }
}

async function enablePlan(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const plan = await subRepo.setPlanActive(id, true);
    if (!plan) throw new AppError(404, 'Plan not found');
    res.json({ success: true, plan });
  } catch (err) { next(err); }
}

// ─── Subscriptions ───────────────────────────────────────────────────────────

async function listSubscriptions(req, res, next) {
  try {
    const { status } = req.query;
    const subscriptions = await subRepo.listSubscriptions({ status });
    res.json({ success: true, subscriptions });
  } catch (err) { next(err); }
}

async function getExpiringSubscriptions(req, res, next) {
  try {
    const days = parseInt(req.query.days || '7', 10);
    const subscriptions = await subRepo.getExpiringSubscriptions(days);
    res.json({ success: true, subscriptions });
  } catch (err) { next(err); }
}

async function assignPlan(req, res, next) {
  try {
    const { hospitalId, planId, notes, durationDays } = req.body;
    if (!hospitalId || !planId) throw new AppError(400, 'hospitalId and planId are required');
    const plan = await subRepo.getPlanById(planId);
    if (!plan) throw new AppError(404, 'Plan not found');
    const days = durationDays || plan.durationDays || 30;
    const expiresAt = new Date(Date.now() + days * 86400000);
    const sub = await subRepo.assignPlan({
      hospitalId, planId, assignedBy: req.user.id,
      notes, status: plan.code === 'trial' ? 'trialing' : 'active', expiresAt
    });
    res.json({ success: true, subscription: sub });
  } catch (err) { next(err); }
}

// ─── Hospital Admin ───────────────────────────────────────────────────────────

async function getMySubscription(req, res, next) {
  try {
    const hospitalId = req.user.hospitalId;
    const [sub, usage] = await Promise.all([
      subRepo.getSubscriptionByHospital(hospitalId),
      subRepo.getUsageSummary(hospitalId),
    ]);
    res.json({ success: true, subscription: sub, usage });
  } catch (err) { next(err); }
}

async function getMyHistory(req, res, next) {
  try {
    const history = await subRepo.getSubscriptionHistory(req.user.hospitalId);
    res.json({ success: true, history });
  } catch (err) { next(err); }
}

async function requestUpgrade(req, res, next) {
  try {
    const { message } = req.body;
    if (!message || message.trim().length < 5) throw new AppError(400, 'Upgrade request message is required');
    const result = await subRepo.saveUpgradeRequest(req.user.hospitalId, message.trim());
    if (!result) throw new AppError(404, 'No active subscription found for this hospital');
    res.json({ success: true, message: 'Upgrade request submitted successfully' });
  } catch (err) { next(err); }
}

module.exports = {
  listPlans, createPlan, updatePlan, disablePlan, enablePlan,
  listSubscriptions, getExpiringSubscriptions, assignPlan,
  getMySubscription, getMyHistory, requestUpgrade,
};
