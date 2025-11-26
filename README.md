DeepSeek RAG Pro - 本地部署指南1. 文件目录结构请确保您的文件按照以下结构存放：您的项目文件夹/
├── package.json           <-- 项目配置文件
├── README.md              <-- 本说明文件
│
├── backend/               <-- 后端文件夹
│   ├── server.py
│   └── requirements.txt
│
├── electron/              <-- Electron文件夹
│   └── main.js
│
├── public/                <-- 公共资源文件夹
│   └── index.html
│
└── src/                   <-- 前端源码文件夹
    └── App.jsx
2. 环境准备在运行之前，请确保电脑上安装了：Node.js (用于运行前端和Electron)Python (用于运行AI后端)3. 安装依赖打开终端（CMD 或 PowerShell），进入项目文件夹，依次运行：第一步：安装前端依赖npm install
注意：如果遇到网络问题，可以使用 npm install --registry=https://registry.npmmirror.com第二步：安装后端依赖pip install -r backend/requirements.txt
建议使用国内源加速：pip install -r backend/requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple4. 运行软件 (开发模式)同时启动后端和前端进行调试：npm run dev
等待片刻，Electron 窗口应该会自动弹出。5. 打包成软件 (生产模式)如果您想生成 .exe (Windows) 或 .dmg (Mac) 安装包：npm run dist
打包完成后，安装包会出现在生成的 dist 文件夹中。