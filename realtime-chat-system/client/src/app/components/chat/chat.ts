import { Component, OnInit, OnDestroy, signal, ViewChild, ElementRef, AfterViewChecked, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { Chat, Message, User } from '../../models/chat.models';
import { AuthService } from '../../services/auth.service';
import { ChatService } from '../../services/chat.service';
import { SignalRService } from '../../services/signalr.service';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.html',
  styleUrl: './chat.css'
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messageContainer') private messageContainer!: ElementRef;

  private authService = inject(AuthService);
  private chatService = inject(ChatService);
  private signalRService = inject(SignalRService);
  private router = inject(Router);

  currentUser = this.authService.currentUser;
  
  chats = signal<Chat[]>([]);
  activeChat = signal<Chat | null>(null);
  messages = signal<Message[]>([]);
  
  // Searching & Contacts
  searchQuery = '';
  searchResults = signal<User[]>([]);
  onlineUsers = signal<User[]>([]);
  
  // Message input
  newMessageContent = '';

  // Group creation modal state
  showGroupModal = signal(false);
  groupName = '';
  groupMembersList = signal<User[]>([]);
  selectedMemberIds = signal<number[]>([]);

  private subs: Subscription[] = [];
  private shouldScrollToBottom = false;

  ngOnInit(): void {
    // Ensure SignalR connection is active
    this.signalRService.startConnection();

    // Fetch initial chat list
    this.loadChats();

    // Fetch list of online users
    this.loadOnlineUsers();

    // Subscribe to incoming messages
    this.subs.push(
      this.signalRService.messageReceived$.subscribe((message: Message) => {
        this.handleIncomingMessage(message);
      })
    );

    // Subscribe to presence updates
    this.subs.push(
      this.signalRService.userPresenceChanged$.subscribe((presence) => {
        this.handlePresenceUpdate(presence);
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  loadChats(): void {
    this.chatService.getChats().subscribe(data => {
      this.chats.set(data);
    });
  }

  loadOnlineUsers(): void {
    this.chatService.getOnlineUsers().subscribe(data => {
      this.onlineUsers.set(data);
    });
  }

  selectChat(chat: Chat): void {
    const previousChat = this.activeChat();
    if (previousChat) {
      this.signalRService.leaveChatGroup(previousChat.id);
    }

    this.activeChat.set(chat);
    this.signalRService.joinChatGroup(chat.id);
    
    // Clear search and results
    this.searchQuery = '';
    this.searchResults.set([]);

    // Load messages
    this.chatService.getMessages(chat.id).subscribe(data => {
      this.messages.set(data);
      this.shouldScrollToBottom = true;
    });
  }

  onSearch(): void {
    if (!this.searchQuery.trim()) {
      this.searchResults.set([]);
      return;
    }
    this.chatService.searchUsers(this.searchQuery).subscribe(users => {
      this.searchResults.set(users);
    });
  }

  startPrivateChat(user: User): void {
    this.chatService.createPrivateChat(user.id).subscribe(chat => {
      // Add chat to the list if not present, and select it
      const currentChats = this.chats();
      if (!currentChats.some(c => c.id === chat.id)) {
        this.chats.set([chat, ...currentChats]);
      }
      this.selectChat(chat);
    });
  }

  sendMessage(): void {
    const chat = this.activeChat();
    if (!chat || !this.newMessageContent.trim()) return;

    const content = this.newMessageContent.trim();
    this.newMessageContent = '';

    this.signalRService.sendMessage(chat.id, content)
      .then(() => {
        this.shouldScrollToBottom = true;
      })
      .catch(err => {
        console.error('Failed to send message:', err);
      });
  }

  // Group Modal Actions
  openGroupModal(): void {
    this.groupName = '';
    this.selectedMemberIds.set([]);
    this.showGroupModal.set(true);
    
    // Fetch all users to choose from
    this.chatService.searchUsers(' ').subscribe(users => {
      this.groupMembersList.set(users);
    });
  }

  closeGroupModal(): void {
    this.showGroupModal.set(false);
  }

  toggleMemberSelection(userId: number): void {
    const selected = this.selectedMemberIds();
    if (selected.includes(userId)) {
      this.selectedMemberIds.set(selected.filter(id => id !== userId));
    } else {
      this.selectedMemberIds.set([...selected, userId]);
    }
  }

  createGroupChat(): void {
    if (!this.groupName.trim() || this.selectedMemberIds().length === 0) return;

    this.chatService.createGroupChat(this.groupName.trim(), this.selectedMemberIds()).subscribe(chat => {
      this.chats.set([chat, ...this.chats()]);
      this.selectChat(chat);
      this.closeGroupModal();
    });
  }

  logout(): void {
    this.signalRService.stopConnection();
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  // Real-time Event Handlers
  private handleIncomingMessage(message: Message): void {
    const chat = this.activeChat();
    if (chat && chat.id === message.chatId) {
      this.messages.set([...this.messages(), message]);
      this.shouldScrollToBottom = true;
    }

    // Update last message in chat list
    const updatedChats = this.chats().map(c => {
      if (c.id === message.chatId) {
        return { ...c, lastMessage: message };
      }
      return c;
    });

    // Sort: bring the active chat to the top
    const chatIndex = updatedChats.findIndex(c => c.id === message.chatId);
    if (chatIndex > -1) {
      const matchingChat = updatedChats[chatIndex];
      updatedChats.splice(chatIndex, 1);
      this.chats.set([matchingChat, ...updatedChats]);
    } else {
      // If chat is not in the list yet, reload the list
      this.loadChats();
    }
  }

  private handlePresenceUpdate(presence: { userId: number, isOnline: boolean, lastSeen?: string }): void {
    // Update online list
    this.loadOnlineUsers();

    // Update members online status in chat lists
    this.chats.set(this.chats().map(c => {
      const updatedMembers = c.members.map(m => {
        if (m.id === presence.userId) {
          return { ...m, isOnline: presence.isOnline, lastSeen: presence.lastSeen };
        }
        return m;
      });
      return { ...c, members: updatedMembers };
    }));

    // Update active chat online status
    const active = this.activeChat();
    if (active) {
      const updatedMembers = active.members.map(m => {
        if (m.id === presence.userId) {
          return { ...m, isOnline: presence.isOnline, lastSeen: presence.lastSeen };
        }
        return m;
      });
      this.activeChat.set({ ...active, members: updatedMembers });
    }
  }

  private scrollToBottom(): void {
    try {
      this.messageContainer.nativeElement.scrollTop = this.messageContainer.nativeElement.scrollHeight;
    } catch (err) {
      // Ignore scroll errors
    }
  }

  // Helper template formatters
  getChatDisplayName(chat: Chat): string {
    if (chat.chatType === 'Group') {
      return chat.chatName || 'Unnamed Group';
    }
    // For Private chats, show the other user's name
    const otherMember = chat.members.find(m => m.id !== this.currentUser()?.id);
    return otherMember?.username || 'Deleted User';
  }

  getChatAvatarInitials(chat: Chat): string {
    const name = this.getChatDisplayName(chat);
    return name.slice(0, 2).toUpperCase();
  }

  getOtherMemberOnlineStatus(chat: Chat): boolean {
    if (chat.chatType === 'Group') return false;
    const otherMember = chat.members.find(m => m.id !== this.currentUser()?.id);
    return otherMember?.isOnline || false;
  }

  getOtherMemberLastSeen(chat: Chat): string {
    if (chat.chatType === 'Group') return '';
    const otherMember = chat.members.find(m => m.id !== this.currentUser()?.id);
    if (!otherMember) return '';
    if (otherMember.isOnline) return 'Online';
    if (!otherMember.lastSeen) return 'Offline';
    
    // Format simple timestamp
    const date = new Date(otherMember.lastSeen);
    return 'Last seen ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  getUserAvatarInitials(username: string): string {
    return username.slice(0, 2).toUpperCase();
  }
}
export default ChatComponent;
