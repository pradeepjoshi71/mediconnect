import { io } from "socket.io-client";
import { getAccessToken } from "./session";

let socket = null;

export function connectRealtime() {
  if (socket) return socket;

  socket = io("/", {
    transports: ["websocket"],
    withCredentials: true,
  });

  socket.on("connect", () => {
    const token = getAccessToken();
    if (token) {
      socket.emit("auth:identify", { token });
    }
  });

  return socket;
}

export function disconnectRealtime() {
  if (!socket) return;
  socket.disconnect();
  socket = null;
}
