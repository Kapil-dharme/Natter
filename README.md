# Natter

A full-stack, end-to-end encrypted real-time chat application built with Node.js, Socket.io, Redis, and React.

**Live demo:** [natter.vercel.app](https://natter-lake.vercel.app/)

---

## Highlights

- **End-to-end encryption**: ECDH key exchange with AES encryption, so the server only ever stores ciphertext
- **Horizontally scalable real-time layer**: Socket.io with a Redis pub/sub adapter, verified across multiple server instances
- **Secure authentication**: JWT access and refresh token rotation in httpOnly cookies, with OTP verification
- **Rich messaging**: text, image, and file messages with replies, delivery and read receipts, and an offline queue
- **Group chat**: admin controls, auto-promotion, and real-time group events
- **Privacy controls**: user blocking and graceful handling of deleted users
- **Notifications**: push notifications and an installable PWA

---

## Tech Stack

| Layer           | Technology                    |
| --------------- | ----------------------------- |
| Backend         | Node.js, Express (ES Modules) |
| Database        | MongoDB, Mongoose             |
| Real-time       | Socket.io                     |
| Cache / Pub-Sub | Redis (Upstash, via ioredis)  |
| Encryption      | ECDH + AES (client-side)      |
| Media           | Cloudinary, Multer            |
| Frontend        | React, Vite                   |
| Deployment      | Vercel                        |

---

## Features

### Authentication

- Register and login with OTP email verification
- Short-lived access tokens (15 min) and long-lived refresh tokens (7 days), both httpOnly cookies
- Silent token refresh through an axios interceptor
- Session restore on load via `/auth/me`
- Consistent status-code handling (400 / 404 / 409 / 500)

### End-to-End Encryption

- Each user generates an ECDH key pair on the client; the public key is shared with the server and the private key stays on the device
- Two users derive the same shared secret from their own private key and the other's public key
- The shared secret is used to derive an AES key that encrypts and decrypts message content in the browser
- The server stores and relays only ciphertext and cannot read message content

### Messaging

- Direct conversations (create-or-find)
- Text, image, and file messages
- **Replies**: reply to any message with a quoted preview of the original
- Paginated message history with an IDOR guard on conversation access
- Delivery status: sent, delivered, read
- Online and offline presence indicators
- Offline message queue, drained on reconnect

### Group Chat

- Create groups, rename (admin only), add participants, remove participants (admin only), leave, and delete (admin only)
- When the admin leaves, the next member in the participants array is promoted automatically
- When the last member leaves, the conversation is deleted automatically
- Group deletion hard-deletes the conversation and explicitly cascades to all its messages
- Real-time events: `group_created`, `group_renamed`, `group_updated`, `group_removed`, `group_deleted`

### Blocking

- Block and unblock users from a Blocked Users modal
- Blocked users are hidden from search and cannot message you

### Deleted Users

- Conversations with a deleted account remain readable and are shown with a deleted-user placeholder
- A deleted user can no longer be messaged or found in search

### Notifications

- Push notification support, with a permission prompt in the app
- Installable as an app (PWA)
- Real-time delivery and read updates over Socket.io

---

## Architecture

```
┌────────────────────────┐
│     React (Vite)       │
│  • ECDH key pair       │
│  • AES encrypt/decrypt │
│  • Service worker      │
└───────┬────────┬───────┘
        │ HTTP   │ WebSocket
        ▼        ▼
┌─────────────────────────────────────────────┐
│  Node.js / Express + Socket.io (N instances) │
│  • JWT cookie auth (REST + socket handshake) │
│  • Controllers: auth, user, chat, group      │
│  • Relays ciphertext only                    │
└───────┬──────────────────────┬──────────────┘
        │                      │
        ▼                      ▼
┌───────────────┐     ┌─────────────────────────┐
│   MongoDB     │     │  Redis (Upstash)        │
│  Users        │     │  • Pub/sub adapter      │
│  Conversations│     │  • Presence             │
│  Messages     │     │  • Offline queue        │
└───────────────┘     └─────────────────────────┘
                      ┌─────────────────────────┐
                      │  Cloudinary             │
                      │  Image and file storage │
                      └─────────────────────────┘
```

### Layers

| Layer      | Responsibility                                                                                                 |
| ---------- | -------------------------------------------------------------------------------------------------------------- |
| Client     | Generates keys, encrypts and decrypts messages, holds the session, renders the UI, receives push notifications |
| REST API   | Auth, user search, blocking, conversations, message history, media upload, group management                    |
| Socket.io  | Live message delivery, delivery and read status, presence, group events                                        |
| MongoDB    | Persistent users, conversations, and encrypted messages                                                        |
| Redis      | Cross-instance event broadcast, online-user tracking, offline message queue                                    |
| Cloudinary | Media storage, with the returned URLs stored in messages                                                       |

### Scaling the real-time layer

Socket.io connections are stateful, so an event emitted on one server instance would never reach a user connected to another. Natter uses the Socket.io Redis adapter to broadcast events across all instances through Redis pub/sub. Presence (`onlineUsers`) and the offline message queue also live in Redis rather than process memory, so any instance can serve any user and instances can be added or removed freely.

### Authentication flow

1. Registration sends an OTP; verifying it activates the account.
2. Login issues a 15-minute access token and a 7-day refresh token as httpOnly cookies, signed with separate secrets.
3. When the access token expires, an axios interceptor calls `/auth/refresh` and retries the failed request.
4. The Socket.io handshake authenticates from the same cookies, so there is no second login for the socket.
5. On page load, the client calls `/auth/me` to restore the session.

### End-to-end encryption flow

1. On registration, the client generates an ECDH key pair. The public key is uploaded; the private key stays on the device.
2. To open a conversation, the client fetches the other user's public key.
3. Both sides compute the same shared secret from their own private key and the other's public key, then derive an AES key from it.
4. The sender encrypts the message in the browser and sends only ciphertext over REST or Socket.io.
5. The server stores and relays the ciphertext without being able to read it.
6. The receiver decrypts locally.

### Message lifecycle

1. The sender encrypts the message and emits `send_message`, with an optional reply reference to an earlier message.
2. The server checks that the sender is a participant in the conversation and that neither side has blocked the other.
3. The message is saved, then pushed to the recipient through Redis pub/sub if they are online.
4. If the recipient is offline, the message goes to the Redis offline queue and a push notification is sent.
5. On reconnect, the queue is drained and the sender is notified of the `delivered` status.
6. When the recipient opens the conversation, the status moves to `read`.

### Group chat

- Each conversation has a `type` of `direct` or `group`; groups add `groupName` and `groupAdmin`.
- Management actions (create, rename, add, remove, leave, delete) each emit a Socket.io event to all affected participants.
- Admin-only actions are checked on the server, and removal includes an IDOR guard.
- If the admin leaves, the next participant in the array becomes admin; if the last member leaves, the conversation is deleted.
- Deleting a group removes the conversation and explicitly cascades to all of its messages in the controller.

### Blocking and deleted users

- Blocking is stored on the user record and enforced on the server: blocked users are filtered out of search and cannot send messages to the blocker.
- When an account is deleted, its existing conversations stay intact and the client shows a deleted-user placeholder in place of the profile.

### Notifications

- The client registers a service worker and asks for notification permission.
- Offline recipients receive a push notification when a message arrives.
- Online recipients get live updates over Socket.io instead.

### Data models

**User**

- Credentials, verification state
- ECDH public key
- Blocked users list
- Push subscription

**Conversation**

- `participants`
- `type` (`direct` | `group`)
- `groupName`, `groupAdmin`
- `lastMessage`, `lastMessageAt`

**Message**

- `conversationID`
- `sender`
- `type` (`text` | `image` | `file`)
- `content` (ciphertext for text; media URL for image and file)
- Reply reference to another message
- Delivery status (`sent` | `delivered` | `read`)

### Design decisions

- **Redis for shared state:** presence and the offline queue sit outside the process so that horizontal scaling works.
- **Ciphertext-only server:** the backend never holds keys or plaintext, so a database leak does not expose message content.
- **Explicit cascade delete:** group deletion removes messages in the controller rather than a Mongoose hook, which keeps the behavior visible in the code.
- **Cookie-based auth for sockets:** the same httpOnly cookies cover REST and WebSocket, so tokens never touch JavaScript storage.

---

## API Reference

### Auth

| Method | Endpoint           | Description                                     |
| ------ | ------------------ | ----------------------------------------------- |
| POST   | `/auth/register`   | Create an account and send an OTP               |
| POST   | `/auth/verify-otp` | Verify the OTP and activate the account         |
| POST   | `/auth/login`      | Log in and set token cookies                    |
| POST   | `/auth/refresh`    | Issue a new access token from the refresh token |
| GET    | `/auth/me`         | Return the current user                         |
| POST   | `/auth/logout`     | Clear the session cookies                       |

### Users

| Method | Endpoint                | Description                          |
| ------ | ----------------------- | ------------------------------------ |
| GET    | `/user/search`          | Search users (empty query lists all) |
| POST   | `/user/block/:userId`   | Block a user                         |
| POST   | `/user/unblock/:userId` | Unblock a user                       |
| GET    | `/user/blocked`         | List blocked users                   |
| DELETE | `/user/me`              | Delete the current account           |

### Conversations

| Method | Endpoint                     | Description                          |
| ------ | ---------------------------- | ------------------------------------ |
| POST   | `/userChat/conversation`     | Create or find a direct conversation |
| GET    | `/userChat/conversations`    | List conversations (populated)       |
| GET    | `/userChat/conversation/:id` | Conversation metadata                |

### Messages

| Method | Endpoint                    | Description                            |
| ------ | --------------------------- | -------------------------------------- |
| GET    | `/messages/:conversationId` | Paginated message history              |
| POST   | `/messages/text`            | Send a text message (supports replies) |
| POST   | `/messages/image`           | Send an image message                  |
| POST   | `/messages/file`            | Send a file message                    |

### Groups

| Method | Endpoint                                   | Description                       |
| ------ | ------------------------------------------ | --------------------------------- |
| POST   | `/userChat/group`                          | Create a group                    |
| PATCH  | `/userChat/group/:id/rename`               | Rename a group (admin only)       |
| POST   | `/userChat/group/:id/participants`         | Add participants                  |
| DELETE | `/userChat/group/:id/participants/:userId` | Remove a participant (admin only) |
| POST   | `/userChat/group/:id/leave`                | Leave a group                     |
| DELETE | `/userChat/group/:id`                      | Delete a group (admin only)       |

### Socket.io events

| Event                                                                               | Direction        | Description                      |
| ----------------------------------------------------------------------------------- | ---------------- | -------------------------------- |
| `send_message`                                                                      | Client to server | Send an encrypted message        |
| `receive_message`                                                                   | Server to client | Deliver a message                |
| `message_delivered` / `message_read`                                                | Both             | Delivery and read status updates |
| `user_online` / `user_offline`                                                      | Server to client | Presence updates                 |
| `group_created`, `group_renamed`, `group_updated`, `group_removed`, `group_deleted` | Server to client | Group lifecycle events           |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A MongoDB database
- A Redis instance (Upstash works)
- A Cloudinary account

### Backend

```bash
git clone <repo-url>
cd natter/backend
npm install
```

Create a `.env` file:

```env
PORT=3000
MONGO_URI=
ACCESS_SECRET=
REFRESH_SECRET=
REDIS_URL=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLIENT_URL=http://localhost:5173
```

```bash
npm run dev
```

### Frontend

```bash
cd natter/frontend
npm install
```

Create a `.env` file for production builds:

```env
VITE_API_URL=<backend-origin>
```

```bash
npm run dev
```

In development, the Vite proxy forwards `/auth`, `/user`, `/messages`, and `/userChat` to `localhost:3000`.

### Testing horizontal scaling locally

Run two backend instances on different ports, connect a client to each, and send a message from one to the other. Delivery across instances confirms the Redis adapter is working.

---

## Design

Typography uses Fraunces for headings and Plus Jakarta Sans for body text, with a warm off-white background (`#f5f0eb`) and an orange accent (`#c8714a`).
