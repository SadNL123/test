// 辅助函数：展平文件树
export const flattenFiles = (nodes) => {
    let files = [];
    nodes.forEach(node => {
        if (node.type === 'file') {
            files.push(node);
        } else if (node.children) {
            files = files.concat(flattenFiles(node.children));
        }
    });
    return files;
};

// Token 估算器
export const estimateTokens = (text) => {
    if (!text) return 0;
    return Math.ceil(text.length * 0.7); 
};

// 正则转义函数
export const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); 
};

// 根据文件名获取 Monaco Editor 语言
export const getFileLanguage = (fileName) => {
    if (!fileName) return 'plaintext';
    const ext = fileName.split('.').pop().toLowerCase();
    const map = {
        js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
        py: 'python', html: 'html', css: 'css', json: 'json', md: 'markdown',
        java: 'java', c: 'c', cpp: 'cpp', go: 'go', rs: 'rust', sql: 'sql',
        sh: 'shell', bash: 'shell', yaml: 'yaml', yml: 'yaml', xml: 'xml',
        txt: 'plaintext', ini: 'ini', dockerfile: 'dockerfile'
    };
    return map[ext] || 'plaintext';
};