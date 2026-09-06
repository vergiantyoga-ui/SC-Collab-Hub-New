import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AppStoreProvider } from './store/AppStore.jsx';
import { ToastProvider } from './components/ui/Toast.jsx';
import { ThemeProvider } from './store/ThemeContext.jsx';
import { LanguageProvider } from './i18n/LanguageContext.jsx';
import './styles/global.css';
import './styles/patterns.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <ThemeProvider>
        <AppStoreProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AppStoreProvider>
        </ThemeProvider>
      </LanguageProvider>
    </BrowserRouter>
  </StrictMode>,
);
