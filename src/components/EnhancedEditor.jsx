import React, { useRef, useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import Editor, { DiffEditor } from '@monaco-editor/react'; // 引入 DiffEditor
import axios from 'axios'; // 需要 axios 调用后端
import { API_URL } from '../lib/constants'; // 引入常量

import { 
    MagnifyingGlassIcon, XMarkIcon, DocumentTextIcon, 
    CodeBracketSquareIcon, EyeIcon, EyeSlashIcon, 
    ArrowDownTrayIcon, CommandLineIcon as TerminalIcon,
    CheckCircleIcon, XCircleIcon // 新增图标
} from '@heroicons/react/24/outline';
import { getFileLanguage, escapeRegExp } from '../lib/utils';
import InlineEditWidget from './InlineEditWidget'; // 导入新组件

const EnhancedEditor = ({
    activeFile,
    editorContent,
    setEditorContent,
    showMdPreview,
    setShowMdPreview,
    globalSearchQuery,
    setGlobalSearchQuery,
    handleGlobalSearch,
    globalSearchResults,
    setGlobalSearchResults,
    handleOpenFile,
    handleSaveFile,
    terminalOpen,
    setTerminalOpen,
    terminalInput,
    setTerminalInput,
    terminalOutput,
    handleRunTerminal,
    darkMode
}) => {
    const editorRef = useRef(null);
    const monacoRef = useRef(null);
    
    // === Cursor 功能状态 ===
    const [showInlineEdit, setShowInlineEdit] = useState(false);
    const [widgetPosition, setWidgetPosition] = useState(null);
    const [isProcessingEdit, setIsProcessingEdit] = useState(false);
    const [diffMode, setDiffMode] = useState(false);
    const [originalCode, setOriginalCode] = useState("");
    const [modifiedCode, setModifiedCode] = useState("");

    // 获取 Editor 实例
    const handleEditorDidMount = (editor, monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;

        // 绑定快捷键 Cmd+K / Ctrl+K
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
            triggerInlineEdit();
        });
    };

    // 触发 Cmd+K
    const triggerInlineEdit = () => {
        const editor = editorRef.current;
        if (!editor) return;

        const position = editor.getPosition();
        const coordinates = editor.getScrolledVisiblePosition(position);
        
        // 计算 widget 显示位置 (简单处理，基于编辑器容器偏移)
        // 注意：实际项目中可能需要更精确的 DOM 计算
        setWidgetPosition({ 
            top: coordinates.top + 50, 
            left: coordinates.left + 60 
        });
        setShowInlineEdit(true);
    };

    // 处理 AI 代码生成请求
    const handleInlineEditSend = async (instruction) => {
        setIsProcessingEdit(true);
        const editor = editorRef.current;
        
        // 防御性检查：如果在处理过程中 editor 实例丢失
        if (!editor) {
             setIsProcessingEdit(false);
             return;
        }

        const model = editor.getModel();
        const selection = editor.getSelection();
        const selectedText = model.getValueInRange(selection);
        const fullContent = model.getValue();

        try {
            // 从 localStorage 获取配置 (复用 App.jsx 的逻辑)
            const apiKey = localStorage.getItem(`api_key_${localStorage.getItem("ai_provider") || "deepseek"}`);
            const baseUrl = localStorage.getItem("ai_base_url");
            const aiModel = localStorage.getItem("ai_model");

            const res = await axios.post(`${API_URL}/api/code/edit`, {
                file_path: activeFile.path,
                selected_text: selectedText,
                full_content: fullContent,
                instruction: instruction,
                api_key: apiKey,
                base_url: baseUrl,
                model: aiModel
            });

            const newCodeSnippet = res.data.new_code;

            // 进入 Diff 模式
            setOriginalCode(fullContent);
            
            // 构造替换后的完整代码
            let newFullContent;
            if (selection.isEmpty()) {
                // 插入模式
                const offset = model.getOffsetAt(selection.getStartPosition());
                newFullContent = fullContent.slice(0, offset) + newCodeSnippet + fullContent.slice(offset);
            } else {
                // 替换模式
                // 简单的字符串替换，生产环境建议使用 model.applyEdits 逻辑在内存中模拟
                const startOffset = model.getOffsetAt(selection.getStartPosition());
                const endOffset = model.getOffsetAt(selection.getEndPosition());
                newFullContent = fullContent.slice(0, startOffset) + newCodeSnippet + fullContent.slice(endOffset);
            }

            setModifiedCode(newFullContent);
            
            // 关键：在状态切换前清理引用
            editorRef.current = null;
            setDiffMode(true);
            setShowInlineEdit(false);

        } catch (e) {
            console.error(e);
            alert("AI 生成失败: " + e.message);
        } finally {
            setIsProcessingEdit(false);
        }
    };

    const acceptDiff = () => {
        const contentToSave = modifiedCode;
        
        // 先更新内容
        if (contentToSave !== undefined && contentToSave !== null) {
            setEditorContent(contentToSave);
        }
        
        // 使用 setTimeout 将模式切换推迟到下一个事件循环
        // 这有助于让 React 先处理完数据更新，再处理组件卸载/挂载，减少 ResizeObserver 冲突
        setTimeout(() => {
            setDiffMode(false);
            setOriginalCode("");
            setModifiedCode("");
        }, 0);
    };

    const rejectDiff = () => {
        setDiffMode(false);
        setOriginalCode("");
        setModifiedCode("");
    };

    if (!activeFile) return (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-sm bg-slate-50/30 dark:bg-slate-900/50">
            <CodeBracketSquareIcon className="w-16 h-16 text-slate-200 dark:text-slate-700 mb-4"/>
            <p>请在左侧选择一个文件进行编辑</p>
        </div>
    );
      
    // 注意：lines 的计算需要处理 diffMode 下的状态，防止闪烁
    const currentCode = diffMode ? modifiedCode : editorContent;
    const lines = (currentCode || "").split('\n');
    const isMarkdown = activeFile.path.toLowerCase().endsWith('.md');

    return (
        <div className="flex-1 flex flex-col min-w-0 relative animate-fadeIn">
             {/* Inline Edit Widget */}
             {showInlineEdit && (
                 <InlineEditWidget 
                    position={widgetPosition}
                    onSend={handleInlineEditSend}
                    onClose={() => setShowInlineEdit(false)}
                    isLoading={isProcessingEdit}
                 />
             )}

             {/* Global Search Bar in Editor */}
             <div className="h-12 border-b border-slate-100 dark:border-slate-700 flex items-center px-4 bg-slate-50 dark:bg-slate-800">
                <MagnifyingGlassIcon className="w-4 h-4 text-slate-400 mr-3"/>
                <input 
                    type="text" 
                    placeholder="全局代码搜索 (Grep)..." 
                    value={globalSearchQuery}
                    onChange={e => setGlobalSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleGlobalSearch()}
                    className="flex-1 bg-transparent text-xs outline-none text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
                />
            </div>

            {/* 搜索结果显示区域 */}
            {globalSearchResults.length > 0 && (
                <div className="flex-shrink-0 border-b border-slate-200 dark:border-slate-700 bg-yellow-50/50 dark:bg-slate-800/50 flex flex-col transition-all duration-300 ease-in-out" style={{ maxHeight: '45vh', minHeight: '150px' }}>
                    <div className="flex justify-between items-center px-4 py-2 bg-yellow-100/80 dark:bg-slate-800/80 backdrop-blur-sm border-b border-yellow-200 dark:border-slate-700 sticky top-0 z-10 shadow-sm">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase flex items-center tracking-wider">
                            <MagnifyingGlassIcon className="w-3.5 h-3.5 mr-2 text-indigo-500"/>
                            搜索结果 <span className="ml-2 bg-white dark:bg-slate-700 px-1.5 py-0.5 rounded-md text-indigo-600 dark:text-indigo-400 shadow-sm">{globalSearchResults.length}</span>
                        </span>
                        <button onClick={()=>setGlobalSearchResults([])} className="p-1.5 hover:bg-slate-200/50 dark:hover:bg-slate-600/50 rounded-full text-slate-500 hover:text-red-500 transition-colors" title="关闭搜索结果">
                            <XMarkIcon className="w-4 h-4"/>
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                        {globalSearchResults.map((res, i) => (
                            <div 
                                key={i} 
                                onClick={() => handleOpenFile(res.path)} 
                                className="cursor-pointer group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md transition-all duration-200 overflow-hidden"
                            >
                                <div className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                                    <div className="flex items-center min-w-0">
                                        <DocumentTextIcon className="w-3.5 h-3.5 text-indigo-400 mr-2 flex-shrink-0"/>
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate font-mono">{res.file}</span>
                                    </div>
                                    <span className="text-[10px] text-slate-400 truncate ml-3 opacity-60 group-hover:opacity-100 transition-opacity max-w-[150px]" title={res.path}>
                                        {res.path.split('/').slice(-3).join('/')}
                                    </span>
                                </div>
                                <div className="p-3 bg-white dark:bg-slate-900">
                                    <div className="text-xs font-mono text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-2 rounded border border-slate-100 dark:border-slate-800 whitespace-pre-wrap break-all leading-relaxed">
                                        {(() => {
                                            const text = String(res.snippet || "");
                                            if (!globalSearchQuery) return text;
                                            const escapedQuery = escapeRegExp(globalSearchQuery);
                                            const parts = text.split(new RegExp(`(${escapedQuery})`, 'gi'));
                                            return parts.map((part, j) => 
                                                part.toLowerCase() === globalSearchQuery.toLowerCase() ? 
                                                <span key={j} className="bg-yellow-200 dark:bg-yellow-900/60 text-slate-900 dark:text-yellow-200 font-bold px-0.5 rounded border border-yellow-300 dark:border-yellow-700/50">{part}</span> : 
                                                part
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Diff Mode Header Actions */}
            {diffMode && (
                <div className="flex items-center justify-between px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 border-b border-indigo-100 dark:border-indigo-800">
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">✨ AI 生成结果对比</span>
                    <div className="flex space-x-2">
                        <button onClick={rejectDiff} className="flex items-center px-3 py-1 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs rounded border border-slate-200 dark:border-slate-600 hover:text-red-500">
                            <XCircleIcon className="w-4 h-4 mr-1"/> 拒绝
                        </button>
                        <button onClick={acceptDiff} className="flex items-center px-3 py-1 bg-indigo-600 text-white text-xs font-bold rounded hover:bg-indigo-700 shadow-sm">
                            <CheckCircleIcon className="w-4 h-4 mr-1"/> 接受更改
                        </button>
                    </div>
                </div>
            )}

            <div className="flex-1 flex relative overflow-hidden bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-mono text-sm leading-6">
                {/* 编辑区 OR 预览区 OR Diff区 */}
                {showMdPreview && isMarkdown ? (
                    <div className="flex-1 w-full h-full p-8 overflow-y-auto markdown-body bg-white dark:bg-slate-900">
                        <ReactMarkdown>{editorContent}</ReactMarkdown>
                    </div>
                ) : diffMode ? (
                    // Cursor 风格：显示 Diff 视图
                    // key属性强制 DiffEditor 在内容变化时彻底重置，避免 ResizeObserver 错误
                    <DiffEditor
                        key={`diff-editor-${activeFile.path}`}
                        height="100%"
                        language={getFileLanguage(activeFile.path)}
                        original={originalCode}
                        modified={modifiedCode}
                        theme={darkMode ? "vs-dark" : "light"}
                        options={{
                            renderSideBySide: true,
                            minimap: { enabled: false },
                            fontSize: 14,
                            scrollBeyondLastLine: false,
                            originalEditable: false, // 显式设置为不可编辑
                        }}
                    />
                ) : (
                    // 标准编辑器
                    // key属性确保切换回标准编辑器时是一个全新的实例，避免引用混淆
                    <Editor
                        key={`standard-editor-${activeFile.path}`}
                        height="100%"
                        language={getFileLanguage(activeFile.path)}
                        value={editorContent}
                        theme={darkMode ? "vs-dark" : "light"}
                        onChange={(value) => setEditorContent(value || "")}
                        onMount={handleEditorDidMount} // 绑定 onMount
                        options={{
                            minimap: { enabled: false },
                            fontSize: 14,
                            wordWrap: 'on',
                            automaticLayout: true,
                            scrollBeyondLastLine: false,
                            lineNumbers: 'on',
                            renderLineHighlight: 'all',
                        }}
                    />
                )}
            </div>
            
            {/* 底部工具栏 */}
            <div className="h-10 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 bg-white dark:bg-slate-900">
                <div className="flex items-center space-x-4">
                    <span className="text-xs text-slate-400">{lines.length} lines • UTF-8</span>
                    {isMarkdown && (
                        <button 
                            onClick={() => setShowMdPreview(!showMdPreview)} 
                            className={`flex items-center text-xs font-medium transition-colors ${showMdPreview ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            {showMdPreview ? <EyeSlashIcon className="w-3.5 h-3.5 mr-1"/> : <EyeIcon className="w-3.5 h-3.5 mr-1"/>}
                            {showMdPreview ? '退出预览' : '实时预览'}
                        </button>
                    )}
                </div>
                <div className="flex space-x-2">
                    <button onClick={() => setTerminalOpen(!terminalOpen)} className={`p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 ${terminalOpen ? 'text-indigo-500' : 'text-slate-400'}`} title="Toggle Terminal"><TerminalIcon className="w-4 h-4"/></button>
                    <button onClick={handleSaveFile} className="flex items-center px-3 py-1 bg-indigo-600 text-white text-xs font-bold rounded hover:bg-indigo-700 transition shadow-sm">
                        <ArrowDownTrayIcon className="w-3.5 h-3.5 mr-1.5"/> 保存
                    </button>
                </div>
            </div>
            
            {/* 终端面板 */}
            {terminalOpen && (
                <div className="h-48 border-t border-slate-200 dark:border-slate-800 bg-slate-900 text-slate-200 p-2 font-mono text-xs flex flex-col animate-slideUp">
                    <div className="flex-1 overflow-y-auto mb-2 space-y-1">
                        {terminalOutput.map((line, i) => (
                            <div key={i} className={`${line.type==='command'?'text-yellow-400':line.type==='error'?'text-red-400':'text-slate-300'}`}>{line.text}</div>
                        ))}
                    </div>
                    <div className="flex items-center border-t border-slate-700 pt-2">
                        <span className="text-green-400 mr-2">➜</span>
                        <input 
                            type="text" 
                            className="flex-1 bg-transparent outline-none text-white" 
                            value={terminalInput}
                            onChange={e => setTerminalInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleRunTerminal()}
                            placeholder="输入命令 (例如: npm install)..."
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default EnhancedEditor;
