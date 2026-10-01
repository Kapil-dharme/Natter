import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import GroupSettingsPanel from '../Group/GroupSettingsPanel';
import ProfileModal from '../Profile/ProfileModal';
import BlockedUsersModal from '../Profile/BlockedUsersModal';
import api from '../../api/axios';
import styles from './ChatHeader.module.css';

import {
  Eraser,
  Settings,
  Trash2,
  CircleUser,
  LogOut,
  ArrowLeft,
  Ban,
} from 'lucide-react';

function formatLastSeen(date) {
  if (!date) return '';

  const d = new Date(date);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;

  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);

  if (
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear()
  ) {
    return 'yesterday';
  }

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  return `${day}/${month}/${year}`;
}

export default function ChatHeader({
  conversation,
  onConversationUpdate,
  onLeaveOrDelete,
  onClearChat,
  onDeleteChat,
  onBack,
  onlineUsers,
  lastSeenMap,
  onBlockStatusChange
}) {
  const { user, logout } = useAuth();

  const userId = user?._id || user?.id;
  const isGroup = conversation.type === 'group';

  const other = !isGroup
    ? conversation.participants?.find(
      p => String(p._id || p) !== String(userId)
    )
    : null;

  const isOnline =
    !isGroup &&
    other?._id &&
    onlineUsers?.has(String(other._id));

  const name = isGroup
    ? conversation.groupName
    : other?.userName;

  const avatar = isGroup
    ? conversation.groupPhoto
    : other?.profileURL;

  const [showSettings, setShowSettings] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showBlockedUsers, setShowBlockedUsers] = useState(false);

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [isBlocked, setIsBlocked] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);

  const dropdownRef = useRef(null);
  const chatMenuRef = useRef(null);

  useEffect(() => {
    async function checkBlockStatus() {
      if (isGroup || !other?._id) {
        setIsBlocked(false);
        onBlockStatusChange?.(false);
        return;
      }

      try {
        const res = await api.get(
          `/block/status/${other._id}`
        );

        const blocked = res.data?.iBlockedThem === true;

        setIsBlocked(blocked);
        onBlockStatusChange?.(blocked);
      } catch (error) {
        console.error(
          'Failed to check block status:',
          error
        );

        setIsBlocked(false);
        onBlockStatusChange?.(false);
      }
    }

    checkBlockStatus();
  }, [isGroup, other?._id, onBlockStatusChange]);

  useEffect(() => {
    function handleBlockedUsersUpdated(e) {
      const targetId = e.detail?.userId;

      if (!other?._id || !targetId) return;

      if (String(targetId) !== String(other._id)) return;

      const blocked = Boolean(e.detail?.blocked);

      setIsBlocked(blocked);
      onBlockStatusChange?.(blocked);
    }

    window.addEventListener(
      'blocked-users-updated',
      handleBlockedUsersUpdated
    );

    return () => {
      window.removeEventListener(
        'blocked-users-updated',
        handleBlockedUsersUpdated
      );
    };
  }, [other?._id, onBlockStatusChange]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target)
      ) {
        setShowDropdown(false);
      }

      if (
        chatMenuRef.current &&
        !chatMenuRef.current.contains(e.target)
      ) {
        setShowChatMenu(false);
      }
    }

    document.addEventListener(
      'mousedown',
      handleClickOutside
    );

    return () => {
      document.removeEventListener(
        'mousedown',
        handleClickOutside
      );
    };
  }, []);

  function handleClearChat() {
    setShowChatMenu(false);
    setShowClearConfirm(true);
  }

  function handleDeleteChat() {
    setShowChatMenu(false);
    setShowDeleteConfirm(true);
  }

  async function handleBlockToggle() {
    if (!other?._id || blockLoading) return;

    setBlockLoading(true);

    try {
      if (isBlocked) {
        await api.delete(
          `/block/${other._id}`
        );

        setIsBlocked(false);
        onBlockStatusChange?.(false);

        window.dispatchEvent(
          new CustomEvent('blocked-users-updated', {
            detail: {
              userId: String(other._id),
              blocked: false
            }
          })
        );
      } else {
        await api.post(
          `/block/${other._id}`
        );

        setIsBlocked(true);
        onBlockStatusChange?.(true);

        window.dispatchEvent(
          new CustomEvent('blocked-users-updated', {
            detail: {
              userId: String(other._id),
              blocked: true
            }
          })
        );
      }

      setShowChatMenu(false);
    } catch (error) {
      console.error(
        'Block status update failed:',
        error
      );
    } finally {
      setBlockLoading(false);
    }
  }

  function confirmClearChat() {
    setShowClearConfirm(false);
    onClearChat?.();
  }

  function confirmDeleteChat() {
    setShowDeleteConfirm(false);
    onDeleteChat?.();
  }

  return (
    <>
      <div className={styles.header}>

        <div className={styles.left}>

          {onBack && (
            <button
              className={styles.backBtn}
              onClick={onBack}
              title="Back"
            >
              <ArrowLeft size={20} />
            </button>
          )}

          {avatar ? (
            <div
              className={styles.avatar}
              style={{
                backgroundImage: `url(${avatar})`
              }}
            />
          ) : (
            <div className={styles.avatarFallback}>
              {name?.[0]?.toUpperCase()}
            </div>
          )}

          <div className={styles.text}>
            <span className={styles.name}>
              {name}
            </span>

            {isGroup ? (
              <span className={styles.sub}>
                {conversation.participants?.length} members
              </span>
            ) : (
              <span
                className={styles.sub}
                style={{
                  color: isOnline
                    ? '#4caf50'
                    : 'var(--on-surface-variant)'
                }}
              >
                {isOnline
                  ? 'Online'
                  : lastSeenMap?.[String(other?._id)]
                    ? `Last seen ${formatLastSeen(
                      lastSeenMap[String(other._id)]
                    )}`
                    : 'Offline'}
              </span>
            )}
          </div>
        </div>

        <div className={styles.right}>

          {isGroup && (
            <button
              className={styles.settingsBtn}
              onClick={() => setShowSettings(true)}
              title="Group settings"
            >
              <Settings size={18} />
            </button>
          )}

          {!isGroup && (
            <div
              ref={chatMenuRef}
              style={{
                position: 'relative'
              }}
            >
              <button
                onClick={() =>
                  setShowChatMenu(s => !s)
                }
                title="Chat options"
                style={{
                  width: 38,
                  height: 38,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 'none',
                  background: 'transparent',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 24,
                  color: 'var(--text-primary)',
                  lineHeight: 1
                }}
              >
                ⋮
              </button>

              {showChatMenu && (
                <div
                  style={{
                    position: 'absolute',
                    top: '110%',
                    right: 0,
                    background: 'var(--surface)',
                    border: '1px solid var(--surface-high)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-overlay)',
                    minWidth: 180,
                    zIndex: 200,
                    overflow: 'hidden'
                  }}
                >

                  <button
                    onClick={handleClearChat}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      padding: '12px 16px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      font: 'inherit',
                      fontSize: 14,
                      color: 'var(--text-primary)',
                      textAlign: 'left'
                    }}
                  >
                    <Eraser size={18} />
                    Clear chat
                  </button>

                  <button
                    onClick={handleDeleteChat}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      padding: '12px 16px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      font: 'inherit',
                      fontSize: 14,
                      color: 'var(--error)',
                      textAlign: 'left'
                    }}
                  >
                    <Trash2 size={18} />
                    Delete chat
                  </button>

                  <button
                    onClick={handleBlockToggle}
                    disabled={blockLoading}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      padding: '12px 16px',
                      background: 'none',
                      border: 'none',
                      cursor: blockLoading
                        ? 'not-allowed'
                        : 'pointer',
                      font: 'inherit',
                      fontSize: 14,
                      color: isBlocked
                        ? 'var(--text-primary)'
                        : 'var(--error)',
                      textAlign: 'left',
                      opacity: blockLoading ? 0.6 : 1
                    }}
                  >
                    <Ban size={18} />

                    {blockLoading
                      ? 'Updating…'
                      : isBlocked
                        ? 'Unblock user'
                        : 'Block user'}
                  </button>

                </div>
              )}
            </div>
          )}

          <div
            ref={dropdownRef}
            style={{
              position: 'relative'
            }}
          >
            <div
              className={styles.userBadge}
              onClick={() =>
                setShowDropdown(s => !s)
              }
            >
              {user?.profileURL ? (
                <div
                  className={styles.userAvatar}
                  style={{
                    backgroundImage: `url(${user.profileURL})`
                  }}
                />
              ) : (
                <div className={styles.userAvatarFallback}>
                  {user?.userName?.[0]?.toUpperCase()}
                </div>
              )}

              <span className={styles.userName}>
                {user?.userName}
              </span>

              <span className={styles.chevron}>
                ∨
              </span>
            </div>

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
                  minWidth: 170,
                  zIndex: 100,
                  overflow: 'hidden'
                }}
              >

                <button
                  onClick={() => {
                    setShowDropdown(false);
                    setShowProfile(true);
                  }}
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
                    textAlign: 'left'
                  }}
                >
                  <CircleUser size={20} />
                  Profile
                </button>

                <button
                  onClick={() => {
                    setShowDropdown(false);
                    setShowBlockedUsers(true);
                  }}
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
                    textAlign: 'left'
                  }}
                >
                  <Ban size={20} />
                  Blocked Users
                </button>

                <button
                  onClick={() => {
                    setShowDropdown(false);
                    logout();
                  }}
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
                    textAlign: 'left'
                  }}
                >
                  <LogOut size={20} />
                  Sign out
                </button>

              </div>
            )}
          </div>

        </div>
      </div>

      {showSettings && isGroup && (
        <GroupSettingsPanel
          conversation={conversation}
          onClose={() => setShowSettings(false)}
          onClearChat={() => {
            setShowSettings(false);
            handleClearChat();
          }}
          onUpdate={updated => {
            onConversationUpdate(updated);
            setShowSettings(false);
          }}
          onLeaveOrDelete={id => {
            onLeaveOrDelete(id);
            setShowSettings(false);
          }}
        />
      )}

      {showProfile && (
        <ProfileModal
          onClose={() => setShowProfile(false)}
        />
      )}

      {showBlockedUsers && (
        <BlockedUsersModal
          onClose={() => setShowBlockedUsers(false)}
        />
      )}

      {showClearConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 380,
              background: 'var(--surface)',
              borderRadius: 12,
              padding: 22,
              boxShadow: '0 10px 35px rgba(0, 0, 0, 0.18)'
            }}
          >
            <h3
              style={{
                margin: '0 0 8px',
                fontSize: 18,
                fontWeight: 600,
                color: 'var(--text-primary)'
              }}
            >
              Clear chat?
            </h3>

            <p
              style={{
                margin: '0 0 22px',
                fontSize: 14,
                lineHeight: 1.5,
                color: 'var(--on-surface-variant)'
              }}
            >
              All messages in this chat will be cleared for you.
            </p>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10
              }}
            >
              <button
                onClick={() => setShowClearConfirm(false)}
                style={{
                  padding: '9px 16px',
                  border: '1px solid var(--surface-high)',
                  borderRadius: 7,
                  background: 'transparent',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                  fontSize: 14
                }}
              >
                Cancel
              </button>

              <button
                onClick={confirmClearChat}
                style={{
                  padding: '9px 16px',
                  border: 'none',
                  borderRadius: 7,
                  background: '#2563eb',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 14
                }}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 380,
              background: 'var(--surface)',
              borderRadius: 12,
              padding: 22,
              boxShadow: '0 10px 35px rgba(0, 0, 0, 0.18)'
            }}
          >
            <h3
              style={{
                margin: '0 0 8px',
                fontSize: 18,
                fontWeight: 600,
                color: 'var(--text-primary)'
              }}
            >
              Delete chat?
            </h3>

            <p
              style={{
                margin: '0 0 22px',
                fontSize: 14,
                lineHeight: 1.5,
                color: 'var(--on-surface-variant)'
              }}
            >
              This conversation will be removed from your chat list.
            </p>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10
              }}
            >
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  padding: '9px 16px',
                  border: '1px solid var(--surface-high)',
                  borderRadius: 7,
                  background: 'transparent',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                  fontSize: 14
                }}
              >
                Cancel
              </button>

              <button
                onClick={confirmDeleteChat}
                style={{
                  padding: '9px 16px',
                  border: 'none',
                  borderRadius: 7,
                  background: 'var(--error)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 14
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}