import React from 'react';
import { SparklesIcon, FolderIcon, WrenchScrewdriverIcon } from '@heroicons/react/24/outline';
import { PROVIDERS } from '../lib/constants';

const WelcomeScreen = ({ provider, setShowImport, setImportTab, setCurrentView }) => {
    const providerName = PROVIDERS[provider]?.name.split(' ')[0] || "DeepSeek";
    
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4 animate-fadeIn pb-64">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-lg mb-12 border border-slate-100 dark:border-slate-700 w-24 h-24 flex items-center justify-center">
            <SparklesIcon className="w-12 h-12 text-indigo-500" />
        </div>
        <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-6">{providerName} RAG Pro</h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-md mb-16">全能的本地知识库助手。当前引擎: {PROVIDERS[provider]?.name}</p>
        <div className="flex flex-col md:flex-row gap-10 max-w-3xl w-full">
          <button onClick={() => { setShowImport(true); setImportTab('file'); }} className="p-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl hover:border-indigo-400 hover:shadow-xl transition text-left group flex-1">
            <div className="flex items-center space-x-4 mb-4">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/50 rounded-xl group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900 transition">
                    <FolderIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400"/>
                </div>
                <span className="font-bold text-lg text-slate-700 dark:text-slate-200">导入知识库</span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">支持上传 PDF, TXT, 代码文件或 Git 仓库链接</p>
          </button>
          <button onClick={() => { setCurrentView('tools') }} className="p-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl hover:border-pink-400 hover:shadow-xl transition text-left group flex-1">
             <div className="flex items-center space-x-4 mb-4">
                <div className="p-3 bg-pink-50 dark:bg-pink-900/50 rounded-xl group-hover:bg-pink-100 dark:group-hover:bg-pink-900 transition">
                    <WrenchScrewdriverIcon className="w-6 h-6 text-pink-600 dark:text-pink-400"/>
                </div>
                <span className="font-bold text-lg text-slate-700 dark:text-slate-200">AI 工具箱</span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">内建 12+ 种生产力工具，提高工作效率</p>
          </button>
        </div>
      </div>
    );
};

export default WelcomeScreen;