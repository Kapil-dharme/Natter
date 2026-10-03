import { useAuth } from '../../context/AuthContext';
import { useEffect, useRef, useState } from 'react';
import {
  Check,
  CheckCheck,
  Clock,
  File, FileText
} from 'lucide-react';

import styles from './MessageBubble.module.css';

function formatTime(d) {
  if (!d) return '';

  return new Date(d).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

function renderTextWithLinks(text) {
  if (!text) return null;

  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    const isUrl = /^(https?:\/\/|www\.)/i.test(part);

    if (!isUrl) {
      return <span key={index}>{part}</span>;
    }

    const href = /^https?:\/\//i.test(part)
      ? part
      : `https://${part}`;

    return (
      <a
        key={index}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.messageLink}
        onClick={e => e.stopPropagation()}
      >
        {part}
      </a>
    );
  });
}

const OFFICE_EXT = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];

function getPreviewUrl(url = '') {
  const ext = url.split('?')[0].split('.').pop().toLowerCase();

  if (OFFICE_EXT.includes(ext)) {
    return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(url)}`;
  }
  return url;
}

function attachmentUrl(url = '') {
  return /\/(image|video)\/upload\//.test(url)
    ? url.replace('/upload/', '/upload/fl_attachment/')
    : url;
}

async function handleFileDownload(e, url, fileName) {
  e.stopPropagation();
  e.preventDefault();

  const fromUrl = decodeURIComponent(
    (url || '').split('?')[0].split('/').pop() || ''
  );

  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName || fromUrl || 'download';

    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  } catch {
    const a = document.createElement('a');
    a.href = attachmentUrl(url);
    a.download = '';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}

export default function MessageBubble({
  message,
  prevMessage,
  isGroup,
  onDeleteMessage,
  onReplyMessage,
  onJumpToMessage
}) {
  const { user } = useAuth();

  const userId = user?._id || user?.id;

  const senderId =
    message.sender?._id ||
    message.sender;

  const isOwn =
    String(senderId) === String(userId);

  const prevSenderId =
    prevMessage?.sender?._id ||
    prevMessage?.sender;

  const isSameSender =
    prevSenderId &&
    senderId &&
    String(prevSenderId) === String(senderId);

  const isGrouped = Boolean(isSameSender);

  const senderName =
    message.sender?.userName ||
    message.sender?.name ||
    'User';

  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);

  const [swipeOffset, setSwipeOffset] = useState(0);
  const [menuPlacement, setMenuPlacement] = useState('bottom');

  const menuRef = useRef(null);
  const bubbleRef = useRef(null);
  const longPressTimer = useRef(null);
  const textRef = useRef(null);

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const currentSwipeX = useRef(0);
  const isSwiping = useRef(false);
  const hasMoved = useRef(false);

  useEffect(() => {
    if (
      message.type !== 'text' ||
      !message.content ||
      !textRef.current
    ) {
      setCanExpand(false);
      return;
    }

    const checkTextOverflow = () => {
      const element = textRef.current;

      if (!element) return;

      const computedStyle =
        window.getComputedStyle(element);

      const lineHeight =
        parseFloat(computedStyle.lineHeight);

      if (!lineHeight || Number.isNaN(lineHeight)) {
        return;
      }

      const maxHeight = lineHeight * 5;

      const previousDisplay =
        element.style.display;

      const previousWebkitLineClamp =
        element.style.webkitLineClamp;

      const previousOverflow =
        element.style.overflow;

      element.style.display = 'block';
      element.style.webkitLineClamp = 'unset';
      element.style.overflow = 'visible';

      const fullHeight =
        element.scrollHeight;

      element.style.display =
        previousDisplay;

      element.style.webkitLineClamp =
        previousWebkitLineClamp;

      element.style.overflow =
        previousOverflow;

      setCanExpand(
        fullHeight > maxHeight + 2
      );
    };

    checkTextOverflow();

    window.addEventListener(
      'resize',
      checkTextOverflow
    );

    return () => {
      window.removeEventListener(
        'resize',
        checkTextOverflow
      );
    };
  }, [
    message.content,
    message.type
  ]);

  function updateMenuPlacement() {
    const bubble = bubbleRef.current;

    if (!bubble) return;

    const rect = bubble.getBoundingClientRect();

    const menuWidth = 150;
    const menuHeight = 130;
    const gap = 8;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const spaceRight =
      viewportWidth - rect.right;

    const spaceLeft =
      rect.left;

    const spaceAbove =
      rect.top;

    const spaceBelow =
      viewportHeight - rect.bottom;

    if (isOwn) {
      if (spaceLeft >= menuWidth + gap) {
        setMenuPlacement('left');
        return;
      }
    } else {
      if (spaceRight >= menuWidth + gap) {
        setMenuPlacement('right');
        return;
      }
    }

    if (spaceAbove >= menuHeight + gap) {
      setMenuPlacement('top');
      return;
    }

    if (spaceBelow >= menuHeight + gap) {
      setMenuPlacement('bottom');
      return;
    }

    setMenuPlacement('top');
  }
  function openMessageMenu() {
    updateMenuPlacement();
    setShowMenu(true);
  }

  function handleContextMenu(e) {
    e.preventDefault();
    e.stopPropagation();

    openMessageMenu();
  }

  function handleTouchStart(e) {
    const touch = e.touches[0];

    touchStartX.current =
      touch.clientX;

    touchStartY.current =
      touch.clientY;

    currentSwipeX.current = 0;
    isSwiping.current = false;
    hasMoved.current = false;

    if (longPressTimer.current) {
      clearTimeout(
        longPressTimer.current
      );
    }

    longPressTimer.current =
      setTimeout(() => {
        if (!hasMoved.current) {
          openMessageMenu();
        }
      }, 500);
  }

  function handleTouchMove(e) {
    const touch = e.touches[0];

    const deltaX =
      touch.clientX -
      touchStartX.current;

    const deltaY =
      touch.clientY -
      touchStartY.current;

    if (
      Math.abs(deltaY) >
      Math.abs(deltaX) &&
      Math.abs(deltaY) > 8
    ) {
      hasMoved.current = true;

      if (longPressTimer.current) {
        clearTimeout(
          longPressTimer.current
        );

        longPressTimer.current = null;
      }

      setSwipeOffset(0);
      currentSwipeX.current = 0;
      isSwiping.current = false;

      return;
    }

    if (
      Math.abs(deltaX) > 8 &&
      Math.abs(deltaX) >
      Math.abs(deltaY)
    ) {
      hasMoved.current = true;
      isSwiping.current = true;

      if (longPressTimer.current) {
        clearTimeout(
          longPressTimer.current
        );

        longPressTimer.current = null;
      }

      let movement = 0;

      if (deltaX > 0) {
        movement = Math.min(deltaX, 80);
      }

      currentSwipeX.current =
        movement;

      setSwipeOffset(movement);
    }
  }

  function handleTouchEnd() {
    if (longPressTimer.current) {
      clearTimeout(
        longPressTimer.current
      );

      longPressTimer.current = null;
    }

    if (isSwiping.current) {
      const movement =
        currentSwipeX.current;

      if (Math.abs(movement) >= 55) {
        onReplyMessage?.(message);
      }
    }

    setSwipeOffset(0);

    currentSwipeX.current = 0;
    touchStartX.current = 0;
    touchStartY.current = 0;
    isSwiping.current = false;
    hasMoved.current = false;
  }

  function handleTouchCancel() {
    if (longPressTimer.current) {
      clearTimeout(
        longPressTimer.current
      );

      longPressTimer.current = null;
    }

    setSwipeOffset(0);

    currentSwipeX.current = 0;
    touchStartX.current = 0;
    touchStartY.current = 0;
    isSwiping.current = false;
    hasMoved.current = false;
  }

  async function handleCopy() {
    if (message.type !== 'text') {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        message.content || ''
      );
    } catch {
      const textarea =
        document.createElement('textarea');

      textarea.value =
        message.content || '';

      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';

      document.body.appendChild(
        textarea
      );

      textarea.focus();
      textarea.select();

      try {
        document.execCommand('copy');
      } catch { }

      document.body.removeChild(
        textarea
      );
    }

    setShowMenu(false);
    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 1500);
  }

  function handleDelete() {
    setShowMenu(false);

    onDeleteMessage?.(message);
  }

  function handleReply() {
    setShowMenu(false);

    onReplyMessage?.(message);
  }

  function handleToggleExpanded(e) {
    e.stopPropagation();

    setExpanded(prev => !prev);
  }

  useEffect(() => {
    function handleClickOutside(e) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target)
      ) {
        setShowMenu(false);
      }
    }

    document.addEventListener(
      'mousedown',
      handleClickOutside
    );

    document.addEventListener(
      'touchstart',
      handleClickOutside
    );

    return () => {
      document.removeEventListener(
        'mousedown',
        handleClickOutside
      );

      document.removeEventListener(
        'touchstart',
        handleClickOutside
      );
    };
  }, []);

  useEffect(() => {
    if (!showMenu) return;

    updateMenuPlacement();

    const handleResize = () => {
      updateMenuPlacement();
    };

    window.addEventListener(
      'resize',
      handleResize
    );

    window.addEventListener(
      'scroll',
      handleResize,
      true
    );

    return () => {
      window.removeEventListener(
        'resize',
        handleResize
      );

      window.removeEventListener(
        'scroll',
        handleResize,
        true
      );
    };
  }, [showMenu]);

  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(
          longPressTimer.current
        );
      }
    };
  }, []);

  return (
    <div
      className={`${styles.row} ${isOwn
        ? styles.rowOwn
        : styles.rowOther
        } ${isGrouped
          ? styles.grouped
          : ''
        }`}
    >
      <div
        ref={bubbleRef}
        className={`${styles.bubble} ${isOwn
          ? styles.own
          : styles.other
          } ${showMenu
            ? styles.bubbleMenuOpen
            : ''
          }`}
        style={{
          transform:
            `translateX(${swipeOffset}px)`
        }}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
      >
        {isGroup && !isOwn && (
          <span className={styles.senderName}>
            {senderName}
          </span>
        )}

        {message.replyTo &&
          typeof message.replyTo === 'object' && (
            <div
              className={`${styles.replyMessage} ${message.replyTo.unavailable
                ? styles.replyUnavailable
                : ''
                }`}
              onClick={() => {
                if (
                  message.replyTo.unavailable
                ) {
                  return;
                }

                onJumpToMessage?.(
                  message.replyTo._id
                );
              }}
            >
              <div
                className={
                  styles.replyMessageName
                }
              >
                {message.replyTo.unavailable
                  ? 'Message unavailable'
                  : String(
                    message.replyTo.sender?._id ||
                    message.replyTo.sender
                  ) === String(userId)
                    ? 'You'
                    : message.replyTo.sender
                      ?.userName ||
                    'User'}
              </div>

              <div
                className={
                  styles.replyMessageContent
                }
              >
                {message.replyTo.unavailable ? (
                  'This message is no longer available'
                ) : message.replyTo.type === 'text' ? (
                  <span className={styles.replyText}>
                    {message.replyTo.content}
                  </span>
                ) : message.replyTo.type === 'image' ? (
                  <div className={styles.replyImagePreview}>
                    <img src={message.replyTo.content} alt="Replied image" />
                    <span>Image</span>
                  </div>
                ) : (
                  <div className={styles.replyFile}>
                    <FileText size={15} />
                    <span className={styles.replyFileName}>
                      {message.replyTo.fileName || 'File'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

        {message.type === 'image' ? (
          <div
            className={
              styles.imageMsgContainer
            }
          >
            <img
              src={message.content}
              alt="sent image"
              className={styles.imageMsg}
            />

            <button
              type="button"
              className={
                styles.imageDownload
              }
              onClick={e =>
                handleFileDownload(
                  e,
                  message.content,
                  message.fileName
                )
              }
            >
              Download
            </button>
          </div>
        ) : message.type === 'file' ? (
          <div
            className={styles.fileMsg}
            onClick={e =>
              e.stopPropagation()
            }
          >
            <span
              className={styles.fileIcon}
            >
              <File size={20} />
            </span>

            <div
              className={
                styles.fileActions
              }
            >
              <a
                href={getPreviewUrl(message.content)}
                target="_blank"
                rel="noreferrer"
                className={`${styles.fileAction} ${isOwn
                  ? styles.fileActionPrimary
                  : styles.fileActionSecondary
                  }`}
                onClick={e =>
                  e.stopPropagation()
                }
              >
                Preview
              </a>

              <a
                href={message.content}
                className={`${styles.fileAction} ${isOwn
                  ? styles.fileActionPrimary
                  : styles.fileActionSecondary
                  }`}
                onClick={e =>
                  handleFileDownload(
                    e,
                    message.content,
                    message.fileName
                  )
                }
              >
                Download
              </a>
            </div>
          </div>
        ) : (
          <div className={styles.textContainer}>
            <p
              ref={textRef}
              className={`${styles.text} ${!expanded &&
                canExpand
                ? styles.textCollapsed
                : styles.textExpanded
                }`}
            >
              {renderTextWithLinks(
                message.content
              )}
            </p>

            {canExpand && (
              <button
                type="button"
                className={
                  styles.showMoreBtn
                }
                onClick={
                  handleToggleExpanded
                }
              >
                {expanded
                  ? 'Show less'
                  : 'Show more'}
              </button>
            )}
          </div>
        )}

        <div className={styles.meta}>
          <span className={styles.time}>
            {formatTime(
              message.createdAt
            )}
          </span>

          {isOwn && (
            <span
              className={styles.status}
              style={{
                color:
                  message.status ===
                    'read'
                    ? '#00ff1a'
                    : '#ffffff'
              }}
            >
              {message.status ===
                'pending' ? (
                <Clock size={12} />
              ) : message.status ===
                'read' ? (
                <CheckCheck size={16} />
              ) : message.status ===
                'delivered' ? (
                <CheckCheck size={16} />
              ) : (
                <Check size={16} />
              )}
            </span>
          )}
        </div>

        {copied && (
          <div
            className={
              styles.copiedMessage
            }
          >
            <Check size={15} />
            Copied
          </div>
        )}

        {showMenu && (
          <div
            ref={menuRef}
            className={`${styles.messageMenu} ${menuPlacement === 'left'
              ? styles.messageMenuLeft
              : menuPlacement === 'right'
                ? styles.messageMenuRight
                : menuPlacement === 'top'
                  ? styles.messageMenuTop
                  : styles.messageMenuBottom
              }`}
            onClick={e =>
              e.stopPropagation()
            }
          >
            <button
              type="button"
              onClick={handleReply}
            >
              Reply
            </button>

            {message.type === 'text' && (
              <button
                type="button"
                onClick={handleCopy}
              >
                Copy
              </button>
            )}

            {isOwn && (
              <button
                type="button"
                className={
                  styles.deleteMessageBtn
                }
                onClick={handleDelete}
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}