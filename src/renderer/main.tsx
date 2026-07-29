import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { NotificationsProvider } from './notifications';
const root = document.getElementById('root');
if (!root) throw new Error('Renderer root element is missing');
createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={new QueryClient()}>
      <NotificationsProvider>
        <App />
      </NotificationsProvider>
    </QueryClientProvider>
  </StrictMode>,
);
