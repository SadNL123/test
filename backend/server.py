import os
import sys
import shutil
import tempfile
import logging
import json
import glob
import datetime
import stat
import uuid
import re
import subprocess
import traceback
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response

# RAG Libraries
from langchain_community.document_loaders import PyMuPDFLoader, TextLoader, DirectoryLoader, GitLoader, WebBaseLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_core.documents import Document
from openai import AsyncOpenAI

# === Config ===
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"
os.environ["USER_AGENT"] = "DeepSeekRAG/1.0"
logging.getLogger('tensorflow').setLevel(logging.ERROR)

# --- [路径定位逻辑] ---
# 1. 获取当前脚本(server.py)所在的绝对路径目录 (即 backend 文件夹)
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
# 2. 获取项目根目录 (backend 的父级目录)
PROJECT_ROOT_DIR = os.path.dirname(BACKEND_DIR)
# 3. chat_histories 位于项目根目录下 (与 backend 同级)
HISTORY_DIR = os.path.join(PROJECT_ROOT_DIR, "chat_histories")

if not os.path.exists(HISTORY_DIR):
    try:
        os.makedirs(HISTORY_DIR, exist_ok=True)
        print(f"Created history directory at: {HISTORY_DIR}")
    except Exception as e:
        print(f"Error creating history directory: {e}")
else:
    print(f"Using history directory at: {HISTORY_DIR}")

app = FastAPI()

# === [CORS 配置增强] ===
# 允许所有来源，特别是 localhost 和 127.0.0.1
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === Global State ===
class GlobalState:
    def __init__(self):
        self.vector_store = None
        self.full_text_cache = "" 
        self.current_model_name = None
        self.sources = {} 
        self.project_root = None 

state = GlobalState()

# === Helper Classes ===
class ChatRequest(BaseModel):
    messages: List[dict]
    api_key: str
    base_url: str
    model: str
    temperature: float
    mode: str
    system_instruction: Optional[str] = None 
    editor_context: Optional[dict] = None 

class GitRequest(BaseModel):
    repo_url: str
    branch: str = "main"

class FolderRequest(BaseModel):
    folder_path: str

class WebRequest(BaseModel):
    url: str

class DeleteRequest(BaseModel):
    source_id: str

class DeleteHistoryRequest(BaseModel):
    session_id: str

class FileReadRequest(BaseModel):
    path: str

class FileSaveRequest(BaseModel):
    path: str
    content: str

class FileSearchRequest(BaseModel):
    query: str

class FileCreateRequest(BaseModel):
    path: str
    type: str # 'file' or 'folder'

class TerminalRequest(BaseModel):
    command: str
    cwd: Optional[str] = None

class CodeEditRequest(BaseModel):
    file_path: str
    selected_text: str
    full_content: str
    instruction: str
    api_key: str
    base_url: str
    model: str

# === Helper Functions ===
def get_embedding_model(model_name):
    MODEL_MAP = {
        "minilm": "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
        "bge-small": "BAAI/bge-small-zh-v1.5", 
        "bge-large": "BAAI/bge-large-zh-v1.5", 
        "bge-m3": "BAAI/bge-m3"                
    }
    repo_id = MODEL_MAP.get(model_name, model_name)
    try:
        print(f"Loading embedding model: {repo_id} ...")
        # 强制使用 CPU，避免 GPU 环境依赖
        return HuggingFaceEmbeddings(
            model_name=repo_id,
            model_kwargs={'device': 'cpu'},
            encode_kwargs={'normalize_embeddings': True}
        )
    except Exception as e:
        print(f"Error loading embeddings: {e}")
        return None

def remove_readonly(func, path, _):
    """用于 Windows 删除 Git 仓库时解除只读权限"""
    os.chmod(path, stat.S_IWRITE)
    func(path)

def process_docs_to_vs(docs, model_name):
    if not docs:
        return None, None, None, "没有文档"
    
    # 递归字符分割器，适用于各种文档
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1200, chunk_overlap=200)
    splits = text_splitter.split_documents(docs)
    
    ids = [str(uuid.uuid4()) for _ in splits]
    
    full_text = "\n\n".join([f"【Source: {d.metadata.get('source', 'unknown')}】\n{d.page_content}" for d in docs])

    embeddings = get_embedding_model(model_name)
    if not embeddings:
        return None, None, None, "Embedding load failed"
    
    vector_store = FAISS.from_documents(splits, embeddings, ids=ids)
    return vector_store, full_text, ids, None

