const { verifyAccessToken } = require("../utils/tokens");

let io = null;

function setIO(serverIO) {
  io = serverIO;
}

function getIO() {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
}

const db = require("../config/db");

function attachSocketHandlers(socket) {
  socket.on("auth:identify", ({ token }) => {
    if (!token) return;

    try {
      const decoded = verifyAccessToken(token);
      socket.join(`user:${decoded.sub}`);
      if (decoded.hospitalId) {
        socket.join(`hospital:${decoded.hospitalId}`);
      }
    } catch (_error) {
      socket.emit("auth:error", { message: "Invalid realtime token" });
    }
  });

  // --- WebRTC Telemedicine Signaling & Waiting Room ---

  socket.on("telemedicine:join-room", async ({ token, appointmentId }) => {
    try {
      const decoded = verifyAccessToken(token);
      const hospitalId = decoded.hospitalId;
      const userId = decoded.sub;

      // Verify tenant isolation & query appointment details
      const appointmentResult = await db.query(
        `SELECT id, hospital_id AS "hospitalId", doctor_id AS "doctorId", patient_id AS "patientId"
         FROM appointments WHERE id = $1 AND hospital_id = $2`,
        [appointmentId, hospitalId]
      );
      const appointment = appointmentResult.rows[0];
      if (!appointment) {
        socket.emit("telemedicine:error", { message: "Appointment not found or tenant access denied" });
        return;
      }

      // Check role authorizations
      let isAuthorized = ["admin", "super_admin", "hospital_admin", "receptionist"].includes(decoded.role);
      if (!isAuthorized) {
        if (decoded.role === "patient") {
          const patRes = await db.query('SELECT id FROM patients WHERE user_id = $1 AND hospital_id = $2', [userId, hospitalId]);
          isAuthorized = patRes.rows[0]?.id === appointment.patientId;
        } else if (decoded.role === "doctor") {
          const docRes = await db.query('SELECT id FROM doctors WHERE user_id = $1 AND hospital_id = $2', [userId, hospitalId]);
          isAuthorized = docRes.rows[0]?.id === appointment.doctorId;
        }
      }

      if (!isAuthorized) {
        socket.emit("telemedicine:error", { message: "Forbidden: insufficient appointment access" });
        return;
      }

      const roomName = `telemedicine:${appointmentId}`;
      socket.join(roomName);
      socket.appointmentId = appointmentId;
      socket.userId = userId;
      socket.userRole = decoded.role;
      socket.hospitalId = hospitalId;

      // Check / update session status to support Waiting Room
      const sessionRes = await db.query(
        `SELECT status FROM telemedicine_sessions WHERE appointment_id = $1 AND hospital_id = $2`,
        [appointmentId, hospitalId]
      );
      let currentStatus = sessionRes.rows[0]?.status || "ready";

      if (decoded.role === "doctor" || ["admin", "super_admin", "hospital_admin"].includes(decoded.role)) {
        await db.query(
          `UPDATE telemedicine_sessions SET status = 'active' WHERE appointment_id = $1 AND hospital_id = $2`,
          [appointmentId, hospitalId]
        );
        currentStatus = "active";
      } else if (decoded.role === "patient" && currentStatus === "ready") {
        await db.query(
          `UPDATE telemedicine_sessions SET status = 'waiting' WHERE appointment_id = $1 AND hospital_id = $2`,
          [appointmentId, hospitalId]
        );
        currentStatus = "waiting";
      }

      // Broadcast event to other peers in room
      socket.to(roomName).emit("telemedicine:peer-joined", {
        userId,
        role: decoded.role,
        status: currentStatus
      });

      socket.emit("telemedicine:room-status", {
        status: currentStatus,
        message: currentStatus === "waiting" ? "In waiting room" : "Meeting active"
      });

    } catch (err) {
      socket.emit("telemedicine:error", { message: err.message });
    }
  });

  socket.on("telemedicine:signal", ({ appointmentId, signalData }) => {
    if (!socket.userId || Number(socket.appointmentId) !== Number(appointmentId)) {
      return socket.emit("telemedicine:error", { message: "Unauthorized signal relay" });
    }
    socket.to(`telemedicine:${appointmentId}`).emit("telemedicine:signal", {
      senderUserId: socket.userId,
      signalData
    });
  });

  socket.on("telemedicine:leave-room", ({ appointmentId }) => {
    const roomName = `telemedicine:${appointmentId}`;
    socket.leave(roomName);
    socket.to(roomName).emit("telemedicine:peer-left", { userId: socket.userId });
    socket.appointmentId = null;
  });

  socket.on("disconnect", () => {
    if (socket.appointmentId) {
      socket.to(`telemedicine:${socket.appointmentId}`).emit("telemedicine:peer-left", { userId: socket.userId });
    }
  });
}

function safeEmitToUser(userId, event, payload) {
  if (!io || !userId) return;
  io.to(`user:${userId}`).emit(event, payload);
}

function safeEmitToHospital(hospitalId, event, payload) {
  if (!io || !hospitalId) return;
  io.to(`hospital:${hospitalId}`).emit(event, payload);
}

module.exports = {
  setIO,
  getIO,
  attachSocketHandlers,
  safeEmitToUser,
  safeEmitToHospital,
};
