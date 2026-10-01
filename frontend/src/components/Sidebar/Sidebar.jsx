import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import ConversationList from './ConversationList';
import UserSearch from './UserSearch';
import CreateGroupModal from '../Group/CreateGroupModal';
import ProfileModal from '../Profile/ProfileModal';
import BlockedUsersModal from '../Profile/BlockedUsersModal';
import styles from './Sidebar.module.css';
import { Users, CircleUser, LogOut, Ban } from 'lucide-react';

export default function Sidebar({
  conversations,
  activeConversation,
  onSelectConversation,
  onSelectUser,
  onGroupCreated,
  unreadMap,
  onlineUsers,
  lastSeenMap
}) {
  const { user, logout } = useAuth();

  const [query, setQuery] = useState('');
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showBlockedUsers, setShowBlockedUsers] = useState(false);

  const profileMenuRef = useRef(null);

  const showSearch =
    searchFocused ||
    query.trim().length > 0;

  useEffect(() => {
    function handleClickOutside(e) {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(e.target)
      ) {
        setShowProfileMenu(false);
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

  function handleSelectUser(u) {
    setQuery('');
    setSearchFocused(false);
    onSelectUser(u);
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.topBar}>

        <h1 className={styles.appTitle}>
          Chat
        </h1>

        <div
          className={styles.mobileProfile}
          ref={profileMenuRef}
        >
          <button
            className={styles.mobileProfileBtn}
            onClick={() =>
              setShowProfileMenu(s => !s)
            }
            title="Profile"
          >
            {user?.profileURL ? (
              <div
                className={styles.mobileProfileAvatar}
                style={{
                  backgroundImage:
                    `url(${user.profileURL})`
                }}
              />
            ) : (
              <div
                className={
                  styles.mobileProfileAvatarFallback
                }
              >
                {user?.userName?.[0]?.toUpperCase()}
              </div>
            )}

            <span className={styles.mobileProfileName}>
              {user?.userName}
            </span>

            <span className={styles.mobileProfileChevron}>
              ∨
            </span>
          </button>

          {showProfileMenu && (
            <div
              className={styles.mobileProfileDropdown}
            >
              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  setShowProfile(true);
                }}
                className={styles.mobileProfileItem}
              >
                <CircleUser size={20} />
                Profile
              </button>

              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  setShowBlockedUsers(true);
                }}
                className={styles.mobileProfileItem}
              >
                <Ban size={20} />
                Blocked Users
              </button>

              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  logout();
                }}
                className={`${styles.mobileProfileItem} ${styles.mobileLogoutItem}`}
              >
                <LogOut size={20} />
                Sign out
              </button>
            </div>
          )}
        </div>
        <div className={styles.topActions}>
          <button
            className={styles.createGroupBtn}
            onClick={() =>
              setShowGroupModal(true)
            }
          >
            <Users size={15} />
            New Group
          </button>
        </div>
      </div>

      <div className={styles.searchBar}>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Search people..."
          value={query}
          onChange={e =>
            setQuery(e.target.value)
          }
          onFocus={() =>
            setSearchFocused(true)
          }
          onBlur={() =>
            setTimeout(
              () =>
                setSearchFocused(false),
              200
            )
          }
        />

        {showSearch && (
          <button
            className={styles.clearBtn}
            onClick={() => {
              setQuery('');
              setSearchFocused(false);
            }}
          >
            ✕
          </button>
        )}
      </div>

      {showSearch ? (
        <UserSearch
          query={query}
          onSelectUser={handleSelectUser}
          onCreateGroup={() => {
            setQuery('');
            setSearchFocused(false);
            setShowGroupModal(true);
          }}
        />
      ) : (
        <ConversationList
          conversations={conversations}
          activeConversation={activeConversation}
          onSelect={onSelectConversation}
          unreadMap={unreadMap}
          onlineUsers={onlineUsers}
        />
      )}

      {showGroupModal && (
        <CreateGroupModal
          onClose={() =>
            setShowGroupModal(false)
          }
          onGroupCreated={g => {
            onGroupCreated(g);
            setShowGroupModal(false);
          }}
        />
      )}

      {showProfile && (
        <ProfileModal
          onClose={() =>
            setShowProfile(false)
          }
        />
      )}

      {showBlockedUsers && (
        <BlockedUsersModal
          onClose={() =>
            setShowBlockedUsers(false)
          }
        />
      )}
    </aside>
  );
}