import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

let io = null;

/**
 * Initialize Socket.IO on the HTTP server.
 * Customers join room `user:<userId>` after JWT auth.
 */
export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => callback(null, origin || true),
      credentials: true,
      methods: ['GET', 'POST'],
    },
    path: '/socket.io',
  });

  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.query?.token ||
        (socket.handshake.headers?.authorization || '').replace(/^Bearer\s+/i, '');

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'sathiseller_secret');
      if (!decoded?.id || decoded.role !== 'user') {
        return next(new Error('Forbidden'));
      }

      socket.userId = String(decoded.id);
      socket.userRole = decoded.role;
      return next();
    } catch (err) {
      return next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const room = `user:${socket.userId}`;
    socket.join(room);

    socket.on('disconnect', () => {
      // room leave is automatic
    });
  });

  console.log('[Socket.IO] Initialized for user notifications');
  return io;
};

export const getIO = () => io;

export const emitToUser = (userId, event, payload) => {
  if (!io || !userId) return;
  io.to(`user:${String(userId)}`).emit(event, payload);
};

export default { initSocket, getIO, emitToUser };
