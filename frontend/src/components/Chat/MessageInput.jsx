
import { useState, useRef, useEffect } from 'react';
import EmojiPickerPopup from './EmojiPicker';
import styles from './MessageInput.module.css';
import { Smile, Paperclip, Camera, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function MessageInput({
  onSendText,
  onSendImage,
  onSendFile,
  disabled,
  replyingTo,
  onCancelReply
}) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttach, setShowAttach] = useState(false);

  const imageRef = useRef(null);
  const fileRef = useRef(null);
  const wrapRef = useRef(null);
  const textareaRef = useRef(null);


  useEffect(() => {
    if (replyingTo) {
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    }
  }, [replyingTo]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (
        wrapRef.current &&
        !wrapRef.current.contains(e.target)
      ) {
        setShowAttach(false);
      }
    }

    document.addEventListener(
      'mousedown',
      handleClickOutside
    );

    return () => {
      document.removeEventListener(
        'mousedown',
        handleClickOutside
      );
    };
  }, []);

  function handleKeyDown(e) {
    if (
      e.key === 'Enter' &&
      !e.shiftKey
    ) {
      e.preventDefault();
      submit();
    }
  }

  function submit() {
    const t = text.trim();

    if (!t) return;

    onSendText(
      t,
      replyingTo?._id || null
    );

    setText('');
    setShowEmoji(false);
  }

  function handleEmojiSelect(emoji) {
    setText(t => t + emoji);

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }

  async function handleImageChange(e) {
    const file = e.target.files[0];

    if (!file) return;

    e.target.value = '';
    setShowAttach(false);

    await onSendImage(
      file,
      replyingTo?._id || null
    );
  }

  async function handleFileChange(e) {
    const file = e.target.files[0];

    if (!file) return;

    e.target.value = '';
    setShowAttach(false);

    await onSendFile(
      file,
      replyingTo?._id || null
    );
  }

  function getReplyPreview(message) {
    if (!message) return '';

    if (message.type === 'image') {
      return '📷 Photo';
    }

    if (message.type === 'file') {
      return `📄 ${message.fileName || 'File'} `;
    }

    return message.content || '';
  }

  function truncateText(
    value,
    maxLength = 80
  ) {
    if (!value) return '';

    return value.length > maxLength
      ? `${value.slice(0, maxLength)}...`
      : value;
  }

  function getReplySender(message) {
    if (!message) return '';

    const senderId =
      message.sender?._id ||
      message.sender;

    const currentUserId =
      user?._id ||
      user?.id;

    if (
      senderId &&
      currentUserId &&
      String(senderId) === String(currentUserId)
    ) {
      return 'You';
    }

    return message.sender?.userName || 'User';
  }
  return (
    <div
      className={styles.wrap}
      ref={wrapRef}
    >

      {showEmoji && (
        <EmojiPickerPopup
          onSelect={handleEmojiSelect}
          onClose={() =>
            setShowEmoji(false)
          }
        />
      )}

      {showAttach && (
        <div className={styles.attachMenu}>

          <button
            type="button"
            className={styles.attachItem}
            onClick={() => {
              imageRef.current?.click();
            }}
          >
            <Camera size={20} />
            Send Image
          </button>

          <button
            type="button"
            className={styles.attachItem}
            onClick={() => {
              fileRef.current?.click();
            }}
          >
            <Paperclip size={20} />
            Send File
          </button>

        </div>
      )}

      <input
        ref={imageRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleImageChange}
      />

      <input
        ref={fileRef}
        type="file"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {replyingTo && (
        <div className={styles.replyPreview}>

          <div
            className={
              styles.replyPreviewContent
            }
          >

            <div
              className={
                styles.replyPreviewName
              }
            >
              {getReplySender(replyingTo)}
            </div>

            <div
              className={
                styles.replyPreviewText
              }
            >
              {truncateText(
                getReplyPreview(replyingTo)
              )}
            </div>

          </div>

          <button
            type="button"
            className={
              styles.replyCancelBtn
            }
            onClick={onCancelReply}
            title="Cancel reply"
          >
            <X size={18} />
          </button>

        </div>
      )}

      <div className={styles.inputRow}>

        <button
          type="button"
          className={styles.iconBtn}
          onClick={() => {
            setShowAttach(s => !s);
            setShowEmoji(false);
          }}
          disabled={disabled}
          title="Attach"
        >
          <Paperclip size={22} />
        </button>

        <button
          type="button"
          className={styles.iconBtn}
          onClick={() => {
            setShowEmoji(s => !s);
            setShowAttach(false);
          }}
          disabled={disabled}
          title="Emoji"
        >
          <Smile size={22} />
        </button>

        <textarea
          ref={textareaRef}
          className={styles.textarea}
          placeholder="Start typing..."
          value={text}
          onChange={e =>
            setText(e.target.value)
          }
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={disabled}
        />

        <button
          type="button"
          className={styles.sendBtn}
          onClick={submit}
          disabled={
            disabled ||
            !text.trim()
          }
          title="Send"
        >
          ➤
        </button>

      </div>

    </div>
  );
}
