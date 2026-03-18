const bcrypt = require("bcrypt");
const repo = require("../repositories/authRepository");
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashRefreshToken,
} = require("../utils/tokens");

async function register(fullName, email, password) {
  const existingUser = await repo.findUserByEmail(email);

  if (existingUser) {
    throw new Error("User already exists");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await repo.createUser(fullName, email, passwordHash);

  return user;
}

async function login(email, password) {
  const user = await repo.findUserByEmail(email);

  if (!user) {
    throw new Error("Invalid credentials");
  }

  const match = await bcrypt.compare(password, user.password_hash);

  if (!match) {
    throw new Error("Invalid credentials");
  }

  const accessToken = signAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  const refreshToken = signRefreshToken({ userId: user.id });
  const tokenHash = hashRefreshToken(refreshToken);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
  await repo.insertRefreshToken({ userId: user.id, tokenHash, expiresAt });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatar_url,
    },
  };
}

async function refresh(refreshToken) {
  if (!refreshToken) throw new Error("Missing refresh token");

  const decoded = verifyRefreshToken(refreshToken);
  const tokenHash = hashRefreshToken(refreshToken);
  const tokenRow = await repo.findActiveRefreshTokenByHash(tokenHash);
  if (!tokenRow) throw new Error("Refresh token is invalid");

  const userId = Number(decoded.sub);
  const user = await repo.findUserById(userId);
  if (!user) throw new Error("User not found");

  const accessToken = signAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  return {
    accessToken,
    user: {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatar_url,
    },
  };
}

async function logout(refreshToken) {
  if (!refreshToken) return;
  const tokenHash = hashRefreshToken(refreshToken);
  await repo.revokeRefreshTokenByHash(tokenHash);
}

module.exports = {
  register,
  login,
  refresh,
  logout,
};