import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import styles from './Landing.module.css';

const INITIAL_MESSAGES = [
  { id: 1, from: 'alex', text: "Hey, how's it going?", time: '10:42 AM' },
  { id: 2, from: 'me', text: 'Everything is great! Just setting up Natter.', time: '10:45 AM' },
  { id: 3, from: 'alex', text: 'Looks awesome! The interface is so clean.', time: '10:46 AM' },
];

const AUTO_REPLIES = [
  "That's awesome! ",
  "Haha totally agree!",
  "Tell me more about it ",
  "Nice one!",
  "Sounds good to me ",
  "Wow, really? That's cool!",
  "Haha, you're funny ",
  "Interesting... ",
];

function now() {
  return new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function Landing() {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [input, setInput] = useState('');

  const bottomRef = useRef(null);
  const replyTimer = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleInstall() {
    try {
      const installed = await window.installNatter();

      if (!installed) {
        console.log(
          'Natter install prompt is currently unavailable.'
        );
      }
    } catch (error) {
      console.error(
        'Natter installation failed:',
        error
      );
    }
  }

  function sendMessage() {
    const text = input.trim();

    if (!text) return;

    const myMsg = {
      id: Date.now(),
      from: 'me',
      text,
      time: now(),
    };

    setMessages((prev) => [...prev, myMsg]);
    setInput('');

    clearTimeout(replyTimer.current);

    replyTimer.current = setTimeout(() => {
      const reply =
        AUTO_REPLIES[
          Math.floor(Math.random() * AUTO_REPLIES.length)
        ];

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          from: 'alex',
          text: reply,
          time: now(),
        },
      ]);
    }, 1000);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      sendMessage();
    }
  }

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>
            <svg
              viewBox="0 0 48 48"
              width="38"
              height="38"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-label="Natter"
            >
              <rect
                x="2"
                y="2"
                width="44"
                height="44"
                rx="14"
                fill="#0058be"
              />

              <path
                d="M13 31V17C13 15.895 13.895 15 15 15H17L31 29V17"
                stroke="white"
                strokeWidth="3.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              <path
                d="M31 29L35 33"
                stroke="white"
                strokeWidth="3.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              <path
                d="M17 33H14C12.343 33 11 31.657 11 30V27"
                stroke="white"
                strokeWidth="3.4"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <span className={styles.logoText}>
            Natter
          </span>
        </div>

        <div className={styles.navActions}>
          <Link
            to="/login"
            className={styles.navLogin}
          >
            Log In
          </Link>

          <Link
            to="/register"
            className={styles.navSignup}
          >
            Sign Up
          </Link>
        </div>
      </nav>

      <main className={styles.hero}>
        <h1 className={styles.heroTitle}>
          Natter with your world
        </h1>

        <p className={styles.heroSub}>
          Experience the cleanest, fastest way to stay connected.
          <br />
          Minimalist by design, powerful by choice.
        </p>

        <div className={styles.heroActions}>
          <Link
            to="/register"
            className={styles.ctaPrimary}
          >
            Get Started for Free →
          </Link>

          <button
            className={styles.ctaInstall}
            onClick={handleInstall}
            type="button"
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />

              <polyline points="7 10 12 15 17 10" />

              <line
                x1="12"
                y1="15"
                x2="12"
                y2="3"
              />
            </svg>

            Install Natter
          </button>
        </div>

        <div className={styles.demoShell}>
          <div className={styles.demoBar}>
            <div
              className={styles.dot}
              style={{ background: '#ff5f57' }}
            />

            <div
              className={styles.dot}
              style={{ background: '#febc2e' }}
            />

            <div
              className={styles.dot}
              style={{ background: '#28c840' }}
            />

            <span className={styles.demoLabel}>
              Interactive Chat Experience
            </span>
          </div>

          <div className={styles.demoBody}>
            <div className={styles.demoSidebar}>
              <div className={styles.demoSearch}>
                Search chats...
              </div>

              <div
                className={`${styles.demoItem} ${styles.demoItemActive}`}
              >
                <div
                  className={styles.demoAvatar}
                  style={{
                    background: '#3b82f6',
                    color: '#fff',
                  }}
                >
                  AL
                </div>

                <div>
                  <div className={styles.demoName}>
                    Alex
                  </div>

                  <div className={styles.demoPreview}>
                    {messages[
                      messages.length - 1
                    ]?.text?.slice(0, 20)}
                    ...
                  </div>
                </div>
              </div>

              <div className={styles.demoItem}>
                <div
                  className={styles.demoAvatar}
                  style={{
                    background: '#e7eefe',
                    color: '#3b82f6',
                  }}
                >
                  JD
                </div>

                <div>
                  <div className={styles.demoName}>
                    Jordan
                  </div>

                  <div className={styles.demoPreview}>
                    Are we still on for to...
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.demoChat}>
              <div className={styles.demoChatHeader}>
                <div
                  className={styles.demoAvatar}
                  style={{
                    background: '#3b82f6',
                    color: '#fff',
                    width: 36,
                    height: 36,
                    fontSize: 13,
                  }}
                >
                  AL
                </div>

                <div>
                  <div className={styles.demoName}>
                    Alex
                  </div>

                  <div
                    style={{
                      fontSize: 11,
                      color: '#22c55e',
                    }}
                  >
                    ● Online
                  </div>
                </div>
              </div>

              <div className={styles.demoChatMessages}>
                {messages.map((msg) =>
                  msg.from === 'me' ? (
                    <div
                      key={msg.id}
                      className={styles.demoBubbleOut}
                    >
                      {msg.text}

                      <div className={styles.demoTime}>
                        {msg.time}
                      </div>
                    </div>
                  ) : (
                    <div
                      key={msg.id}
                      className={styles.demoBubbleIn}
                    >
                      {msg.text}

                      <div className={styles.demoTime}>
                        {msg.time}
                      </div>
                    </div>
                  )
                )}

                <div ref={bottomRef} />
              </div>

              <div className={styles.demoChatInputWrap}>
                <input
                  className={styles.demoChatInputField}
                  type="text"
                  placeholder="Type a message..."
                  value={input}
                  onChange={(e) =>
                    setInput(e.target.value)
                  }
                  onKeyDown={handleKeyDown}
                />

                <button
                  className={styles.demoSendBtn}
                  onClick={sendMessage}
                  type="button"
                >
                  ➤
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerLeft}>
          <div className={styles.logo}>
            <div className={styles.logoIcon}>
              <svg
                viewBox="0 0 48 48"
                width="38"
                height="38"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-label="Natter"
              >
                <rect
                  x="2"
                  y="2"
                  width="44"
                  height="44"
                  rx="14"
                  fill="#0058be"
                />

                <path
                  d="M13 31V17C13 15.895 13.895 15 15 15H17L31 29V17"
                  stroke="white"
                  strokeWidth="3.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                <path
                  d="M31 29L35 33"
                  stroke="white"
                  strokeWidth="3.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                <path
                  d="M17 33H14C12.343 33 11 31.657 11 30V27"
                  stroke="white"
                  strokeWidth="3.4"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>

          <span
            style={{
              fontSize: 12,
              color: 'var(--outline)',
            }}
          >
            © 2026 Natter. All rights reserved.
          </span>
        </div>

        <div className={styles.footerLinks}>
          <a href="#">Privacy Policy</a>
          <a href="#">Terms of Service</a>
          <a href="#">Contact Support</a>
        </div>

        <span
          style={{
            fontSize: 12,
            color: 'var(--outline)',
          }}
        >
          Made by{' '}
          <a
            href="https://www.linkedin.com/in/kapil-dharme-a52a1336a/"
            target="_blank"
            rel="noreferrer"
            style={{
              color: 'var(--primary)',
              fontWeight: 600,
              textDecoration: 'none',
            }}
            onMouseEnter={(e) =>
              (e.target.style.textDecoration =
                'underline')
            }
            onMouseLeave={(e) =>
              (e.target.style.textDecoration =
                'none')
            }
          >
            Kapil Dharme
          </a>
        </span>
      </footer>
    </div>
  );
}