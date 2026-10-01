import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
let socket = null;
let socketReadyCallbacks = [];
let socketGeneration = 0;

function onSocketReady(cb) {
  if (socket?.connected) {
    cb();
    return;
  }
  socketReadyCallbacks.push(cb);
}

function notifySocketReady() {
  socketReadyCallbacks.forEach(cb => cb());
  socketReadyCallbacks = [];
}

async function refreshCookie() {
  try {
    await fetch(`${SOCKET_URL}/auth/refresh`, {
      method: 'GET',
      credentials: 'include',
    });
  } catch { }
}

export function disconnectSocket() {
  socketGeneration++;

  if (socket) {
    socket.disconnect();
    socket = null;
    socketReadyCallbacks = [];
  }
}

export function useSocket() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    if (!socket) {
      const currentGeneration = socketGeneration;

      refreshCookie().then(() => {

        if (!user || currentGeneration !== socketGeneration) {
          return;
        }

        if (socket) return;

        socket = io(SOCKET_URL, {
          withCredentials: true,
          transports: ['websocket'],
        });

        socket.on('connect', () => {
          console.log('socket connected');
          notifySocketReady();
          setTimeout(() => socket.emit('get_online_users'), 0);
        });

        socket.on('connect_error', async (err) => {
          if (err.message.includes('Authentication error')) {
            await refreshCookie();

            if (socket) {
              socket.connect();
            }
          }
        });
      });
    }
  }, [user]);

  useEffect(() => {
    if (!user && socket) {
      socket.disconnect();
      socket = null;
      socketReadyCallbacks = [];
    }
  }, [user]);

  return socket;
}

export function useSocketEvent(event, handler) {
  const { user } = useAuth();
  const handlerRef = useRef(handler);
  const wrappedRef = useRef(null);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!user) return;

    wrappedRef.current = (data) => handlerRef.current(data);

    const register = () => {
      if (socket) socket.on(event, wrappedRef.current);
    };

    onSocketReady(register);

    return () => {
      if (socket) socket.off(event, wrappedRef.current);
    };
  }, [event, user]);
}

export function getSocket() {
  return socket;
}