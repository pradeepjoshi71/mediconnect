import { io } from "socket.io-client";
import { getUser } from "./session";

let socket = null;

export function connectRealtime() {
  if (socket) return socket;
  socket = io("/", { transports: ["websocket"] });

  socket.on("connect", () => {
    const user = getUser();
    if (user?.id) socket.emit("auth:identify", { userId: user.id });
  });

  return socket;
}

export function disconnectRealtime() {
  socket?.disconnect();
  socket = null;
}

