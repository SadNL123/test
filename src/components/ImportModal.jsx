import React from 'react';
import { 
    XMarkIcon, 
    DocumentTextIcon, 
    FolderIcon, 
    BeakerIcon, 
    LinkIcon, 
    CloudArrowUpIcon, 
    TrashIcon 
} from '@heroicons/react/24/outline';

const ImportModal = ({ 
    showImport, 
    setShowImport, 
    importTab, 
    setImportTab, 
    isImporting, 
    fileInputRef, 
    handleFileUpload,
    folderPath, 
    setFolderPath, 
    handleFolderLoad,
    repoUrl, 
    setRepoUrl, 
    repoBranch, 
    setRepoBranch, 
    handleGitLoad,
    webUrl, 
    setWebUrl, 
    handleWebLoad,
    sources,
    handleDeleteSource
}) => {
    if (!showImport) return null;

    const LoadingSpinner = () => <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>;

    const SourceList = () => (
        <div className="mt-8 border-t border-slate-100 dark:border-slate-700 pt-6">
            <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">已加载的知识库源 ({sources.length})</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                {sources.length === 0 && <p className="text-xs text-slate-400 italic">暂无数据源</p>}
                {sources.map(src => (
                    <div key={src.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg border border-slate-100 dark:border-slate-700 text-sm">
                        <div className="flex items-center truncate">
                            <span className={`w-2 h-2 rounded-full mr-2 ${src.type==='git'?'bg-pink-500':src.type==='folder'?'bg-indigo-500':src.type==='web'?'bg-blue-500':'bg-emerald-500'}`}></span>
                            <span className="truncate text-slate-600 dark:text-slate-300 max-w-[300px]" title={src.name}>{src.name}</span>
                            <span className="ml-2 text-xs text-slate-400 bg-slate-200 dark:bg-slate-700 px-1.5 rounded">{src.type}</span>
                            <span className="ml-2 text-xs text-slate-400">{src.count} docs</span>
                        </div>
                        <button onClick={() => handleDeleteSource(src.id)} className="text-slate-400 hover:text-red-500 p-1 transition"><TrashIcon className="w-4 h-4"/></button>
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn" onClick={() => setShowImport(false)}>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                    <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm">导入数据</h3>
                    <button onClick={() => setShowImport(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full"><XMarkIcon className="w-5 h-5 text-slate-400"/></button>
                </div>
                <div className="p-8 overflow-y-auto bg-white dark:bg-slate-800">
                    {/* Import Tabs */}
                    <div className="flex space-x-6 border-b border-slate-200 dark:border-slate-700 mb-6">
                        {[{id:'file',name:'单文件',icon:DocumentTextIcon}, {id:'folder',name:'文件夹',icon:FolderIcon}, {id:'git',name:'Git 仓库',icon:BeakerIcon}, {id:'web',name:'网页链接',icon:LinkIcon}].map(tab => (
                            <button key={tab.id} onClick={() => setImportTab(tab.id)} className={`pb-3 flex items-center space-x-2 text-sm font-medium border-b-2 transition ${importTab === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>
                                <tab.icon className="w-4 h-4"/><span>{tab.name}</span>
                            </button>
                        ))}
                    </div>
                    <div className="min-h-[100px]">
                        {importTab === 'file' && (
                            <div onClick={() => !isImporting && fileInputRef.current.click()} className={`border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl h-32 flex flex-col items-center justify-center cursor-pointer transition group ${isImporting ? 'bg-slate-100 dark:bg-slate-900 opacity-70 cursor-wait' : 'hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-slate-700'}`}>
                                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} disabled={isImporting} />
                                {isImporting ? <div className="w-8 h-8 border-4 border-indigo-300 border-t-indigo-600 rounded-full animate-spin mb-3"></div> : <CloudArrowUpIcon className="w-10 h-10 text-slate-400 group-hover:text-indigo-500 transition mb-3"/>}
                                <p className="text-sm text-slate-500 font-medium">{isImporting ? '正在处理文件...' : '点击上传 PDF, Markdown, Code'}</p>
                            </div>
                        )}
                        {importTab === 'folder' && (
                            <div className="space-y-3">
                                <div className="flex space-x-2">
                                    <input type="text" placeholder="本地文件夹路径 (例如: D:\Projects\MyCode)" value={folderPath} onChange={e => setFolderPath(e.target.value)} disabled={isImporting} className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-slate-100"/>
                                    <button onClick={handleFolderLoad} disabled={isImporting || !folderPath} className={`px-6 rounded-xl text-sm font-medium transition flex items-center ${isImporting || !folderPath ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
                                        {isImporting && <LoadingSpinner />} {isImporting ? '扫描中...' : '扫描'}
                                    </button>
                                </div>
                            </div>
                        )}
                        {importTab === 'git' && (
                            <div className="space-y-3">
                                <div className="flex space-x-2">
                                    <input type="text" placeholder="Git URL (GitHub, Gitee...)" value={repoUrl} onChange={e => setRepoUrl(e.target.value)} disabled={isImporting} className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-pink-500 outline-none disabled:bg-slate-100" />
                                    <input type="text" placeholder="Branch" value={repoBranch} onChange={e => setRepoBranch(e.target.value)} disabled={isImporting} className="w-24 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-pink-500 outline-none disabled:bg-slate-100" />
                                    <button onClick={handleGitLoad} disabled={isImporting || !repoUrl} className={`px-6 rounded-xl text-sm font-medium transition flex justify-center items-center ${isImporting || !repoUrl ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-pink-600 text-white hover:bg-pink-700'}`}>
                                        {isImporting && <LoadingSpinner />} {isImporting ? '克隆中...' : '克隆'}
                                    </button>
                                </div>
                            </div>
                        )}
                        {importTab === 'web' && (
                            <div className="space-y-3">
                                <div className="flex space-x-2">
                                    <input type="text" placeholder="网页 URL (https://...)" value={webUrl} onChange={e => setWebUrl(e.target.value)} disabled={isImporting} className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100"/>
                                    <button onClick={handleWebLoad} disabled={isImporting || !webUrl} className={`px-6 rounded-xl text-sm font-medium transition flex items-center ${isImporting || !webUrl ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                                        {isImporting && <LoadingSpinner />} {isImporting ? '分析中...' : '抓取'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                    <SourceList />
                </div>
            </div>
        </div>
    );
};

export default ImportModal;