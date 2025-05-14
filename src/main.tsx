
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Add custom styles for smooth transitions
const style = document.createElement('style');
style.textContent = `
  .grid, .card, .col-span-3, .col-span-9, .col-span-12 {
    transition: all 0.3s ease-in-out;
  }
`;
document.head.appendChild(style);

// Ensure we're using React 18's createRoot API correctly
const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
