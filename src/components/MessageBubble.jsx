import React from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  SparklesIcon, 
  ClipboardDocumentIcon, 
  ArrowDownCircleIcon 
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
      <div ref={bubbleRef} className={`flex w-full mb-6 ${isUser ? 'justify-end' : ''} animate-fadeIn`}>
         {!isUser && (
            <div className="flex-shrink-0 mr-4 mt-1">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-sm">
                    <SparklesIcon className="w-5 h-5"/>
                </div>
            </div>
         )}
         <div className={`relative max-w-[90%] ${isUser ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-5 py-3.5' : 'flex-1 min-w-0'}`}>
             {msg.reasoning && (
                <div className="mb-3 bg-slate-50 dark:bg-slate-800 border-l-2 border-indigo-200 dark:border-indigo-900 pl-4 py-2 pr-4 rounded-r-lg text-xs text-slate-600 dark:text-slate-400 font-mono leading-relaxed whitespace-pre-wrap">
                    {msg.reasoning}
                </div>
             )}
             {isUser ? (
                <div className="text-white text-[15px] leading-7 markdown-body">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
             ) : (
                <div className="text-slate-800 dark:text-slate-200 text-[15px] leading-7 markdown-body">
                    <ReactMarkdown components={{ code: CodeBlock }}>{msg.content}</ReactMarkdown>
                </div>
             )}
         </div>
      </div>
    );
};

export default MessageBubble;