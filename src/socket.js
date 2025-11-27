import { io } from "socket.io-client";

const SERVER_URL = process.env.NODE_ENV === 'production' ? undefined : "http://localhost:3000";
let socket = null;

export const getSocket = () => {
  const token = localStorage.getItem("token");
  const username = localStorage.getItem("username");
  if (!token || !username) return null;

  const shouldRecreate = !socket || socket.disconnected || socket.auth?.token !== token || socket.auth?.username !== username;

  if (shouldRecreate) {
    if (socket) {
      socket.disconnect();
    }
    socket = io(SERVER_URL, {
      transports: ["websocket"],
      auth: { token, username },
    });
  }

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
