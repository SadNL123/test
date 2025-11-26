import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  SparklesIcon, 
  ClipboardDocumentIcon, 
  ArrowDownCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CheckIcon,
  LightBulbIcon
} from '@heroicons/react/24/outline';

const MessageBubble = ({ 
    msg, 
    bubbleRef, 
    currentView, 
    activeFile, 
    setEditorContent, 
    setStatusMsg 
}) => {
    const isUser = msg.role === "user";
    const [isExpanded, setIsExpanded] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    // 新增：控制思考过程是否展开，默认为 false (不展开)
    const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);
    
    // 判断内容是否过长，阈值设为 300 字符
    const isLongContent = isUser && msg.content && msg.content.length > 300;

    // 新增：复制全文功能
    const handleCopy = () => {
        if (!msg.content) return;
        const textToCopy = msg.content;
        
        const success = () => {
            setIsCopied(true);
            setStatusMsg({type: "success", text: "已复制全文"});
            setTimeout(() => {
                setIsCopied(false);
                setStatusMsg({type: "", text: ""});
            }, 2000);
        };

        const failure = () => {
             setStatusMsg({type: "error", text: "复制失败"});
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(textToCopy).then(success).catch(failure);
        } else {
            try {
                const textarea = document.createElement('textarea');
                textarea.value = textToCopy;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                success();
            } catch (err) {
                failure();
            }
        }
    };

    const CodeBlock = ({node, inline, className, children, ...props}) => {
        const match = /language-(\w+)/.exec(className || '');
        const codeText = String(children).replace(/\n$/, '');
        
        const copyToClipboard = () => {
            try {
                // 创建一个临时 textarea 元素来执行复制
                const textarea = document.createElement('textarea');
                textarea.value = codeText;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy'); // 使用 execCommand 兼容性更好
                document.body.removeChild(textarea);
                setStatusMsg({type: "success", text: "代码已复制"});
                setTimeout(() => setStatusMsg({type:"", text:""}), 2000);
            } catch (err) {
                 setStatusMsg({type: "error", text: "复制失败"});
            }
        };

        const applyToEditor = () => { 
            setEditorContent(codeText); 
            setStatusMsg({type: "success", text: "已应用到编辑器"}); 
            setTimeout(()=>setStatusMsg({type:"",text:""}),2000); 
        };
        
        return !inline && match ? (
          <div className="my-4 rounded-xl overflow-hidden border border-slate-200/60 dark:border-slate-700 shadow-sm bg-slate-50 dark:bg-slate-900 group/code">
            <div className="bg-slate-100/50 dark:bg-slate-800 px-4 py-2 text-xs text-slate-500 font-mono border-b border-slate-200/60 dark:border-slate-700 flex justify-between items-center">
                <span className="font-semibold">{match[1]}</span>
                <div className="flex space-x-3 opacity-0 group-hover/code:opacity-100 transition-opacity">
                    <button onClick={copyToClipboard} className="hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center transition-colors">
                        <ClipboardDocumentIcon className="w-3.5 h-3.5 mr-1"/>复制
                    </button>
                    {currentView === 'editor' && activeFile && (
                        <button onClick={applyToEditor} className="hover:text-pink-600 dark:hover:text-pink-400 flex items-center text-pink-500 font-bold transition-colors" title="覆盖当前文件">
                            <ArrowDownCircleIcon className="w-3.5 h-3.5 mr-1"/> 应用
                        </button>
                    )}
                </div>
            </div>
            <pre className="p-4 overflow-x-auto text-sm font-mono text-slate-800 dark:text-slate-200 m-0 leading-normal">
                <code className={className} {...props}>{children}</code>
            </pre>
          </div>
        ) : <code className="bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded text-xs font-mono font-medium" {...props}>{children}</code>;
    };

    return (
      <div ref={bubbleRef} className={`flex w-full mb-6 ${isUser ? 'justify-end' : ''} animate-fadeIn group`}>
         {!isUser && (
            <div className="flex-shrink-0 mr-4 mt-1">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-sm">
                    <SparklesIcon className="w-5 h-5"/>
                </div>
            </div>
         )}
         {/* 修改：添加 overflow-hidden 防止内容溢出圆角容器 */}
         <div className={`relative max-w-[90%] ${isUser ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-5 py-3.5 overflow-hidden' : 'flex-1 min-w-0'}`}>
             {msg.reasoning && (
                <div className="mb-3">
                    <button 
                        onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}
                        className="flex items-center text-xs font-bold text-slate-400 hover:text-indigo-500 dark:text-slate-500 dark:hover:text-indigo-400 transition-colors select-none mb-2"
                        title={isThinkingExpanded ? "收起思考过程" : "展开思考过程"}
                    >
                        <LightBulbIcon className="w-3.5 h-3.5 mr-1.5"/>
                        <span>深度思考</span>
                        {isThinkingExpanded ? (
                             <ChevronUpIcon className="w-3 h-3 ml-1"/>
                        ) : (
                             <ChevronDownIcon className="w-3 h-3 ml-1"/>
                        )}
                    </button>
                    
                    {isThinkingExpanded && (
                        <div className="bg-slate-50 dark:bg-slate-800/50 border-l-2 border-indigo-200 dark:border-indigo-500/30 pl-4 py-3 pr-4 rounded-r-lg text-xs text-slate-600 dark:text-slate-400 font-mono leading-relaxed whitespace-pre-wrap animate-fadeIn">
                            {msg.reasoning}
                        </div>
                    )}
                </div>
             )}
             
             {isUser ? (
                /* 修改：添加 break-words 强制长单词换行 */
                <div className="text-white text-[15px] leading-7 markdown-body break-words">
                    {/* 如果是长内容且未展开，限制高度并隐藏溢出 */}
                    <div className={`${isLongContent && !isExpanded ? 'max-h-[150px] overflow-hidden mask-linear-gradient' : ''}`}>
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                    
                    {/* 修改：底部操作栏 (复制 + 展开/收起) */}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/20">
                        <button 
                            onClick={handleCopy}
                            className="flex items-center text-xs text-white/70 hover:text-white transition-colors gap-1"
                            title="复制全文"
                        >
                            {isCopied ? <CheckIcon className="w-3.5 h-3.5"/> : <ClipboardDocumentIcon className="w-3.5 h-3.5"/>}
                            <span>{isCopied ? '已复制' : '复制'}</span>
                        </button>

                        {isLongContent && (
                            <button 
                                onClick={() => setIsExpanded(!isExpanded)}
                                className="flex items-center text-xs font-medium text-white/80 hover:text-white transition-colors"
                            >
                                {isExpanded ? (
                                    <>收起 <ChevronUpIcon className="w-3 h-3 ml-1" /></>
                                ) : (
                                    <>展开更多 <ChevronDownIcon className="w-3 h-3 ml-1" /></>
                                )}
                            </button>
                        )}
                    </div>
                </div>
             ) : (
                <div className="text-slate-800 dark:text-slate-200 text-[15px] leading-7 markdown-body">
                    <ReactMarkdown components={{ code: CodeBlock }}>{msg.content}</ReactMarkdown>
                    
                    {/* 新增：Assistant 消息底部复制按钮 */}
                    <div className="mt-2 flex items-center justify-start opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button 
                            onClick={handleCopy}
                            className="flex items-center text-xs text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors gap-1.5 px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="复制全文"
                        >
                            {isCopied ? <CheckIcon className="w-3.5 h-3.5"/> : <ClipboardDocumentIcon className="w-3.5 h-3.5"/>}
                            <span>{isCopied ? '已复制' : '复制全文'}</span>
                        </button>
                    </div>
                </div>
             )}
         </div>
      </div>
    );
};

export default MessageBubble;
