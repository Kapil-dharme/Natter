import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import styles from './UserSearch.module.css';

export default function UserSearch({ query, onSelectUser }) {
  const { user } = useAuth();
  const userId = user?._id || user?.id;

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const loaderRef = useRef(null);

  useEffect(() => {
    setUsers([]);
    setPage(1);
    setHasMore(true);
  }, [query]);

  useEffect(() => {
    setLoading(true);

    const timer = setTimeout(() => {
      api.get(
        `/userChat/users/search?query=${encodeURIComponent(
          query.trim()
        )}&page=${page}&limit=15`
      )
        .then(res => {
          const fetched = (res.data.user || [])
            .filter(u => u._id !== userId)
            .filter(u => u.isVerified !== false);

          setUsers(prev =>
            page === 1
              ? fetched
              : [...prev, ...fetched]
          );

          setHasMore(fetched.length === 15);
        })
        .catch(() => {
          if (page === 1) {
            setUsers([]);
          }
        })
        .finally(() => {
          setLoading(false);
        });
    }, query.trim() ? 250 : 0);

    return () => clearTimeout(timer);
  }, [query, page, userId]);

  const handleObserver = useCallback(
    entries => {
      if (
        entries[0].isIntersecting &&
        hasMore &&
        !loading
      ) {
        setPage(prev => prev + 1);
      }
    },
    [hasMore, loading]
  );

  useEffect(() => {
    const observer = new IntersectionObserver(
      handleObserver,
      {
        threshold: 1
      }
    );

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => observer.disconnect();
  }, [handleObserver]);

  return (
    <div className={styles.container}>
      <div className={styles.results}>

        {!loading && !users.length && (
          <div className={styles.status}>
            No users found.
          </div>
        )}

        {users.map(u => (
          <div
            key={u._id}
            className={styles.userItem}
            onClick={() => onSelectUser(u)}
          >
            {u.profileURL ? (
              <img
                src={u.profileURL}
                alt={u.userName}
                className={styles.avatar}
                style={{
                  objectPosition: 'top center'
                }}
              />
            ) : (
              <div
                className={styles.avatarFallback}
              >
                {u.userName?.[0]?.toUpperCase()}
              </div>
            )}

            <div className={styles.info}>
              <span className={styles.name}>
                {u.userName}
              </span>
            </div>
          </div>
        ))}

        {loading && (
          <div className={styles.status}>
            Loading…
          </div>
        )}

        <div
          ref={loaderRef}
          style={{ height: 1 }}
        />
      </div>
    </div>
  );
}