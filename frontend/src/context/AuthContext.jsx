import { disconnectSocket } from '../hooks/useSocket';
import { createContext, useContext, useState, useEffect, useRef } from "react";
import api from '../api/axios';

import {
  enablePushNotifications,
} from '../utils/pushnotifications';

import NotificationPrompt from '../components/NotificationPromt';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const passwordRef = useRef(null);

  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationError, setNotificationError] = useState('');

  async function askForPushNotifications(currentUser = user) {
    try {
      if (
        !("Notification" in window) ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window)
      ) {
        return;
      }

      if (Notification.permission === "denied") {
        return;
      }

      if (currentUser?.pushNotificationsConfigured === true) {
        return;
      }

      setShowNotificationPrompt(true);
    } catch (error) {
      console.error(
        "Notification permission check failed:",
        error
      );
    }
  }

  async function handleEnableNotifications() {
    if (notificationLoading) {
      return;
    }

    setNotificationError('');
    setNotificationLoading(true);

    try {
      await enablePushNotifications();

      setUser(currentUser => {
        if (!currentUser) {
          return currentUser;
        }

        return {
          ...currentUser,
          pushNotificationsDisabled: false,
          pushNotificationsConfigured: true
        };
      });

      setShowNotificationPrompt(false);
    } catch (error) {
      console.error(
        "Failed to enable push notifications:",
        error
      );

      setNotificationError(
        error.response?.data?.message ||
        error.message ||
        "Failed to enable notifications."
      );
    } finally {
      setNotificationLoading(false);
    }
  }

  function handleNotNowNotifications() {
    setNotificationError('');
    setShowNotificationPrompt(false);
  }

  useEffect(() => {
    api
      .get('/auth/me')
      .then(async res => {
        const currentUser = res.data?.user ?? null;

        setUser(currentUser);

        if (currentUser) {
          await askForPushNotifications(currentUser);
        }
      })
      .catch(error => {
        console.error('Auth check failed:', error);
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  async function login(userData, password) {
    passwordRef.current = password;

    try {
      const response = await api.get('/auth/me');

      const loggedInUser =
        response.data?.user ?? userData;

      setUser(loggedInUser);

      await askForPushNotifications(loggedInUser);
    } catch (error) {
      console.error(
        'Failed to load complete user data:',
        error
      );

      setUser(userData);

      await askForPushNotifications(userData);
    }
  }

  function getPassword() {
    return passwordRef.current;
  }

  function clearPassword() {
    passwordRef.current = null;
  }

  async function logout() {
    try {
      await fetch(
        (import.meta.env.VITE_API_URL || 'http://localhost:3000') +
          '/user/logout',
        {
          method: 'POST',
          credentials: 'include',
        }
      );
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      disconnectSocket();
      clearPassword();
      setUser(null);
    }
  }

  function updateUser(updatedUser) {
    setUser(updatedUser);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        updateUser,
        loading,
        getPassword,
        clearPassword,
        askForPushNotifications,
      }}
    >
      {children}

      {showNotificationPrompt && (
        <NotificationPrompt
          onEnable={handleEnableNotifications}
          onNotNow={handleNotNowNotifications}
          loading={notificationLoading}
          error={notificationError}
        />
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}