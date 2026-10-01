import { createPortal } from 'react-dom';

export default function NotificationPrompt({ onEnable, onNotNow, loading }) {
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
                zIndex: 10000,
                padding: 16,
                boxSizing: 'border-box'
            }}
        >
            <div
                style={{
                    width: '100%',
                    maxWidth: 380,
                    background: 'var(--surface)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '26px 24px',
                    boxShadow: 'var(--shadow-overlay)',
                    boxSizing: 'border-box'
                }}
            >
                <div
                    style={{
                        display: 'inline-flex',
                        padding: '5px 9px',
                        borderRadius: '10px',
                        background: '#ffffff',
                        border: '1px solid #e5e5e5',
                        boxShadow: '0 1px 5px rgba(0, 0, 0, 0.07)',
                        marginBottom: 18
                    }}
                >
                    <h2
                        style={{
                            margin: 0,
                            fontFamily: "'Poppins', sans-serif",
                            fontSize: 15,
                            fontWeight: 600,
                            color: '#111111'
                        }}
                    >
                        Notifications
                    </h2>
                </div>

                <h3
                    style={{
                        margin: '0 0 8px',
                        fontSize: 18,
                        fontWeight: 600,
                        color: 'var(--text-primary)'
                    }}
                >
                    Stay updated with Natter
                </h3>

                <p
                    style={{
                        margin: '0 0 24px',
                        fontSize: 14,
                        lineHeight: 1.6,
                        color: 'var(--text-secondary)'
                    }}
                >
                    Get notified when you receive new messages, even when
                    Natter is not open.
                </p>

                <div
                    style={{
                        display: 'flex',
                        gap: 10,
                        justifyContent: 'flex-end'
                    }}
                >
                    <button
                        type="button"
                        onClick={onNotNow}
                        disabled={loading}
                        style={{
                            padding: '9px 16px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--surface-high)',
                            background: 'none',
                            color: 'var(--text-secondary)',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            font: 'inherit',
                            fontSize: 14
                        }}
                    >
                        Not now
                    </button>

                    <button
                        type="button"
                        onClick={onEnable}
                        disabled={loading}
                        style={{
                            padding: '9px 18px',
                            borderRadius: 'var(--radius-sm)',
                            border: 'none',
                            background: '#2563eb',
                            color: '#ffffff',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            font: 'inherit',
                            fontSize: 14,
                            opacity: loading ? 0.7 : 1
                        }}
                    >
                        {loading ? 'Enabling…' : 'Enable notifications'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}