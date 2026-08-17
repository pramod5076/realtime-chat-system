import { Injectable, signal } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { AuthService } from './auth.service';
import { Message } from '../models/chat.models';
import { environment } from '../../environments/environment';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SignalRService {
  private hubConnection!: signalR.HubConnection;
  
  // Real-time events stream
  messageReceived$ = new Subject<Message>();
  userPresenceChanged$ = new Subject<{ userId: number, isOnline: boolean, lastSeen?: string }>();
  
  connectionState = signal<'Connected' | 'Disconnected' | 'Connecting'>('Disconnected');

  constructor(private authService: AuthService) {
    // If user is already authenticated upon app boot, start connection
    if (this.authService.isAuthenticated()) {
      this.startConnection();
    }
  }

  startConnection(): void {
    if (this.hubConnection && this.hubConnection.state === signalR.HubConnectionState.Connected) {
      return;
    }

    const token = this.authService.getToken();
    if (!token) return;

    this.connectionState.set('Connecting');

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(environment.hubUrl, {
        accessTokenFactory: () => token,
        skipNegotiation: true,
        transport: signalR.HttpTransportType.WebSockets
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Information)
      .build();

    this.hubConnection.start()
      .then(() => {
        this.connectionState.set('Connected');
        this.registerHandlers();
      })
      .catch(err => {
        console.error('Error starting SignalR connection:', err);
        this.connectionState.set('Disconnected');
      });

    this.hubConnection.onclose(() => {
      this.connectionState.set('Disconnected');
    });

    this.hubConnection.onreconnecting(() => {
      this.connectionState.set('Connecting');
    });

    this.hubConnection.onreconnected(() => {
      this.connectionState.set('Connected');
    });
  }

  stopConnection(): void {
    if (this.hubConnection) {
      this.hubConnection.stop().then(() => {
        this.connectionState.set('Disconnected');
      });
    }
  }

  private registerHandlers(): void {
    this.hubConnection.on('ReceiveMessage', (message: Message) => {
      this.messageReceived$.next(message);
    });

    this.hubConnection.on('UserPresence', (presence: { userId: number, isOnline: boolean, lastSeen?: string }) => {
      this.userPresenceChanged$.next(presence);
    });
  }

  sendMessage(chatId: number, content: string): Promise<void> {
    if (this.connectionState() !== 'Connected') {
      return Promise.reject('Not connected to chat hub.');
    }
    return this.hubConnection.invoke('SendMessage', chatId, content);
  }

  joinChatGroup(chatId: number): Promise<void> {
    if (this.connectionState() !== 'Connected') return Promise.resolve();
    return this.hubConnection.invoke('JoinChatGroup', chatId);
  }

  leaveChatGroup(chatId: number): Promise<void> {
    if (this.connectionState() !== 'Connected') return Promise.resolve();
    return this.hubConnection.invoke('LeaveChatGroup', chatId);
  }
}
