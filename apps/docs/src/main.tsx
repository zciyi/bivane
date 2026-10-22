import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('找不到 #root 挂载点');

createRoot(root).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
);
