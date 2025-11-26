import React from 'react';
import { XMarkIcon, DocumentTextIcon } from '@heroicons/react/24/outline';

const SourceViewer = ({ content, onClose }) => {
    if (!content) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden ring-1 ring-slate-900/5" onClick={e => e.stopPropagation()}>
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                    <h3 className="font-bold text-slate-700 dark:text-slate-200 flex items-center text-sm">
                        <DocumentTextIcon className="w-5 h-5 mr-2 text-indigo-500"/> 来源文档原文
                    </h3>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-200/50 dark:hover:bg-slate-700 rounded-full text-slate-400 hover:text-slate-600 transition">
                        <XMarkIcon className="w-5 h-5"/>
                    </button>
                </div>
                <div className="p-6 overflow-y-auto bg-white dark:bg-slate-800">
                    <pre className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap font-mono font-medium">{content}</pre>
                </div>
                <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-200 hover:bg-slate-50 transition">
                        关闭
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SourceViewer;