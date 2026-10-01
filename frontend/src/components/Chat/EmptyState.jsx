
import { useAuth } from '../../context/AuthContext';
import { useState } from 'react';
import styles from './EmptyState.module.css';
import {
  LogOut,
  MessageSquarePlus,
  CircleUser
} from 'lucide-react';
import ProfileModal from '../Profile/ProfileModal';

export default function EmptyState() {
  const { user, logout } = useAuth();

  const [showDropdown, setShowDropdown] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const handleProfile = () => {
    setShowDropdown(false);
    setShowProfile(true);
  };

  const handleLogout = () => {
    setShowDropdown(false);
    logout();
  };

  return (
    <div className={styles.wrap}>

      {/* User menu */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          right: 16
        }}
      >
        <div
          onClick={() => setShowDropdown(s => !s)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px 6px 6px',
            borderRadius: 'var(--radius-full)',
            background: 'var(--surface-low)',
            cursor: 'pointer',
            transition: 'background 0.15s'
          }}
        >

          {/* User avatar */}
          {user?.profileURL ? (
            <img
              src={user.profileURL}
              alt={user.userName}
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                objectFit: 'cover'
              }}
            />
          ) : (
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'var(--primary)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 700
              }}
            >
              {user?.userName?.[0]?.toUpperCase()}
            </div>
          )}

          {/* Username */}
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--on-surface)'
            }}
          >
            {user?.userName}
          </span>

          {/* Dropdown arrow */}
          <span
            style={{
              fontSize: 10,
              color: 'var(--outline)'
            }}
          >
            ∨
          </span>
        </div>

        {/* Dropdown */}
        {showDropdown && (
          <div
            style={{
              position: 'absolute',
              top: '110%',
              right: 0,
              background: 'var(--surface)',
              border: '1px solid var(--surface-high)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-overlay)',
              minWidth: 160,
              zIndex: 100,
              overflow: 'hidden'
            }}
          >

            {/* Profile */}
            <button
              type="button"
              onClick={handleProfile}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '11px 16px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                font: 'inherit',
                fontSize: 14,
                color: 'var(--text-primary)',
                transition: 'background 0.15s',
                textAlign: 'left'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background =
                  'var(--surface-high)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'none';
              }}
            >
              <CircleUser size={20} />
              Profile
            </button>

            {/* Sign out */}
            <button
              type="button"
              onClick={handleLogout}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '11px 16px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                font: 'inherit',
                fontSize: 14,
                color: 'var(--error)',
                transition: 'background 0.15s',
                textAlign: 'left'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background =
                  'var(--error-container)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'none';
              }}
            >
              <LogOut size={20} />
              Sign out
            </button>

          </div>
        )}
      </div>

      {/* Empty state content */}
      <MessageSquarePlus size={25} />

      <h2 className={styles.title}>
        Your messages
      </h2>

      <p className={styles.sub}>
        Select a conversation or search to start a new one.
      </p>

      {/* Profile modal */}
      {showProfile && (
        <ProfileModal
          onClose={() => setShowProfile(false)}
        />
      )}

    </div>
  );
}

