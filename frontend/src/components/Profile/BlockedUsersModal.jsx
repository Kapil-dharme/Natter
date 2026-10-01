import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, UserRound, ShieldOff } from 'lucide-react';
import api from '../../api/axios';

export default function BlockedUsersModal({ onClose }) {
    const [blockedUsers, setBlockedUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [unblockingId, setUnblockingId] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        async function loadBlockedUsers() {
            try {
                setLoading(true);
                setError('');

                const response = await api.get('/block');

                const users =
                    response.data?.users ||
                    response.data?.blockedUsers ||
                    response.data?.user ||
                    [];

                setBlockedUsers(users);
            } catch (error) {
                console.error(
                    'Failed to load blocked users:',
                    error
                );

                setError(
                    error.response?.data?.message ||
                    'Failed to load blocked users.'
                );
            } finally {
                setLoading(false);
            }
        }

        loadBlockedUsers();
    }, []);

    async function handleUnblock(userId) {
        if (!userId || unblockingId) return;

        try {
            setUnblockingId(String(userId));
            setError('');

            await api.delete(
                `/block/${userId}`
            );

            setBlockedUsers(prev =>
                prev.filter(user => {
                    const id =
                        user?._id ||
                        user?.id ||
                        user;

                    return (
                        String(id) !==
                        String(userId)
                    );
                })
            );

            window.dispatchEvent(
                new CustomEvent(
                    'blocked-users-updated',
                    {
                        detail: {
                            userId: String(userId),
                            blocked: false
                        }
                    }
                )
            );
        } catch (error) {
            console.error(
                'Failed to unblock user:',
                error
            );

            setError(
                error.response?.data?.message ||
                'Failed to unblock user.'
            );
        } finally {
            setUnblockingId(null);
        }
    }

    return createPortal(
        <div
            style={{
                position: 'fixed',
                inset: 0,
                width: '100vw',
                height: '100vh',
                background: 'rgba(0, 0, 0, 0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10000,
                padding: 16,
                boxSizing: 'border-box'
            }}
        >
            <div
                style={{
                    width: '100%',
                    maxWidth: 420,
                    maxHeight: 'calc(100vh - 32px)',
                    background: 'var(--surface)',
                    borderRadius: 'var(--radius-lg)',
                    boxShadow: 'var(--shadow-overlay)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '18px 20px',
                        borderBottom:
                            '1px solid var(--surface-high)'
                    }}
                >
                    <div>
                        <h2
                            style={{
                                margin: 0,
                                fontFamily:
                                    "'Poppins', sans-serif",
                                fontSize: 17,
                                fontWeight: 600,
                                color:
                                    'var(--text-primary)'
                            }}
                        >
                            Blocked Users
                        </h2>

                        <p
                            style={{
                                margin: '4px 0 0',
                                fontSize: 12,
                                color:
                                    'var(--text-secondary)'
                            }}
                        >
                            Manage the users you have blocked.
                        </p>
                    </div>

                    <button
                        onClick={onClose}
                        title="Close"
                        style={{
                            width: 34,
                            height: 34,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: 'none',
                            borderRadius: 8,
                            background: 'transparent',
                            color:
                                'var(--text-primary)',
                            cursor: 'pointer'
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>

                <div
                    style={{
                        padding: 16,
                        overflowY: 'auto',
                        flex: 1
                    }}
                >
                    {loading ? (
                        <div
                            style={{
                                padding: '35px 10px',
                                textAlign: 'center',
                                fontSize: 14,
                                color:
                                    'var(--text-secondary)'
                            }}
                        >
                            Loading blocked users…
                        </div>
                    ) : error ? (
                        <div
                            style={{
                                padding: '20px 10px',
                                textAlign: 'center',
                                fontSize: 13,
                                color: 'var(--error)'
                            }}
                        >
                            {error}
                        </div>
                    ) : blockedUsers.length === 0 ? (
                        <div
                            style={{
                                padding: '40px 15px',
                                textAlign: 'center',
                                color:
                                    'var(--text-secondary)'
                            }}
                        >
                            <ShieldOff
                                size={38}
                                strokeWidth={1.5}
                                style={{
                                    marginBottom: 10
                                }}
                            />

                            <div
                                style={{
                                    fontSize: 14,
                                    color:
                                        'var(--text-primary)'
                                }}
                            >
                                No blocked users
                            </div>

                            <div
                                style={{
                                    marginTop: 4,
                                    fontSize: 12
                                }}
                            >
                                Users you block will appear here.
                            </div>
                        </div>
                    ) : (
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 8
                            }}
                        >
                            {blockedUsers.map(
                                blockedUser => {
                                    const userId =
                                        blockedUser?._id ||
                                        blockedUser?.id ||
                                        blockedUser;

                                    const userName =
                                        blockedUser?.userName ||
                                        blockedUser?.name ||
                                        'Unknown user';

                                    const profileURL =
                                        blockedUser?.profileURL ||
                                        null;

                                    return (
                                        <div
                                            key={String(
                                                userId
                                            )}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 12,
                                                padding:
                                                    '10px 12px',
                                                border:
                                                    '1px solid var(--surface-high)',
                                                borderRadius:
                                                    'var(--radius-md)',
                                                background:
                                                    'var(--surface-low)'
                                            }}
                                        >
                                            {profileURL ? (
                                                <div
                                                    style={{
                                                        width: 42,
                                                        height: 42,
                                                        flexShrink: 0,
                                                        borderRadius:
                                                            '50%',
                                                        backgroundImage:
                                                            `url(${profileURL})`,
                                                        backgroundSize:
                                                            'cover',
                                                        backgroundPosition:
                                                            'center'
                                                    }}
                                                />
                                            ) : (
                                                <div
                                                    style={{
                                                        width: 42,
                                                        height: 42,
                                                        flexShrink: 0,
                                                        borderRadius:
                                                            '50%',
                                                        display:
                                                            'flex',
                                                        alignItems:
                                                            'center',
                                                        justifyContent:
                                                            'center',
                                                        background:
                                                            'var(--surface-high)',
                                                        color:
                                                            'var(--text-secondary)'
                                                    }}
                                                >
                                                    <UserRound
                                                        size={20}
                                                    />
                                                </div>
                                            )}

                                            <div
                                                style={{
                                                    flex: 1,
                                                    minWidth: 0
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        fontSize: 14,
                                                        fontWeight: 500,
                                                        color:
                                                            'var(--text-primary)',
                                                        overflow:
                                                            'hidden',
                                                        textOverflow:
                                                            'ellipsis',
                                                        whiteSpace:
                                                            'nowrap'
                                                    }}
                                                >
                                                    {userName}
                                                </div>
                                            </div>

                                            <button
                                                onClick={() =>
                                                    handleUnblock(
                                                        userId
                                                    )
                                                }
                                                disabled={
                                                    unblockingId ===
                                                    String(userId)
                                                }
                                                style={{
                                                    padding:
                                                        '7px 12px',
                                                    border: 'none',
                                                    borderRadius:
                                                        'var(--radius-sm)',
                                                    background:
                                                        '#2563eb',
                                                    color:
                                                        '#ffffff',
                                                    cursor:
                                                        unblockingId ===
                                                        String(userId)
                                                            ? 'not-allowed'
                                                            : 'pointer',
                                                    font:
                                                        'inherit',
                                                    fontSize: 12,
                                                    opacity:
                                                        unblockingId ===
                                                        String(userId)
                                                            ? 0.7
                                                            : 1,
                                                    whiteSpace:
                                                        'nowrap'
                                                }}
                                            >
                                                {unblockingId ===
                                                String(userId)
                                                    ? 'Unblocking…'
                                                    : 'Unblock'}
                                            </button>
                                        </div>
                                    );
                                }
                            )}
                        </div>
                    )}
                </div>

                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        padding: '12px 16px',
                        borderTop:
                            '1px solid var(--surface-high)'
                    }}
                >
                    <button
                        onClick={onClose}
                        style={{
                            padding: '8px 16px',
                            borderRadius:
                                'var(--radius-sm)',
                            border:
                                '1px solid var(--surface-high)',
                            background: 'transparent',
                            color:
                                'var(--text-primary)',
                            cursor: 'pointer',
                            font: 'inherit',
                            fontSize: 13
                        }}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}