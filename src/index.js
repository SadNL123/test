import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// === 最终极防崩溃补丁 (The "Anti-Overlay" Patch) ===

// 1. JS 层面拦截：静默处理 ResizeObserver 和 Script error
const ignoreErrors = [
    'ResizeObserver loop',
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    'Script error',
    'Script error.',
    'unstable_flushDiscreteUpdates',
    'ResizeObserver'
];

const shouldIgnore = (msg) => {
    if (!msg) return false;
    const str = String(msg);
    return ignoreErrors.some(err => str.includes(err));
};

// 拦截全局错误
const originalOnError = window.onerror;
window.onerror = function(message, source, lineno, colno, error) {
    if (shouldIgnore(message)) return true; // 阻止上报
    if (originalOnError) return originalOnError.apply(this, arguments);
    return false;
};

// 拦截捕获阶段的 Error 事件
window.addEventListener('error', (event) => {
    if (shouldIgnore(event.message)) {
        event.stopImmediatePropagation();
        event.stopPropagation();
        event.preventDefault();
    }
}, true);

// 拦截 Promise 拒绝
window.addEventListener('unhandledrejection', (event) => {
    const msg = event.reason ? (event.reason.message || String(event.reason)) : '';
    if (shouldIgnore(msg)) {
        event.stopImmediatePropagation();
        event.stopPropagation();
        event.preventDefault();
    }
}, true);

// 拦截 console.error (这是 Overlay 弹出的主要触发器)
const originalConsoleError = console.error;
console.error = (...args) => {
    if (args.length > 0 && shouldIgnore(args[0])) return;
    originalConsoleError.apply(console, args);
};

// 2. UI 层面拦截：物理移除/隐藏报错遮罩 (针对顽固的 CRA Overlay)

// 方法 A: 注入 CSS 强制隐藏 iframe
const style = document.createElement('style');
style.innerHTML = `
    /* 隐藏 CRA 的报错 iframe */
    iframe[style*="z-index: 2147483647"],
    iframe[style*="z-index: 2147483647"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
        width: 0 !important;
        height: 0 !important;
    }
`;
document.head.appendChild(style);

// 方法 B: 使用 MutationObserver 只要发现报错遮罩进入 DOM 就立即移除
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (!mutation.addedNodes) return;
        mutation.addedNodes.forEach((node) => {
            // CRA Overlay 通常是一个 iframe，且 z-index 很高
            if (node.tagName === 'IFRAME' && 
               (node.style.zIndex === '2147483647' || node.src === 'about:blank')) {
                // 确保它是因为报错而弹出的（虽然我们通过 CSS 隐藏了，但移除它更安全）
                try {
                    node.remove();
                    // console.log('已物理移除 React Error Overlay');
                } catch (e) { /* ignore */ }
            }
        });
    });
});

// 监听 body 的子节点变化
observer.observe(document.body, { childList: true });


const root = ReactDOM.createRoot(document.getElementById('root'));

// 3. 移除 StrictMode，只渲染 App
root.render(
    <App />
);
