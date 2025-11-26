import React, { useEffect } from 'react';
import { 
    PencilSquareIcon, 
    CloudArrowUpIcon, 
    CodeBracketSquareIcon, 
    WrenchScrewdriverIcon, 
    TrashIcon, 
    ArrowDownTrayIcon, 
    SunIcon, 
    MoonIcon, 
    MagnifyingGlassIcon 
} from '@heroicons/react/24/outline';

const CommandPalette = ({ 
    showCmdPalette, 
    setShowCmdPalette, 
    searchInputRef, 
    handleNewChat, 
    setShowImport, 
    setCurrentView, 
    handleResetKB, 
    handleExportChat, 
    darkMode, 
    setDarkMode 
}) => {
    
    // 监听 ESC 键关闭 (本地逻辑，虽然 App.jsx 也有，但为了组件独立性可以保留或移除，这里为了简化复用 App.jsx 的逻辑，只负责渲染)
    // 注意：原 App.jsx 中已经处理了 ESC 关闭逻辑，所以这里主要是渲染结构

    if (!showCmdPalette) return null;
    
    const actions = [
        { name: "新对话", icon: PencilSquareIcon, action: handleNewChat },
        { name: "导入数据", icon: CloudArrowUpIcon, action: () => setShowImport(true) },
        { name: "切换到 IDE 编辑", icon: CodeBracketSquareIcon, action: () => setCurrentView('editor') },
        { name: "切换到 工具箱", icon: WrenchScrewdriverIcon, action: () => setCurrentView('tools') },
        { name: "清空知识库", icon: TrashIcon, action: handleResetKB },
        { name: "导出对话", icon: ArrowDownTrayIcon, action: handleExportChat },
        { name: "切换深色模式", icon: darkMode ? SunIcon : MoonIcon, action: () => setDarkMode(!darkMode) },
    ];

    return (
        <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-start justify-center pt-32" onClick={() => setShowCmdPalette(false)}>
            <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-fadeIn" onClick={e => e.stopPropagation()}>
                <div className="p-3 border-b border-slate-100 dark:border-slate-700 flex items-center">
                    <MagnifyingGlassIcon className="w-5 h-5 text-slate-400 mr-2"/>
                    <input ref={searchInputRef} type="text" placeholder="搜索命令..." className="w-full outline-none text-sm text-slate-700 dark:text-slate-200 bg-transparent placeholder:text-slate-400"/>
                    <span className="text-xs text-slate-400 px-2 border border-slate-200 dark:border-slate-600 rounded">ESC</span>
                </div>
                <div className="py-2">
                    <div className="px-3 py-1 text-xs font-bold text-slate-400 uppercase">建议</div>
                    {actions.map((act, i) => (
                        <button key={i} onClick={() => { act.action(); setShowCmdPalette(false); }} className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-sm text-slate-700 dark:text-slate-300 flex items-center transition-colors">
                            <act.icon className="w-4 h-4 mr-3 text-slate-500"/>{act.name}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default CommandPalette;