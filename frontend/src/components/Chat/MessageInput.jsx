
import { useState, useRef, useEffect } from 'react';
import EmojiPickerPopup from './EmojiPicker';
import styles from './MessageInput.module.css';
import { Smile, Paperclip, Camera, X, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const MB = 1024 * 1024;
const MAX_IMAGE = 10 * MB;
const MAX_FILE = 10 * MB;

const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
const FILE_EXT = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'];
const getExt = (name = '') => (name.includes('.') ? name.split('.').pop().toLowerCase() : '');

async function compressImage(file, maxDim = 2048, quality = 0.85) {
  if (file.type === 'image/gif' || file.size < 2 * MB) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

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

  const [errorMsg, setErrorMsg] = useState('');
  const errorTimer = useRef(null);

  function showError(msg) {
    setErrorMsg(msg);
    clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setErrorMsg(''), 3500);
  }

  useEffect(() => () => clearTimeout(errorTimer.current), []);


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
    let file = e.target.files[0];
    if (!file) return;

    e.target.value = '';
    setShowAttach(false);

    const ext = getExt(file.name);
    if (!IMAGE_EXT.includes(ext)) {
      showError(`Unsupported image (.${ext || '?'})`);
      return;
    }

    if (file.size > 50 * MB) {
      showError(`Image too large (${(file.size / MB).toFixed(0)} MB). Max 10 MB.`);
      return;
    }

    file = await compressImage(file);

    if (file.size > MAX_IMAGE) {
      showError(`Image too large (${(file.size / MB).toFixed(1)} MB). Max 10 MB.`);
      return;
    }

    await onSendImage(file, replyingTo?._id || null);
  }

  async function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    e.target.value = '';
    setShowAttach(false);

    const ext = getExt(file.name);
    if (!FILE_EXT.includes(ext)) {
      showError(`Unsupported file (.${ext || '?'})`);
      return;
    }

    if (file.size > MAX_FILE) {
      showError(`File too large (${(file.size / MB).toFixed(1)} MB). Max 10 MB.`);
      return;
    }

    await onSendFile(file, replyingTo?._id || null);
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

  function truncateText(value, maxLength = 100) {
    if (!value) return '';
    return value.length > maxLength ? value.slice(0, maxLength) : value;
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

      {errorMsg && (
        <div className={styles.errorToast} role="alert">
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

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
        accept="image/jpeg,image/png,image/webp,image/gif"
        style={{ display: 'none' }}
        onChange={handleImageChange}
      />

      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
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
