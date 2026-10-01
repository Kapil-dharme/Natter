import { useEffect, useRef } from 'react';
import data from '@slidoapp/emoji-mart-data';
import Picker from '@slidoapp/emoji-mart-react';
import styles from './EmojiPicker.module.css';

export default function EmojiPickerPopup({ onSelect, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    setTimeout(() => document.addEventListener('mousedown', handleClick), 0);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div ref={ref} className={styles.wrap}>
      <Picker
        data={data}
        onEmojiSelect={(emoji) => onSelect(emoji.native)}
        theme="light"
        previewPosition="none"
        skinTonePosition="none"
      />
    </div>
  );
}
