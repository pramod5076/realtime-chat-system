export interface User {
  id: number;
  username: string;
  email: string;
  isOnline: boolean;
  lastSeen?: string;
}

export interface Message {
  id: number;
  chatId: number;
  senderId: number;
  senderUsername: string;
  content: string;
  sentAt: string;
  messageType: string;
}

export interface Chat {
  id: number;
  chatType: 'Private' | 'Group';
  chatName: string;
  createdAt: string;
  members: User[];
  lastMessage?: Message;
}

export interface AuthResponse {
  id: number;
  username: string;
  email: string;
  token: string;
  role: string;
}
