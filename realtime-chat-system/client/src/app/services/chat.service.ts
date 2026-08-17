import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Chat, Message, User } from '../models/chat.models';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private baseApiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getChats(): Observable<Chat[]> {
    return this.http.get<Chat[]>(`${this.baseApiUrl}/api/chat`);
  }

  getMessages(chatId: number): Observable<Message[]> {
    return this.http.get<Message[]>(`${this.baseApiUrl}/api/chat/${chatId}/messages`);
  }

  createPrivateChat(targetUserId: number): Observable<Chat> {
    return this.http.post<Chat>(`${this.baseApiUrl}/api/chat/private`, { targetUserId });
  }

  createGroupChat(chatName: string, memberIds: number[]): Observable<Chat> {
    return this.http.post<Chat>(`${this.baseApiUrl}/api/chat/group`, { chatName, memberIds });
  }

  searchUsers(query: string): Observable<User[]> {
    return this.http.get<User[]>(`${this.baseApiUrl}/api/user/search?query=${encodeURIComponent(query)}`);
  }

  getOnlineUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.baseApiUrl}/api/user/online`);
  }
}
