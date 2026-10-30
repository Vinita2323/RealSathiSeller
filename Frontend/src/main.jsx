import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

// Listen for dynamic import errors (usually caused by a new deployment replacing old chunks)
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  
  // Guard against infinite reloads by using sessionStorage
  const chunkFailedKey = 'sathiseller_chunk_failed_reload';
  if (!sessionStorage.getItem(chunkFailedKey)) {
    sessionStorage.setItem(chunkFailedKey, 'true');
    window.location.reload(true); // Force reload to fetch the latest index.html
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
