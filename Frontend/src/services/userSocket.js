import { io } from 'socket.io-client';
import { getBaseApiUrl } from './api';

let socket = null;

const getSocketOrigin = () => {
  const apiBase = getBaseApiUrl(); // e.g. http://localhost:5000/api
  return apiBase.replace(/\/api\/?$/, '') || 'http://localhost:5000';
};

export const connectUserSocket = (token) => {
  if (!token) return null;

  if (socket?.connected) {
    return socket;
  }

  if (socket) {
    socket.auth = { token };
    socket.connect();
    return socket;
  }

  socket = io(getSocketOrigin(), {
    auth: { token },
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1500,
  });

  return socket;
};

export const disconnectUserSocket = () => {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
};

export const getUserSocket = () => socket;

export default { connectUserSocket, disconnectUserSocket, getUserSocket };
