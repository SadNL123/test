import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

// === 图标导入 ===
import { 
  CpuChipIcon, 
  PencilSquareIcon, 
  Bars3Icon, 
  XMarkIcon, 
  ArrowDownTrayIcon, 
  CloudArrowUpIcon,
  SunIcon, 
  MoonIcon, 
  TrashIcon,
  PaperAirplaneIcon,
  StopCircleIcon,
  MicrophoneIcon,
  FolderIcon,
  ArrowPathIcon,
  ArrowLeftIcon,
  WrenchScrewdriverIcon,
  FunnelIcon,
  SparklesIcon,
  DocumentTextIcon,
  ClipboardDocumentIcon,
  ArrowDownTrayIcon as DownloadIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';

// === 提取的常量与工具 ===
import { API_URL, PROVIDERS, AI_TOOLS } from './lib/constants';
import { flattenFiles, estimateTokens } from './lib/utils';

// === 提取的子组件 ===
import WelcomeScreen from './components/WelcomeScreen';
import FileTreeNode from './components/FileTreeNode';
import MessageBubble from './components/MessageBubble';
import EnhancedEditor from './components/EnhancedEditor';
import CommandPalette from './components/CommandPalette';
import ImportModal from './components/ImportModal';
import SourceViewer from './components/SourceViewer';

// 如果需要使用 ReactMarkdown 渲染工具输出，保留引用
import ReactMarkdown from 'react-markdown';

const App = () => {
  // === 状态管理 ===
  //const [tokenUsage, setTokenUsage] = useState({ used: 0, limit: 32000 });
  
  // === 新增：控制 IDE 侧边栏显示 ===
  const [showIdeChat, setShowIdeChat] = useState(true);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("theme") === "dark");
  const [currentView, setCurrentView] = useState('chat'); 
  const [activeTool, setActiveTool] = useState(null); 
  
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [toolInput, setToolInput] = useState(""); 
  const [toolOutput, setToolOutput] = useState(""); 
  const [toolFile, setToolFile] = useState(null);

  // 翻译工具状态
  const [transLang, setTransLang] = useState("中文 (Chinese)");
  const [transStyle, setTransStyle] = useState("标准 (Standard)");

  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshingHistory, setIsRefreshingHistory] = useState(false); // 新增：刷新状态
  const [isImporting, setIsImporting] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [viewSource, setViewSource] = useState(null);
  const [sources, setSources] = useState([]);
  const [envKeys, setEnvKeys] = useState({});
  
  const [provider, setProvider] = useState(() => localStorage.getItem("ai_provider") || "deepseek");
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(`api_key_${localStorage.getItem("ai_provider") || "deepseek"}`) || "");
  const [baseUrl, setBaseUrl] = useState(() => localStorage.getItem("ai_base_url") || PROVIDERS["deepseek"].baseUrl);
  const [model, setModel] = useState(() => localStorage.getItem("ai_model") || "deepseek-chat");
  const [temperature, setTemperature] = useState(1.0);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [historyList, setHistoryList] = useState([]);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [showCmdPalette, setShowCmdPalette] = useState(false);
  
  const [importTab, setImportTab] = useState("file"); 
  const [ragMode, setRagMode] = useState("rag");
  const [embedModel, setEmbedModel] = useState("bge-small"); 
  const [statusMsg, setStatusMsg] = useState({ type: "", text: "" });
  const [scrollTarget, setScrollTarget] = useState('bottom');
  
  const fileInputRef = useRef(null);
  const toolFileInputRef = useRef(null);
  const searchInputRef = useRef(null);

  const [repoUrl, setRepoUrl] = useState("");
  const [repoBranch, setRepoBranch] = useState("main");
  const [folderPath, setFolderPath] = useState("");
  const [webUrl, setWebUrl] = useState("");

  // === IDE 状态 ===
  const [fileTree, setFileTree] = useState([]);
  const [activeFile, setActiveFile] = useState(null); 
  const [editorContent, setEditorContent] = useState("");
  const [projectRoot, setProjectRoot] = useState(null);
  const [fileFilter, setFileFilter] = useState(""); 
  const [globalSearchQuery, setGlobalSearchQuery] = useState(""); 
  const [globalSearchResults, setGlobalSearchResults] = useState([]);
  const [pinnedFiles, setPinnedFiles] = useState([]); 
  const [terminalOpen, setTerminalOpen] = useState(false); 
  const [terminalInput, setTerminalInput] = useState("");
  const [terminalOutput, setTerminalOutput] = useState([]);
  
  const [showMdPreview, setShowMdPreview] = useState(false);
  const [tokenUsage, setTokenUsage] = useState({ used: 0, limit: 32000 });

  // === @ 提及相关状态 ===
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(-1);

  const messagesEndRef = useRef(null);
  const lastUserMsgRef = useRef(null);
  const abortControllerRef = useRef(null); 
  const lastUserIndex = messages.map(m => m.role).lastIndexOf('user');
  const msgBufferRef = useRef(""); 
  const reasoningBufferRef = useRef(""); 
  const typingTimerRef = useRef(null); 
  const isStreamingRef = useRef(false); 
  const [isListening, setIsListening] = useState(false);

  // === Effects ===
  useEffect(() => {
      const historyTokens = estimateTokens(JSON.stringify(messages));
      const pinnedTokens = pinnedFiles.reduce((acc, f) => acc + estimateTokens(f.content), 0);
      const currentFileTokens = (currentView === 'editor' && activeFile) ? estimateTokens(editorContent) : 0;
      const total = historyTokens + pinnedTokens + currentFileTokens;
      setTokenUsage({ used: total, limit: 32000 }); 
  }, [messages, pinnedFiles, editorContent, activeFile, currentView]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  useEffect(() => { 
      if (currentView === 'chat' || currentView === 'editor') {
          if (scrollTarget === 'bottom') {
              messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); 
          } else if (scrollTarget === 'last-user') {
              setTimeout(() => {
                  lastUserMsgRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
              }, 100);
          }
      }
  }, [messages, scrollTarget, currentView]);

  useEffect(() => {
      const handleKeyDown = (e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
              e.preventDefault();
              setShowCmdPalette(prev => !prev);
          }
          if (e.key === 'Escape' && showCmdPalette) setShowCmdPalette(false);
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCmdPalette]);

  useEffect(() => { if(showCmdPalette) searchInputRef.current?.focus(); }, [showCmdPalette]);

  useEffect(() => { fetchHistory(); fetchConfigAndInit(); fetchSources(); fetchFileTree(); }, []);
  useEffect(() => { 
      if (apiKey) localStorage.setItem(`api_key_${provider}`, apiKey);
      localStorage.setItem("ai_provider", provider);
      localStorage.setItem("ai_base_url", baseUrl);
      localStorage.setItem("ai_model", model);
  }, [apiKey, provider, baseUrl, model]);

  // === Handlers ===
  const handleProviderChange = (e) => {
    const newProvider = e.target.value;
    setProvider(newProvider);
    const preset = PROVIDERS[newProvider];
    if (preset && newProvider !== "custom") {
        setBaseUrl(preset.baseUrl);
        setModel(preset.defaultModel);
    }
    const envKey = envKeys[newProvider];
    setApiKey(envKey || localStorage.getItem(`api_key_${newProvider}`) || "");
  };

  const fetchConfigAndInit = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/config`);
      const keys = res.data.keys || {};
      setEnvKeys(keys);
      setApiKey(prev => {
          const currentProvider = localStorage.getItem("ai_provider") || "deepseek";
          if (keys[currentProvider]) return keys[currentProvider];
          return prev; 
      });
    } catch (e) { console.error(e); }
  };

  const fetchSources = async () => axios.get(`${API_URL}/api/sources`).then(res => setSources(res.data)).catch(console.error);
  
  // === 优化后的历史记录获取逻辑 ===
  const fetchHistory = async () => {
      try {
          const res = await axios.get(`${API_URL}/api/history`);
          if (Array.isArray(res.data)) {
              setHistoryList(res.data);
          } else {
              setHistoryList([]);
          }
      } catch (e) {
          console.error("Fetch history error:", e);
          setStatusMsg({ type: "error", text: "获取历史记录失败" });
      }
  };

  // === 刷新历史记录按钮处理函数 ===
  const handleRefreshHistory = async () => {
      setIsRefreshingHistory(true);
      await fetchHistory();
      // 加一点延迟让动画可见，体验更好
      setTimeout(() => setIsRefreshingHistory(false), 500);
      setStatusMsg({ type: "success", text: "历史记录已刷新" });
      setTimeout(() => setStatusMsg({type:"", text:""}), 1500);
  };

  const handleDeleteSource = async (sourceId) => {
      if (!window.confirm("确定要移除这个知识库源吗？")) return;
      await axios.post(`${API_URL}/api/delete_source`, { source_id: sourceId });
      fetchSources(); setStatusMsg({ type: "success", text: "已移除" });
  };

  const handleDeleteHistory = async (e, hid) => {
      e.stopPropagation(); 
      if (!window.confirm("确定要永久删除这条对话记录吗？")) return;
      await axios.post(`${API_URL}/api/delete_history`, { session_id: hid });
      if (hid === sessionId) { setMessages([]); setSessionId(null); }
      fetchHistory(); 
  };

  const loadHistory = async (path) => {
    try {
        setStatusMsg({ type: "info", text: "正在加载..." });
        const res = await axios.post(`${API_URL}/api/load_history`, { path });
        // 增加数据校验
        if (res.data && res.data.messages) {
            setMessages(res.data.messages);
            setSessionId(res.data.session_id);
            setScrollTarget('last-user');
            setCurrentView('chat');
            setStatusMsg({ type: "", text: "" });
        } else {
            throw new Error("Invalid history data");
        }
    } catch (e) {
        console.error(e);
        setStatusMsg({ type: "error", text: "加载失败，文件可能已损坏" });
    }
  };

  const handleResetKB = async () => {
    if (!window.confirm("确定要清空当前所有已加载的知识库吗？")) return;
    await axios.post(`${API_URL}/api/reset`);
    setStatusMsg({ type: "success", text: "知识库已全部清空" });
    fetchSources();
  };

  const stopGeneration = () => {
      if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          abortControllerRef.current = null;
      }
      setIsLoading(false);
      isStreamingRef.current = false;
      if (typingTimerRef.current) clearInterval(typingTimerRef.current);
  };

  const handleNewChat = () => {
      stopGeneration();
      setMessages([]);  
      setSessionId(null); 
      setInput("");     
      setToolOutput(""); 
      setPinnedFiles([]); 
      setStatusMsg({ type: "info", text: "新对话已开始" });
      setTimeout(() => setStatusMsg({type:"", text:""}), 1500);
  };

  const handleExportChat = () => {
      if (messages.length === 0) return;
      let mdContent = `# 对话记录 (${new Date().toLocaleString()})\n\n`;
      messages.forEach(m => {
          const role = m.role === 'user' ? 'User' : 'AI';
          const content = m.content || "";
          mdContent += `## ${role}\n\n${content}\n\n`;
      });
      const blob = new Blob([mdContent], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat_export_${new Date().getTime()}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatusMsg({ type: "success", text: "对话已导出" });
  };

  const toggleVoiceInput = () => {
      if (!('webkitSpeechRecognition' in window)) {
          window.alert("当前浏览器不支持语音输入 (需要 Chrome/Edge)");
          return;
      }
      if (isListening) {
          setIsListening(false);
          return;
      }
      const recognition = new window.webkitSpeechRecognition();
      recognition.lang = 'zh-CN';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.onstart = () => { setIsListening(true); setStatusMsg({type: "info", text:"正在聆听..."}); };
      recognition.onend = () => { setIsListening(false); setStatusMsg({type:"", text:""}); };
      recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          setInput(prev => prev + transcript);
      };
      recognition.start();
  };

  const handleInputChange = (e) => {
      const val = e.target.value;
      setInput(val);
      const cursor = e.target.selectionStart;
      let lastAt = -1;
      for (let i = cursor - 1; i >= 0; i--) {
          if (val[i] === '@') {
              lastAt = i;
              break;
          }
      }
      if (lastAt !== -1) {
          const query = val.slice(lastAt + 1, cursor);
          if ((lastAt === 0 || val[lastAt - 1] === ' ' || val[lastAt - 1] === '\n') && !query.includes(' ')) {
              setMentionIndex(lastAt);
              setMentionQuery(query);
              setShowMentionList(true);
              return;
          }
      }
      setShowMentionList(false);
      setMentionIndex(-1);
      setMentionQuery("");
  };

  const handleSelectMention = (file) => {
      handlePinFile(file, { stopPropagation: () => {} }); 
      if (mentionIndex !== -1) {
          const before = input.slice(0, mentionIndex);
          const after = input.slice(mentionIndex + 1 + mentionQuery.length);
          setInput(before + after); 
      } else {
          setInput("");
      }
      setShowMentionList(false);
      setMentionIndex(-1);
  };

  const handleUnpinFile = (path) => {
      setPinnedFiles(prev => prev.filter(f => f.path !== path));
  };

  const handleImportSuccess = (info) => {
      setStatusMsg({ type: "success", text: "导入成功！" });
      fetchSources();
      setIsImporting(false);
      if (info?.type === 'folder') {
          fetchFileTree();
      }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setIsImporting(true);
    const formData = new FormData(); formData.append("file", file); formData.append("mode", ragMode); formData.append("embed_model", embedModel);
    try { await axios.post(`${API_URL}/api/upload_file`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }); handleImportSuccess({ type: 'file' }); } 
    catch (err) { setStatusMsg({ type: "error", text: err.response?.data?.detail || err.message }); setIsImporting(false); } finally { e.target.value = null; }
  };
  const handleFolderLoad = async () => {
    if (!folderPath) return; setIsImporting(true);
    try { await axios.post(`${API_URL}/api/load_folder`, { folder_path: folderPath }, { params: { mode: ragMode, embed_model: embedModel } }); handleImportSuccess({ type: 'folder' }); }
    catch (err) { setStatusMsg({ type: "error", text: err.response?.data?.detail || err.message }); setIsImporting(false); }
  };
  const handleGitLoad = async () => {
    if (!repoUrl) return; setIsImporting(true);
    try { await axios.post(`${API_URL}/api/load_git`, { repo_url: repoUrl, branch: repoBranch }, { params: { mode: ragMode, embed_model: embedModel } }); handleImportSuccess({ type: 'git' }); }
    catch (err) { setStatusMsg({ type: "error", text: err.response?.data?.detail || err.message }); setIsImporting(false); }
  };
  const handleWebLoad = async () => {
    if (!webUrl) return; setIsImporting(true);
    try { await axios.post(`${API_URL}/api/load_web`, { url: webUrl }, { params: { mode: ragMode, embed_model: embedModel } }); handleImportSuccess({ type: 'web' }); }
    catch (err) { setStatusMsg({ type: "error", text: err.response?.data?.detail || err.message }); setIsImporting(false); }
  };

  const fetchFileTree = async () => {
      try {
          const res = await axios.get(`${API_URL}/api/fs/tree`);
          setFileTree(res.data.tree || []);
          setProjectRoot(res.data.root);
      } catch (e) { console.error(e); }
  };

  const handleOpenFile = async (path) => {
      try {
          const res = await axios.post(`${API_URL}/api/fs/read`, { path });
          setActiveFile({ path, content: res.data.content });
          setEditorContent(res.data.content);
          // 重置预览状态
          setShowMdPreview(false);
      } catch (e) { setStatusMsg({ type: "error", text: "打开失败: " + e.message }); }
  };

  const handleSaveFile = async () => {
      if (!activeFile) return;
      try {
          await axios.post(`${API_URL}/api/fs/save`, { path: activeFile.path, content: editorContent });
          setStatusMsg({ type: "success", text: "文件已保存" });
          setTimeout(() => setStatusMsg({type:"", text:""}), 2000);
      } catch (e) { setStatusMsg({ type: "error", text: "保存失败: " + e.message }); }
  };

  const handleGlobalSearch = async () => {
      if (!globalSearchQuery.trim()) return;
      setStatusMsg({type: "info", text: "正在搜索..."});
      try {
          const res = await axios.post(`${API_URL}/api/fs/search`, { query: globalSearchQuery });
          setGlobalSearchResults(res.data.results);
          setStatusMsg({type: "success", text: `找到 ${res.data.results.length} 个结果`});
      } catch (e) { setStatusMsg({type: "error", text: "搜索失败"}); }
  };

  const handlePinFile = async (node, e) => {
      if (e) e.stopPropagation(); 
      if (node.type === 'folder') return;
      
      const alreadyPinned = pinnedFiles.find(f => f.path === node.path);
      
      if (alreadyPinned) {
          setPinnedFiles(prev => prev.filter(f => f.path !== node.path));
          setStatusMsg({type: "info", text: "已取消引用"});
      } else {
          try {
              const res = await axios.post(`${API_URL}/api/fs/read`, { path: node.path });
              if (!pinnedFiles.some(f => f.path === node.path)) {
                  setPinnedFiles(prev => [...prev, { path: node.path, content: res.data.content }]);
                  setStatusMsg({type: "success", text: "已加入上下文"});
              }
          } catch (e) { 
              setStatusMsg({type: "error", text: "引用失败"}); 
          }
      }
  };

  const handleRunTerminal = async () => {
      if (!terminalInput.trim()) return;
      const cmd = terminalInput;
      setTerminalInput("");
      setTerminalOutput(prev => [...prev, { type: 'command', text: `> ${cmd}` }]);
      try {
          const res = await axios.post(`${API_URL}/api/term/run`, { command: cmd });
          setTerminalOutput(prev => [...prev, { type: 'result', text: res.data.output }]);
      } catch (e) {
          setTerminalOutput(prev => [...prev, { type: 'error', text: e.message }]);
      }
  };

  const startTypingAnimation = (targetSetter) => {
      if (typingTimerRef.current) clearInterval(typingTimerRef.current);
      typingTimerRef.current = setInterval(() => {
          const hasContent = msgBufferRef.current.length > 0;
          if (hasContent) {
              const chunk = msgBufferRef.current.slice(0, 5);
              msgBufferRef.current = msgBufferRef.current.slice(5);
              targetSetter(prev => prev + chunk); 
          } else if (!isStreamingRef.current) clearInterval(typingTimerRef.current);
      }, 20); 
  };

  const handleChatSend = async () => {
    if (!input.trim() || !apiKey) return;
    if (isLoading) return;
    setScrollTarget('bottom');
    const userMsg = { role: "user", content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);
    msgBufferRef.current = "";
    reasoningBufferRef.current = "";
    isStreamingRef.current = true;
    
    stopGeneration(); 
    const controller = new AbortController(); 
    abortControllerRef.current = controller;

    if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    typingTimerRef.current = setInterval(() => {
        const hasContent = msgBufferRef.current.length > 0;
        const hasReasoning = reasoningBufferRef.current.length > 0;
        if (hasContent || hasReasoning) {
             const cChunk = msgBufferRef.current.slice(0, 5);
             msgBufferRef.current = msgBufferRef.current.slice(5);
             const rChunk = reasoningBufferRef.current.slice(0, 5);
             reasoningBufferRef.current = reasoningBufferRef.current.slice(5);
             setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last && last.role === "assistant") {
                    return [...prev.slice(0, -1), { ...last, content: last.content + cChunk, reasoning: (last.reasoning || "") + rChunk }];
                }
                if (prev.length > 0 && prev[prev.length - 1].role === "user") {
                     return [...prev, { role: "assistant", content: cChunk, reasoning: rChunk, sources: [] }];
                }
                return prev;
            });
        } else if (!isStreamingRef.current) {
            clearInterval(typingTimerRef.current);
        }
    }, 20);

    let currentSessionId = sessionId;
    if (!currentSessionId) {
        try { 
            const res = await axios.post(`${API_URL}/api/save_history`, { session_id: null, messages: newMessages }); 
            currentSessionId = res.data.session_id; 
            setSessionId(currentSessionId); 
            fetchHistory(); 
        } 
        catch (e) { setIsLoading(false); return; }
    } else {
        axios.post(`${API_URL}/api/save_history`, { session_id: currentSessionId, messages: newMessages }).catch(console.error);
    }

    const editorContext = (currentView === 'editor' && projectRoot) ? {
        path: activeFile?.path || projectRoot,
        content: editorContent || "",
        pinned_files: pinnedFiles
    } : null;

    setMessages(prev => [...prev, { role: "assistant", content: "", reasoning: "", sources: [] }]);
    
    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages, 
          api_key: apiKey, 
          model: model, 
          base_url: baseUrl, 
          temperature: temperature, 
          mode: ragMode, 
          system_instruction: systemPrompt, 
          editor_context: editorContext 
        }),
        signal: controller.signal 
      });
      
      if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value, { stream: true }).split("\n");
        for (let line of lines) {
            if (!line.trim()) continue;
            try {
                const data = JSON.parse(line);
                if (data.t === "content") msgBufferRef.current += data.d;
                else if (data.t === "reasoning") reasoningBufferRef.current += data.d;
                else if (data.t === "sources") {
                    setMessages(prev => {
                        const last = prev[prev.length - 1];
                        return [ ...prev.slice(0, -1), { ...last, sources: data.d } ];
                    });
                } else if (data.t === "error") {
                    msgBufferRef.current += `\n\n**[API 错误]**：${data.d}`;
                    isStreamingRef.current = false;
                    clearInterval(typingTimerRef.current);
                }
            } catch (e) { }
        }
      }
      isStreamingRef.current = false;
      clearInterval(typingTimerRef.current); 
      
      setMessages(prev => {
          const finalMessages = [...newMessages, { role: "assistant", content: prev[prev.length - 1].content, reasoning: prev[prev.length - 1].reasoning, sources: prev[prev.length - 1].sources }];
          axios.post(`${API_URL}/api/save_history`, { session_id: currentSessionId, messages: finalMessages }).catch(console.error);
          return finalMessages;
      });

    } catch (e) { 
        isStreamingRef.current = false; 
        clearInterval(typingTimerRef.current);
        const errorContent = `**[请求被中断或发生错误]**：${e.message}`;
        setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last && last.role === "assistant") {
                return [...prev.slice(0, -1), { ...last, content: last.content + errorContent }];
            }
            return [...prev, { role: "assistant", content: errorContent, reasoning: "", sources: [] }];
        });
    } finally { 
        setIsLoading(false); 
    }
  };

  const handleToolRun = async () => {
      if (!apiKey) return;
      if (isLoading) return;
      setToolOutput(""); setIsLoading(true); msgBufferRef.current = ""; isStreamingRef.current = true;
      
      const isVideoTool = activeTool.inputType === 'video';
      if (!isVideoTool) startTypingAnimation(setToolOutput);
      
      try {
        let response;
        if (isVideoTool) {
            if (!toolFile) throw new Error("请上传视频或音频文件");
            const fd = new FormData(); 
            fd.append("file", toolFile); 
            fd.append("api_key", apiKey); 
            fd.append("base_url", baseUrl);
            response = await axios.post(`${API_URL}/api/tool/video_subtitle`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            setToolOutput(response.data.content);
            isStreamingRef.current = false;
        } else {
            let systemInstruction = activeTool.prompt;
            if (activeTool.id === 'translate') {
                systemInstruction = `你是一个精通多国语言的资深翻译与写作专家。任务：请将用户提供的文本翻译为【${transLang}】。风格要求：【${transStyle}】。指南：1. 如果源文本已经是目标语言，请对其进行润色和优化，使其更符合目标风格。2. 保持原文的核心语意，但根据目标语言的文化习惯进行调整（信达雅）。3. 如果是代码或特定术语，请保持准确性。4. 请直接输出最终结果，不要包含“好的”、“以下是翻译”等废话。`;
            }

            const payload = JSON.stringify({ 
                messages: [{ role: "user", content: toolInput }], 
                api_key: apiKey, 
                model: model, 
                base_url: baseUrl, 
                temperature: 0.7, 
                mode: "rag", 
                system_instruction: systemInstruction
            });
            const fetchResponse = await fetch(`${API_URL}/api/chat`, { 
                method: "POST", 
                headers: { "Content-Type": "application/json" }, 
                body: payload 
            });
            if (!fetchResponse.ok) throw new Error(`HTTP error! status: ${fetchResponse.status}`);
            const reader = fetchResponse.body.getReader();
            const decoder = new TextDecoder();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const lines = decoder.decode(value, { stream: true }).split("\n");
                for (let line of lines) { 
                    if (!line.trim()) continue;
                    try { 
                        const data = JSON.parse(line); 
                        if (data.t === "content") msgBufferRef.current += data.d; 
                        else if (data.t === "error") throw new Error(`API 错误: ${data.d}`);
                    } catch(e){ } 
                }
            }
            isStreamingRef.current = false;
            clearInterval(typingTimerRef.current);
        }
      } catch (e) { 
          isStreamingRef.current = false;
          clearInterval(typingTimerRef.current);
          setToolOutput(prev => prev + `\n\n**[错误]**：${e.message}`); 
      } 
      finally { 
          setIsLoading(false); 
      }
  };
  
  const downloadSRT = () => {
      const blob = new Blob([toolOutput], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `subtitle_${new Date().getTime()}.srt`; document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url);
  };

  const LoadingSpinner = () => <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>;

  return (
    <div className={`flex h-screen bg-slate-50 dark:bg-slate-900 font-sans text-slate-800 dark:text-slate-200 overflow-hidden selection:bg-indigo-100 dark:selection:bg-indigo-900 ${darkMode ? 'dark' : ''}`}>
      
      {/* 引用来源查看器 */}
      <SourceViewer content={viewSource} onClose={() => setViewSource(null)} />

      {/* 命令面板 */}
      <CommandPalette 
          showCmdPalette={showCmdPalette} 
          setShowCmdPalette={setShowCmdPalette}
          searchInputRef={searchInputRef}
          handleNewChat={handleNewChat}
          setShowImport={setShowImport}
          setCurrentView={setCurrentView}
          handleResetKB={handleResetKB}
          handleExportChat={handleExportChat}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
      />
      
      {/* 导入模态框 */}
      <ImportModal 
          showImport={showImport}
          setShowImport={setShowImport}
          importTab={importTab}
          setImportTab={setImportTab}
          isImporting={isImporting}
          fileInputRef={fileInputRef}
          handleFileUpload={handleFileUpload}
          folderPath={folderPath}
          setFolderPath={setFolderPath}
          handleFolderLoad={handleFolderLoad}
          repoUrl={repoUrl}
          setRepoUrl={setRepoUrl}
          repoBranch={repoBranch}
          setRepoBranch={setRepoBranch}
          handleGitLoad={handleGitLoad}
          webUrl={webUrl}
          setWebUrl={setWebUrl}
          handleWebLoad={handleWebLoad}
          sources={sources}
          handleDeleteSource={handleDeleteSource}
      />

      {/* Sidebar */}
      <div className={`bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col h-full transition-all duration-300 ${showSidebar ? "w-72" : "w-0 overflow-hidden"} relative z-20`}>
        {/* Sidebar Header */}
        <div className="p-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center space-x-2 text-indigo-600 font-bold">
                <CpuChipIcon className="w-6 h-6"/>
                <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-slate-100">RAG Pro</span>
            </div>
            <button onClick={handleNewChat} className="p-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 transition" title="新建对话">
                <PencilSquareIcon className="w-5 h-5"/>
            </button>
        </div>
        
        {/* Sidebar Tabs */}
        <div className="flex px-2 py-2 space-x-1 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700">
            {['chat', 'editor', 'tools'].map(view => (
                <button 
                    key={view} 
                    onClick={() => { setCurrentView(view); if(view==='editor') fetchFileTree(); }} 
                    className={`flex-1 py-1.5 text-xs font-bold uppercase rounded-md transition ${currentView === view || (view === 'tools' && currentView === 'tool-runner') ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                >
                    {view === 'chat' ? '对话' : view === 'editor' ? 'IDE' : '工具'}
                </button>
            ))}
        </div>

        {/* Sidebar Content */}
        <div className="flex-1 overflow-y-auto p-2">
            {currentView === 'chat' && (
                <div className="space-y-1">
                    <div className="px-2 mb-4">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">系统提示词 (Persona)</label>
                        <textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} placeholder="例如：你是一个资深的 Python 工程师..." className="w-full text-xs p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none transition h-24 text-slate-600 dark:text-slate-300"/>
                    </div>
                    {/* 历史记录标题 + 刷新按钮 */}
                    <div className="px-2 mb-2 flex justify-between items-center group">
                        <span className="text-xs font-bold text-slate-400 uppercase">历史记录</span>
                        <button 
                            onClick={handleRefreshHistory} 
                            className={`p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-indigo-600 transition ${isRefreshingHistory ? 'animate-spin text-indigo-500' : ''}`}
                            title="刷新历史记录"
                        >
                            <ArrowPathIcon className="w-3.5 h-3.5"/>
                        </button>
                    </div>
                    {/* 历史记录列表 */}
                    <div className="space-y-1">
                        {!historyList || historyList.length === 0 ? (
                            <div className="text-center py-8 text-xs text-slate-400 italic bg-slate-50 dark:bg-slate-800/50 rounded-lg mx-2 border border-dashed border-slate-200 dark:border-slate-700">
                                暂无历史记录
                            </div>
                        ) : (
                            historyList.map(h => (
                                <div key={h.id} onClick={() => loadHistory(h.path)} className={`group flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition cursor-pointer mb-1 border ${sessionId === h.id ? 'bg-indigo-50 dark:bg-slate-700 border-indigo-200 dark:border-indigo-900 shadow-sm' : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                                    <div className="flex-1 flex items-center min-w-0">
                                        <span className={`w-1.5 h-1.5 rounded-full mr-2 transition-colors flex-shrink-0 ${sessionId === h.id ? 'bg-indigo-500' : 'bg-slate-300 group-hover:bg-slate-400'}`}></span>
                                        <div className="flex flex-col min-w-0"><span className={`truncate font-medium ${sessionId === h.id ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-300'}`}>{h.title}</span></div>
                                    </div>
                                    <button onClick={(e) => handleDeleteHistory(e, h.id)} className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition">
                                        <TrashIcon className="w-3.5 h-3.5"/>
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {currentView === 'editor' && (
                <div className="px-1">
                    <div className="mb-2 flex items-center border border-slate-200 dark:border-slate-700 rounded px-2 bg-white dark:bg-slate-900">
                        <FunnelIcon className="w-3 h-3 text-slate-400 mr-1"/>
                        <input type="text" placeholder="过滤文件..." value={fileFilter} onChange={e => setFileFilter(e.target.value)} className="w-full py-1 text-xs outline-none text-slate-600 dark:text-slate-300 bg-transparent placeholder:text-slate-300"/>
                    </div>
                    <div className="mb-2 px-2 text-xs font-bold text-slate-400 flex justify-between items-center">
                        <span>项目文件</span>
                        <button onClick={fetchFileTree} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition"><ArrowPathIcon className="w-3 h-3"/></button>
                    </div>
                    {projectRoot ? (
                        <div className="space-y-0.5">
                            {fileTree.map((node, i) => (
                                <FileTreeNode 
                                    key={i} 
                                    node={node} 
                                    activeFile={activeFile}
                                    fileFilter={fileFilter}
                                    pinnedFiles={pinnedFiles}
                                    handleOpenFile={handleOpenFile}
                                    handlePinFile={handlePinFile}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-10 px-4">
                            <FolderIcon className="w-10 h-10 text-slate-300 mx-auto mb-2"/>
                            <p className="text-xs text-slate-500 mb-3">未打开项目文件夹</p>
                            <button 
                                onClick={() => { setShowImport(true); setImportTab('folder'); }} 
                                className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg shadow hover:bg-indigo-700 transition"
                            >
                                打开文件夹
                            </button>
                        </div>
                    )}
                </div>
            )}

            {(currentView === 'tools' || currentView === 'tool-runner') && (
                 <div className="px-1 space-y-1">
                     <div className="mb-2 px-2 text-xs font-bold text-slate-400 uppercase">常用工具</div>
                     {AI_TOOLS.map(tool => (
                         <div key={tool.id} onClick={() => { setActiveTool(tool); setCurrentView('tool-runner'); setToolInput(''); setToolOutput(''); setToolFile(null); }} className={`px-3 py-2.5 rounded-lg cursor-pointer flex items-center text-xs transition ${activeTool?.id === tool.id ? 'bg-indigo-50 dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 font-medium' : 'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                             <tool.icon className="w-4 h-4 mr-2.5 opacity-70"/> {tool.name}
                         </div>
                     ))}
                     {currentView === 'tool-runner' && (
                         <button onClick={() => setCurrentView('tools')} className="mt-4 text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center justify-center w-full py-2">
                             <ArrowLeftIcon className="w-3 h-3 mr-1"/> 返回工具列表
                         </button>
                     )}
                 </div>
            )}
        </div>
        
        {/* 上下文 Token 用量监控条 */}
        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-700">
            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                <span>上下文使用 (估算)</span>
                <span className={tokenUsage.used > tokenUsage.limit * 0.8 ? 'text-red-500 font-bold' : ''}>{tokenUsage.used} / {tokenUsage.limit} Tokens</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                <div 
                    className={`h-1.5 rounded-full transition-all duration-500 ${tokenUsage.used > tokenUsage.limit * 0.9 ? 'bg-red-500' : tokenUsage.used > tokenUsage.limit * 0.7 ? 'bg-yellow-500' : 'bg-green-500'}`} 
                    style={{ width: `${Math.min(100, (tokenUsage.used / tokenUsage.limit) * 100)}%` }}
                ></div>
            </div>
        </div>

        {/* Sidebar Footer (Full Settings) */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
             <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">服务商 (Provider)</label>
                <select value={provider} onChange={handleProviderChange} className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs px-2 py-2 outline-none text-slate-600 dark:text-slate-300">
                    {Object.entries(PROVIDERS).map(([key, val]) => <option key={key} value={key}>{val.name}</option>)}
                </select>
             </div>
             <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Base URL</label>
                <input type="text" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none focus:border-indigo-500 transition text-slate-600 dark:text-slate-300" placeholder="https://..." />
             </div>
             <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">API Key</label>
                <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none focus:border-indigo-500 transition text-slate-600 dark:text-slate-300" placeholder="Enter API Key..." />
                {envKeys[provider] && <p className="text-[10px] text-green-600 mt-1">✅ 已自动加载环境变量</p>}
             </div>
             <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Model Name</label>
                <input type="text" value={model} onChange={e => setModel(e.target.value)} className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none focus:border-indigo-500 transition text-slate-600 dark:text-slate-300" placeholder="e.g. gpt-4" />
             </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900 relative">
        {/* Main Header */}
        <div className="h-14 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur z-10 sticky top-0">
            <div className="flex items-center">
                <button onClick={() => setShowSidebar(!showSidebar)} className="mr-4 text-slate-400 hover:text-slate-600 transition">
                    {showSidebar ? <XMarkIcon className="w-5 h-5"/> : <Bars3Icon className="w-5 h-5"/>}
                </button>
                <span className="font-semibold text-sm text-slate-700 dark:text-slate-200">
                    {currentView === 'editor' ? (activeFile ? activeFile.path.split('/').pop() : 'IDE 编辑器') : 
                     currentView === 'tool-runner' ? (activeTool ? activeTool.name : '工具箱') :
                     '智能助手'}
                </span>
                {statusMsg.text && <span className={`ml-4 text-xs px-2.5 py-0.5 rounded-full animate-fadeIn font-medium ${statusMsg.type === 'error' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>{statusMsg.text}</span>}
            </div>
            <div className="flex items-center space-x-3">
                {/* === 新增：IDE 模式下的侧边栏切换按钮 === */}
                {currentView === 'editor' && (
                    <button 
                        onClick={() => setShowIdeChat(!showIdeChat)} 
                        className={`p-2 rounded-lg transition ${showIdeChat ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500'}`} 
                        title={showIdeChat ? "隐藏 AI 助手 (以查看完整代码)" : "显示 AI 助手"}
                    >
                        <ChatBubbleLeftRightIcon className="w-5 h-5"/>
                    </button>
                )}
                <button onClick={()=>setDarkMode(!darkMode)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 transition" title="切换主题">
                    {darkMode ? <SunIcon className="w-5 h-5 text-yellow-400"/> : <MoonIcon className="w-5 h-5"/>}
                </button>
                <button onClick={handleExportChat} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 transition" title="导出对话">
                    <ArrowDownTrayIcon className="w-5 h-5"/>
                </button>
                <button onClick={() => setShowImport(!showImport)} className={`p-2 rounded-lg transition ${showImport ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500'}`} title="导入数据">
                    <CloudArrowUpIcon className="w-5 h-5"/>
                </button>
                {/* 快捷新建按钮 */}
                <button onClick={handleNewChat} className="ml-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold flex items-center hover:bg-indigo-700 transition shadow-sm">
                    <PencilSquareIcon className="w-3.5 h-3.5 mr-1.5"/>新对话
                </button>
            </div>
        </div>

        {/* Content Views */}
        <div className="flex-1 relative overflow-hidden flex flex-col">
            
            {/* === EDITOR VIEW === */}
            {currentView === 'editor' && (
                <EnhancedEditor
                    activeFile={activeFile}
                    editorContent={editorContent}
                    setEditorContent={setEditorContent}
                    showMdPreview={showMdPreview}
                    setShowMdPreview={setShowMdPreview}
                    globalSearchQuery={globalSearchQuery}
                    setGlobalSearchQuery={setGlobalSearchQuery}
                    handleGlobalSearch={handleGlobalSearch}
                    globalSearchResults={globalSearchResults}
                    setGlobalSearchResults={setGlobalSearchResults}
                    handleOpenFile={handleOpenFile}
                    handleSaveFile={handleSaveFile}
                    terminalOpen={terminalOpen}
                    setTerminalOpen={setTerminalOpen}
                    terminalInput={terminalInput}
                    setTerminalInput={setTerminalInput}
                    terminalOutput={terminalOutput}
                    handleRunTerminal={handleRunTerminal}
                    darkMode={darkMode}
                    // IDE View Pinned Files (Left side chat) need to be rendered differently here
                    // Wait, the structure is Editor Left + Chat Right. 
                    // EnhancedEditor handles the Editor part. I need to render the Chat part in App.jsx
                />
            )}

            {/* Editor Side Chat (Displayed when in editor view) */}
            {currentView === 'editor' && showIdeChat && (
                <div className="w-96 flex flex-col bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 shadow-xl z-10 absolute right-0 top-0 bottom-0 animate-fadeIn">
                    
                    {/* 标题栏：包含清空按钮和关闭按钮 */}
                    <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-900">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">AI 编程助手</span>
                        
                        <div className="flex items-center space-x-1">
                            <button onClick={handleNewChat} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-400 hover:text-indigo-600 transition" title="清空上下文">
                                <PencilSquareIcon className="w-4 h-4"/>
                            </button>
                            <button onClick={() => setShowIdeChat(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-400 hover:text-red-500 transition" title="隐藏侧边栏">
                                <XMarkIcon className="w-4 h-4"/>
                            </button>
                        </div>
                    </div>

                    {/* Pinned Files Area */}
                    {pinnedFiles.length > 0 && (
                        <div className="px-4 py-2 bg-indigo-50/50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-900">
                            <div className="flex items-center justify-between mb-1"><span className="text-[10px] font-bold text-indigo-400 uppercase">引用上下文 ({pinnedFiles.length})</span><button onClick={()=>setPinnedFiles([])} className="text-[10px] text-slate-400 hover:text-red-500">清空</button></div>
                            <div className="flex flex-wrap gap-1.5">{pinnedFiles.map((f,i)=>(<div key={i} className="flex items-center bg-white dark:bg-slate-800 border border-indigo-100 dark:border-slate-600 rounded px-1.5 py-0.5 text-[10px] text-slate-600 dark:text-slate-300 max-w-full"><span className="truncate max-w-[120px]">{f.path.split('/').pop()}</span><button onClick={()=>handleUnpinFile(f.path)} className="ml-1 hover:text-red-500"><XMarkIcon className="w-3 h-3"/></button></div>))}</div>
                        </div>
                    )}

                    {/* 聊天内容区域 */}
                    <div className="flex-1 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-800">
                        {messages.length === 0 && (
                            <div className="text-center py-10 px-6">
                                <SparklesIcon className="w-8 h-8 text-indigo-200 dark:text-indigo-700 mx-auto mb-3"/>
                                <p className="text-xs text-slate-400 leading-relaxed">针对当前打开的文件进行提问。<br/>试着问：解释这段代码 / 重构函数 X</p>
                            </div>
                        )}
                        {messages.map((m, i) => (
                            <MessageBubble 
                                key={i} 
                                msg={m} 
                                bubbleRef={i === lastUserIndex ? lastUserMsgRef : null}
                                currentView={currentView}
                                activeFile={activeFile}
                                setEditorContent={setEditorContent}
                                setStatusMsg={setStatusMsg}
                            />
                        ))}
                        <div ref={messagesEndRef}/>
                        
                        {/* @ Mention List Popover */}
                        {showMentionList && (
                            <div 
                                className="absolute bottom-16 left-4 right-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-48 overflow-y-auto z-50 animate-slideUp"
                                onMouseDown={e => e.preventDefault()}
                            >
                                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase border-b border-slate-100 dark:border-slate-700">提及文件...</div>
                                {flattenFiles(fileTree)
                                    .filter(f => !pinnedFiles.some(p => p.path === f.path) && f.name.toLowerCase().includes(mentionQuery.toLowerCase()))
                                    .map((f, i) => (
                                    <div 
                                        key={i} 
                                        onClick={() => handleSelectMention(f)} 
                                        className="px-3 py-2 hover:bg-indigo-50 dark:hover:bg-slate-700 cursor-pointer flex items-center text-xs text-slate-700 dark:text-slate-300 transition-colors"
                                    >
                                        <DocumentTextIcon className="w-3.5 h-3.5 mr-2 text-indigo-400"/>
                                        <span className="truncate">{f.name}</span>
                                        <span className="ml-auto text-[10px] text-slate-400">{f.path.split('/').slice(-2, -1)[0]}</span>
                                    </div>
                                ))}
                                {flattenFiles(fileTree).filter(f => !pinnedFiles.some(p => p.path === f.path) && f.name.toLowerCase().includes(mentionQuery.toLowerCase())).length === 0 && <div className="px-3 py-2 text-xs text-slate-400 text-center">无匹配文件或已全部引用</div>}
                            </div>
                        )}
                    </div>

                    {/* 输入框区域 */}
                    <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 relative">
                        <div className="relative">
                            <textarea 
                                value={input} 
                                onChange={handleInputChange} 
                                onKeyDown={e => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault(); handleChatSend();} }} 
                                placeholder="输入指令... (@引用文件)" 
                                className="w-full p-3 pr-16 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-xl text-sm resize-none focus:ring-2 focus:ring-indigo-500 outline-none transition shadow-sm" 
                                rows={3}
                            />
                            <div className="absolute bottom-2 right-2 flex items-center space-x-1">
                                <button onClick={toggleVoiceInput} className={`p-1.5 rounded-lg transition ${isListening ? 'bg-red-100 text-red-500 animate-pulse' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400'}`}><MicrophoneIcon className="w-4 h-4"/></button>
                                {isLoading ? (
                                    <button onClick={stopGeneration} className="p-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition"><StopCircleIcon className="w-4 h-4"/></button>
                                ) : (
                                    <button onClick={handleChatSend} className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition"><PaperAirplaneIcon className="w-4 h-4"/></button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* === CHAT VIEW === */}
            {currentView === 'chat' && (
                <div className="flex flex-col h-full animate-fadeIn">
                    <div className="flex-1 overflow-y-auto px-4 sm:px-12 py-8 scroll-smooth">
                        <div className="max-w-3xl mx-auto h-full">
                            {messages.length === 0 ? (
                                <WelcomeScreen 
                                    provider={provider} 
                                    setShowImport={setShowImport} 
                                    setImportTab={setImportTab} 
                                    setCurrentView={setCurrentView} 
                                />
                            ) : (
                                messages.map((m, i) => (
                                    <MessageBubble 
                                        key={i} 
                                        msg={m} 
                                        bubbleRef={i === lastUserIndex ? lastUserMsgRef : null}
                                        currentView={currentView}
                                        activeFile={activeFile}
                                        setEditorContent={setEditorContent}
                                        setStatusMsg={setStatusMsg}
                                    />
                                ))
                            )}
                            <div ref={messagesEndRef} />
                            <div className="h-32"/> {/* Spacer */}
                        </div>
                    </div>
                    <div className="absolute bottom-6 left-0 w-full px-4 pointer-events-none">
                        <div className="max-w-3xl mx-auto pointer-events-auto relative group">
                            <div className={`absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-3xl blur opacity-20 group-hover:opacity-30 transition duration-500 ${isLoading ? 'animate-pulse' : ''}`}></div>
                            <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 p-2 flex items-end transition-shadow duration-300">
                                <textarea 
                                    value={input} 
                                    onChange={e => setInput(e.target.value)} 
                                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSend(); } }} 
                                    placeholder="想问点什么？(Shift + Enter 换行)..." 
                                    className="w-full max-h-40 min-h-[50px] py-3 px-4 pr-24 bg-transparent border-none outline-none text-slate-700 dark:text-slate-200 placeholder:text-slate-400 resize-none text-sm" 
                                    rows={1} 
                                />
                                <div className="absolute bottom-2 right-2 flex items-center space-x-2">
                                    <button onClick={toggleVoiceInput} className={`p-2 rounded-full transition ${isListening ? 'bg-red-100 text-red-500 animate-pulse' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400'}`} title="语音输入">
                                        <MicrophoneIcon className="w-5 h-5"/>
                                    </button>
                                    <button 
                                        onClick={handleChatSend} 
                                        disabled={isLoading || !input.trim()} 
                                        className={`p-2.5 rounded-2xl transition-all duration-300 flex items-center justify-center ${isLoading || !input.trim() ? "bg-slate-100 text-slate-300" : "bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:scale-105 hover:bg-indigo-700"}`}
                                    >
                                        {isLoading ? <StopCircleIcon className="w-5 h-5" onClick={(e)=>{e.stopPropagation(); stopGeneration();}}/> : <PaperAirplaneIcon className="w-5 h-5 -rotate-45 translate-x-0.5 -translate-y-0.5" />}
                                    </button>
                                </div>
                            </div>
                            <div className="text-center mt-2"><span className="text-[10px] text-slate-300 font-medium tracking-wide">AI Generate content may be inaccurate.</span></div>
                        </div>
                    </div>
                </div>
            )}

            {/* === TOOLS VIEWS === */}
            {(currentView === 'tools' || currentView === 'tool-runner') && (
                currentView === 'tools' ? (
                    <div className="h-full overflow-y-auto p-8 animate-fadeIn">
                        <div className="max-w-4xl mx-auto">
                            <div className="flex items-center mb-8">
                                <WrenchScrewdriverIcon className="w-8 h-8 text-indigo-600 mr-3"/>
                                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">AI 生产力工具箱</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {AI_TOOLS.map(tool => (
                                    <div 
                                        key={tool.id} 
                                        onClick={()=>{setActiveTool(tool); setCurrentView('tool-runner'); setToolInput(''); setToolOutput(''); setToolFile(null);}} 
                                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 hover:shadow-lg hover:border-indigo-300 dark:hover:border-indigo-700 transition cursor-pointer group"
                                    >
                                        <div className="flex items-start justify-between mb-4">
                                            <div className={`p-3 rounded-xl ${tool.color}`}><tool.icon className="w-6 h-6"/></div>
                                            <ArrowPathIcon className="w-5 h-5 text-slate-300 opacity-0 group-hover:opacity-100 -rotate-45 group-hover:rotate-0 transition-all duration-300"/>
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">{tool.name}</h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{tool.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 animate-slideDown">
                        <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-8 py-4 flex items-center justify-between">
                            <div className="flex items-center">
                                <button onClick={() => setCurrentView('tools')} className="mr-4 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-500 transition"><ArrowLeftIcon className="w-5 h-5"/></button>
                                <div className={`p-2 rounded-lg mr-3 ${activeTool?.color}`}><activeTool.icon className="w-5 h-5"/></div>
                                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">{activeTool?.name}</h2>
                            </div>
                        </div>
                        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                            <div className="flex-1 p-6 border-r border-slate-200 dark:border-slate-700 flex flex-col">
                                {/* 翻译工具选项 */}
                                {activeTool.id === 'translate' && (
                                    <div className="flex flex-wrap gap-4 mb-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                        <div className="flex-1 min-w-[150px]">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">目标语言</label>
                                            <select 
                                                value={transLang} 
                                                onChange={e => setTransLang(e.target.value)} 
                                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition text-slate-700 dark:text-slate-200"
                                            >
                                                <option>中文 (Chinese)</option>
                                                <option>英语 (English)</option>
                                                <option>日语 (Japanese)</option>
                                                <option>韩语 (Korean)</option>
                                                <option>法语 (French)</option>
                                                <option>德语 (German)</option>
                                                <option>西班牙语 (Spanish)</option>
                                                <option>俄语 (Russian)</option>
                                            </select>
                                        </div>
                                        <div className="flex-1 min-w-[150px]">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">翻译风格</label>
                                            <select 
                                                value={transStyle} 
                                                onChange={e => setTransStyle(e.target.value)} 
                                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition text-slate-700 dark:text-slate-200"
                                            >
                                                <option>标准 (Standard)</option>
                                                <option>学术 (Academic)</option>
                                                <option>商务 (Business)</option>
                                                <option>轻松 (Casual)</option>
                                                <option>创意 (Creative)</option>
                                                <option>地道 (Authentic)</option>
                                            </select>
                                        </div>
                                    </div>
                                )}

                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">输入内容</label>
                                {activeTool.inputType === 'video' ? (
                                    <div onClick={() => { if (!isLoading) toolFileInputRef.current.click(); }} className={`flex-1 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl flex flex-col items-center justify-center cursor-pointer transition ${isLoading ? 'bg-slate-50 dark:bg-slate-800 cursor-wait' : 'hover:border-indigo-400 hover:bg-indigo-50/30 dark:hover:bg-slate-800'}`}>
                                        <input type="file" ref={toolFileInputRef} accept="video/*,audio/*" className="hidden" onChange={e => setToolFile(e.target.files[0])} disabled={isLoading}/>
                                        {toolFile ? (
                                            <div className="text-center"><VideoCameraIcon className="w-10 h-10 text-green-500 mx-auto mb-2"/><p className="text-sm font-medium text-slate-700 dark:text-slate-200">{toolFile.name}</p><p className="text-xs text-slate-400 mt-1">{(toolFile.size / 1024 / 1024).toFixed(2)} MB</p></div>
                                        ) : (
                                            <><CloudArrowUpIcon className="w-10 h-10 text-slate-300 mb-2"/><p className="text-sm text-slate-500">点击上传视频或音频文件</p><p className="text-xs text-slate-400 mt-1">支持 MP4, MP3, WAV, M4A</p></>
                                        )}
                                    </div>
                                ) : (
                                    <textarea className="flex-1 w-full bg-white dark:bg-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-sm resize-none focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm" placeholder="在此粘贴需要处理的文本..." value={toolInput} onChange={e => setToolInput(e.target.value)}/>
                                )}
                                <div className="mt-4 flex justify-end">
                                    <button onClick={handleToolRun} disabled={isLoading || (activeTool.inputType==='text' && !toolInput.trim()) || (activeTool.inputType==='video' && !toolFile)} className={`px-6 py-2.5 rounded-xl font-medium text-sm flex items-center shadow-md transition ${isLoading ? 'bg-slate-300 cursor-wait' : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg'}`}>
                                        {isLoading ? <LoadingSpinner /> : <SparklesIcon className="w-4 h-4 mr-2"/>} {isLoading ? '处理中...' : '开始生成'}
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 p-6 flex flex-col bg-white dark:bg-slate-800">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex justify-between">
                                    <span>生成结果</span>
                                    {toolOutput && (
                                        <div className="flex space-x-3">
                                            {activeTool.id === 'subtitle' && <button onClick={downloadSRT} className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center text-xs"><DownloadIcon className="w-3 h-3 mr-1"/>下载 .SRT</button>}
                                            <button onClick={() => navigator.clipboard.writeText(toolOutput)} className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center text-xs"><ClipboardDocumentIcon className="w-3 h-3 mr-1"/>复制</button>
                                        </div>
                                    )}
                                </label>
                                <div className="flex-1 w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-sm overflow-y-auto relative">
                                    {toolOutput ? (
                                        <div className="markdown-body text-slate-800 dark:text-slate-200">{activeTool.id === 'subtitle' ? <pre className="whitespace-pre-wrap font-mono text-xs text-slate-600 dark:text-slate-400">{toolOutput}</pre> : <ReactMarkdown>{toolOutput}</ReactMarkdown>}</div>
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">等待输入...</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            )}
        </div>
      </div>
    </div>
  );
};

export default App;