def update_knowledge_base(new_vs, new_text, new_ids, source_name, source_type, embed_model_name):
    source_id = str(uuid.uuid4())
    
    # 如果切换了 embedding 模型，则清空旧的 vector store
    if state.vector_store and state.current_model_name != embed_model_name:
        print(f"Embedding model changed from {state.current_model_name} to {embed_model_name}. Resetting KB.")
        state.vector_store = new_vs
        state.full_text_cache = new_text
        state.sources = {} 
    elif state.vector_store:
        # 合并新的向量库
        state.vector_store.merge_from(new_vs)
        state.full_text_cache += "\n\n" + new_text
    else:
        state.vector_store = new_vs
        state.full_text_cache = new_text
    
    state.current_model_name = embed_model_name
    
    state.sources[source_id] = {
        "id": source_id,
        "name": source_name,
        "type": source_type,
        "doc_ids": new_ids,
        "count": len(new_ids),
        "time": datetime.datetime.now().strftime("%H:%M:%S"),
        "model": embed_model_name 
    }
    return source_id

def hybrid_search(query, top_k=5, fetch_k=20):
    """向量相似度 + 关键词重排的混合检索"""
    docs_and_scores = state.vector_store.similarity_search_with_score(query, k=fetch_k)
    # 简单的关键词提取
    keywords = [w.lower() for w in re.split(r'\W+', query) if len(w) > 1]
    
    reranked = []
    for doc, score in docs_and_scores:
        content_lower = doc.page_content.lower()
        # 计算关键词命中次数
        keyword_hits = sum(1 for k in keywords if k in content_lower)
        # 调整分数：相似度分数越低越好，关键词命中越多越好，所以这里用减法
        final_score = score - (keyword_hits * 0.15) 
        reranked.append((doc, final_score))
    
    # 重新排序，取前 top_k
    reranked.sort(key=lambda x: x[1])
    
    final_docs = []
    seen_content = set()
    for doc, _ in reranked:
        if len(final_docs) >= top_k:
            break
        # 去重
        if doc.page_content not in seen_content:
            seen_content.add(doc.page_content)
            final_docs.append(doc)
            
    return final_docs

def get_dir_tree(path):
    """递归获取目录树结构，忽略常见隐藏和编译文件"""
    tree = []
    try:
        items = sorted(os.listdir(path), key=lambda x: (not os.path.isdir(os.path.join(path, x)), x))
        for item in items:
            if item.startswith(".") or item in ["__pycache__", "node_modules", "venv", "dist", "build", "coverage", ".git", ".idea", ".vscode"]:
                continue
            full_path = os.path.join(path, item)
            node = {
                "name": item,
                "path": full_path,
                "type": "folder" if os.path.isdir(full_path) else "file"
            }
            if os.path.isdir(full_path):
                node["children"] = get_dir_tree(full_path)
            tree.append(node)
    except Exception as e:
        print(f"Error reading dir {path}: {e}")
    return tree

# === API Endpoints ===

@app.get("/health")
def health_check():
    return {"status": "ok", "count": len(state.sources)}

@app.get("/api/config")
def get_config():
    """获取通过环境变量设置的 API 密钥"""
    return {
        "keys": {
            "deepseek": os.environ.get("DEEPSEEK_API_KEY", ""),
            "gemini": os.environ.get("GEMINI_API_KEY", ""),
            "openai": os.environ.get("OPENAI_API_KEY", ""),
            "siliconflow": os.environ.get("SILICONFLOW_API_KEY", ""),
            "moonshot": os.environ.get("MOONSHOT_API_KEY", ""),
            "openrouter": os.environ.get("OPENROUTER_API_KEY", "")
        }
    }

@app.get("/api/sources")
def get_sources():
    """获取当前加载的知识库源列表"""
    return list(state.sources.values())

# === IDE / FS APIs ===

@app.get("/api/fs/tree")
def fs_tree():
    """获取当前项目根目录的文件树"""
    if not state.project_root or not os.path.exists(state.project_root):
        return {"tree": [], "root": None}
    return {"tree": get_dir_tree(state.project_root), "root": state.project_root}

