import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { AuthResponse, User } from '../models/chat.models';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = `${environment.apiUrl}/api/auth`;
  
  currentUser = signal<AuthResponse | null>(null);

  constructor(private http: HttpClient) {
    this.loadToken();
  }

  setApiUrl(url: string) {
    this.apiUrl = `${url}/api/auth`;
  }

  getApiUrl(): string {
    return this.apiUrl;
  }

  register(username: string, email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, { username, email, password }).pipe(
      tap(res => this.handleAuth(res))
    );
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, { email, password }).pipe(
      tap(res => this.handleAuth(res))
    );
  }

  logout(): void {
    localStorage.removeItem('chat_auth_user');
    this.currentUser.set(null);
  }

  getToken(): string | null {
    const user = this.currentUser();
    return user ? user.token : null;
  }

  isAuthenticated(): boolean {
    return this.currentUser() !== null;
  }

  private handleAuth(response: AuthResponse): void {
    localStorage.setItem('chat_auth_user', JSON.stringify(response));
    this.currentUser.set(response);
  }

  private loadToken(): void {
    const stored = localStorage.getItem('chat_auth_user');
    if (stored) {
      try {
        const user = JSON.parse(stored) as AuthResponse;
        this.currentUser.set(user);
      } catch {
        this.logout();
      }
    }
  }
}
