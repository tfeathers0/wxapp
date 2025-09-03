// 引入全局app实例
const app = getApp();

Page({
  data: {
    agentInput: '',
    agentMessages: [],
    conversationId: '',
    chatId: '',
    loading: false,
    isFirstLoad: true,
    scrollToView: ''
  },

  // 生命周期函数-页面加载
  onLoad() {
    // 页面加载时可以初始化一些数据或进行权限检查
    console.log('智能体页面加载完成');
  },



  // 设置输入内容
  setAgentInput(e) {
    this.setData({
      agentInput: e.detail.value
    });
  },

  // 滚动到底部
  scrollToBottom() {
    setTimeout(() => {
      const { agentMessages } = this.data;
      if (agentMessages.length > 0) {
        const lastIndex = agentMessages.length - 1;
        this.setData({
          scrollToView: `message-${lastIndex}`
        });
      }
    }, 100);
  },

  // 发送智能体请求
  sendAgentRequest() {
    const { agentInput } = this.data;
    if (!agentInput.trim()) {
      wx.showToast({
        title: '请输入您的问题',
        icon: 'none'
      });
      return;
    }

    // 添加用户消息到聊天记录
    this.setData({
      agentMessages: [...this.data.agentMessages, { role: 'user', content: agentInput }],
      agentInput: '',
      loading: true
    });

    // 发送消息后滚动到底部
    this.scrollToBottom();

    // 获取必要的配置信息
    const userId = app.globalData.userOpenid || `temp_${Date.now()}`;
    const botId = '7545307104631570473';
    const token = app.globalData.cozeAgentToken;
    
    console.log('使用用户ID:', userId);
    console.log('使用机器人ID:', botId);
    console.log('Token是否存在:', !!token);

    if (!token) {
      this.setData({
        loading: false,
        agentMessages: [...this.data.agentMessages, {
          role: 'assistant',
          content: '获取Token失败，请重新登录后再试。'
        }]
      });
      // 显示错误消息后滚动到底部
      this.scrollToBottom();
      return;
    }

    // 调用智能体API
    wx.request({
      // 修复API端点，根据Coze API文档更新为正确的路径
      url: 'https://api.coze.cn/open_api/v2/chat',
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      data: {
        bot_id: botId,
        user: userId,
        query: agentInput,
        conversation_id: this.data.conversationId || undefined,
        chat_id: this.data.chatId || undefined
      },
      success: (res) => {
        console.log('智能体响应:', res.data);
        
        // 检查响应状态码
        if (res.statusCode !== 200) {
          console.error('API返回非成功状态码:', res.statusCode);
          this.handleApiError(`API错误 (状态码: ${res.statusCode})`, res.data);
          return;
        }
        
        // 健壮的request_id获取逻辑
        let requestId = null;
        if (res.data && res.data.request_id) {
          requestId = res.data.request_id;
        } else if (res.data && res.data.data && res.data.data.request_id) {
          requestId = res.data.data.request_id;
        } else if (res.data && res.data.id) {
          requestId = res.data.id;
        }
        
        if (requestId) {
          this.getAgentMessage(requestId);
        } else {
          // 如果没有request_id，尝试直接处理响应数据
          console.log('未找到request_id，尝试直接处理响应');
          this.handleResponseWithoutRequestId(res.data);
        }
      },
      fail: (err) => {
        console.error('发送请求失败:', err);
        this.handleApiError(`网络请求失败: ${err.errMsg || '未知错误'}`);
      }
    });
  },
  
  // 统一处理API错误
  handleApiError(errorMessage, errorData = null) {
    this.setData({
      loading: false,
      agentMessages: [...this.data.agentMessages, {
        role: 'assistant',
        content: `${errorMessage}\n\n建议：\n1. 检查网络连接\n2. 确认Token有效\n3. 稍后再试\n\n${errorData ? '详细信息: ' + JSON.stringify(errorData).substring(0, 200) + '...' : ''}`
      }]
    });
    // 显示错误消息后滚动到底部
    this.scrollToBottom();
  },
  
  // 无request_id时直接处理响应
  handleResponseWithoutRequestId(data) {
    try {
      console.log('直接处理响应数据:', data);
      
      // 尝试从响应中提取有意义的回复
      const validReply = this.findAndExtractMeaningfulReply(data);
      console.log('直接提取的有效回复:', validReply);
      
      // 更新会话ID和聊天ID（如果有）
      if (data && data.conversation_id) {
        this.setData({
          conversationId: data.conversation_id,
          chatId: data.chat_id
        });
      } else if (data && data.data && data.data.conversation_id) {
        this.setData({
          conversationId: data.data.conversation_id,
          chatId: data.data.chat_id
        });
      }
      
      if (validReply && validReply.trim()) {
        // 显示提取的回复
        this.setData({
          loading: false,
          agentMessages: [...this.data.agentMessages, {
            role: 'assistant',
            content: validReply
          }]
        });
        // 显示回复后滚动到底部
        this.scrollToBottom();
      } else {
        // 未能提取到有效回复
        this.setData({
          loading: false,
          agentMessages: [...this.data.agentMessages, {
            role: 'assistant',
            content: '未能获取到智能体回复，请稍后再试。' + 
                     (data ? '\n\n响应状态: ' + JSON.stringify(data).substring(0, 200) + '...' : '')
          }]
        });
        // 显示消息后滚动到底部
        this.scrollToBottom();
      }
    } catch (e) {
      console.error('处理响应数据时出错:', e);
      this.setData({
        loading: false,
        agentMessages: [...this.data.agentMessages, {
          role: 'assistant',
          content: '处理响应时发生错误: ' + (e.message || '未知错误')
        }]
      });
      // 显示错误消息后滚动到底部
      this.scrollToBottom();
    }
  },

  // 获取智能体回复
  getAgentMessage(requestId) {
    console.log('获取消息ID:', requestId);
    
    if (!requestId) {
      console.error('请求ID为空');
      this.setData({
        loading: false,
        agentMessages: [...this.data.agentMessages, {
          role: 'assistant',
          content: '获取回复失败: 请求ID为空'
        }]
      });
      // 显示错误消息后滚动到底部
      this.scrollToBottom();
      return;
    }

    const token = app.globalData.cozeAgentToken;
    if (!token) {
      this.setData({
        loading: false,
        agentMessages: [...this.data.agentMessages, {
          role: 'assistant',
          content: '获取Token失败，请重新登录后再试。'
        }]
      });
      // 显示错误消息后滚动到底部
      this.scrollToBottom();
      return;
    }

    // 发送请求获取消息
    wx.request({
      // 更新消息检索API端点
      url: `https://api.coze.cn/v3/chat/completions/${requestId}`,
      method: 'GET',
      header: {
        'Authorization': `Bearer ${token}`
      },
      success: (res) => {
        console.log('获取消息成功:', res.data);
        
        // 检查响应状态码
        if (res.statusCode !== 200) {
          console.error('消息检索API返回非成功状态码:', res.statusCode);
          this.handleApiError(`获取消息失败 (状态码: ${res.statusCode})`, res.data);
          return;
        }
        
        // 提取有效回复
        const validReply = this.findAndExtractMeaningfulReply(res.data);
        console.log('提取的有效回复:', validReply);
        
        // 更新会话ID和聊天ID
        if (res.data.data && res.data.data.conversation_id) {
          this.setData({
            conversationId: res.data.data.conversation_id,
            chatId: res.data.data.chat_id
          });
        }
        
        if (validReply && this.isValidChineseContent(validReply)) {
          // 成功提取到有效回复
          console.log('显示有效回复');
          this.setData({
            loading: false,
            agentMessages: [...this.data.agentMessages, {
              role: 'assistant',
              content: validReply
            }]
          });
          // 显示回复后滚动到底部
          this.scrollToBottom();
        } else {
          // 未能提取到有效回复，尝试使用备用方法
          console.error('未能提取到有效回复，尝试备用方法');
          const rawContent = this.extractRawTextFromResponse(res.data);
          
          if (rawContent && rawContent.trim()) {
            this.setData({
              loading: false,
              agentMessages: [...this.data.agentMessages, {
                role: 'assistant',
                content: rawContent
              }]
            });
          } else {
            this.setData({
              loading: false,
              agentMessages: [...this.data.agentMessages, {
                role: 'assistant',
                content: '未能提取到有效回复，请稍后再试。\n\n如有需要，请联系技术支持。'
              }]
            });
          }
          // 显示消息后滚动到底部
          this.scrollToBottom();
        }
      },
      fail: (err) => {
        console.error('获取消息请求失败:', err);
        this.setData({
          loading: false,
          agentMessages: [...this.data.agentMessages, {
            role: 'assistant',
            content: `获取回复失败: ${err.errMsg || '未知错误'}`
          }]
        });
        // 显示错误消息后滚动到底部
        this.scrollToBottom();
      }
    });
  },

  // 查找并提取有意义的回复
  findAndExtractMeaningfulReply(data) {
    if (!data) return '';
    
    try {
      console.log('开始提取有意义的回复');
      
      // 1. 首先尝试从messages数组中提取
      if (data.messages && Array.isArray(data.messages)) {
        // 使用标准for循环替换for...of循环
        for (let i = 0; i < data.messages.length; i++) {
          const message = data.messages[i];
          
          // 跳过function_call和tool_response类型的消息，避免显示搜索结果
          if (message.type === 'function_call' || message.type === 'tool_response') {
            console.log('跳过function_call或tool_response类型的消息');
            continue;
          }
          
          const content = this.getContentFromMessage(message);
          if (content && this.isValidChineseContent(content)) {
            console.log('从消息列表提取到有效回复');
            return content;
          }
        }
      }
      
      // 2. 尝试从data对象中提取
      const dataContent = this.extractContentFromData(data);
      if (dataContent) {
        console.log('从数据对象提取到有效回复');
        return dataContent;
      }
      
      // 3. 尝试从整个响应中提取
      const responseContent = this.extractMeaningfulContentFromResponse(data);
      if (responseContent) {
        console.log('从响应中提取到有效回复');
        return responseContent;
      }
      
      // 4. 如果以上方法都失败，返回友好提示而不是JSON字符串
      return '未能提取到完整回复，请尝试用更明确的问题提问。';
    } catch (e) {
      console.error('提取有意义回复时出错:', e);
      return '';
    }
  },
  
  // 从数据对象中提取内容
  extractContentFromData(data) {
    if (!data) return '';
    
    // 尝试从常见的回复字段中提取
    const contentFields = ['answer', 'reply', 'content', 'result', 'output', 'message', 'response'];
    
    // 使用标准for循环替换for...of循环
    for (let i = 0; i < contentFields.length; i++) {
      const field = contentFields[i];
      if (data[field]) {
        const content = typeof data[field] === 'string' 
          ? data[field] 
          : JSON.stringify(data[field]);
        
        if (content && this.isValidChineseContent(content)) {
          return content;
        }
      }
    }
    
    return '';
  },

  // 从消息中获取内容
  getContentFromMessage(message) {
    if (!message || !message.content) return '';
    
    // 如果content是字符串，直接返回
    if (typeof message.content === 'string') {
      return message.content;
    }
    
    // 如果content是对象，尝试从各个字段中提取
    if (typeof message.content === 'object') {
      // 处理嵌套的JSON字符串
      if (typeof message.content === 'string' && message.content.startsWith('{') && message.content.endsWith('}')) {
        try {
          const parsed = JSON.parse(message.content);
          return this.getContentFromMessage({content: parsed});
        } catch (e) {
          console.error('解析嵌套JSON失败:', e);
        }
      }
      
      if (message.content.text) {
        return message.content.text;
      }
      if (message.content.answer) {
        return message.content.answer;
      }
      if (message.content.content) {
        return message.content.content;
      }
      if (message.content.result) {
        return message.content.result;
      }
      if (message.content.output) {
        return message.content.output;
      }
      // 检查是否有搜索结果相关的字段，跳过这些内容
      if (message.content.search_result || message.content.search || message.content.url) {
        console.log('检测到搜索结果相关内容，跳过');
        return '';
      }
    }
    
    // 如果都不行，尝试转换为JSON字符串但不直接返回
    try {
      const jsonStr = JSON.stringify(message.content);
      // 检查是否包含搜索结果相关关键词
      if (jsonStr.includes('search') || jsonStr.includes('plugin') || jsonStr.includes('url')) {
        console.log('JSON字符串中包含搜索结果相关关键词，跳过');
        return '';
      }
      return this.cleanNestedJson(jsonStr);
    } catch (e) {
      console.error('转换消息内容为字符串失败:', e);
      return '';
    }
  },
  
  // 清理嵌套的JSON字符串，提取有用信息
  cleanNestedJson(jsonStr) {
    try {
      // 尝试解析JSON
      const parsed = JSON.parse(jsonStr);
      
      // 如果是对象，递归处理
      if (typeof parsed === 'object' && parsed !== null) {
        // 检查是否包含答案相关字段
        if (parsed.answer || parsed.reply || parsed.content || parsed.result || parsed.output) {
          return this.getContentFromMessage({content: parsed});
        }
        
        // 如果包含摘要信息，返回摘要
        if (parsed.summary) {
          return parsed.summary;
        }
        
        // 处理数组
        if (Array.isArray(parsed)) {
          const contents = [];
          for (let i = 0; i < parsed.length; i++) {
            const item = parsed[i];
            const content = this.getContentFromMessage({content: item});
            if (content) {
              contents.push(content);
            }
          }
          return contents.join('\n\n');
        }
      }
      
      return jsonStr;
    } catch (e) {
      console.error('清理嵌套JSON失败:', e);
      return jsonStr;
    }
  },
  
  // 提取原始文本作为后备方案
  extractRawTextFromResponse(responseData) {
    try {
      if (!responseData) return '';
      
      // 尝试直接从data字段获取
      if (responseData.data && typeof responseData.data === 'string') {
        return responseData.data;
      }
      
      // 尝试从messages数组中获取原始内容
      if (responseData.data && responseData.data.messages && Array.isArray(responseData.data.messages)) {
        // 使用标准for循环替换for...of循环
        for (let i = 0; i < responseData.data.messages.length; i++) {
          const msg = responseData.data.messages[i];
          
          // 跳过function_call和tool_response类型的消息
          if (msg.type === 'function_call' || msg.type === 'tool_response') {
            continue;
          }
          
          if (msg.content && typeof msg.content === 'string') {
            return msg.content;
          }
          if (msg.content && typeof msg.content === 'object') {
            // 尝试获取文本内容而不是直接返回JSON
            const textContent = this.getContentFromMessage(msg);
            if (textContent && textContent.length > 10 && !this.isTokenOrId(textContent)) {
              return textContent;
            }
          }
        }
      }
      
      // 最后的后备方案，返回简单的友好提示
      return '智能体已收到您的问题，但暂时无法提供格式化回复。请稍后再试。';
    } catch (e) {
      console.error('提取原始文本失败:', e);
      return '获取回复时发生错误，请稍后再试。';
    }
  },
  
  // 从整个响应中提取有意义的内容
  extractMeaningfulContentFromResponse(responseData) {
    if (!responseData) return '';
    
    try {
      const responseStr = JSON.stringify(responseData);
      const cleanedStr = this.cleanText(responseStr);
      
      // 尝试提取可能包含中文内容的部分
      const chineseContent = this.extractChineseParagraphs(cleanedStr);
      if (chineseContent && chineseContent.length > 0) {
        return chineseContent.join('\n\n');
      }
      
      return '';
    } catch (e) {
      console.error('提取内容失败:', e);
      return '';
    }
  },
  
  // 判断是否为有效的中文内容
  isValidChineseContent(text) {
    if (!text || typeof text !== 'string') return false;
    
    // 去除空白字符
    const trimmed = text.trim();
    
    // 检查文本长度
    if (trimmed.length < 5) {
      console.log('文本长度不足:', trimmed.length);
      return false;
    }
    
    // 计算中文字符数量
    const chineseRegex = /[\u4e00-\u9fa5]/g;
    const chineseMatches = trimmed.match(chineseRegex);
    const chineseCount = chineseMatches ? chineseMatches.length : 0;
    
    console.log('中文字符数量:', chineseCount);
    
    // 检查中文字符比例
    if (chineseCount < 5) {
      console.log('中文字符数量不足5个');
      return false;
    }
    
    // 检查是否包含合理的标点符号
    const punctuationRegex = /[，。！？：；,.!?;:]/;
    if (!punctuationRegex.test(trimmed)) {
      console.log('缺少合理的标点符号');
      return false;
    }
    
    return true;
  },
  
  // 检查文本是否为token或ID等无意义字符串
  isTokenOrId(text) {
    if (!text || typeof text !== 'string') return false;
    
    // 检查是否是纯数字或数字字符串
    if (/^\d+$/.test(text)) {
      return true;
    }
    
    // 检查是否是由字母、数字和特殊字符组成的长字符串（可能是token）
    if (text.length > 20 && /^[a-zA-Z0-9-_]+$/.test(text)) {
      return true;
    }
    
    // 检查是否包含大量连续的相同字符
    if (/(.+)\1{5,}/.test(text)) {
      return true;
    }
    
    // 检查是否是base64编码或类似格式
    if (/^[a-zA-Z0-9+/=]{20,}$/.test(text)) {
      return true;
    }
    
    return false;
  },
  
  // 清理文本内容
  cleanText(text) {
    if (!text || typeof text !== 'string') return '';
    
    try {
      // 去除多余的空格和换行符
      let cleaned = text.replace(/\s+/g, ' ');
      
      // 去除JSON格式的特殊字符，但保留中文内容
      cleaned = cleaned.replace(/"|\{|\}|\[|\]|\\|:/g, ' ');
      
      // 去除重复的标点符号
      cleaned = cleaned.replace(/([，。！？：；,.!?;:])\1+/g, '$1');
      
      // 去除首尾空白字符
      cleaned = cleaned.trim();
      
      return cleaned;
    } catch (e) {
      console.error('清理文本失败:', e);
      return text;
    }
  },
  
  // 提取中文段落
  extractChineseParagraphs(text) {
    if (!text || typeof text !== 'string') return [];
    
    try {
      // 分割文本为可能的段落
      const segments = text.split(/[.,!?;:，。！？：；\s]+/);
      const chineseParagraphs = [];
      
      // 使用标准for循环替换for...of循环
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i].trim();
        
        // 检查段落是否包含足够的中文字符
        if (segment.length > 10) {
          const chineseRegex = /[\u4e00-\u9fa5]/g;
          const chineseMatches = segment.match(chineseRegex);
          const chineseCount = chineseMatches ? chineseMatches.length : 0;
          
          // 如果中文字符数量超过总长度的30%，则认为是中文段落
          if (chineseCount > segment.length * 0.3) {
            chineseParagraphs.push(segment);
          }
        }
      }
      
      return chineseParagraphs;
    } catch (e) {
      console.error('提取中文段落失败:', e);
      return [];
    }
  }
});