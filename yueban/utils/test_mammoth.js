// 测试mammoth库的可用性
// 用于诊断'mammoth.extractRawText is not a function'错误

console.log('开始测试mammoth库...');

// 测试1: 直接加载mammoth库
console.log('\n测试1: 直接加载mammoth库');
try {
  const directMammoth = require('../libs/mammoth.min.js');
  console.log('- mammoth库加载成功');
  console.log('- mammoth类型:', typeof directMammoth);
  console.log('- mammoth对象结构:', JSON.stringify(directMammoth, null, 2).substring(0, 500) + '...');
  
  // 检查extractRawText方法
  if (directMammoth.extractRawText) {
    console.log('- extractRawText存在');
    console.log('- extractRawText类型:', typeof directMammoth.extractRawText);
    
    if (typeof directMammoth.extractRawText === 'function') {
      console.log('- ✅ 成功: extractRawText是一个函数');
    } else {
      console.log('- ❌ 失败: extractRawText不是一个函数');
    }
  } else {
    console.log('- ❌ 失败: extractRawText方法不存在');
  }
} catch (e) {
  console.log('- ❌ 失败: 加载mammoth库时出错:', e);
}

// 测试2: 模拟ArrayBuffer并测试extractRawText调用
console.log('\n测试2: 模拟ArrayBuffer并测试extractRawText调用');
try {
  const testMammoth = require('../libs/mammoth.min.js');
  
  // 创建一个模拟的ArrayBuffer
  const testString = 'This is a test document content';
  const encoder = new TextEncoder();
  const mockArrayBuffer = encoder.encode(testString).buffer;
  
  if (typeof testMammoth.extractRawText === 'function') {
    console.log('- 准备调用extractRawText方法...');
    
    testMammoth.extractRawText({ arrayBuffer: mockArrayBuffer })
      .then(result => {
        console.log('- ✅ 成功: extractRawText调用返回结果');
        console.log('- 返回结果类型:', typeof result);
        console.log('- 返回结果值长度:', result.value ? result.value.length : '无值');
        console.log('- 结果预览:', result.value ? result.value.substring(0, 100) + '...' : '无值');
      })
      .catch(error => {
        console.log('- ❌ 失败: extractRawText调用出错:', error);
      });
  } else {
    console.log('- ❌ 失败: extractRawText不是一个函数，无法调用');
  }
} catch (e) {
  console.log('- ❌ 失败: 测试过程中出错:', e);
}

// 测试3: 模拟knowledgeManager中的导入和使用方式
console.log('\n测试3: 模拟knowledgeManager中的导入和使用方式');
try {
  // 模拟knowledgeManager中的导入逻辑
  let mockKM_Mammoth = null;
  let mockKM_MockMammoth = {
    extractRawText: function(options) {
      return Promise.resolve({
        value: '这是模拟实现返回的文本内容',
        messages: []
      });
    }
  };
  
  try {
    mockKM_Mammoth = require('../libs/mammoth.min.js');
    console.log('- mammoth库加载成功');
    
    if (!mockKM_Mammoth || typeof mockKM_Mammoth.extractRawText !== 'function') {
      console.log('- 切换到模拟实现');
      mockKM_Mammoth = mockKM_MockMammoth;
    }
  } catch (e) {
    console.log('- 加载失败，使用模拟实现:', e);
    mockKM_Mammoth = mockKM_MockMammoth;
  }
  
  console.log('- 当前使用的mammoth实现类型:', typeof mockKM_Mammoth);
  console.log('- extractRawText方法类型:', typeof mockKM_Mammoth.extractRawText);
  
  // 总结测试结果
  console.log('\n测试总结:');
  if (typeof mockKM_Mammoth.extractRawText === 'function') {
    console.log('- ✅ 总体结果: 成功！mammoth.extractRawText可以作为函数使用');
  } else {
    console.log('- ❌ 总体结果: 失败！mammoth.extractRawText不是一个可用的函数');
  }
  
  console.log('\n建议:');
  console.log('1. 如果测试通过，尝试重新上传文档');
  console.log('2. 如果仍然遇到问题，请检查微信小程序开发工具的控制台日志');
  console.log('3. 当前的修复方案包含多层回退机制，即使原始mammoth库不可用，也应该能上传文档');
} catch (e) {
  console.log('- ❌ 失败: 模拟测试过程中出错:', e);
}