try {
  console.log('开始检查relationship_information.js的语法...');
  const fs = require('fs');
  const path = require('path');
  
  const filePath = path.join(__dirname, 'pages', 'relationship_information', 'relationship_information.js');
  const fileContent = fs.readFileSync(filePath, 'utf8');
  
  // 移除页面的配置和其他非JS代码，只保留JS逻辑部分
  // 提取Page({ ... })里面的内容
  const pageMatch = fileContent.match(/Page\s*\(\s*\{([\s\S]*?)\}\s*\)/);
  
  if (pageMatch && pageMatch[1]) {
    // 模拟小程序环境中的全局对象
    global.AV = {
      Query: class MockQuery {
        constructor() {}
        get() { return Promise.resolve({ get: () => {} }); }
        find() { return Promise.resolve([]); }
        first() { return Promise.resolve(null); }
        descending() { return this; }
        limit() { return this; }
        where() { return this; }
        static equalTo() {}
        static exists() {}
        static or() {}
      }
    };
    
    global.wx = {
      showLoading: () => {},
      hideLoading: () => {},
      showToast: () => {}
    };
    
    // 创建一个模拟的Page对象
    const mockPage = {};
    
    // 执行提取的JS代码，检查语法
    new Function(pageMatch[1])(mockPage);
    
    console.log('语法检查通过！relationship_information.js没有语法错误。');
  } else {
    console.error('无法提取Page对象内容，请检查文件格式。');
  }
} catch (error) {
  console.error('语法错误:', error.message);
}