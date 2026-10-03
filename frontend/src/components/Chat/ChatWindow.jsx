import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useLayoutEffect
} from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocketEvent, getSocket } from '../../hooks/useSocket';
import api from '../../api/axios';
import ChatHeader from './ChatHeader';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import styles from './ChatWindow.module.css';
import { MessageCircle } from "lucide-react";
import {
  encryptMessage,
  decryptMessage
} from '../../utils/Encryption';

function getDateKey(date) {
  const d = new Date(date);

  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function getDateLabel(date) {
  const messageDate = new Date(date);
  const now = new Date();

  const todayKey = getDateKey(now);

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const yesterdayKey = getDateKey(yesterday);
  const messageKey = getDateKey(messageDate);

  if (messageKey === todayKey) {
    return 'TODAY';
  }

  if (messageKey === yesterdayKey) {
    return 'YESTERDAY';
  }

  const options =
    messageDate.getFullYear() === now.getFullYear()
      ? {
        day: 'numeric',
        month: 'long',
      }
      : {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      };

  return messageDate
    .toLocaleDateString('en-GB', options)
    .toUpperCase();
}

export default function ChatWindow({
  conversation,
  getSharedKey,
  onMessageSent,
  onConversationUpdate,
  onLeaveOrDelete,
  onBack,
  onlineUsers,
  lastSeenMap,
  blockedUserIds,
  onUnblockUser
}) {
  const { user } = useAuth();

  const userId = user?._id || user?.id;

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteMessage, setDeleteMessage] = useState(null);
  const [deletingMessage, setDeletingMessage] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [unblocking, setUnblocking] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const bottomRef = useRef(null);
  const isNearBottom = useRef(true);
  const messagesContainerRef = useRef(null);
  const readEmittedRef = useRef(new Set());
  const messageIdsRef = useRef(new Set());
  const shouldScrollAfterMessage = useRef(false);
  const loadingOlderRef = useRef(false);
  const restoreScrollRef = useRef(null);

  const isGroup = conversation.type === 'group';

  const blockedOtherParticipant = isGroup
    ? null
    : (conversation.participants || []).find(participant => {
      const participantId =
        participant?._id ||
        participant?.id ||
        participant;

      return String(participantId) !== String(userId);
    });

  const blockedOtherUserId = blockedOtherParticipant
    ? (
      blockedOtherParticipant._id ||
      blockedOtherParticipant.id ||
      blockedOtherParticipant
    )
    : null;

  const isBlocked = Boolean(
    blockedOtherUserId &&
    blockedUserIds?.has(String(blockedOtherUserId))
  );

  const scrollToBottom = useCallback(() => {
    const container = messagesContainerRef.current;

    if (!container) {
      return;
    }

    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth'
    });
  }, []);

  const scrollToMessage = useCallback((messageId) => {
    if (!messageId) {
      return;
    }

    const element =
      document.getElementById(
        `message-${messageId}`
      );

    if (!element) {
      return;
    }

    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
  }, []);

  const getOtherParticipantId = useCallback(() => {
    if (isGroup) {
      return null;
    }

    const participants =
      conversation.participants || [];

    const otherParticipant =
      participants.find(participant => {
        const participantId =
          participant?._id ||
          participant?.id ||
          participant;

        return (
          String(participantId) !==
          String(userId)
        );
      });

    if (!otherParticipant) {
      return null;
    }

    return (
      otherParticipant._id ||
      otherParticipant.id ||
      otherParticipant
    );
  }, [
    conversation.participants,
    userId,
    isGroup
  ]);

  const decryptText = useCallback(async (
    ciphertext,
    encryptionIv,
    otherUserId
  ) => {
    if (
      !ciphertext ||
      !encryptionIv ||
      !otherUserId
    ) {
      throw new Error(
        "Invalid encrypted message data."
      );
    }

    let lastError = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const sharedKey =
          await getSharedKey(
            otherUserId
          );

        if (!sharedKey) {
          throw new Error(
            "Shared encryption key unavailable."
          );
        }

        return await decryptMessage(
          ciphertext,
          encryptionIv,
          sharedKey
        );
      } catch (error) {
        lastError = error;

        if (attempt === 0) {
          await new Promise(resolve =>
            setTimeout(resolve, 150)
          );
        }
      }
    }

    throw lastError;
  }, [
    getSharedKey
  ]);

  const decryptIncomingMessage = useCallback(async (message) => {
    if (!message) {
      return message;
    }

    if (isGroup) {
      return message;
    }

    const hasEncryptedText =
      message.type === "text" &&
      Boolean(message.encryptionIv);

    const hasEncryptedReply =
      message.replyTo &&
      !message.replyTo.unavailable &&
      message.replyTo.type === "text" &&
      Boolean(message.replyTo.encryptionIv);

    if (
      !hasEncryptedText &&
      !hasEncryptedReply
    ) {
      return message;
    }

    const otherUserId =
      getOtherParticipantId();

    if (!otherUserId) {
      return message;
    }

    let decryptedMessage = {
      ...message
    };

    try {
      if (hasEncryptedText) {
        const decryptedContent =
          await decryptText(
            message.content,
            message.encryptionIv,
            otherUserId
          );

        decryptedMessage = {
          ...decryptedMessage,
          content: decryptedContent
        };
      }

      if (hasEncryptedReply) {
        const decryptedReplyContent =
          await decryptText(
            message.replyTo.content,
            message.replyTo.encryptionIv,
            otherUserId
          );

        decryptedMessage = {
          ...decryptedMessage,
          replyTo: {
            ...message.replyTo,
            content: decryptedReplyContent
          }
        };
      }

      return decryptedMessage;
    } catch (error) {
      console.error(
        "Failed to decrypt message:",
        {
          messageId: message._id,
          senderId:
            message.sender?._id ||
            message.sender,
          otherUserId,
          error
        }
      );

      const failedMessage = {
        ...decryptedMessage
      };

      if (hasEncryptedText) {
        failedMessage.content =
          "Unable to decrypt this message.";
      }

      if (hasEncryptedReply) {
        failedMessage.replyTo = {
          ...message.replyTo,
          content:
            "Unable to decrypt this message."
        };
      }

      return failedMessage;
    }
  }, [
    isGroup,
    getOtherParticipantId,
    decryptText
  ]);

  const decryptRef = useRef(decryptIncomingMessage);

  useEffect(() => {
    decryptRef.current = decryptIncomingMessage;
  }, [decryptIncomingMessage]);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setMessages([]);
    setCurrentPage(1);
    setHasMore(true);
    setHasNewMessage(false);

    readEmittedRef.current = new Set();
    messageIdsRef.current = new Set();
    shouldScrollAfterMessage.current = false;
    isNearBottom.current = true;

    const loadMessages = async () => {
      try {
        const res =
          await api.get(
            `/userChat/conversations/${conversation._id}/messages?page=1&limit=20`
          );

        if (cancelled) {
          return;
        }

        const loadedMessages =
          (res.data.chatMessages || []).reverse();

        setHasMore(loadedMessages.length >= 20);

        const decryptedMessages =
          await Promise.all(
            loadedMessages.map(message =>
              decryptRef.current(message)
            )
          );

        if (cancelled) {
          return;
        }

        messageIdsRef.current =
          new Set(
            decryptedMessages.map(
              message =>
                String(message._id)
            )
          );

        shouldScrollAfterMessage.current = true;

        setMessages(
          decryptedMessages
        );
      } catch (error) {
        if (!cancelled) {
          console.error(
            "Failed to load messages:",
            error
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadMessages();

    return () => {
      cancelled = true;
    };
  }, [
    conversation._id
  ]);

  useLayoutEffect(() => {
    if (
      !shouldScrollAfterMessage.current
    ) {
      return;
    }

    shouldScrollAfterMessage.current =
      false;

    const container =
      messagesContainerRef.current;

    if (!container) {
      return;
    }

    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'auto'
    });
  }, [messages]);

  const handleIncoming = useCallback(async (data) => {
    if (
      data.conversationId &&
      String(data.conversationId) !==
      String(conversation._id)
    ) {
      return;
    }

    const incomingSenderId =
      data.sender?._id ||
      data.sender?.id ||
      data.sender ||
      data.senderId;

    if (
      incomingSenderId &&
      blockedUserIds?.has(
        String(incomingSenderId)
      )
    ) {
      return;
    }

    const messageId =
      data._id ||
      data.messageId ||
      `r-${Date.now()}-${Math.random()}`;

    const messageIdString =
      String(messageId);

    if (
      messageIdsRef.current.has(
        messageIdString
      )
    ) {
      return;
    }

    const container =
      messagesContainerRef.current;

    let userWasAtBottom = true;

    if (container) {
      const distanceFromBottom =
        container.scrollHeight -
        container.scrollTop -
        container.clientHeight;

      userWasAtBottom =
        distanceFromBottom <= 80;
    }

    const msg = {
      _id: messageId,
      content:
        data.content ||
        data.text,
      encryptionIv:
        data.encryptionIv ||
        null,
      fileName:
        data.fileName,
      sender:
        data.sender ||
        data.senderId,
      type:
        data.type ||
        'text',
      conversationID:
        conversation._id,
      createdAt:
        data.createdAt ||
        data.timestamp ||
        new Date().toISOString(),
      status: 'delivered',
      replyTo:
        data.replyTo ||
        null
    };

    const decryptedMessage =
      await decryptIncomingMessage(msg);

    const finalMessageId =
      String(
        decryptedMessage._id
      );

    if (
      messageIdsRef.current.has(
        finalMessageId
      )
    ) {
      return;
    }

    messageIdsRef.current.add(
      finalMessageId
    );

    const senderId =
      decryptedMessage.sender?._id ||
      decryptedMessage.sender;

    const isOwnMessage =
      String(senderId) ===
      String(userId);

    if (userWasAtBottom) {
      shouldScrollAfterMessage.current =
        true;

      setHasNewMessage(false);
    } else {
      shouldScrollAfterMessage.current =
        false;

      if (!isOwnMessage) {
        setHasNewMessage(true);
      }
    }

    setMessages(prev => {
      if (
        prev.some(
          message =>
            String(message._id) ===
            finalMessageId
        )
      ) {
        return prev;
      }

      return [
        ...prev,
        decryptedMessage
      ];
    });

    onMessageSent(
      conversation._id,
      decryptedMessage
    );
  }, [
    conversation._id,
    userId,
    blockedUserIds,
    decryptIncomingMessage,
    onMessageSent
  ]);

  useSocketEvent(
    'receive_message',
    handleIncoming
  );

  const handleDelivered =
    useCallback((messageId) => {
      setMessages(prev =>
        prev.map(message =>
          String(message._id) ===
            String(messageId)
            ? {
              ...message,
              status: 'delivered'
            }
            : message
        )
      );
    }, []);

  useSocketEvent(
    'message_delivered',
    handleDelivered
  );

  const handleReadAck =
    useCallback(({ messageId }) => {
      setMessages(prev =>
        prev.map(message =>
          String(message._id) ===
            String(messageId)
            ? {
              ...message,
              status: 'read'
            }
            : message
        )
      );
    }, []);

  useSocketEvent(
    'message_read_ack',
    handleReadAck
  );

  const handleMessageDeleted =
    useCallback((data) => {
      if (!data?.conversationId) {
        return;
      }

      if (
        String(data.conversationId) !==
        String(conversation._id)
      ) {
        return;
      }

      const deletedId =
        String(data.messageId);

      messageIdsRef.current.delete(
        deletedId
      );

      setMessages(prev =>
        prev.filter(
          message =>
            String(message._id) !==
            deletedId
        )
      );

      onConversationUpdate?.({
        ...conversation,
        lastMessage:
          data.lastMessage ||
          null,
        lastMessageAt:
          data.lastMessageAt ||
          null
      });
    }, [
      conversation,
      onConversationUpdate
    ]);

  useSocketEvent(
    "message_deleted",
    handleMessageDeleted
  );

  const loadOlderMessages = useCallback(async () => {
    if (
      loadingOlderRef.current ||
      loadingOlder ||
      loading ||
      !hasMore
    ) {
      return;
    }

    const container =
      messagesContainerRef.current;

    if (!container) {
      return;
    }

    loadingOlderRef.current = true;
    setLoadingOlder(true);

    const nextPage = currentPage + 1;

    try {
      const res = await api.get(
        `/userChat/conversations/${conversation._id}/messages?page=${nextPage}&limit=20`
      );

      const olderMessages = [
        ...(res.data.chatMessages || [])
      ].reverse();

      if (olderMessages.length < 20) {
        setHasMore(false);
      }

      if (!olderMessages.length) {
        return;
      }

      const decryptedOlder = await Promise.all(
        olderMessages.map(message =>
          decryptIncomingMessage(message)
        )
      );

      restoreScrollRef.current = {
        previousScrollHeight:
          container.scrollHeight,
        previousScrollTop:
          container.scrollTop
      };

      setMessages(prev => {
        const existingIds = new Set(
          prev.map(message =>
            String(message._id)
          )
        );

        const freshMessages =
          decryptedOlder.filter(
            message =>
              !existingIds.has(
                String(message._id)
              )
          );

        freshMessages.forEach(message => {
          messageIdsRef.current.add(
            String(message._id)
          );
        });

        return [
          ...freshMessages,
          ...prev
        ];
      });

      setCurrentPage(nextPage);
    } catch (error) {
      console.error(
        "Failed to load older messages:",
        error
      );
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [
    conversation._id,
    currentPage,
    hasMore,
    loading,
    loadingOlder,
    decryptIncomingMessage
  ]);

  useLayoutEffect(() => {
    const pending =
      restoreScrollRef.current;

    if (!pending) {
      return;
    }

    restoreScrollRef.current = null;

    const container =
      messagesContainerRef.current;

    if (!container) {
      return;
    }

    container.scrollTop =
      container.scrollHeight -
      pending.previousScrollHeight +
      pending.previousScrollTop;
  }, [messages]);

  function handleScroll(e) {
    const container =
      e.currentTarget;

    const distanceFromBottom =
      container.scrollHeight -
      container.scrollTop -
      container.clientHeight;

    const atBottom =
      distanceFromBottom <= 80;

    isNearBottom.current =
      atBottom;

    if (atBottom) {
      setHasNewMessage(false);
    }

    if (container.scrollTop <= container.clientHeight * 2) {
      loadOlderMessages();
    }
  }

  const socket = getSocket();

  useEffect(() => {
    if (!socket) {
      return;
    }

    messages.forEach(message => {
      const senderId =
        message.sender?._id ||
        message.sender;

      if (
        String(senderId) !==
        String(userId) &&
        message.status !== 'read' &&
        message._id &&
        !String(message._id).startsWith('tmp-') &&
        !readEmittedRef.current.has(
          message._id
        )
      ) {
        readEmittedRef.current.add(
          message._id
        );

        socket.emit(
          'message_read',
          {
            messageId:
              message._id,
            senderId:
              String(senderId)
          }
        );
      }
    });
  }, [
    messages,
    userId,
    socket
  ]);

  function addOptimistic(
    content,
    type = 'text',
    fileName = null,
    replyToId = null,
    replyMessage = null
  ) {
    setHasNewMessage(false);

    shouldScrollAfterMessage.current = true;
    isNearBottom.current = true;

    const tempId =
      `tmp-${Date.now()}-${Math.random()}`;

    const opt = {
      _id: tempId,
      content,
      type,
      fileName,
      sender: userId,
      conversationID:
        conversation._id,
      createdAt:
        new Date().toISOString(),
      status: 'pending',
      replyTo:
        replyMessage ||
        null
    };

    messageIdsRef.current.add(
      String(tempId)
    );

    setMessages(prev => [
      ...prev,
      opt
    ]);

    return opt;
  }

  function replaceOptimistic(
    tempId,
    real
  ) {
    messageIdsRef.current.delete(
      String(tempId)
    );

    if (real?._id) {
      messageIdsRef.current.add(
        String(real._id)
      );
    }

    setMessages(prev =>
      prev.map(message =>
        message._id === tempId
          ? {
            ...message,
            ...real,
            replyTo:
              real.replyTo !== undefined
                ? real.replyTo
                : message.replyTo ||
                null
          }
          : message
      )
    );
  }

  function removeOptimistic(
    tempId
  ) {
    messageIdsRef.current.delete(
      String(tempId)
    );

    setMessages(prev =>
      prev.filter(
        message =>
          message._id !== tempId
      )
    );
  }

  async function handleUnblock() {
    if (!blockedOtherUserId || unblocking) {
      return;
    }

    try {
      setUnblocking(true);

      await onUnblockUser?.(
        blockedOtherUserId
      );

      window.dispatchEvent(
        new CustomEvent(
          'blocked-users-updated',
          {
            detail: {
              userId: String(blockedOtherUserId),
              blocked: false
            }
          }
        )
      );
    } catch (error) {
      console.error(
        "Failed to unblock user:",
        error
      );
    } finally {
      setUnblocking(false);
    }
  }

  async function handleSendText(
    content,
    replyTo = null
  ) {
    if (isBlocked) {
      return;
    }
    const isDirectText =
      !isGroup;

    const replyPreview =
      replyingTo;

    setReplyingTo(null);

    let encryptedContent =
      content;

    let encryptionIv =
      null;

    try {
      if (isDirectText) {
        const otherUserId =
          getOtherParticipantId();

        if (!otherUserId) {
          throw new Error(
            "Chat participant not found."
          );
        }

        const sharedKey =
          await getSharedKey(
            otherUserId
          );

        if (!sharedKey) {
          throw new Error(
            "Unable to create shared encryption key."
          );
        }

        const encrypted =
          await encryptMessage(
            content,
            sharedKey
          );

        encryptedContent =
          encrypted.ciphertext;

        encryptionIv =
          encrypted.iv;
      }

      const opt =
        addOptimistic(
          content,
          'text',
          null,
          replyTo,
          replyPreview
        );

      if (!isNearBottom.current) {
        requestAnimationFrame(() => {
          scrollToMessage(
            opt._id
          );
        });
      }

      const res =
        await api.post(
          '/messages/send-text',
          {
            conversationID:
              conversation._id,
            content:
              encryptedContent,
            encryptionIv,
            replyTo
          }
        );

      const saved =
        res.data.data;

      let savedReply =
        saved?.replyTo ||
        null;

      if (
        savedReply &&
        !savedReply.unavailable &&
        savedReply.type === "text" &&
        savedReply.encryptionIv &&
        isDirectText
      ) {
        const otherUserId =
          getOtherParticipantId();

        try {
          const decryptedReply =
            await decryptText(
              savedReply.content,
              savedReply.encryptionIv,
              otherUserId
            );

          savedReply = {
            ...savedReply,
            content:
              decryptedReply
          };
        } catch {
          savedReply = {
            ...savedReply,
            content:
              "Unable to decrypt this message."
          };
        }
      }

      replaceOptimistic(
        opt._id,
        {
          ...saved,
          content,
          replyTo:
            savedReply
        }
      );

      if (!isNearBottom.current) {
        requestAnimationFrame(() => {
          scrollToMessage(
            saved._id
          );
        });
      }

      onMessageSent(
        conversation._id,
        {
          ...saved,
          content,
          replyTo:
            savedReply
        }
      );

      const s =
        getSocket();

      if (s) {
        s.emit(
          'send_message',
          {
            messageId:
              saved._id,
            conversationId:
              conversation._id,
            message:
              encryptedContent,
            content:
              encryptedContent,
            encryptionIv,
            type:
              'text',
            participants:
              conversation.participants.map(
                p =>
                  p._id || p
              ),
            replyTo
          }
        );
      }
    } catch (error) {
      console.error(
        "Failed to send text message:",
        error
      );
    }
  }

  async function handleSendImage(
    file,
    replyTo = null
  ) {
    if (isBlocked) {
      return;
    }
    const replyPreview =
      replyingTo;

    setReplyingTo(null);

    const previewUrl =
      URL.createObjectURL(file);

    const opt =
      addOptimistic(
        previewUrl,
        'image',
        null,
        replyTo,
        replyPreview
      );

    try {
      const form =
        new FormData();

      form.append(
        'file',
        file
      );

      form.append(
        'conversationID',
        conversation._id
      );

      if (replyTo) {
        form.append(
          'replyTo',
          replyTo
        );
      }

      const res =
        await api.post(
          '/messages/send-image',
          form,
          {
            headers: {
              'Content-Type':
                'multipart/form-data'
            }
          }
        );

      const saved =
        res.data.data;

      replaceOptimistic(
        opt._id,
        saved
      );

      onMessageSent(
        conversation._id,
        saved
      );

      URL.revokeObjectURL(
        previewUrl
      );

      const s =
        getSocket();

      if (s) {
        s.emit(
          'send_message',
          {
            messageId:
              saved._id,
            conversationId:
              conversation._id,
            message:
              ' Image',
            content:
              saved.content,
            type:
              'image',
            participants:
              conversation.participants.map(
                p =>
                  p._id || p
              ),
            replyTo
          }
        );
      }
    } catch (error) {
      URL.revokeObjectURL(
        previewUrl
      );

      removeOptimistic(
        opt._id
      );

      console.error(
        "Failed to send image:",
        error
      );
    }
  }
  async function handleClearChat() {
    try {
      await api.patch(
        `/userChat/conversations/${conversation._id}/clear`
      );

      setMessages([]);

      messageIdsRef.current =
        new Set();

      setCurrentPage(1);
      setHasMore(false);
      setHasNewMessage(false);
      isNearBottom.current = true;
      shouldScrollAfterMessage.current =
        false;

      readEmittedRef.current =
        new Set();

      onConversationUpdate?.({
        ...conversation,
        lastMessage: null,
        lastMessageAt: null
      });
    } catch (error) {
      console.error(
        'Failed to clear chat:',
        error
      );
    }
  }

  async function handleDeleteChat() {
    try {
      await api.patch(
        `/userChat/conversations/${conversation._id}/delete`
      );

      onLeaveOrDelete?.(
        conversation._id
      );
    } catch (error) {
      console.error(
        'Failed to delete chat:',
        error
      );
    }
  }

  function handleDeleteMessage(
    message
  ) {
    setDeleteMessage(
      message
    );
  }

  function handleReply(
    message
  ) {
    setReplyingTo(
      message
    );
  }

  async function handleJumpToMessage(
    messageId
  ) {
    if (!messageId) {
      return;
    }

    const highlightMessage =
      element => {
        if (!element) {
          return;
        }

        element.classList.remove(
          styles.highlightMessage
        );

        void element.offsetWidth;

        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });

        element.classList.add(
          styles.highlightMessage
        );

        setTimeout(() => {
          element.classList.remove(
            styles.highlightMessage
          );
        }, 2500);
      };

    let element =
      document.getElementById(
        `message-${messageId}`
      );

    if (element) {
      highlightMessage(
        element
      );
      return;
    }

    if (loadingOlder || loadingOlderRef.current) {
      return;
    }

    loadingOlderRef.current = true;
    setLoadingOlder(true);

    try {
      let page =
        currentPage + 1;

      let targetFound =
        false;

      while (page <= 20) {
        const res =
          await api.get(
            `/userChat/conversations/${conversation._id}/messages?page=${page}&limit=20`
          );

        const olderMessages =
          res.data.chatMessages ||
          [];

        if (!olderMessages.length) {
          setHasMore(false);
          break;
        }

        if (olderMessages.length < 20) {
          setHasMore(false);
        }

        const olderMessagesOrdered =
          [
            ...olderMessages
          ].reverse();

        const decryptedOlderMessages =
          await Promise.all(
            olderMessagesOrdered.map(
              message =>
                decryptIncomingMessage(
                  message
                )
            )
          );

        setMessages(prev => {
          const existingIds =
            new Set(
              prev.map(
                message =>
                  String(message._id)
              )
            );

          const newMessages =
            decryptedOlderMessages.filter(
              message =>
                !existingIds.has(
                  String(message._id)
                )
            );

          newMessages.forEach(
            message => {
              messageIdsRef.current.add(
                String(message._id)
              );
            }
          );

          return [
            ...newMessages,
            ...prev
          ];
        });

        setCurrentPage(page);

        await new Promise(
          resolve =>
            setTimeout(
              resolve,
              100
            )
        );

        element =
          document.getElementById(
            `message-${messageId}`
          );

        if (element) {
          highlightMessage(
            element
          );

          targetFound =
            true;

          break;
        }

        page++;
      }

      if (!targetFound) {
        console.log(
          "Reply message was not found in loaded pages:",
          messageId
        );
      }
    } catch (error) {
      console.error(
        'Failed to load older messages:',
        error
      );
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }

  async function handleConfirmDeleteMessage() {
    if (!deleteMessage) {
      return;
    }

    try {
      setDeletingMessage(true);

      const messageId =
        deleteMessage._id;

      const res =
        await api.delete(
          `/messages/${messageId}`
        );

      const {
        conversationId,
        lastMessage,
        lastMessageAt
      } = res.data;

      messageIdsRef.current.delete(
        String(messageId)
      );

      setMessages(prev =>
        prev.filter(
          message =>
            String(message._id) !==
            String(messageId)
        )
      );

      onConversationUpdate?.({
        ...conversation,
        lastMessage:
          lastMessage ||
          null,
        lastMessageAt:
          lastMessageAt ||
          null
      });

      const socket =
        getSocket();

      if (socket) {
        socket.emit(
          "delete_message",
          {
            messageId,
            conversationId,
            participants:
              conversation.participants.map(
                participant =>
                  participant._id ||
                  participant
              ),
            lastMessage:
              lastMessage ||
              null,
            lastMessageAt:
              lastMessageAt ||
              null
          }
        );
      }

      setDeleteMessage(null);
    } catch (error) {
      console.error(
        "Failed to delete message:",
        error
      );
    } finally {
      setDeletingMessage(false);
    }
  }

  async function handleSendFile(
    file,
    replyTo = null
  ) {
    if (isBlocked) {
      return;
    }
    const replyPreview =
      replyingTo;

    setReplyingTo(null);

    const previewUrl =
      URL.createObjectURL(file);

    const opt =
      addOptimistic(
        previewUrl,
        'file',
        file.name,
        replyTo,
        replyPreview
      );

    try {
      const form =
        new FormData();

      form.append(
        'file',
        file
      );

      form.append(
        'conversationID',
        conversation._id
      );

      if (replyTo) {
        form.append(
          'replyTo',
          replyTo
        );
      }

      const res =
        await api.post(
          '/messages/send-file',
          form,
          {
            headers: {
              'Content-Type':
                'multipart/form-data'
            }
          }
        );

      const saved =
        res.data.data;

      replaceOptimistic(
        opt._id,
        saved
      );

      onMessageSent(
        conversation._id,
        saved
      );

      URL.revokeObjectURL(
        previewUrl
      );

      const s =
        getSocket();

      if (s) {
        s.emit(
          'send_message',
          {
            messageId:
              saved._id,
            conversationId:
              conversation._id,
            message:
              ' File',
            content:
              saved.content,
            type:
              'file',
            fileName:
              saved.fileName ||
              file.name,
            participants:
              conversation.participants.map(
                p =>
                  p._id || p
              ),
            replyTo
          }
        );
      }
    } catch (error) {
      URL.revokeObjectURL(
        previewUrl
      );

      removeOptimistic(
        opt._id
      );

      console.error(
        "Failed to send file:",
        error
      );
    }
  }

  return (
    <div className={styles.window}>
      <ChatHeader
        conversation={conversation}
        onConversationUpdate={
          onConversationUpdate
        }
        onLeaveOrDelete={
          onLeaveOrDelete
        }
        onClearChat={
          handleClearChat
        }
        onDeleteChat={
          handleDeleteChat
        }
        onBack={onBack}
        onlineUsers={onlineUsers}
        lastSeenMap={lastSeenMap}
        isBlocked={isBlocked}
      />
      <div
        className={styles.messages}
        ref={messagesContainerRef}
        onScroll={handleScroll}
      >
        {loading && (
          <div className={styles.status}>
            Loading messages…
          </div>
        )}

        {!loading &&
          !messages.length && (
            <div className={styles.status}>
              <MessageCircle size={18} />
              No messages yet. Say hello!
            </div>
          )}

        {messages.map(
          (msg, i) => {
            const currentDateKey =
              getDateKey(
                msg.createdAt
              );

            const previousDateKey =
              i > 0
                ? getDateKey(
                  messages[
                    i - 1
                  ].createdAt
                )
                : null;

            const showDateSeparator =
              currentDateKey !==
              previousDateKey;

            return (
              <div
                key={msg._id}
              >
                {showDateSeparator && (
                  <div
                    className={
                      styles.dateSeparator
                    }
                  >
                    <span>
                      {getDateLabel(
                        msg.createdAt
                      )}
                    </span>
                  </div>
                )}

                <div
                  id={`message-${msg._id}`}
                >
                  <MessageBubble
                    message={msg}
                    prevMessage={
                      messages[
                      i - 1
                      ]
                    }
                    isGroup={
                      isGroup
                    }
                    onDeleteMessage={
                      handleDeleteMessage
                    }
                    onReplyMessage={
                      handleReply
                    }
                    onJumpToMessage={
                      handleJumpToMessage
                    }
                  />
                </div>
              </div>
            );
          }
        )}

        {hasNewMessage && (
          <button
            type="button"
            className={
              styles.newMessageButton
            }
            onClick={() => {
              shouldScrollAfterMessage.current =
                false;

              scrollToBottom();

              setHasNewMessage(false);

              isNearBottom.current =
                true;
            }}
          >
            ↓ New message
          </button>
        )}

        <div
          ref={bottomRef}
        />
      </div>

      {isBlocked ? (
        <div className={styles.blockedNotice}>
          <p>You can't send messages to this user.</p>

          <button
            type="button"
            onClick={handleUnblock}
            disabled={unblocking}
          >
            {unblocking ? 'Unblocking…' : 'Unblock User'}
          </button>
        </div>
      ) : (
        <MessageInput
          onSendText={handleSendText}
          onSendImage={handleSendImage}
          onSendFile={handleSendFile}
          replyingTo={replyingTo}
          onCancelReply={() =>
            setReplyingTo(null)
          }
        />
      )}
      {deleteMessage && (
        <div
          className={
            styles.deleteMessageOverlay
          }
        >
          <div
            className={
              styles.deleteMessageModal
            }
          >
            <h3>
              Delete message?
            </h3>

            <p>
              This message will be permanently deleted for everyone.
              This action cannot be undone.
            </p>

            <div
              className={
                styles.deleteMessageActions
              }
            >
              <button
                type="button"
                className={
                  styles.cancelDeleteMessage
                }
                onClick={() =>
                  setDeleteMessage(
                    null
                  )
                }
                disabled={
                  deletingMessage
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className={
                  styles.confirmDeleteMessage
                }
                disabled={
                  deletingMessage
                }
                onClick={
                  handleConfirmDeleteMessage
                }
              >
                {deletingMessage
                  ? 'Deleting...'
                  : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}