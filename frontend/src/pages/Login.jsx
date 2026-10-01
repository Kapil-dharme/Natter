import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Home } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import styles from './Auth.module.css';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleChange(e) { setForm(f => ({ ...f, [e.target.name]: e.target.value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await api.post('/auth/login-user', form);
      login(res.data.user, form.password);
      navigate("/chat");
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password.');
    } finally { setLoading(false); }
  }

  return (
    <div className={styles.page}>
      <main className={styles.card}>
        <div className={styles.blob} />
        <div className={styles.header}>
          <Link to="/" className={styles.homeIcon} aria-label="Back to home">
            <Home size={20} />
          </Link>
          <h1 className={styles.title}>Natter</h1>
          <p className={styles.subtitle}>Sign in to continue your conversations.</p>
        </div>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">Email Address</label>
            <input id="email" name="email" type="email" placeholder="Enter your Email" value={form.email} onChange={handleChange} required className={styles.input} />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="password">Password</label>
            <input id="password" name="password" type="password" placeholder="••••••••" value={form.password} onChange={handleChange} required className={styles.input} />
          </div>
          {error && <p className={styles.error}>{error}</p>}
          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? 'Signing in…' : 'Login →'}
          </button>
        </form>
        <div className={styles.footer}>
          <p>Don't have an account? <Link to="/register" className={styles.link}>Sign up</Link></p>
        </div>
      </main>
    </div>
  );
}