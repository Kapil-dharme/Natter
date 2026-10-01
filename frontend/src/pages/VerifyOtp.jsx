
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import styles from './Auth.module.css';

export default function VerifyOtp() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const email = location.state?.email || '';
  const otpExpiresAt = location.state?.otpExpiresAt || null;

  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [expiresAt, setExpiresAt] = useState(otpExpiresAt);

  const [countdown, setCountdown] = useState(() => {
    if (!otpExpiresAt) return 0;

    return Math.max(
      0,
      Math.floor(
        (new Date(otpExpiresAt).getTime() - Date.now()) / 1000
      )
    );
  });

  const [canResend, setCanResend] = useState(false);

  const inputRefs = useRef([]);

  useEffect(() => {
    if (!expiresAt) {
      setCountdown(0);
      setCanResend(true);
      return;
    }

    const updateCountdown = () => {
      const remaining = Math.max(
        0,
        Math.ceil(
          (new Date(expiresAt).getTime() - Date.now()) / 1000
        )
      );

      setCountdown(remaining);

      if (remaining <= 0) {
        setCanResend(true);
      } else {
        setCanResend(false);
      }
    };

    updateCountdown();

    const timer = setInterval(updateCountdown, 250);

    return () => clearInterval(timer);
  }, [expiresAt]);

  function handleDigit(index, value) {
    if (!/^\d?$/.test(value)) return;

    const next = [...digits];
    next[index] = value;

    setDigits(next);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index, e) {
    if (
      e.key === 'Backspace' &&
      !digits[index] &&
      index > 0
    ) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e) {
    e.preventDefault();

    const pasted = e.clipboardData
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, 6);

    const next = [...digits];

    pasted.split('').forEach((ch, i) => {
      next[i] = ch;
    });

    setDigits(next);

    inputRefs.current[
      Math.min(pasted.length, 5)
    ]?.focus();
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const otp = digits.join('');

    if (otp.length < 6) {
      setError('Please enter all 6 digits.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await api.post(
        '/user/verify-otp',
        {
          email,
          otp
        }
      );

      login(res.data.user);

      navigate('/chat');
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Invalid OTP. Try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError('');
    setLoading(true);

    try {
      const res = await api.post(
        '/user/resent-otp',
        {
          email
        }
      );

      const newExpiresAt = res.data.otpExpiresAt;

      setExpiresAt(newExpiresAt);
      setCanResend(false);
      setDigits(['', '', '', '', '', '']);

      inputRefs.current[0]?.focus();
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Failed to resend OTP.'
      );
    } finally {
      setLoading(false);
    }
  }

  const mins = Math.floor(countdown / 60);
  const secs = String(countdown % 60).padStart(2, '0');

  if (!location.state?.email) {
    return <Navigate to="/register" replace />;
  }

  return (
    <div className={styles.page}>
      <main className={styles.card}>
        <div className={styles.blob} />

        <div className={styles.header}>
          <h1
            className={styles.title}
            style={{
              color: 'var(--on-surface)'
            }}
          >
            Verify your email
          </h1>

          <p className={styles.subtitle}>
            We've sent a 6-digit code to{' '}
            <strong>{email}</strong>.
            Enter it below to continue.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className={styles.form}
        >
          <div
            className={styles.otpBoxes}
            onPaste={handlePaste}
          >
            {digits.map((d, i) => (
              <input
                key={i}
                ref={el => inputRefs.current[i] = el}
                className={styles.otpBox}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={e =>
                  handleDigit(
                    i,
                    e.target.value
                  )
                }
                onKeyDown={e =>
                  handleKeyDown(i, e)
                }
                autoFocus={i === 0}
              />
            ))}
          </div>

          {error && (
            <p className={styles.error}>
              {error}
            </p>
          )}

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={loading}
          >
            {loading
              ? 'Verifying…'
              : 'Verify'}
          </button>

          <div className={styles.resendRow}>
            {canResend ? (
              <button
                type="button"
                className={styles.resendBtn}
                onClick={handleResend}
                disabled={loading}
              >
                Resend code
              </button>
            ) : (
              <span>
                Resend code in{' '}
                <strong
                  style={{
                    color: 'var(--primary)'
                  }}
                >
                  {mins}:{secs}
                </strong>
              </span>
            )}
          </div>

          <Link
            to="/login"
            className={styles.backLink}
          >
            ← Back to login
          </Link>
        </form>
      </main>
    </div>
  );
}

