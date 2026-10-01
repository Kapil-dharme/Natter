import { useAuth } from '../../context/AuthContext';
import { ChevronDown } from 'lucide-react';
import styles from './ConversationList.module.css';

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr), now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { weekday: 'short' });
}

export default function ConversationList({ conversations, activeConversation, onSelect, unreadMap, onlineUsers }) {
  const { user } = useAuth();
  const userId = user?._id || user?.id;

  if (!conversations.length) {
    return <div className={styles.empty}><p>No conversations yet.</p><p>search people to start one.</p></div>;
  }

  return (
    <div className={styles.list}>
      <div className={styles.sectionHeader}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <ChevronDown size={15} />
          My chats
        </span>
        <span className={styles.count}>{conversations.length}</span>
      </div>
      {conversations.map(convo => {
        const isGroup = convo.type === 'group';
        const other = !isGroup ? convo.participants?.find(p => (p._id || p) !== userId) : null;
        const name = isGroup ? convo.groupName : (other?.userName || 'Unknown');
        const avatar = isGroup ? convo.groupPhoto : other?.profileURL;
        const isActive = activeConversation?._id === convo._id;
        const lastMsg = convo.lastMessage;
        const isOnline = !isGroup && other?._id && onlineUsers?.has(String(other._id || other));
        const unread = unreadMap?.[convo._id] || 0;

        console.log('other._id:', other?._id, 'onlineUsers:', onlineUsers);

        return (
          <div
            key={convo._id}
            className={`${styles.item} ${isActive ? styles.active : ''}`}
            onClick={() => onSelect(convo)}
          >
            <div className={styles.avatarWrap}>
              {avatar
                ? <img src={avatar} alt={name} className={styles.avatar} style={{ objectPosition: 'top center' }} />
                : <div className={styles.avatarFallback} style={isGroup ? { background: 'var(--primary-fixed)', color: 'var(--primary)' } : {}}>
                  {name?.[0]?.toUpperCase()}
                </div>
              }
              {isOnline && <span className={styles.onlineDot} />}
            </div>
            <div className={styles.info}>
              <div className={styles.row}>
                <span className={styles.name}>{name}</span>
                <span className={styles.time}>
                  {lastMsg ? formatTime(lastMsg.createdAt) : ''}
                </span>
              </div>
              <div className={styles.row}>
                <span className={styles.preview}>
                  {lastMsg
                    ? lastMsg.type === 'image'
                      ? 'Photo'
                      : lastMsg.type === 'file'
                        ? 'File'
                        : lastMsg.content
                    : ''
                  }
                </span>
                {unread > 0 && (
                  <span className={styles.badge}>{unread > 100 ? '100+' : unread}</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
