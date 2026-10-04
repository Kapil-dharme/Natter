import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import {
    enablePushNotifications,
    disablePushNotifications,
    isPushEnabled
} from '../../utils/pushnotifications';

export default function ProfileModal({ onClose }) {
    const { user, updateUser } = useAuth();
    const [userName, setUserName] = useState(user?.userName || '');
    const [preview, setPreview] = useState(user?.profileURL || null);
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const [notificationLoading, setNotificationLoading] = useState(false);
    const [notificationError, setNotificationError] = useState('');
    const fileRef = useRef(null);

    useEffect(() => {
        async function checkNotifications() {
            try {
                if (!('Notification' in window)) {
                    setNotificationsEnabled(false);
                    return;
                }

                if (user?.pushNotificationsDisabled === true) {
                    setNotificationsEnabled(false);
                    return;
                }

                if (Notification.permission === 'denied') {
                    setNotificationsEnabled(false);
                    setNotificationError(
                        "Notifications are blocked. Please allow notifications from your browser's site settings."
                    );
                    return;
                }

                const enabled = await isPushEnabled();
                setNotificationsEnabled(enabled);
            } catch (error) {
                console.error(
                    'Failed to check notification status:',
                    error
                );

                setNotificationsEnabled(false);
            }
        }

        checkNotifications();
    }, [user]);

    function handleFileChange(e) {
        const f = e.target.files[0];

        if (!f) {
            return;
        }

        setFile(f);
        setPreview(URL.createObjectURL(f));
    }

    async function handleNotificationToggle() {
        setNotificationError('');
        setNotificationLoading(true);

        try {
            if (notificationsEnabled) {
                await disablePushNotifications();

                const updatedUser = {
                    ...user,
                    pushNotificationsDisabled: true,
                    pushNotificationsConfigured: true
                };

                updateUser(updatedUser);
                setNotificationsEnabled(false);

                return;
            }

            if (
                'Notification' in window &&
                Notification.permission === 'denied'
            ) {
                setNotificationError(
                    "Notifications are blocked. Please allow notifications from your browser's site settings."
                );

                return;
            }

            await enablePushNotifications();

            const updatedUser = {
                ...user,
                pushNotificationsDisabled: false,
                pushNotificationsConfigured: true
            };

            updateUser(updatedUser);
            setNotificationsEnabled(true);

        } catch (error) {
            console.error(
                'Notification toggle error:',
                error
            );

            if (
                'Notification' in window &&
                Notification.permission === 'denied'
            ) {
                setNotificationError(
                    "Notifications are blocked. Please allow notifications from your browser's site settings."
                );
            } else {
                setNotificationError(
                    error.response?.data?.message ||
                    error.message ||
                    'Failed to update notification settings.'
                );
            }
        } finally {
            setNotificationLoading(false);
        }
    }

    async function handleSave() {
        setError('');
        const nameUnchanged = userName.trim() === (user?.userName || '');

        if (nameUnchanged && !file) {
            onClose();
            return;
        }
        setLoading(true);

        try {
            const formData = new FormData();

            formData.append('userName', userName);

            if (file) {
                formData.append('profileURL', file);
            }

            const res = await api.patch('/auth/profile', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            updateUser(res.data.user);

            window.dispatchEvent(
                new CustomEvent('profile-updated', {
                    detail: res.data.user
                })
            );

            onClose();

        } catch (err) {
            setError(
                err.response?.data?.message ||
                'Update failed'
            );
        } finally {
            setLoading(false);
        }
    }

    return createPortal(
        <div
            style={{
                position: 'fixed',
                inset: 0,
                width: '100vw',
                height: '100vh',
                background: 'rgba(0,0,0,0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                padding: 16,
                boxSizing: 'border-box'
            }}
        >
            <div
                style={{
                    background: 'var(--surface)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '28px 24px',
                    width: '100%',
                    maxWidth: 400,
                    boxShadow: 'var(--shadow-overlay)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 20,
                    maxHeight: 'calc(100vh - 32px)',
                    overflowY: 'auto',
                    boxSizing: 'border-box'
                }}
            >
                <div
                    style={{
                        display: 'inline-flex',
                        width: 'fit-content',
                        alignSelf: 'flex-start',
                        alignItems: 'center',
                        padding: '5px 9px',
                        borderRadius: '10px',
                        background: '#ffffff',
                        border: '1px solid #e5e5e5',
                        boxShadow: '0 1px 5px rgba(0, 0, 0, 0.07)'
                    }}
                >
                    <h2
                        style={{
                            margin: 0,
                            fontFamily: "'Poppins', sans-serif",
                            fontSize: 15,
                            fontWeight: 600,
                            color: '#111111',
                            lineHeight: 1.2,
                            whiteSpace: 'nowrap'
                        }}
                    >
                        My Profile
                    </h2>
                </div>

                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 10
                    }}
                >
                    <div
                        onClick={() => fileRef.current.click()}
                        style={{
                            width: 80,
                            height: 80,
                            borderRadius: '50%',
                            cursor: 'pointer',
                            flexShrink: 0,
                            ...(preview
                                ? {
                                    backgroundImage: `url(${preview})`,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'top'
                                }
                                : {
                                    background: 'var(--surface-high)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 28,
                                    color: 'var(--text-secondary)'
                                }),
                            border: '2px dashed var(--surface-high)'
                        }}
                    >
                        {!preview && '＋'}
                    </div>

                    <span
                        onClick={() => fileRef.current.click()}
                        style={{
                            fontSize: 16,
                            color: '#2563eb',
                            cursor: 'pointer'
                        }}
                    >
                        Change photo
                    </span>

                    <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleFileChange}
                    />
                </div>

                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6
                    }}
                >
                    <label
                        style={{
                            fontSize: 13,
                            color: 'var(--text-secondary)'
                        }}
                    >
                        Username{'  '} :-
                        <span style={{ fontSize: 11 ,color:'#2563eb'}}>
                            (can be changed once every 30 days)
                        </span>
                    </label>

                    <input
                        value={userName}
                        onChange={e => {
                            setUserName(e.target.value);
                            setError('');
                        }}
                        style={{
                            padding: '10px 12px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--surface-high)',
                            background: 'var(--surface-low)',
                            color: 'var(--text-primary)',
                            font: 'inherit',
                            fontSize: 14,
                            outline: 'none'
                        }}
                    />
                </div>

                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                        padding: '14px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--surface-high)',
                        background: 'var(--surface-low)'
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 12
                        }}
                    >
                        <div>
                            <div
                                style={{
                                    fontSize: 14,
                                    fontWeight: 600,
                                    color: 'var(--text-primary)'
                                }}
                            >
                                Notifications
                            </div>

                            <div
                                style={{
                                    marginTop: 3,
                                    fontSize: 12,
                                    color: 'var(--text-secondary)'
                                }}
                            >
                                {notificationsEnabled
                                    ? 'Push notifications are enabled'
                                    : 'Receive notifications for new messages'}
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleNotificationToggle}
                            disabled={notificationLoading}
                            style={{
                                padding: '8px 14px',
                                borderRadius: 'var(--radius-sm)',
                                border: 'none',
                                background: notificationsEnabled
                                    ? '#111111'
                                    : '#2563eb',
                                color: '#ffffff',
                                cursor: notificationLoading
                                    ? 'not-allowed'
                                    : 'pointer',
                                font: 'inherit',
                                fontSize: 13,
                                opacity: notificationLoading ? 0.7 : 1,
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {notificationLoading
                                ? 'Updating…'
                                : notificationsEnabled
                                    ? 'Disable'
                                    : 'Enable'}
                        </button>
                    </div>

                    {notificationError && (
                        <p
                            style={{
                                margin: 0,
                                fontSize: 12,
                                lineHeight: 1.5,
                                color: 'var(--error)'
                            }}
                        >
                            {notificationError}
                        </p>
                    )}
                </div>

                {error && (
                    <p
                        style={{
                            margin: 0,
                            fontSize: 13,
                            color: 'var(--error)'
                        }}
                    >
                        {error}
                    </p>
                )}

                <div
                    style={{
                        display: 'flex',
                        gap: 10,
                        justifyContent: 'center'
                    }}
                >
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        style={{
                            padding: '9px 18px',
                            borderRadius: 'var(--radius-sm)',
                            border: 'none',
                            background: '#2563eb',
                            color: '#fff',
                            cursor: loading
                                ? 'not-allowed'
                                : 'pointer',
                            font: 'inherit',
                            fontSize: 14,
                            opacity: loading ? 0.7 : 1
                        }}
                    >
                        {loading ? 'Saving…' : 'Save'}
                    </button>

                    <button
                        onClick={onClose}
                        style={{
                            padding: '9px 18px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--surface-high)',
                            background: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            font: 'inherit',
                            fontSize: 14
                        }}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
