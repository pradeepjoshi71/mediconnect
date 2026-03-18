const authService = require("../services/authService");
const { z } = require("zod");
const { refreshCookieOptions } = require("../utils/tokens");

async function register(req, res) {
  try {
    const schema = z.object({
      fullName: z.string().min(2).max(120),
      email: z.string().email().max(255),
      password: z.string().min(8).max(72),
    });
    const { fullName, email, password } = schema.parse(req.body);

    const user = await authService.register(fullName, email, password);

    res.status(201).json({
      message: "User registered successfully",
      user,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}

async function login(req, res) {
  try {
    const schema = z.object({
      email: z.string().email().max(255),
      password: z.string().min(1).max(72),
      rememberMe: z.boolean().optional(),
    });
    const { email, password } = schema.parse(req.body);

    const { accessToken, refreshToken, user } = await authService.login(
      email,
      password
    );

    res.cookie("refresh_token", refreshToken, refreshCookieOptions());
    res.json({ accessToken, user });
  } catch (err) {
    res.status(401).json({ message: err.message });
  }
}

async function refresh(req, res) {
  try {
    const token = req.cookies?.refresh_token;
    const result = await authService.refresh(token);
    res.json(result);
  } catch (err) {
    res.status(401).json({ message: err.message });
  }
}

async function logout(req, res) {
  try {
    const token = req.cookies?.refresh_token;
    await authService.logout(token);
    res.clearCookie("refresh_token", refreshCookieOptions());
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}

async function me(req, res) {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
    },
  });
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  me,
};