import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource/noto-sans-khmer/400.css';
import '@fontsource/noto-sans-khmer/500.css';
import '@fontsource/noto-sans-khmer/600.css';
import '@fontsource/noto-sans-khmer/700.css';
import '@fontsource/noto-sans-khmer/800.css';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './auth.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
