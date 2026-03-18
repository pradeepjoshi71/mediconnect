let io = null;

function setIO(serverIO) {
  io = serverIO;
}

function getIO() {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
}

function safeEmitToUser(userId, event, payload) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, payload);
}

module.exports = { setIO, getIO, safeEmitToUser };

