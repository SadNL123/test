import React, { useState } from 'react';
import { 
  FolderIcon, 
  DocumentTextIcon 
} from '@heroicons/react/24/outline';
import { PaperClipIcon } from '@heroicons/react/20/solid';

const FileTreeNode = ({ 
    node, 
    level = 0, 
    activeFile, 
    fileFilter, 
    pinnedFiles, 
    handleOpenFile, 
    handlePinFile 
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const isFolder = node.type === 'folder';
    const isSelected = activeFile?.path === node.path;
    const isPinned = pinnedFiles.find(f => f.path === node.path);
    
    // 简单的过滤逻辑
    if (fileFilter && !isFolder && !node.name.toLowerCase().includes(fileFilter.toLowerCase())) return null;

    return (
        <div className="select-none group">
            <div 
                className={`flex items-center py-1 px-2 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-sm transition-colors ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium' : 'text-slate-600 dark:text-slate-400'}`}
                style={{ paddingLeft: `${level * 12 + 8}px` }}
                onClick={() => isFolder ? setIsOpen(!isOpen) : handleOpenFile(node.path)}
            >
                {isFolder ? (
                    <FolderIcon className={`w-4 h-4 mr-1.5 flex-shrink-0 ${isOpen ? 'text-indigo-500' : 'text-slate-400'}`}/>
                ) : (
                    <DocumentTextIcon className="w-4 h-4 mr-1.5 flex-shrink-0 text-slate-400"/>
                )}
                <span className="truncate flex-1">{node.name}</span>
                {!isFolder && (
                    <button 
                        onClick={(e) => handlePinFile(node, e)} 
                        className={`opacity-0 group-hover:opacity-100 p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded ${isPinned ? 'opacity-100 text-indigo-500' : 'text-slate-400'}`} 
                        title={isPinned ? '已引用，点击取消' : '点击引用到 AI 上下文'}
                    >
                        <PaperClipIcon className="w-3 h-3"/>
                    </button>
                )}
            </div>
            {isFolder && isOpen && node.children && (
                <div>
                    {node.children.map((child, i) => (
                        <FileTreeNode 
                            key={i} 
                            node={child} 
                            level={level + 1}
                            activeFile={activeFile}
                            fileFilter={fileFilter}
                            pinnedFiles={pinnedFiles}
                            handleOpenFile={handleOpenFile}
                            handlePinFile={handlePinFile}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default FileTreeNode;