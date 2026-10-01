import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import styles from './CreateGroupModal.module.css';
import {Camera} from "lucide-react"

export default function CreateGroupModal({ onClose, onGroupCreated }) {
  const { user } = useAuth();
  const userId = user?._id || user?.id;
  const fileRef = useRef(null);
  const loaderRef = useRef(null);
  const listRef = useRef(null);
  const [groupPhoto, setGroupPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  const [step, setStep] = useState('select');
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    setUsers([]);
    setPage(1);
    setHasMore(true);
  }, [query]);

  useEffect(() => {
    const t = setTimeout(() => {
      api.get(`/userChat/users/search?query=${encodeURIComponent(query.trim())}&page=${page}&limit=15`)
        .then(res => {
          const fetched = (res.data.user || []).filter(u => u._id !== userId);
          setUsers(prev => page === 1 ? fetched : [...prev, ...fetched]);
          setHasMore(fetched.length === 15);
        })
        .catch(() => setUsers([]));
    }, query.trim() ? 250 : 0);
    return () => clearTimeout(t);
  }, [query, page, userId]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) setPage(prev => prev + 1);
      },
      { threshold: 1 }
    );
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasMore]);

  function toggle(u) {
    setSelected(prev => prev.find(s => s._id === u._id) ? prev.filter(s => s._id !== u._id) : [...prev, u]);
  }

  async function handleCreate() {
    if (!groupName.trim()) { setError('Please enter a group name.'); return; }
    if (selected.length < 2) { setError('Select at least 2 participants.'); return; }
    setError(''); setLoading(true);
    try {
      const data = new FormData();
      data.append('groupName', groupName.trim());
      selected.map(u => u._id).filter(Boolean).forEach(id => data.append('participantIds[]', id));
      if (groupPhoto) data.append('groupPhoto', groupPhoto);

      const res = await api.post('/userChat/conversations/group', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      onGroupCreated(res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create group.');
    } finally { setLoading(false); }
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>

        {step === 'select' && (
          <>
            <div className={styles.header}>
              <h2 className={styles.title}>New Group</h2>
              <button className={styles.closeBtn} onClick={onClose}>✕</button>
            </div>
            <p className={styles.hint}>Select at least 2 people to add.</p>

            {selected.length > 0 && (
              <div className={styles.chips}>
                {selected.map(u => (
                  <div key={u._id} className={styles.chip}>
                    {u.userName}
                    <button className={styles.chipX} onClick={() => toggle(u)}>✕</button>
                  </div>
                ))}
              </div>
            )}

            <input
              className={styles.searchInput}
              type="text" placeholder="Search people…"
              value={query} onChange={e => setQuery(e.target.value)} autoFocus
            />

            <div className={styles.list} ref={listRef}>
              {users.map(u => {
                const sel = !!selected.find(s => s._id === u._id);
                return (
                  <div key={u._id} className={`${styles.item} ${sel ? styles.itemSel : ''}`} onClick={() => toggle(u)}>
                    {u.profileURL
                      ? <img src={u.profileURL} alt={u.userName} className={styles.avatar} />
                      : <div className={styles.avatarFallback}>{u.userName?.[0]?.toUpperCase()}</div>
                    }
                    <span className={styles.itemName}>{u.userName}</span>
                    {sel && <span className={styles.check}>✓</span>}
                  </div>
                );
              })}
              <div ref={loaderRef} style={{ height: 1 }} />
            </div>

            <div className={styles.footer}>
              <button
                className={styles.nextBtn}
                onClick={() => setStep('name')}
                disabled={selected.length < 2}
              >
                Next ({selected.length} selected)
              </button>
            </div>
          </>
        )}

        {step === 'name' && (
          <>
            <div className={styles.header}>
              <h2 className={styles.title}>Group Settings</h2>
              <button className={styles.closeBtn} onClick={onClose}>✕</button>
            </div>

            <div className={styles.groupPhotoWrap}>
              <div className={styles.groupPhoto} onClick={() => fileRef.current.click()}>
                {photoPreview
                  ? <img src={photoPreview} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', objectPosition: 'top center' }} />
                  : <span style={{ fontSize: 28 }}><Camera size={22}/></span>
                }
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => {
                  const file = e.target.files[0];
                  if (!file) return;
                  setGroupPhoto(file);
                  setPhotoPreview(URL.createObjectURL(file));
                }}
              />
              <span className={styles.uploadLabel}>Upload Group Photo</span>
            </div>

            <div className={styles.nameField}>
              <label className={styles.nameLabel}>Group Name</label>
              <input
                className={styles.nameInput}
                type="text" placeholder="Group Name"
                value={groupName} onChange={e => setGroupName(e.target.value)}
                autoFocus onKeyDown={e => e.key === 'Enter' && handleCreate()}
              />
            </div>

            <div className={styles.selectedSection}>
              <div className={styles.selectedHeader}>
                <span>Selected Members ({selected.length})</span>
                <button className={styles.addMoreBtn} onClick={() => setStep('select')}>＋ Add More</button>
              </div>
              {selected.map(u => (
                <div key={u._id} className={styles.memberRow}>
                  {u.profileURL
                    ? <img src={u.profileURL} alt={u.userName} className={styles.memberAvatar} />
                    : <div className={styles.memberAvatarFallback}>{u.userName?.[0]?.toUpperCase()}</div>
                  }
                  <span className={styles.memberName}>{u.userName}</span>
                </div>
              ))}
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <div className={styles.footer}>
              <button className={styles.finalizeBtn} onClick={handleCreate} disabled={loading}>
                {loading ? 'Creating…' : 'Finalize Group'}
              </button>
              <button className={styles.cancelBtn} onClick={() => setStep('select')}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}