const { verifyAccessToken } = require("../utils/tokens");

let io = null;

function setIO(serverIO) {
  io = serverIO;
}

function getIO() {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
}

function attachSocketHandlers(socket) {
  socket.on("auth:identify", ({ token }) => {
    if (!token) return;

    try {
      const decoded = verifyAccessToken(token);
      socket.join(`user:${decoded.sub}`);
    } catch (_error) {
      socket.emit("auth:error", { message: "Invalid realtime token" });
    }
  });
}

function safeEmitToUser(userId, event, payload) {
  if (!io || !userId) return;
  io.to(`user:${userId}`).emit(event, payload);
}

module.exports = {
  setIO,
  getIO,
  attachSocketHandlers,
  safeEmitToUser,
};
