const { z } = require("zod");
const authService = require("../services/authService");
const { refreshCookieOptions } = require("../utils/tokens");
const { asyncHandler } = require("../middlewares/asyncHandler");

const registerSchema = z.object({
  hospitalCode: z.string().trim().min(1, "Hospital code is required").max(24),
  fullName: z.string().min(2).max(120),
  email: z.string().email().max(255),
  password: z.string().min(8).max(72),
  phone: z.string().max(24).optional(),
  dateOfBirth: z.string().date().optional(),
  gender: z.enum(["male", "female", "other", "undisclosed"]).optional(),
});

const loginSchema = z.object({
  hospitalCode: z.string().trim().min(1, "Hospital code is required").max(24),
  email: z.string().email().max(255),
  password: z.string().min(1).max(72),
});

const register = asyncHandler(async (req, res) => {
  try {
    const payload = registerSchema.parse(req.body);
    const user = await authService.registerPatient({
      ...payload,
      auditContext: req.auditContext,
    });

    res.status(201).json({
      message: "Patient account created",
      user,
    });
  } catch (error) {
    console.error("[Auth Controller Register] Caught exception:", error.message);
    console.error("[Auth Controller Register] Full error stack:", error.stack);
    throw error;
  }
});

const login = asyncHandler(async (req, res) => {
  try {
    const payload = loginSchema.parse(req.body);
    const { accessToken, refreshToken, user } = await authService.login(
      payload.email,
      payload.password,
      {
        hospitalCode: payload.hospitalCode,
        auditContext: req.auditContext,
      }
    );

    res.cookie("refresh_token", refreshToken, refreshCookieOptions());
    res.json({ accessToken, user });
  } catch (error) {
    console.error("[Auth Controller Login] Caught exception:", error.message);
    console.error("[Auth Controller Login] Full error stack:", error.stack);
    throw error;
  }
});

const refresh = asyncHandler(async (req, res) => {
  const result = await authService.refresh(req.cookies?.refresh_token);
  res.cookie("refresh_token", result.refreshToken, refreshCookieOptions());
  const { refreshToken, ...responseBody } = result;
  res.json(responseBody);
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.cookies?.refresh_token, {
    user: req.user || null,
    auditContext: req.auditContext,
  });
  const { maxAge, ...clearOptions } = refreshCookieOptions();
  res.clearCookie("refresh_token", clearOptions);
  res.status(204).send();
});

const me = asyncHandler(async (req, res) => {
  const user = await authService.getCurrentUser(req.user.id);
  res.json({
    user
  });
});

const forgotPasswordSchema = z.object({
  email: z.string().email().max(255),
  hospitalCode: z.string().trim().min(1, "Hospital code is required").max(24),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(72),
  hospitalCode: z.string().trim().min(1, "Hospital code is required").max(24),
});

const forgotPassword = asyncHandler(async (req, res) => {
  const payload = forgotPasswordSchema.parse(req.body);
  const result = await authService.forgotPassword(
    payload.email,
    payload.hospitalCode,
    req.auditContext
  );
  res.json(result);
});

const resetPassword = asyncHandler(async (req, res) => {
  const payload = resetPasswordSchema.parse(req.body);
  const result = await authService.resetPassword(
    payload.token,
    payload.password,
    payload.hospitalCode,
    req.auditContext
  );
  res.json(result);
});

module.exports = {
  register,
  login,
  refresh,
  logout,
  me,
  forgotPassword,
  resetPassword,
};
