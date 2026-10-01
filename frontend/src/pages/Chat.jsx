import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket, useSocketEvent } from '../hooks/useSocket';
import Sidebar from '../components/Sidebar/Sidebar';
import ChatWindow from '../components/Chat/ChatWindow';
import EmptyState from '../components/Chat/EmptyState';
import api from '../api/axios';
import styles from './Chat.module.css';
import {
  generateKeyPair,
  exportPublicKey,
  savePrivateKey,
  loadPrivateKey,
  savePublicKey,
  loadPublicKey,
  importPublicKey,
  deriveSharedKey,
  decryptMessage,
  verifyKeyPair,
  encryptPrivateKeyWithPassword,
  decryptPrivateKeyWithPassword
} from "../utils/Encryption";

import {
  saveEncryptionPublicKey,
  getEncryptionPublicKey,
  saveEncryptedPrivateKey
} from "../api/encryptionApi";

export default function Chat() {
  const { user, getPassword, clearPassword } = useAuth();
  const socket = useSocket();
  const userId = user?._id || user?.id;

  const [conversations, setConversations] = useState([]);
  const conversationsRef = useRef([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [pendingNotificationConversationId, setPendingNotificationConversationId] = useState(null);
  const [unreadMap, setUnreadMap] = useState({});
  const [mobileView, setMobileView] = useState('sidebar');
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [lastSeenMap, setLastSeenMap] = useState({});
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [blockedUserIds, setBlockedUserIds] = useState(new Set());

  const sharedKeysRef = useRef(new Map());
  const encryptionReadyRef = useRef(null);
  const encryptionUserRef = useRef(null);

  const initializeEncryption = useCallback(async () => {
    if (!userId) return;

    const normalizedUserId = String(userId);
    const password = getPassword();

    if (
      encryptionUserRef.current === normalizedUserId &&
      encryptionReadyRef.current
    ) {
      return encryptionReadyRef.current;
    }

    encryptionUserRef.current = normalizedUserId;

    const initialization = (async () => {
      try {
        let privateKey = await loadPrivateKey(normalizedUserId);
        let publicKey = await loadPublicKey(normalizedUserId);

        if (privateKey && publicKey) {
          const publicKeyCryptoKey = await importPublicKey(publicKey);
          const pairValid = await verifyKeyPair(
            privateKey,
            publicKeyCryptoKey
          );

          if (pairValid) {
            let serverPublicKey = null;

            try {
              const response =
                await getEncryptionPublicKey(
                  normalizedUserId
                );

              serverPublicKey =
                response?.publicKey || null;
            } catch {
              serverPublicKey = null;
            }

            if (
              !serverPublicKey ||
              serverPublicKey !== publicKey
            ) {
              await saveEncryptionPublicKey(
                publicKey
              );

              sharedKeysRef.current.clear();
            }

            if (
              !user?.encryptedPrivateKey &&
              password
            ) {
              try {
                const encryptedPrivateKey =
                  await encryptPrivateKeyWithPassword(
                    privateKey,
                    password
                  );

                await saveEncryptedPrivateKey(
                  encryptedPrivateKey
                );

                clearPassword();
              } catch (error) {
                console.error(
                  "Failed to backup existing private key:",
                  error
                );
              }
            }

            return;
          }
        }

        const encryptedBlob =
          user?.encryptedPrivateKey
            ? JSON.parse(
              user.encryptedPrivateKey
            )
            : null;

        if (encryptedBlob && password) {
          try {
            const restoredPrivateKey =
              await decryptPrivateKeyWithPassword(
                encryptedBlob,
                password
              );

            const response =
              await getEncryptionPublicKey(
                normalizedUserId
              );

            const publicKeyString =
              response?.publicKey || null;

            if (!publicKeyString) {
              throw new Error(
                "Public key not found on server."
              );
            }

            await savePrivateKey(
              normalizedUserId,
              restoredPrivateKey
            );

            await savePublicKey(
              normalizedUserId,
              publicKeyString
            );

            sharedKeysRef.current.clear();
            clearPassword();

            return;
          } catch (error) {
            console.error(
              "Failed to restore private key from backup:",
              error
            );
          }
        }

        const keyPair =
          await generateKeyPair();

        privateKey =
          keyPair.privateKey;

        const publicKeyString =
          await exportPublicKey(
            keyPair.publicKey
          );

        await savePrivateKey(
          normalizedUserId,
          privateKey
        );

        await savePublicKey(
          normalizedUserId,
          publicKeyString
        );

        await saveEncryptionPublicKey(
          publicKeyString
        );

        if (password) {
          try {
            const encryptedPrivateKey =
              await encryptPrivateKeyWithPassword(
                privateKey,
                password
              );

            await saveEncryptedPrivateKey(
              encryptedPrivateKey
            );

            clearPassword();
          } catch (error) {
            console.error(
              "Failed to backup private key:",
              error
            );
          }
        }

        sharedKeysRef.current.clear();
      } catch (error) {
        encryptionReadyRef.current = null;
        encryptionUserRef.current = null;
        throw error;
      }
    })();

    encryptionReadyRef.current =
      initialization;

    return initialization;
  }, [
    userId,
    user,
    getPassword,
    clearPassword
  ]);

  const getSharedKey = useCallback(
    async otherUserId => {
      if (!otherUserId) {
        throw new Error(
          "Other user id is required."
        );
      }

      if (!userId) {
        throw new Error(
          "Current user id is required."
        );
      }

      const normalizedCurrentUserId =
        String(userId);

      const normalizedOtherUserId =
        String(otherUserId);

      if (
        normalizedCurrentUserId ===
        normalizedOtherUserId
      ) {
        throw new Error(
          "Cannot derive shared key with yourself."
        );
      }

      await initializeEncryption();

      const cacheKey =
        `${normalizedCurrentUserId}:${normalizedOtherUserId}`;

      if (
        sharedKeysRef.current.has(
          cacheKey
        )
      ) {
        return sharedKeysRef.current.get(
          cacheKey
        );
      }

      const privateKey =
        await loadPrivateKey(
          normalizedCurrentUserId
        );

      if (!privateKey) {
        throw new Error(
          "Private encryption key not found."
        );
      }

      let response;

      try {
        response =
          await getEncryptionPublicKey(
            normalizedOtherUserId
          );
      } catch {
        throw new Error(
          "Other user's encryption public key could not be loaded."
        );
      }

      if (!response?.publicKey) {
        throw new Error(
          "Other user's encryption public key not found."
        );
      }

      const otherPublicKey =
        await importPublicKey(
          response.publicKey
        );

      const sharedKey =
        await deriveSharedKey(
          privateKey,
          otherPublicKey
        );

      sharedKeysRef.current.set(
        cacheKey,
        sharedKey
      );

      return sharedKey;
    },
    [
      userId,
      initializeEncryption
    ]
  );

  const loadBlockedUsers =
    useCallback(async () => {
      if (!userId) {
        setBlockedUsers([]);
        setBlockedUserIds(new Set());
        return;
      }

      try {
        const response =
          await api.get('/block');

        const users =
          response.data?.users ||
          response.data?.blockedUsers ||
          response.data?.user ||
          [];

        setBlockedUsers(users);

        const ids = new Set(
          users
            .map(blockedUser =>
              String(
                blockedUser?._id ||
                blockedUser?.id ||
                blockedUser
              )
            )
            .filter(Boolean)
        );

        setBlockedUserIds(ids);
      } catch (error) {
        console.error(
          "Failed to load blocked users:",
          error
        );
      }
    }, [userId]);

  const checkIfBlocked =
    useCallback(
      async otherUserId => {
        if (!otherUserId) {
          return false;
        }

        try {
          const response =
            await api.get(
              `/block/status/${otherUserId}`
            );

          const blocked =
            Boolean(
              response.data?.iBlockedThem ??
              response.data?.blocked ??
              response.data?.isBlocked
            );

          setBlockedUserIds(prev => {
            const next = new Set(prev);

            if (blocked) {
              next.add(
                String(otherUserId)
              );
            } else {
              next.delete(
                String(otherUserId)
              );
            }

            return next;
          });

          return blocked;
        } catch (error) {
          console.error(
            "Failed to check block status:",
            error
          );

          return false;
        }
      },
      []
    );

  const handleBlockUser =
    useCallback(
      async otherUserId => {
        if (!otherUserId) {
          return;
        }

        try {
          await api.post(
            `/block/${otherUserId}`
          );

          setBlockedUserIds(prev => {
            const next = new Set(prev);

            next.add(
              String(otherUserId)
            );

            return next;
          });

          await loadBlockedUsers();
        } catch (error) {
          console.error(
            "Failed to block user:",
            error
          );

          throw error;
        }
      },
      [loadBlockedUsers]
    );

  const handleUnblockUser =
    useCallback(
      async otherUserId => {
        if (!otherUserId) {
          return;
        }

        try {
          await api.delete(
            `/block/${otherUserId}`
          );

          setBlockedUserIds(prev => {
            const next = new Set(prev);

            next.delete(
              String(otherUserId)
            );

            return next;
          });

          setBlockedUsers(prev =>
            prev.filter(
              blockedUser =>
                String(
                  blockedUser?._id ||
                  blockedUser?.id ||
                  blockedUser
                ) !==
                String(otherUserId)
            )
          );
        } catch (error) {
          console.error(
            "Failed to unblock user:",
            error
          );

          throw error;
        }
      },
      []
    );

  useEffect(() => {
    encryptionReadyRef.current = null;
    encryptionUserRef.current = null;
    sharedKeysRef.current.clear();

    if (!userId) {
      return;
    }

    let cancelled = false;

    const prepareEncryption =
      async () => {
        try {
          await initializeEncryption();

          if (cancelled) {
            return;
          }
        } catch (error) {
          if (!cancelled) {
            console.error(
              "Failed to initialize encryption:",
              error
            );
          }
        }
      };

    prepareEncryption();

    return () => {
      cancelled = true;
      sharedKeysRef.current.clear();
      encryptionReadyRef.current = null;
      encryptionUserRef.current = null;
    };
  }, [
    userId,
    initializeEncryption
  ]);

  useEffect(() => {
    loadBlockedUsers();
  }, [
    loadBlockedUsers
  ]);

  useEffect(() => {
    function handleBlockedUsersUpdated(e) {
      const targetId = e.detail?.userId;
      const blocked = Boolean(e.detail?.blocked);

      if (targetId) {
        setBlockedUserIds(prev => {
          const next = new Set(prev);

          if (blocked) {
            next.add(String(targetId));
          } else {
            next.delete(String(targetId));
          }

          return next;
        });
      }

      loadBlockedUsers();
    }

    window.addEventListener(
      'blocked-users-updated',
      handleBlockedUsersUpdated
    );

    return () => {
      window.removeEventListener(
        'blocked-users-updated',
        handleBlockedUsersUpdated
      );
    };
  }, [loadBlockedUsers]);

  useEffect(() => {
    let cancelled = false;

    const loadConversations =
      async () => {
        try {
          await initializeEncryption();

          if (cancelled) {
            return;
          }

          const res =
            await api.get(
              '/userChat/conversations'
            );

          if (cancelled) {
            return;
          }

          const convos =
            res.data.conversations ||
            [];

          const filteredConversations =
            convos.filter(
              conversation => {
                if (
                  conversation.type !==
                  "direct"
                ) {
                  return true;
                }

                const otherParticipant =
                  conversation.participants?.find(
                    participant => {
                      const participantId =
                        participant?._id ||
                        participant?.id ||
                        participant;

                      return (
                        String(
                          participantId
                        ) !==
                        String(userId)
                      );
                    }
                  );

                if (!otherParticipant) {
                  return true;
                }

                const otherUserId =
                  otherParticipant._id ||
                  otherParticipant.id ||
                  otherParticipant;

                return !blockedUserIds.has(
                  String(otherUserId)
                );
              }
            );

          const decryptedConversations =
            await Promise.all(
              filteredConversations.map(
                async conversation => {
                  if (
                    conversation.type !==
                    "direct" ||
                    !conversation.lastMessage ||
                    conversation.lastMessage.type !==
                    "text" ||
                    !conversation.lastMessage.encryptionIv
                  ) {
                    return conversation;
                  }

                  try {
                    const otherParticipant =
                      conversation.participants?.find(
                        participant => {
                          const participantId =
                            participant?._id ||
                            participant?.id ||
                            participant;

                          return (
                            String(
                              participantId
                            ) !==
                            String(userId)
                          );
                        }
                      );

                    if (!otherParticipant) {
                      return conversation;
                    }

                    const otherUserId =
                      otherParticipant._id ||
                      otherParticipant.id ||
                      otherParticipant;

                    const sharedKey =
                      await getSharedKey(
                        otherUserId
                      );

                    const decryptedContent =
                      await decryptMessage(
                        conversation.lastMessage.content,
                        conversation.lastMessage.encryptionIv,
                        sharedKey
                      );

                    return {
                      ...conversation,
                      lastMessage: {
                        ...conversation.lastMessage,
                        content:
                          decryptedContent
                      }
                    };
                  } catch (error) {
                    console.error(
                      "Failed to decrypt conversation preview:",
                      error
                    );

                    return conversation;
                  }
                }
              )
            );

          if (cancelled) {
            return;
          }

          setConversations(
            decryptedConversations
          );

          const map = {};

          decryptedConversations.forEach(
            conversation => {
              conversation.participants?.forEach(
                participant => {
                  if (
                    participant?._id &&
                    participant?.lastSeen
                  ) {
                    map[
                      String(
                        participant._id
                      )
                    ] =
                      participant.lastSeen;
                  }
                }
              );
            }
          );

          setLastSeenMap(map);
        } catch (error) {
          if (!cancelled) {
            console.error(
              "Failed to load conversations:",
              error
            );
          }
        }
      };

    if (userId) {
      loadConversations();
    } else {
      setConversations([]);
      setActiveConversation(null);
      setUnreadMap({});
      setLastSeenMap({});
      setMobileView('sidebar');
    }

    return () => {
      cancelled = true;
    };
  }, [
    userId,
    initializeEncryption,
    getSharedKey,
    blockedUserIds
  ]);

  useEffect(() => {
    conversationsRef.current =
      conversations;
  }, [conversations]);

  useEffect(() => {
    function handleProfileUpdate(e) {
      const updated =
        e.detail;

      setConversations(prev =>
        prev.map(c => ({
          ...c,
          participants:
            c.participants.map(p =>
              String(p._id) ===
                String(updated._id)
                ? {
                  ...p,
                  ...updated
                }
                : p
            )
        }))
      );

      setActiveConversation(a => {
        if (!a) {
          return a;
        }

        return {
          ...a,
          participants:
            a.participants.map(p =>
              String(p._id) ===
                String(updated._id)
                ? {
                  ...p,
                  ...updated
                }
                : p
            )
        };
      });
    }

    window.addEventListener(
      'profile-updated',
      handleProfileUpdate
    );

    return () =>
      window.removeEventListener(
        'profile-updated',
        handleProfileUpdate
      );
  }, []);

  const handleSocketProfileUpdate =
    useCallback(updated => {
      if (!updated?._id) {
        return;
      }

      setConversations(prev =>
        prev.map(conversation => ({
          ...conversation,
          participants:
            conversation.participants?.map(
              participant =>
                String(
                  participant._id
                ) ===
                  String(updated._id)
                  ? {
                    ...participant,
                    userName:
                      updated.userName,
                    profileURL:
                      updated.profileURL
                  }
                  : participant
            )
        }))
      );

      setActiveConversation(current => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          participants:
            current.participants?.map(
              participant =>
                String(
                  participant._id
                ) ===
                  String(updated._id)
                  ? {
                    ...participant,
                    userName:
                      updated.userName,
                    profileURL:
                      updated.profileURL
                  }
                  : participant
            )
        };
      });
    }, []);

  useSocketEvent(
    'profile_updated',
    handleSocketProfileUpdate
  );

  const selectConversation =
    useCallback(
      async convo => {
        if (
          convo?.type ===
          "direct"
        ) {
          const otherParticipant =
            convo.participants?.find(
              participant =>
                String(
                  participant?._id ||
                  participant?.id ||
                  participant
                ) !==
                String(userId)
            );

          const otherUserId =
            otherParticipant?._id ||
            otherParticipant?.id ||
            otherParticipant;

          if (
            otherUserId &&
            blockedUserIds.has(
              String(otherUserId)
            )
          ) {
            return;
          }

          if (otherUserId) {
            const blocked =
              await checkIfBlocked(
                otherUserId
              );

            if (blocked) {
              return;
            }
          }
        }

        setActiveConversation(
          convo
        );

        setUnreadMap(prev => ({
          ...prev,
          [convo._id]: 0
        }));

        setMobileView('chat');
      },
      [
        userId,
        blockedUserIds,
        checkIfBlocked
      ]
    );

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const sendActiveConversation =
      () => {
        const controller =
          navigator.serviceWorker
            .controller;

        if (!controller) {
          return;
        }

        controller.postMessage({
          type:
            "NATTER_ACTIVE_CONVERSATION",
          conversationId:
            document.visibilityState ===
            "visible"
              ? activeConversation?._id ||
              null
              : null
        });
      };

    sendActiveConversation();

    document.addEventListener(
      "visibilitychange",
      sendActiveConversation
    );

    return () => {
      document.removeEventListener(
        "visibilitychange",
        sendActiveConversation
      );

      const controller =
        navigator.serviceWorker
          .controller;

      if (controller) {
        controller.postMessage({
          type:
            "NATTER_ACTIVE_CONVERSATION",
          conversationId: null
        });
      }
    };
  }, [
    activeConversation
  ]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const handleServiceWorkerMessage =
      event => {
        if (
          event.data?.type ===
          "OPEN_CONVERSATION" &&
          event.data?.conversationId
        ) {
          setPendingNotificationConversationId(
            String(
              event.data.conversationId
            )
          );
        }
      };

    navigator.serviceWorker.addEventListener(
      "message",
      handleServiceWorkerMessage
    );

    const params =
      new URLSearchParams(
        window.location.search
      );

    const conversationId =
      params.get(
        "conversation"
      );

    if (conversationId) {
      setPendingNotificationConversationId(
        String(conversationId)
      );

      window.history.replaceState(
        {},
        document.title,
        window.location.pathname
      );
    }

    return () => {
      navigator.serviceWorker.removeEventListener(
        "message",
        handleServiceWorkerMessage
      );
    };
  }, []);

  useEffect(() => {
    if (
      !pendingNotificationConversationId
    ) {
      return;
    }

    const openNotificationConversation =
      async () => {
        const conversationId =
          pendingNotificationConversationId;

        let conversation =
          conversationsRef.current.find(
            convo =>
              String(convo._id) ===
              String(conversationId)
          );

        if (!conversation) {
          try {
            const response =
              await api.get(
                `/userChat/conversations/${conversationId}`
              );

            conversation =
              response.data?.conversation;

            if (conversation) {
              setConversations(prev => {
                const exists =
                  prev.some(
                    convo =>
                      String(
                        convo._id
                      ) ===
                      String(
                        conversation._id
                      )
                  );

                if (exists) {
                  return prev;
                }

                return [
                  conversation,
                  ...prev
                ];
              });
            }
          } catch (error) {
            console.error(
              "Failed to open notification conversation:",
              error
            );

            setPendingNotificationConversationId(
              null
            );

            return;
          }
        }

        if (!conversation) {
          setPendingNotificationConversationId(
            null
          );

          return;
        }

        if (
          conversation.type ===
          "direct"
        ) {
          const otherParticipant =
            conversation.participants?.find(
              participant =>
                String(
                  participant?._id ||
                  participant?.id ||
                  participant
                ) !==
                String(userId)
            );

          const otherUserId =
            otherParticipant?._id ||
            otherParticipant?.id ||
            otherParticipant;

          if (
            otherUserId &&
            blockedUserIds.has(
              String(otherUserId)
            )
          ) {
            setPendingNotificationConversationId(
              null
            );

            return;
          }
        }

        await selectConversation(
          conversation
        );

        setPendingNotificationConversationId(
          null
        );
      };

    openNotificationConversation();
  }, [
    pendingNotificationConversationId,
    selectConversation,
    userId,
    blockedUserIds
  ]);

  const handleSelectUser =
    useCallback(
      async selectedUser => {
        if (
          blockedUserIds.has(
            String(selectedUser._id)
          )
        ) {
          return;
        }

        try {
          await initializeEncryption();

          const res =
            await api.post(
              '/userChat/conversations',
              {
                participantId:
                  selectedUser._id
              }
            );

          const convo =
            res.data.conversation ||
            res.data.createConversation;

          setConversations(prev =>
            prev.find(
              c =>
                String(c._id) ===
                String(convo._id)
            )
              ? prev
              : [
                convo,
                ...prev
              ]
          );

          setActiveConversation(
            convo
          );

          setUnreadMap(prev => ({
            ...prev,
            [convo._id]: 0
          }));

          setMobileView('chat');
        } catch (err) {
          console.error(
            "Failed to select user:",
            err
          );
        }
      },
      [
        initializeEncryption,
        blockedUserIds
      ]
    );

  const handleGroupCreated =
    useCallback(group => {
      setConversations(prev => {
        const exists =
          prev.find(
            c =>
              String(c._id) ===
              String(group._id)
          );

        return exists
          ? prev
          : [
            group,
            ...prev
          ];
      });

      setActiveConversation(
        group
      );

      setUnreadMap(prev => ({
        ...prev,
        [group._id]: 0
      }));

      setMobileView('chat');
    }, []);

  const handleMessageSent =
    useCallback(
      (
        conversationId,
        message
      ) => {
        setConversations(prev => {
          const updated =
            prev.map(
              conversation =>
                String(
                  conversation._id
                ) ===
                  String(
                    conversationId
                  )
                  ? {
                    ...conversation,
                    lastMessage:
                      message,
                    lastMessageAt:
                      message.createdAt
                  }
                  : conversation
            );

          return updated.sort(
            (a, b) =>
              new Date(
                b.lastMessageAt ||
                0
              ) -
              new Date(
                a.lastMessageAt ||
                0
              )
          );
        });
      },
      []
    );

  const handleConversationUpdate =
    useCallback(updated => {
      setConversations(prev =>
        prev.map(c =>
          c._id ===
            updated._id
            ? {
              ...c,
              ...updated
            }
            : c
        )
      );

      setActiveConversation(a =>
        a?._id ===
          updated._id
          ? {
            ...a,
            ...updated
          }
          : a
      );
    }, []);

  const handleLeaveOrDelete =
    useCallback(
      conversationId => {
        setConversations(prev =>
          prev.filter(
            c =>
              c._id !==
              conversationId
          )
        );

        setActiveConversation(a =>
          a?._id ===
            conversationId
            ? null
            : a
        );

        setMobileView(
          'sidebar'
        );
      },
      []
    );

  const handleBack =
    useCallback(
      () =>
        setMobileView(
          'sidebar'
        ),
      []
    );

  const onIncomingMessage =
    useCallback(
      async data => {
        const convId =
          data.conversationId;

        if (!convId) {
          return;
        }

        let currentConversation =
          conversationsRef.current.find(
            conversation =>
              String(
                conversation._id
              ) ===
              String(convId)
          );

        if (!currentConversation) {
          try {
            const response =
              await api.get(
                `/userChat/conversations/${convId}`
              );

            currentConversation =
              response.data.conversation;
          } catch (error) {
            console.error(
              "Failed to get conversation for incoming message:",
              error
            );
          }
        }

        if (
          currentConversation?.type ===
          "direct"
        ) {
          const senderId =
            data.sender?._id ||
            data.sender?.id ||
            data.sender;

          const otherParticipant =
            currentConversation.participants?.find(
              participant => {
                const participantId =
                  participant?._id ||
                  participant?.id ||
                  participant;

                return (
                  String(
                    participantId
                  ) !==
                  String(userId)
                );
              }
            );

          const otherUserId =
            senderId ||
            otherParticipant?._id ||
            otherParticipant?.id ||
            otherParticipant;

          if (
            otherUserId &&
            blockedUserIds.has(
              String(otherUserId)
            )
          ) {
            return;
          }
        }

        let previewContent =
          data.content ||
          data.text ||
          "";

        if (
          data.type === "text" &&
          data.encryptionIv &&
          currentConversation?.type ===
          "direct"
        ) {
          try {
            const otherParticipant =
              currentConversation.participants?.find(
                participant => {
                  const participantId =
                    participant?._id ||
                    participant?.id ||
                    participant;

                  return (
                    String(
                      participantId
                    ) !==
                    String(userId)
                  );
                }
              );

            if (otherParticipant) {
              const otherUserId =
                otherParticipant._id ||
                otherParticipant.id ||
                otherParticipant;

              const sharedKey =
                await getSharedKey(
                  otherUserId
                );

              previewContent =
                await decryptMessage(
                  data.content,
                  data.encryptionIv,
                  sharedKey
                );
            }
          } catch (error) {
            console.error(
              "Failed to decrypt sidebar message:",
              error
            );
          }
        }

        const newLastMessage = {
          content:
            previewContent,
          type:
            data.type ||
            "text",
          createdAt:
            data.createdAt,
          encryptionIv:
            data.encryptionIv ||
            null
        };

        const conversationExists =
          conversationsRef.current.some(
            conversation =>
              String(
                conversation._id
              ) ===
              String(convId)
          );

        if (conversationExists) {
          setConversations(prev => {
            const updated =
              prev.map(
                conversation =>
                  String(
                    conversation._id
                  ) ===
                    String(convId)
                    ? {
                      ...conversation,
                      lastMessage:
                        newLastMessage,
                      lastMessageAt:
                        data.createdAt
                    }
                    : conversation
              );

            return updated.sort(
              (a, b) =>
                new Date(
                  b.lastMessageAt ||
                  0
                ) -
                new Date(
                  a.lastMessageAt ||
                  0
                )
            );
          });

          setActiveConversation(
            active => {
              const isCurrentChat =
                String(
                  active?._id
                ) ===
                String(convId);

              if (!isCurrentChat) {
                setUnreadMap(prev => ({
                  ...prev,
                  [convId]:
                    (prev[convId] ||
                      0) + 1
                }));
              } else {
                setUnreadMap(prev => ({
                  ...prev,
                  [convId]: 0
                }));
              }

              return active;
            }
          );

          return;
        }

        if (!currentConversation) {
          return;
        }

        setConversations(prev => {
          if (
            prev.some(
              conversation =>
                String(
                  conversation._id
                ) ===
                String(convId)
            )
          ) {
            return prev;
          }

          const restoredConversation = {
            ...currentConversation,
            lastMessage:
              newLastMessage,
            lastMessageAt:
              data.createdAt
          };

          return [
            restoredConversation,
            ...prev
          ].sort(
            (a, b) =>
              new Date(
                b.lastMessageAt ||
                0
              ) -
              new Date(
                a.lastMessageAt ||
                0
              )
          );
        });

        setUnreadMap(prev => ({
          ...prev,
          [convId]:
            (prev[convId] ||
              0) + 1
        }));
      },
      [
        userId,
        getSharedKey,
        blockedUserIds
      ]
    );

  useSocketEvent(
    'receive_message',
    onIncomingMessage
  );

  useSocketEvent(
    'online',
    useCallback(uid => {
      const id =
        String(uid);

      setOnlineUsers(prev => {
        const next =
          new Set(prev);

        next.add(id);

        return next;
      });
    }, [])
  );

  useSocketEvent(
    'offline',
    useCallback(data => {
      const uid =
        String(
          data?.uid ||
          data
        );

      setOnlineUsers(prev => {
        const next =
          new Set(prev);

        next.delete(uid);

        return next;
      });

      if (data?.lastSeen) {
        setLastSeenMap(prev => ({
          ...prev,
          [uid]:
            data.lastSeen
        }));
      }
    }, [])
  );

  useSocketEvent(
    'online_users',
    useCallback(uids => {
      setOnlineUsers(
        new Set(
          uids.map(String)
        )
      );
    }, [])
  );

  const onGroupCreated =
    useCallback(
      group => {
        setConversations(prev => {
          const exists =
            prev.find(
              c =>
                String(c._id) ===
                String(group._id)
            );

          if (exists) {
            return prev;
          }

          return [
            group,
            ...prev
          ];
        });

        const adminId =
          group.groupAdmin?._id ||
          group.groupAdmin;

        if (
          String(adminId) !==
          String(userId)
        ) {
          setUnreadMap(prev => ({
            ...prev,
            [group._id]: 1
          }));
        }
      },
      [userId]
    );

  useSocketEvent(
    'group_created',
    onGroupCreated
  );

  const onGroupRenamed =
    useCallback(
      ({
        conversationId,
        groupName
      }) => {
        setConversations(prev =>
          prev.map(c =>
            c._id ===
              conversationId
              ? {
                ...c,
                groupName
              }
              : c
          )
        );

        setActiveConversation(a =>
          a?._id ===
            conversationId
            ? {
              ...a,
              groupName
            }
            : a
        );
      },
      []
    );

  useSocketEvent(
    'group_renamed',
    onGroupRenamed
  );

  const onGroupUpdated =
    useCallback(
      updated => {
        setConversations(prev => {
          const exists =
            prev.find(
              c =>
                String(c._id) ===
                String(updated._id)
            );

          if (exists) {
            return prev.map(c =>
              String(c._id) ===
                String(updated._id)
                ? {
                  ...c,
                  ...updated
                }
                : c
            );
          }

          return [
            updated,
            ...prev
          ];
        });

        setActiveConversation(a =>
          a?._id ===
            updated._id
            ? {
              ...a,
              ...updated
            }
            : a
        );
      },
      []
    );

  useSocketEvent(
    'group_updated',
    onGroupUpdated
  );

  const onGroupRemoved =
    useCallback(
      ({
        conversationId
      }) => {
        setConversations(prev =>
          prev.filter(
            c =>
              c._id !==
              conversationId
          )
        );

        setActiveConversation(a =>
          a?._id ===
            conversationId
            ? null
            : a
        );
      },
      []
    );

  useSocketEvent(
    'group_removed',
    onGroupRemoved
  );

  const onGroupDeleted =
    useCallback(
      ({
        conversationId
      }) => {
        setConversations(prev =>
          prev.filter(
            c =>
              c._id !==
              conversationId
          )
        );

        setActiveConversation(a =>
          a?._id ===
            conversationId
            ? null
            : a
        );
      },
      []
    );

  useSocketEvent(
    'group_deleted',
    onGroupDeleted
  );

  return (
    <div className={styles.layout}>
      <div
        className={`${styles.sidebarWrapper} ${
          mobileView === 'chat'
            ? styles.sidebarHidden
            : ''
        }`}
      >
        <Sidebar
          conversations={
            conversations
          }
          activeConversation={
            activeConversation
          }
          onSelectConversation={
            selectConversation
          }
          onSelectUser={
            handleSelectUser
          }
          onGroupCreated={
            handleGroupCreated
          }
          unreadMap={
            unreadMap
          }
          onlineUsers={
            onlineUsers
          }
          lastSeenMap={
            lastSeenMap
          }
          blockedUsers={
            blockedUsers
          }
          blockedUserIds={
            blockedUserIds
          }
        />
      </div>

      <main
        className={`${styles.main} ${
          mobileView === 'sidebar'
            ? styles.mainHidden
            : ''
        }`}
      >
        {activeConversation ? (
          <ChatWindow
            key={
              activeConversation._id
            }
            conversation={
              activeConversation
            }
            onMessageSent={
              handleMessageSent
            }
            onConversationUpdate={
              handleConversationUpdate
            }
            onLeaveOrDelete={
              handleLeaveOrDelete
            }
            onBack={
              handleBack
            }
            onlineUsers={
              onlineUsers
            }
            lastSeenMap={
              lastSeenMap
            }
            getSharedKey={
              getSharedKey
            }
            blockedUserIds={
              blockedUserIds
            }
            onBlockUser={
              handleBlockUser
            }
            onUnblockUser={
              handleUnblockUser
            }
            checkIfBlocked={
              checkIfBlocked
            }
          />
        ) : (
          <EmptyState />
        )}
      </main>
    </div>
  );
}