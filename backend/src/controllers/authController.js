const { z } = require("zod");
const authService = require("../services/authService");
const { refreshCookieOptions } = require("../utils/tokens");
const { asyncHandler } = require("../middlewares/asyncHandler");

const registerSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email().max(255),
  password: z.string().min(8).max(72),
  phone: z.string().max(24).optional(),
  dateOfBirth: z.string().date().optional(),
  gender: z.enum(["male", "female", "other", "undisclosed"]).optional(),
});

const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(72),
});

const register = asyncHandler(async (req, res) => {
  const payload = registerSchema.parse(req.body);
  const user = await authService.registerPatient(payload);

  res.status(201).json({
    message: "Patient account created",
    user,
  });
});

const login = asyncHandler(async (req, res) => {
  const payload = loginSchema.parse(req.body);
  const { accessToken, refreshToken, user } = await authService.login(
    payload.email,
    payload.password
  );

  res.cookie("refresh_token", refreshToken, refreshCookieOptions());
  res.json({ accessToken, user });
});

const refresh = asyncHandler(async (req, res) => {
  const result = await authService.refresh(req.cookies?.refresh_token);
  res.json(result);
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.cookies?.refresh_token);
  res.clearCookie("refresh_token", refreshCookieOptions());
  res.status(204).send();
});

const me = asyncHandler(async (req, res) => {
  const user = await authService.getCurrentUser(req.user.id);
  res.json({ user });
});

module.exports = {
  register,
  login,
  refresh,
  logout,
  me,
};
