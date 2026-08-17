import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./components/login/login').then(m => m.LoginComponent)
  },
  {
    path: 'register',
    loadComponent: () => import('./components/register/register').then(m => m.RegisterComponent)
  },
  {
    path: 'chat',
    loadComponent: () => import('./components/chat/chat').then(m => m.ChatComponent),
    canActivate: [authGuard]
  },
  {
    path: '',
    redirectTo: '/chat',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: '/chat'
  }
];
