import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import styles from './GroupSettingsPanel.module.css';
import { TriangleAlert, LogOut, ArrowLeft,Pencil } from "lucide-react"

export default function GroupSettingsPanel({
  conversation,
  onClose,
  onClearChat,
  onUpdate,
  onLeaveOrDelete
}) {
  const { user } = useAuth();
  const userId = user?._id || user?.id;
  const adminId = conversation.groupAdmin?._id || conversation.groupAdmin;
  const isAdmin = String(adminId) === String(userId);

  const [groupName, setGroupName] = useState(conversation.groupName || '');
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState('');

  const [addQuery, setAddQuery] = useState('');
  const [addUsers, setAddUsers] = useState([]);
  const [addSelected, setAddSelected] = useState([]);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  const fileRef = useRef(null);
  const [photoPreview, setPhotoPreview] = useState(conversation.groupPhoto || null);
  const [uploading, setUploading] = useState(false);

  const [error, setError] = useState('');

  const [confirmAction, setConfirmAction] = useState(null);
  const [confirming, setConfirming] = useState(false);

  const participantIds = (conversation.participants || []).map(p => p._id || p);

  useEffect(() => {
    if (!isAdmin) return;

    const t = setTimeout(() => {
      api.get(
        `/userChat/users/search?query=${encodeURIComponent(addQuery.trim())}&page=1&limit=15`
      )
        .then(res =>
          setAddUsers(
            (res.data.user || []).filter(
              u => !participantIds.map(String).includes(String(u._id))
            )
          )
        )
        .catch(() => setAddUsers([]));
    }, addQuery.trim() ? 250 : 0);

    return () => clearTimeout(t);
  }, [addQuery, isAdmin, conversation.participants]);

  async function handleRename() {
    if (!groupName.trim()) {
      setRenameError('Name cannot be empty.');
      return;
    }

    setRenameError('');
    setRenaming(true);

    try {
      const res = await api.patch(
        `/userChat/conversations/group/${conversation._id}/rename`,
        { groupName: groupName.trim() }
      );

      onUpdate(res.data);
    } catch (err) {
      setRenameError(
        err.response?.data?.message || 'Failed to rename.'
      );
    } finally {
      setRenaming(false);
    }
  }

  async function handlePhotoChange(e) {
    const file = e.target.files[0];

    if (!file) return;

    setPhotoPreview(URL.createObjectURL(file));
    setUploading(true);

    try {
      const data = new FormData();
      data.append('groupPhoto', file);

      const res = await api.patch(
        `/userChat/conversations/group/${conversation._id}/photo`,
        data,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      onUpdate(res.data);
    } catch (err) {
      setError('Failed to update group photo.');
    } finally {
      setUploading(false);
    }
  }

  async function handleAdd() {
    if (!addSelected.length) return;

    setAddError('');
    setAdding(true);

    try {
      const res = await api.post(
        `/userChat/conversations/group/${conversation._id}/participants`,
        {
          participantIds: addSelected
        }
      );

      onUpdate(res.data);
      setAddSelected([]);
      setAddQuery('');
    } catch (err) {
      setAddError(
        err.response?.data?.message || 'Failed to add.'
      );
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(pid) {
    try {
      const res = await api.delete(
        `/userChat/conversations/group/${conversation._id}/participants/${pid}`
      );

      onUpdate(res.data);
    } catch (err) {
      setError(
        err.response?.data?.message || 'Failed to remove.'
      );
    }
  }

  function handleLeave() {
    setConfirmAction('leave');
  }

  function handleDelete() {
    setConfirmAction('delete');
  }

  async function confirmActionHandler() {
    if (!confirmAction) return;

    setConfirming(true);
    setError('');

    try {
      if (confirmAction === 'leave') {
        await api.delete(
          `/userChat/conversations/group/${conversation._id}/leave`
        );

        onLeaveOrDelete(conversation._id);
      }

      if (confirmAction === 'delete') {
        await api.delete(
          `/userChat/conversations/group/${conversation._id}`
        );

        onLeaveOrDelete(conversation._id);
      }

      setConfirmAction(null);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        `Failed to ${confirmAction} group.`
      );

      setConfirmAction(null);
    } finally {
      setConfirming(false);
    }
  }

  function toggleAdd(id) {
    setAddSelected(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : [...prev, id]
    );
  }

  return (
    <div
      className={styles.overlay}
      onClick={e =>
        e.target === e.currentTarget && onClose()
      }
    >
      <div className={styles.panel}>

        <div className={styles.panelHeader}>
          <button
            className={styles.backBtn}
            onClick={onClose}
          >
            <ArrowLeft size={22} />
          </button>

          <h3 className={styles.panelTitle}>
            Group Info
          </h3>
        </div>

        <div className={styles.body}>

          <div className={styles.groupAvatar}>

            <div
              className={styles.groupAvatarIcon}
              onClick={() =>
                isAdmin && fileRef.current.click()
              }
              style={{
                cursor: isAdmin ? 'pointer' : 'default',
                position: 'relative'
              }}
            >
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="group"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'top center',
                    borderRadius: '50%'
                  }}
                />
              ) : (
                <span
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: 'var(--primary)'
                  }}
                >
                  {conversation.groupName?.[0]?.toUpperCase()}
                </span>
              )}
              {isAdmin && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: 22,
                    height: 22,
                    background: 'var(--primary)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white'
                  }}
                >
                  <Pencil size={12} strokeWidth={2.5} />
                </div>
              )}
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handlePhotoChange}
            />

            <div>
              <div className={styles.groupAvatarName}>
                {conversation.groupName}
              </div>

              <div className={styles.groupAvatarSub}>
                {conversation.participants?.length} members
              </div>

              {uploading && (
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--primary)',
                    marginTop: 2
                  }}
                >
                  Uploading…
                </div>
              )}
            </div>
          </div>

          {isAdmin && (
            <section className={styles.section}>
              <h4 className={styles.sectionTitle}>
                Group Name
              </h4>

              <div className={styles.renameRow}>
                <input
                  className={styles.input}
                  value={groupName}
                  onChange={e =>
                    setGroupName(e.target.value)
                  }
                  onKeyDown={e =>
                    e.key === 'Enter' && handleRename()
                  }
                  placeholder="Group name"
                />

                <button
                  className={styles.saveBtn}
                  onClick={handleRename}
                  disabled={renaming}
                >
                  {renaming ? '…' : 'Save'}
                </button>
              </div>

              {renameError && (
                <p className={styles.error}>
                  {renameError}
                </p>
              )}
            </section>
          )}

          <section className={styles.section}>
            <h4 className={styles.sectionTitle}>
              Members ({conversation.participants?.length})
            </h4>

            <div className={styles.memberList}>
              {(conversation.participants || []).map(p => {
                const pid = p._id || p;
                const isSelf =
                  String(pid) === String(userId);
                const isGroupAdmin =
                  String(pid) === String(adminId);

                return (
                  <div
                    key={pid}
                    className={styles.memberItem}
                  >
                    {p.profileURL ? (
                      <img
                        src={p.profileURL}
                        alt={p.userName}
                        className={styles.memberAvatar}
                      />
                    ) : (
                      <div
                        className={
                          styles.memberAvatarFallback
                        }
                      >
                        {p.userName?.[0]?.toUpperCase()}
                      </div>
                    )}

                    <div className={styles.memberInfo}>
                      <span className={styles.memberName}>
                        {p.userName || 'Unknown'}
                        {isSelf ? ' (You)' : ''}
                      </span>

                      {isGroupAdmin && (
                        <span className={styles.adminBadge}>
                          Admin
                        </span>
                      )}
                    </div>

                    {isAdmin &&
                      !isSelf &&
                      !isGroupAdmin && (
                        <button
                          className={styles.removeBtn}
                          onClick={() =>
                            handleRemove(pid)
                          }
                        >
                          Remove
                        </button>
                      )}
                  </div>
                );
              })}
            </div>
          </section>

          {isAdmin && (
            <section className={styles.section}>
              <h4 className={styles.sectionTitle}>
                Add People
              </h4>

              <input
                className={styles.input}
                placeholder="Search to add…"
                value={addQuery}
                onChange={e =>
                  setAddQuery(e.target.value)
                }
              />

              {addUsers.length > 0 && (
                <div className={styles.addList}>
                  {addUsers.map(u => (
                    <div
                      key={u._id}
                      className={`${styles.memberItem} ${addSelected.includes(u._id)
                        ? styles.memberSel
                        : ''
                        }`}
                      onClick={() =>
                        toggleAdd(u._id)
                      }
                    >
                      {u.profileURL ? (
                        <img
                          src={u.profileURL}
                          alt={u.userName}
                          className={styles.memberAvatar}
                        />
                      ) : (
                        <div
                          className={
                            styles.memberAvatarFallback
                          }
                        >
                          {u.userName?.[0]?.toUpperCase()}
                        </div>
                      )}

                      <span className={styles.memberName}>
                        {u.userName}
                      </span>

                      {addSelected.includes(u._id) && (
                        <span className={styles.check}>
                          ✓
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {addSelected.length > 0 && (
                <button
                  className={styles.addBtn}
                  onClick={handleAdd}
                  disabled={adding}
                >
                  {adding
                    ? 'Adding…'
                    : `Add ${addSelected.length} participant${addSelected.length > 1
                      ? 's'
                      : ''
                    }`}
                </button>
              )}

              {addError && (
                <p className={styles.error}>
                  {addError}
                </p>
              )}
            </section>
          )}

          {error && (
            <p className={styles.error}>
              {error}
            </p>
          )}

          <section className={styles.dangerSection}>
            <button
              className={styles.leaveBtn}
              onClick={onClearChat}
            >
              Clear Chat
            </button>
            <button
              className={styles.leaveBtn}
              onClick={handleLeave}
            >
              Leave Group
            </button>

            {isAdmin && (
              <button
                className={styles.deleteBtn}
                onClick={handleDelete}
              >
                Delete Group
              </button>
            )}
          </section>
        </div>
      </div>

      {confirmAction && (
        <div
          className={styles.confirmOverlay}
          onClick={e => {
            if (e.target === e.currentTarget) {
              setConfirmAction(null);
            }
          }}
        >
          <div className={styles.confirmModal}>

            <div className={styles.confirmIcon}>
              {confirmAction === 'delete' ? <TriangleAlert size={20} /> : <LogOut size={20} />}
            </div>

            <h3 className={styles.confirmTitle}>
              {confirmAction === 'delete'
                ? 'Delete Group?'
                : 'Leave Group?'}
            </h3>

            <p className={styles.confirmText}>
              {confirmAction === 'delete'
                ? 'This will permanently delete the group for all members. All group conversations and data associated with this group may no longer be accessible. This action cannot be undone.'
                : isAdmin
                  ? 'You are the group admin. If you leave the group, you will no longer be able to manage it. Are you sure you want to leave?'
                  : 'You will leave this group and will no longer receive messages from it. Are you sure you want to continue?'}
            </p>

            <div className={styles.confirmActions}>
              <button
                className={styles.cancelBtn}
                onClick={() => setConfirmAction(null)}
                disabled={confirming}
              >
                Cancel
              </button>

              <button
                className={
                  confirmAction === 'delete'
                    ? styles.confirmDeleteBtn
                    : styles.confirmLeaveBtn
                }
                onClick={confirmActionHandler}
                disabled={confirming}
              >
                {confirming
                  ? 'Please wait…'
                  : confirmAction === 'delete'
                    ? 'Delete Group'
                    : 'Leave Group'}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}