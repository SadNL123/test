// src/components/InlineEditWidget.jsx
import React, { useEffect, useRef } from 'react';
import { SparklesIcon, ArrowRightCircleIcon } from '@heroicons/react/24/outline';

const InlineEditWidget = ({ position, onSend, onClose, isLoading }) => {
    const inputRef = useRef(null);

    useEffect(() => {
        if (inputRef.current) inputRef.current.focus();
    }, []);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSend(inputRef.current.value);
        }
        if (e.key === 'Escape') {
            onClose();
        }
    };

    if (!position) return null;

    return (
        <div 
            className="absolute z-50 w-[500px] bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 animate-fadeIn"
            style={{ 
                top: position.top, 
                left: position.left 
            }}
        >
            <div className="flex items-center p-3 border-b border-slate-100 dark:border-slate-700">
                <SparklesIcon className="w-5 h-5 text-indigo-600 mr-2 animate-pulse" />
                <input 
                    ref={inputRef}
                    type="text" 
                    placeholder="生成或编辑代码... (Enter 发送)" 
                    className="flex-1 bg-transparent outline-none text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
                    onKeyDown={handleKeyDown}
                    disabled={isLoading}
                />
                {isLoading && <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>}
            </div>
            <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-900/50 text-[10px] text-slate-400 rounded-b-xl flex justify-between">
                <span>Esc 关闭</span>
                <span>针对选中的代码进行修改</span>
            </div>
        </div>
    );
};

export default InlineEditWidget;