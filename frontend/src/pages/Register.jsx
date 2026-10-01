
import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Home } from 'lucide-react';
import api from '../api/axios';
import styles from './Auth.module.css';

export default function Register() {
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const [form, setForm] = useState({
    userName: '',
    email: '',
    password: ''
  });

  const [avatar, setAvatar] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setForm(f => ({
      ...f,
      [e.target.name]: e.target.value
    }));
  }

  function handleFile(e) {
    const file = e.target.files[0];

    if (!file) return;

    if (file.size > 1024 * 1024) {
      setError('Image must be under 1MB.');
      return;
    }

    setAvatar(file);
    setPreview(URL.createObjectURL(file));
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();

    setError('');
    setLoading(true);

    try {
      const data = new FormData();

      data.append('userName', form.userName);
      data.append('email', form.email);
      data.append('password', form.password);

      if (avatar) {
        data.append('profileURL', avatar);
      }

      const res = await api.post(
        '/auth/signup-user',
        data,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      navigate('/verify-otp', {
        state: {
          email: form.email,
          otpExpiresAt: res.data.otpExpiresAt
        }
      });

    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Registration failed.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <main className={styles.card}>
        <div className={styles.blob} />

        <div className={styles.header}>
          <Link
            to="/"
            className={styles.homeIcon}
            aria-label="Back to home"
          >
            <Home size={20} />
          </Link>

          <h1 className={styles.title}>
            Natter
          </h1>

          <p className={styles.subtitle}>
            Create an account to get started.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className={styles.form}
        >
          <div className={styles.field}>
            <label className={styles.label}>
              Profile Photo
            </label>

            <div className={styles.avatarRow}>
              <div
                className={styles.avatarPreview}
                onClick={() => fileRef.current.click()}
              >
                {preview ? (
                  <img
                    src={preview}
                    alt="avatar"
                    className={styles.avatarImg}
                  />
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                    <circle
                      cx="12"
                      cy="13"
                      r="3"
                    />
                  </svg>
                )}
              </div>

              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleFile}
                />

                <button
                  type="button"
                  className={styles.chooseBtn}
                  onClick={() => fileRef.current.click()}
                >
                  Choose Image
                </button>
              </div>
            </div>
          </div>

          <div className={styles.field}>
            <label
              className={styles.label}
              htmlFor="userName"
            >
              Username
            </label>

            <input
              id="userName"
              name="userName"
              type="text"
              placeholder="Enter your Username"
              value={form.userName}
              onChange={handleChange}
              required
              className={styles.input}
            />
          </div>

          <div className={styles.field}>
            <label
              className={styles.label}
              htmlFor="email"
            >
              Email Address
            </label>

            <input
              id="email"
              name="email"
              type="email"
              placeholder="Enter your Email"
              value={form.email}
              onChange={handleChange}
              required
              className={styles.input}
            />
          </div>

          <div className={styles.field}>
            <label
              className={styles.label}
              htmlFor="password"
            >
              Password
            </label>

            <input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={handleChange}
              required
              className={styles.input}
            />
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
              ? 'Creating account…'
              : 'Create Account'}
          </button>
        </form>

        <div className={styles.footer}>
          <p>
            Already have an account?{' '}
            <Link
              to="/login"
              className={styles.link}
            >
              Log in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