@app.post("/api/fs/read")
def fs_read(req: FileReadRequest):
    """读取文件内容"""
    if not os.path.exists(req.path):
        raise HTTPException(status_code=404, detail="File not found")
    try:
        # 统一使用 utf-8 编码读取，遇到错误忽略，提高健壮性
        with open(req.path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        return {"content": content, "path": req.path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cannot read file: {str(e)}")

@app.post("/api/fs/save")
def fs_save(req: FileSaveRequest):
    """保存文件内容"""
    try:
        with open(req.path, 'w', encoding='utf-8') as f:
            f.write(req.content)
        return {"status": "success", "path": req.path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/fs/create")
def fs_create(req: FileCreateRequest):
    """创建文件或文件夹"""
    if not state.project_root:
        raise HTTPException(status_code=400, detail="No project opened")
    # 简单的安全检查，防止路径遍历
    if ".." in req.path:
        raise HTTPException(status_code=400, detail="Invalid path")
    
    full_path = os.path.join(state.project_root, req.path) if not os.path.isabs(req.path) else req.path
    
    try:
        if req.type == 'folder':
            os.makedirs(full_path, exist_ok=True)
        else:
            with open(full_path, 'w', encoding='utf-8') as f:
                f.write("")
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/fs/search")
def fs_search(req: FileSearchRequest):
    """在项目文件中搜索内容"""
    if not state.project_root or not os.path.exists(state.project_root):
        return {"results": []}
    
    results = []
    query = req.query.lower()
    if not query: return {"results": []}

    ALLOWED_EXT = {".py", ".js", ".jsx", ".ts", ".tsx", ".html", ".css", ".json", ".md", ".txt", ".java", ".c", ".cpp", ".yaml", ".yml", ".sql"}
    count = 0
    MAX_RESULTS = 50 

    for root, _, files in os.walk(state.project_root):
        if ".git" in root or "node_modules" in root or "__pycache__" in root:
            continue
        for file in files:
            if count >= MAX_RESULTS: break
            ext = os.path.splitext(file)[1].lower()
            if ext in ALLOWED_EXT:
                path = os.path.join(root, file)
                try:
                    with open(path, 'r', encoding='utf-8', errors='ignore') as f: # 读取时忽略编码错误
                        content = f.read()
                        if query in content.lower():
                            idx = content.lower().find(query)
                            start = max(0, idx - 20)
                            end = min(len(content), idx + len(query) + 40)
                            snippet = content[start:end].replace("\n", " ")
                            results.append({
                                "file": file,
                                "path": path,
                                "snippet": f"...{snippet}..."
                            })
                            count += 1
                except Exception: 
                    # 忽略无法读取或权限不足的文件
                    continue 
        if count >= MAX_RESULTS: break
        
    return {"results": results}

# [New Feature] 终端命令执行
@app.post("/api/term/run")
def run_terminal_command(req: TerminalRequest):
    """在项目根目录执行终端命令"""
    # 修正 cwd 逻辑，确保 cwd 是一个有效的绝对路径
    cwd = req.cwd if req.cwd and os.path.exists(req.cwd) and os.path.isabs(req.cwd) else state.project_root
    
    if not cwd or not os.path.exists(cwd):
        return {"output": "Error: No active project directory or directory does not exist."}
    
    try:
        # 使用 shell=True 允许运行 npm, python 等命令
        # capture_output=True 捕获输出
        result = subprocess.run(
            req.command, 
            shell=True, 
            cwd=cwd, 
            capture_output=True, 
            text=True, 
            timeout=30 # 防止命令卡死
        )
        output = result.stdout
        if result.stderr:
            output += "\n[stderr]\n" + result.stderr
        
        # 检查返回码，如果非零则添加错误提示
        if result.returncode != 0:
            output += f"\nError: Command failed with exit code {result.returncode}"
            
        return {"output": output}
    except subprocess.TimeoutExpired:
        return {"output": "Error: Command timed out (30s limit)."}
    except Exception as e:
        return {"output": f"Error executing command: {str(e)}"}


# === Core APIs ===

@app.post("/api/delete_source")
def delete_source(req: DeleteRequest):
    """删除指定的知识库源"""
    sid = req.source_id
    if sid not in state.sources:
        raise HTTPException(status_code=404, detail="Source not found")
    target = state.sources[sid]
    if state.vector_store:
        try:
            # 移除向量数据库中对应的文档
            state.vector_store.delete(target["doc_ids"])
        except Exception as e:
            # 仅打印警告，不中断流程
            print(f"Vector delete warning: {e}")
    
    # 从元数据中移除
    del state.sources[sid]
    
    # 如果所有源都删除了，清理全局状态
    if not state.sources:
        state.vector_store = None
        state.full_text_cache = ""
        state.current_model_name = None
    
    return {"message": "Deleted", "remaining": len(state.sources)}

@app.post("/api/delete_history")
def delete_history(req: DeleteHistoryRequest):
    """删除指定的聊天记录文件"""
    file_name = f"chat_{req.session_id}.json"
    file_path = os.path.join(HISTORY_DIR, file_name)
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
            return {"message": "History deleted", "id": req.session_id}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    else:
        raise HTTPException(status_code=404, detail="History file not found")

@app.get("/api/history")
def get_history():
    """获取所有聊天记录列表"""
    # 确保 HISTORY_DIR 存在
    if not os.path.exists(HISTORY_DIR):
        return []
        
    # 确保扫描的是正确的 HISTORY_DIR
    files = glob.glob(os.path.join(HISTORY_DIR, "*.json"))
    files.sort(key=os.path.getmtime, reverse=True)
    res = []
    for f in files:
        try:
            with open(f, "r", encoding="utf-8") as file:
                data = json.load(file)
            file_id = os.path.basename(f).replace("chat_", "").replace(".json", "")
            # 兼容旧格式（直接存储列表）和新格式（存储对象）
            title = data.get("title", f"对话 {file_id}") if not isinstance(data, list) else f"对话 {file_id}"
            res.append({"id": file_id, "title": title, "path": f})
        except Exception as e:
            # 忽略损坏的文件
            print(f"Error reading history file {f}: {e}")
            continue 
    return res

@app.post("/api/save_history")
def save_history(data: dict):
    """保存或更新聊天记录"""
    sid = data.get("session_id")
    messages = data["messages"]
    
    # 如果没有提供 session_id，则生成一个新的
    if not sid:
        sid = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    
    # 尝试从第一条用户消息生成一个标题
    first_user_msg = next((m["content"] for m in messages if m["role"] == "user"), "新对话")
    short_summary = first_user_msg[:20].replace("\n", " ")
    if len(first_user_msg) > 20: short_summary += "..."
    date_str = datetime.datetime.now().strftime("%m-%d")
    title = f"[{date_str}] {short_summary}"

    save_data = {
        "id": sid,
        "title": title,
        "updated_at": datetime.datetime.now().isoformat(),
        "messages": messages
    }
    path = os.path.join(HISTORY_DIR, f"chat_{sid}.json")
    # 使用 utf-8 确保中文正确保存
    with open(path, "w", encoding="utf-8") as f:
        json.dump(save_data, f, ensure_ascii=False, indent=2)
    return {"session_id": sid, "title": title}

@app.post("/api/load_history")
def load_history_file(data: dict):
    """加载指定的聊天记录文件"""
    path = data.get("path")
    # 确保路径安全，防止遍历（可选增强，这里先确保基本功能）
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                content = json.load(f)
            sid = os.path.basename(path).replace("chat_", "").replace(".json", "")
            # 兼容旧格式
            if isinstance(content, list):
                return {"session_id": sid, "messages": content}
            else:
                return {"session_id": sid, "messages": content.get("messages", [])}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error loading history file: {str(e)}")
    raise HTTPException(status_code=404, detail="File not found")

@app.post("/api/reset")
def reset_kb():
    """清空所有全局知识库状态"""
    state.vector_store = None
    state.full_text_cache = ""
    state.sources = {}
    state.current_model_name = None
    state.project_root = None
    return {"message": "知识库已清空"}

@app.post("/api/upload_file")
async def upload_file(
    file: UploadFile = File(...), 
    mode: str = Form("rag"),
    embed_model: str = Form("bge-small")
):
    """上传并处理单个文件"""
    try:
        suffix = os.path.splitext(file.filename)[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        docs = []
        try:
            if suffix.lower() == ".pdf":
                loader = PyMuPDFLoader(tmp_path)
            else:
                # 使用 utf-8 编码，autodetect_encoding=True 帮助处理不同编码的文本
                loader = TextLoader(tmp_path, encoding="utf-8", autodetect_encoding=True)
            
            docs = loader.load()
            for d in docs: d.metadata["source"] = file.filename
        finally:
            if os.path.exists(tmp_path): os.remove(tmp_path)

        vs, txt, ids, err = process_docs_to_vs(docs, embed_model)
        if err: raise HTTPException(status_code=500, detail=err)

        update_knowledge_base(vs, txt, ids, file.filename, "file", embed_model)
        return {"message": "Success", "count": len(docs)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/load_git")
def load_git(req: GitRequest, mode: str = "rag", embed_model: str = "bge-small"):
    """从 Git 仓库克隆并加载文档"""
    if not shutil.which("git"):
         raise HTTPException(status_code=500, detail="系统未检测到 Git，请安装 Git 客户端。")
    
    # 创建临时目录
    temp_dir = tempfile.mkdtemp()
    
    try:
        loader = GitLoader(
            repo_path=temp_dir, 
            clone_url=req.repo_url,
            branch=req.branch,
            # 过滤文件类型，只保留代码和文档
            file_filter=lambda x: x.endswith((".py", ".js", ".md", ".txt", ".json", ".java", ".c", ".cpp", ".h", ".css", ".html", ".ts", ".tsx", ".go", ".rs"))
        )
        docs = loader.load()
        vs, txt, ids, err = process_docs_to_vs(docs, embed_model)
        if err: raise HTTPException(status_code=500, detail=err)
        
        repo_name = req.repo_url.split('/')[-1].replace(".git", "")
        update_knowledge_base(vs, txt, ids, repo_name, "git", embed_model)
        
        return {"message": "Success", "count": len(docs)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # 清理临时目录，使用 onerror 处理 Windows 的只读文件问题
        if os.path.exists(temp_dir): 
            try:
                shutil.rmtree(temp_dir, onerror=remove_readonly)
            except Exception as e:
                print(f"Error cleaning up temporary directory {temp_dir}: {e}")

@app.post("/api/load_folder")
def load_folder(req: FolderRequest, mode: str = "rag", embed_model: str = "bge-small"):
    """加载本地文件夹中的文档"""
    # 确保路径存在且是一个文件夹
    if not os.path.exists(req.folder_path):
        raise HTTPException(status_code=404, detail="文件夹路径不存在")
    if not os.path.isdir(req.folder_path):
        raise HTTPException(status_code=400, detail="路径不是一个文件夹")
    
    # [IDE Feature] 设置当前项目根目录
    state.project_root = req.folder_path
    
    docs = []
    SUPPORTED_EXT = {".py", ".js", ".md", ".txt", ".json", ".java", ".c", ".cpp", ".h", ".css", ".html", ".ts", ".tsx", ".go", ".rs", ".yaml", ".yml"}
    try:
        for root, _, files in os.walk(req.folder_path):
            # 忽略常见的不需要 RAG 的文件夹
            if ".git" in root or "node_modules" in root or "__pycache__" in root:
                continue
            for file in files:
                ext = os.path.splitext(file)[1].lower()
                if ext in SUPPORTED_EXT:
                    file_path = os.path.join(root, file)
                    try:
                        # 使用 autodetect_encoding=True 增加健壮性
                        loader = TextLoader(file_path, encoding="utf-8", autodetect_encoding=True, errors='ignore')
                        loaded = loader.load()
                        for d in loaded:
                            d.metadata["source"] = os.path.relpath(file_path, req.folder_path)
                        docs.extend(loaded)
                    except Exception as e:
                        # 忽略单个文件加载失败的错误
                        print(f"Skipping file {file_path} due to load error: {e}")
                        continue
        
        if docs:
            vs, txt, ids, err = process_docs_to_vs(docs, embed_model)
            if not err:
                folder_name = os.path.basename(os.path.normpath(req.folder_path))
                update_knowledge_base(vs, txt, ids, folder_name, "folder", embed_model)
        
        return {"message": "Success", "count": len(docs)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/load_web")
def load_web(req: WebRequest, mode: str = "rag", embed_model: str = "bge-small"):
    """抓取网页内容并加载"""
    try:
        # WebBaseLoader 通常能处理大部分网页内容
        loader = WebBaseLoader(req.url)
        docs = loader.load()
        vs, txt, ids, err = process_docs_to_vs(docs, embed_model)
        if err: raise HTTPException(status_code=500, detail=err)
        update_knowledge_base(vs, txt, ids, req.url, "web", embed_model)
        return {"message": "Success", "count": len(docs)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"网页抓取失败: {str(e)}")

@app.post("/api/tool/video_subtitle")
async def tool_video_subtitle(
    file: UploadFile = File(...),
    api_key: str = Form(...),
    base_url: str = Form(...)
):
    """使用 Whisper API 进行视频/音频转录"""
    # 临时文件应该放在 tempfile.mkstemp() 创建的安全位置
    fd, temp_path = tempfile.mkstemp(suffix=os.path.splitext(file.filename)[1])
    os.close(fd) # 关闭文件描述符

    try:
        # 将上传的文件内容写入临时文件
        with open(temp_path, "wb") as buffer:
            # 异步读取文件内容并写入，效率更高
            content = await file.read()
            buffer.write(content)
            
        client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        
        # 重新打开文件进行转录
        with open(temp_path, "rb") as audio_file:
            transcript = await client.audio.transcriptions.create(
                model="whisper-1", 
                file=audio_file,
                response_format="srt" # 请求 SRT 格式带时间轴
            )
        return {"content": transcript}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"转录失败: {str(e)}")
    finally:
        # 确保临时文件被删除
        if os.path.exists(temp_path):
            os.remove(temp_path)

@app.post("/api/chat")
async def chat_endpoint(req: ChatRequest):
    """核心聊天接口，处理 RAG 和流式输出"""
    # 基础身份设置
    base_identity = (
        "你是一个专业的代码助手和知识库专家。请务必使用中文回答。\n"
        "请使用清晰的 Markdown 格式（标题前需换行）。\n"
        """
        并且:
        1. **深度思考**：在回答复杂问题前，先在内心进行一步步的逻辑推理。
        2. **结构清晰**：回答必须层次分明。
        3. 如果用户的问题通过代码解决更佳，请主动提供代码。
        """
    )
    custom_instruction = f"\n\n【用户特别指令/人设】:\n{req.system_instruction}\n" if req.system_instruction else ""

    context_str = ""
    sources = []
    docs_ready = False
    
    # [IDE Feature] 上下文（当前文件和 pinned 文件）
    if req.editor_context:
        file_path = req.editor_context.get("path", "Unknown")
        file_content = req.editor_context.get("content", "")
        pinned_files = req.editor_context.get("pinned_files", [])
        
        # 文件内容过大截断（保留头部和尾部）
        if len(file_content) > 30000:
            head = file_content[:15000]
            tail = file_content[-15000:]
            file_content = f"{head}\n\n...(文件过长，已截断 {len(file_content)-30000} 字符)...\n\n{tail}"
            
        # 拼接到 System Prompt 中
        pinned_content = ""
        for p_file in pinned_files:
             # 确保 pinned file 不是当前文件，避免重复
             if p_file['path'] != file_path: 
                 # 对 pinned file 的内容也进行截断，避免 context 过长
                 p_content = p_file['content']
                 if len(p_content) > 5000:
                     p_content = p_content[:2500] + "\n...(文件过长，已截断)...\n" + p_content[-2500:]
                 pinned_content += f"\n\n【引用文件: {p_file['path']}】\n{p_content}\n"

        base_identity += (
            f"\n\n【当前编辑器状态】\n"
            f"你正在协助用户编辑文件：`{file_path}`\n"
            f"以下是该文件的当前内容：\n\n```\n{file_content}\n```\n"
            f"{pinned_content}\n"
            "重要指令：如果用户要求修改代码，请务必输出一段完整的、可直接替换的代码块。不要只输出差异，方便用户直接复制应用。"
        )

    # RAG 检索逻辑 (注意：这里是阻塞的，可能会导致流式输出前的延迟)
    header_context = ""
    if state.full_text_cache:
        header_context = f"\n\n【文档开头预览 (Title/Abstract)】:\n{state.full_text_cache[:600]}\n...\n"
    
    # 模式选择：全文检索 (full_context) 或 向量检索 (rag)
    if req.mode == "full_context" and state.full_text_cache:
        context_str = f"\n\n【参考文档全文】:\n{state.full_text_cache[:80000]}" 
        docs_ready = True
    # 如果是 rag 模式，或者用户明确在 IDE 模式下要求搜索（输入包含“搜索”或“找”）
    elif state.vector_store and (req.mode == "rag" or (req.editor_context and any(k in req.messages[-1]['content'] for k in ["搜索", "找", "检索", "RAG"]))): 
        try:
            user_query = req.messages[-1]['content']
            docs = hybrid_search(user_query, top_k=6, fetch_k=20)
            rag_content = "\n".join([d.page_content for d in docs])
            context_str = header_context + "\n\n【检索到的相关片段】:\n" + rag_content
            sources = [d.metadata.get('source', 'Unknown Source') for d in docs]
            docs_ready = True
        except Exception as e:
            # 向量库为空或搜索失败时，安静地跳过 RAG，只用系统身份
            print(f"Search error: {e}")

    # 构造最终的 System Prompt
    final_system_prompt = base_identity + custom_instruction
    if docs_ready and not req.editor_context: # 在聊天模式下，将 RAG 结果注入系统提示词
        final_system_prompt += f"\n\n请根据以下参考文档回答问题：\n{context_str}"
    
    # 构造 API 请求消息体
    api_messages = [{"role": "system", "content": final_system_prompt}]
    for m in req.messages:
        # 仅追加用户消息，避免将 AI 的历史回复也作为用户消息发送
        if m["role"] == "user": 
            api_messages.append({"role": m["role"], "content": m["content"]})
        elif m["role"] == "assistant" and m.get("content"):
             api_messages.append({"role": m["role"], "content": m["content"]})
    
    # 初始化 OpenAI 兼容客户端
    client = AsyncOpenAI(api_key=req.api_key, base_url=req.base_url)

    async def generate():
        """流式生成器函数"""
        try:
            print(f"Requesting LLM: Model={req.model}, BaseURL={req.base_url}")
            # 调用 LLM API
            stream = await client.chat.completions.create(
                model=req.model,
                messages=api_messages,
                temperature=req.temperature,
                stream=True
            )
            print("Stream started successfully.")
            
            # 先发送 RAG 来源信息
            if sources: yield json.dumps({"t": "sources", "d": sources}) + "\n"
            
            # 流式处理响应
            async for chunk in stream:
                delta = chunk.choices[0].delta
                
                # DeepSeek 等模型可能会返回推理内容 (reasoning_content)
                if hasattr(delta, 'reasoning_content') and delta.reasoning_content:
                    yield json.dumps({"t": "reasoning", "d": delta.reasoning_content}) + "\n"
                
                # 核心文本内容
                if hasattr(delta, 'content') and delta.content:
                    yield json.dumps({"t": "content", "d": delta.content}) + "\n"
                    
        except Exception as e:
            # 捕获异常并以 JSON 格式返回错误信息
            err_msg = str(e)
            print(f"LLM API Error: {err_msg}")
            traceback.print_exc() 
            yield json.dumps({"t": "error", "d": f"后端 API 调用失败: {err_msg}"}) + "\n"

    # === [关键修复] 添加 Headers 禁止缓存，确保流式输出不被缓冲 ===
    return StreamingResponse(
        generate(), 
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no" # 针对 Nginx 等代理的特殊头
        }
    )

@app.post("/api/code/edit")
async def code_edit_endpoint(req: CodeEditRequest):
    """
    Cursor 风格的代码编辑接口
    """
    client = AsyncOpenAI(api_key=req.api_key, base_url=req.base_url)
    
    # 构造 Prompt，模拟 FIM (Fill-In-Middle) 或 Edit 模式
    system_prompt = (
        "你是一个智能代码编辑器助手。你的任务是根据用户的指令修改代码。\n"
        "只输出修改后的代码片段，不要包含 Markdown 代码块标记（如 ```python），不要包含解释性文字。\n"
        "如果用户没有选中文本，请在当前位置插入代码。\n"
        "如果用户选中了文本，请用新代码替换选中的文本。"
    )
    
    user_prompt = (
        f"【当前文件路径】: {req.file_path}\n"
        f"【完整代码上下文】:\n{req.full_content}\n\n"
        f"【用户选中的代码】:\n{req.selected_text}\n\n"
        f"【修改指令】: {req.instruction}\n\n"
        "请输出替换【用户选中的代码】部分的新代码："
    )

    try:
        response = await client.chat.completions.create(
            model=req.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.2, # 代码生成需要较低的温度
            stream=False # 这里简化处理，直接返回结果，也可以改为流式
        )
        
        new_code = response.choices[0].message.content
        # 清理可能存在的 Markdown 标记
        new_code = new_code.replace("```" + req.file_path.split('.')[-1], "").replace("```", "").strip()
        
        return {"new_code": new_code}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
if __name__ == "__main__":
    import uvicorn
    # === [关键修改] 显式绑定 127.0.0.1 避免 0.0.0.0 被防火墙拦截或 localhost 解析错误 ===
    print("启动后端服务: [http://127.0.0.1:8000](http://127.0.0.1:8000)")
    uvicorn.run(app, host="127.0.0.1", port=8000)
