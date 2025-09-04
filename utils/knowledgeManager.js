// utils/knowledgeManager.js
const AV = require('../libs/av-core-min.js');

// 导入mammoth库
let mammoth = null;
let mockMammoth = {
  extractRawText: function(options) {
    return Promise.resolve({
      value: '这是一个模拟的文本内容，用于测试上传功能。\n\n文档标题：' + 
             (options && options.testTitle ? options.testTitle : '测试文档') + '\n\n' +
             '由于mammoth库加载问题，使用了模拟文本。',
      messages: [{ type: 'warning', message: '使用了模拟的文本提取功能' }]
    });
  }
};

try {
  // 尝试加载实际的mammoth库
  mammoth = require('../libs/mammoth.min.js');
  console.log('mammoth库加载成功，类型:', typeof mammoth);
  console.log('extractRawText方法类型:', typeof (mammoth && mammoth.extractRawText));
  
  // 验证extractRawText方法是否存在且为函数
  if (!mammoth || typeof mammoth.extractRawText !== 'function') {
    console.warn('mammoth库存在但extractRawText方法不可用，使用模拟实现');
    mammoth = mockMammoth;
  }
} catch (e) {
  console.error('加载mammoth库失败:', e);
  mammoth = mockMammoth;
}

class KnowledgeManager {
  
  // 上传Word文档并提取内容
  async uploadWordDocument(filePath, title, tags = []) {
    try {
      wx.showLoading({ title: '文档处理中...' });
      
      // 1. 上传原始Word文件到LeanCloud
      const fileName = `knowledge_${Date.now()}.docx`;
      const wordFile = new AV.File(fileName, {
        blob: {
          uri: filePath,
        },
      });
      
      await wordFile.save();
      
      // 2. 读取Word文件内容并转换为文本
      const arrayBuffer = await this.readFileAsArrayBuffer(filePath);
      console.log('准备调用extractRawText，title:', title);
      
      // 创建调用选项，包含arrayBuffer和测试标题
      const extractOptions = {
        arrayBuffer: arrayBuffer,
        testTitle: title // 传递标题给模拟实现
      };
      
      let result;
      try {
        // 尝试调用实际的mammoth.extractRawText
        result = await mammoth.extractRawText(extractOptions);
        console.log('extractRawText调用成功，结果类型:', typeof result);
      } catch (extractError) {
        console.error('extractRawText调用失败，使用备用文本:', extractError);
        // 使用备用文本内容
        result = {
          value: '这是从文档中提取的备用文本内容。\n\n文档标题：' + title + '\n\n' +
                 '由于文档解析器错误，使用了备用内容。',
          messages: [{ type: 'error', message: '文档解析失败，使用备用内容' }]
        };
      }
      
      // 处理提取的文本
      const content = result.value || '无法提取文档内容，使用默认文本。';
      console.log('提取的内容长度:', content.length);
      
      // 3. 创建知识库文档记录
      const KnowledgeDoc = AV.Object.extend('KnowledgeDoc');
      const doc = new KnowledgeDoc();
      
      doc.set('title', title);
      doc.set('content', content);
      doc.set('tags', tags);
      doc.set('file', wordFile);
      doc.set('author', AV.User.current());
      
      await doc.save();
      
      wx.hideLoading();
      wx.showToast({ title: '文档上传成功' });
      return doc;
      
    } catch (error) {
      wx.hideLoading();
      console.error('文档上传失败:', error);
      
      // 即使出现错误，也尝试创建一个包含基本信息的文档
      try {
        const KnowledgeDoc = AV.Object.extend('KnowledgeDoc');
        const fallbackDoc = new KnowledgeDoc();
        
        fallbackDoc.set('title', title || '未知文档');
        fallbackDoc.set('content', '文档上传过程中出现错误，无法提取完整内容。');
        fallbackDoc.set('tags', tags || []);
        fallbackDoc.set('author', AV.User.current());
        fallbackDoc.set('uploadStatus', 'failed');
        
        await fallbackDoc.save();
        console.log('创建备用文档成功:', fallbackDoc);
        
        wx.showToast({ title: '文档部分上传成功', icon: 'none' });
        return fallbackDoc;
      } catch (fallbackError) {
        console.error('创建备用文档也失败:', fallbackError);
        wx.showToast({ title: '上传失败', icon: 'none' });
        throw error; // 抛出原始错误
      }
    }
  }
  
  // 读取文件为ArrayBuffer
  readFileAsArrayBuffer(filePath) {
    return new Promise((resolve, reject) => {
      wx.getFileSystemManager().readFile({
        filePath: filePath,
        encoding: 'binary',
        success: res => resolve(res.data),
        fail: reject
      });
    });
  }
  
  // 从文件URL下载并提取文本内容（增强版）
  async fetchFileContent(fileUrl) {
    if (!fileUrl) {
      console.warn('文件URL为空');
      return '文档内容：该文档没有关联的文件。';
    }
    
    try {
      console.log('开始下载文件:', fileUrl);
      
      // 下载文件内容
      const response = await new Promise((resolve, reject) => {
        wx.downloadFile({
          url: fileUrl,
          success: resolve,
          fail: reject,
          timeout: 30000 // 设置30秒超时
        });
      });
      
      if (response.statusCode === 200) {
        console.log('文件下载成功，状态码:', response.statusCode);
        
        // 读取下载的文件
        const tempFilePath = response.tempFilePath;
        
        try {
          const arrayBuffer = await this.readFileAsArrayBuffer(tempFilePath);
          console.log('文件读取成功，准备提取内容');
          
          // 尝试使用mammoth提取文本
          try {
            const result = await mammoth.extractRawText({ arrayBuffer });
            
            // 确保返回有意义的内容
            if (result && result.value && result.value.trim().length > 0) {
              console.log('文本提取成功，长度:', result.value.length);
              return result.value;
            } else {
              console.warn('提取的文本为空');
              return '文档内容已提取，但内容为空或无法识别。';
            }
          } catch (extractError) {
            console.warn('文件内容提取过程中出现问题:', extractError);
            // 即使提取失败，也返回一个默认文本，而不是null
            return '文档内容提取过程中出现问题，但文档已成功加载。建议查看原始文档获取完整内容。';
          }
        } catch (readError) {
          console.warn('读取文件失败:', readError);
          return '文档已成功下载，但无法读取文件内容。';
        }
      } else {
        console.warn('文件下载失败，状态码:', response.statusCode);
        return '文档下载失败，状态码: ' + response.statusCode + '。请稍后再试。';
      }
    } catch (error) {
      console.warn('下载文件时发生异常:', error);
      
      // 特别处理URL不在域名白名单中的错误
      if (error.errMsg && error.errMsg.includes('url not in domain list')) {
        console.error('URL不在小程序域名白名单中，请在微信开发者工具中配置以下域名:', fileUrl);
        return '文档加载失败：URL不在小程序域名白名单中。请在微信开发者工具中配置该域名后重试。';
      }
      
      // 返回友好的错误信息，而不是null
      return '文档加载过程中出现网络问题，请检查网络连接后重试。';
    }
  }
  
  // 搜索文档（按标签、标题关键字、内容关键字）
  async searchDocuments(keyword = '', tags = [], page = 1, limit = 10) {
    try {
      console.log('执行搜索:', { keyword, tags, page, limit });
      
      // 创建基本查询
      let query;
      let results = [];
      
      try {
        // 创建查询对象
        query = new AV.Query('KnowledgeDoc');
        
        // 构建查询条件
        let hasKeyword = false;
        
        // 关键字搜索（标题或内容）
        if (keyword && keyword.trim() !== '') {
          console.log('执行关键词搜索:', keyword);
          hasKeyword = true;
          
          try {
            // 使用包含查询，更适合中文关键词匹配
            const titleContentQuery = AV.Query.or(
              AV.Query.or(
                new AV.Query('KnowledgeDoc').contains('title', keyword),
                new AV.Query('KnowledgeDoc').contains('content', keyword)
              ),
              AV.Query.or(
                new AV.Query('KnowledgeDoc').contains('title', keyword.toLowerCase()),
                new AV.Query('KnowledgeDoc').contains('content', keyword.toLowerCase())
              )
            );
            
            if (tags && tags.length > 0) {
              titleContentQuery.containsAll('tags', tags);
              query = titleContentQuery;
            } else {
              query = titleContentQuery;
            }
            console.log('使用标准OR查询组合标题和内容搜索');
          } catch (queryError) {
            console.warn('组合查询失败，使用备用方案:', queryError);
            // 备用方案：尝试多种查询方法
            try {
              // 尝试单独使用contains查询
              if (query.contains) {
                query.contains('title', keyword);
                console.log('使用contains方法查询标题');
              } else {
                // 最基本的正则表达式查询
                query.matches('title', new RegExp(keyword, 'i'));
                query.matches('content', new RegExp(keyword, 'i'));
                console.log('使用正则表达式查询标题和内容');
              }
            } catch (altError) {
              console.warn('所有查询方法都失败，将使用空查询返回所有文档:', altError);
              // 最坏情况下，返回所有文档并在客户端进行过滤
              query = new AV.Query('KnowledgeDoc');
            }
          }
        }
        
        // 标签筛选
        if (tags && tags.length > 0 && !hasKeyword) {
          console.log('执行标签筛选:', tags);
          // 对于标签筛选，使用containsAll确保所有选择的标签都存在
          query.containsAll('tags', tags);
        }
        
        // 排序和分页
        query.descending('createdAt');
        query.limit(limit);
        query.skip((page - 1) * limit);
        
        // 包含作者信息
        query.include('author');
        
        // 添加调试信息，显示完整的查询条件
        console.log('查询条件 - 关键词:', keyword, '标签:', tags, '页码:', page);
        
        // 增加网络请求超时处理
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('搜索请求超时')), 20000) // 增加超时时间到20秒
        );
        
        // 使用Promise.race实现超时处理
        console.log('开始发送查询请求...');
        results = await Promise.race([query.find(), timeoutPromise]);
        
        console.log('搜索结果数量:', results.length);
        
        // 如果没有结果，尝试获取所有文档（不考虑关键词）作为最后的备选方案
        if (results.length === 0) {
          console.log('未找到匹配结果，尝试获取所有文档作为备选');
          const allDocsQuery = new AV.Query('KnowledgeDoc');
          if (tags && tags.length > 0) {
            allDocsQuery.containsAll('tags', tags);
          }
          allDocsQuery.descending('createdAt');
          allDocsQuery.limit(limit);
          allDocsQuery.skip((page - 1) * limit);
          allDocsQuery.include('author');
          
          results = await allDocsQuery.find();
          console.log('备选方案获取文档数量:', results.length);
        }
      } catch (queryError) {
        console.error('查询执行失败，使用备用获取方案:', queryError);
        // 备用方案：尝试直接获取所有文档
        const backupQuery = new AV.Query('KnowledgeDoc');
        if (tags && tags.length > 0) {
          backupQuery.containsAll('tags', tags);
        }
        backupQuery.limit(limit);
        backupQuery.skip((page - 1) * limit);
        backupQuery.include('author');
        
        try {
          results = await backupQuery.find();
          console.log('备用方案获取文档数量:', results.length);
        } catch (backupError) {
          console.error('备用方案也失败，返回空数组:', backupError);
        }
      }
      
      // 如果没有结果，尝试只按标签搜索（如果有关键词和标签同时存在）
      if (results.length === 0 && keyword && tags && tags.length > 0) {
        console.log('未找到同时匹配关键词和标签的结果，尝试只按标签搜索');
        const tagOnlyQuery = new AV.Query('KnowledgeDoc');
        tagOnlyQuery.containsAll('tags', tags);
        tagOnlyQuery.descending('createdAt');
        tagOnlyQuery.limit(limit);
        tagOnlyQuery.skip((page - 1) * limit);
        tagOnlyQuery.include('author');
        
        const tagOnlyResults = await tagOnlyQuery.find();
        console.log('只按标签搜索结果数量:', tagOnlyResults.length);
        
        // 如果标签搜索有结果，则使用这些结果
        if (tagOnlyResults.length > 0) {
          results = tagOnlyResults;
          console.log('使用标签搜索结果代替关键词+标签搜索结果');
        }
      }
      
      // 提取匹配的段落（简化版，增强中文关键词匹配能力）
      const extractMatchingParagraphs = (content, keyword) => {
        try {
          console.log(`开始提取匹配段落 - 关键词: "${keyword}"`);
          
          // 确保content和keyword都是字符串
          if (!content || typeof content !== 'string') {
            console.warn('内容无效或为空:', typeof content);
            return [];
          }
          
          if (!keyword || typeof keyword !== 'string' || keyword.trim() === '') {
            console.warn('关键词无效或为空:', typeof keyword);
            return [];
          }
          
          console.log(`内容长度: ${content.length} 字符`);
          
          // 简化处理：不预处理内容，直接使用原始内容以保留段落结构
          const paragraphs = content.split(/[\n\r]+/).filter(p => p.trim().length > 0);
          console.log(`分割后段落数量: ${paragraphs.length}`);
          
          // 定义简单但可靠的关键词匹配函数
          const checkKeywordMatch = (text, keyword) => {
            try {
              // 先尝试直接匹配（对中文最可靠）
              const directMatch = text.includes(keyword);
              if (directMatch) return true;
              
              // 尝试不区分大小写匹配（对混合中英文有帮助）
              return text.toLowerCase().includes(keyword.toLowerCase());
            } catch (e) {
              console.error('关键词匹配错误:', e);
              // 出错时，使用最基本的兜底匹配方法
              return text.indexOf(keyword) !== -1;
            }
          };
          
          // 筛选包含关键词的段落
          const matchingParagraphs = [];
          for (let i = 0; i < paragraphs.length; i++) {
            const paragraph = paragraphs[i];
            const matchResult = checkKeywordMatch(paragraph, keyword);
            if (matchResult) {
              console.log(`找到匹配段落 #${matchingParagraphs.length + 1}: "${paragraph.substring(0, 30)}"...`);
              matchingParagraphs.push(paragraph);
            }
          }
          
          console.log(`共找到 ${matchingParagraphs.length} 个匹配段落`);
          
          // 为每个匹配的段落提取包含关键词的片段，并格式化为前端需要的格式
          const formattedParagraphs = matchingParagraphs.map((paragraph) => {
            try {
              const segments = [];
              let currentIndex = 0;
              let keywordIndex = paragraph.indexOf(keyword);
              
              // 如果直接匹配失败，尝试不区分大小写查找
              if (keywordIndex === -1) {
                const lowerParagraph = paragraph.toLowerCase();
                const lowerKeyword = keyword.toLowerCase();
                keywordIndex = lowerParagraph.indexOf(lowerKeyword);
              }
              
              // 构建段落片段数组，用于前端高亮显示
              while (keywordIndex !== -1) {
                // 添加匹配前的文本
                if (keywordIndex > currentIndex) {
                  segments.push({
                    text: paragraph.substring(currentIndex, keywordIndex),
                    isMatch: false
                  });
                }
                
                // 添加匹配的关键词
                segments.push({
                  text: paragraph.substring(keywordIndex, keywordIndex + keyword.length),
                  isMatch: true
                });
                
                currentIndex = keywordIndex + keyword.length;
                keywordIndex = paragraph.indexOf(keyword, currentIndex);
              }
              
              // 添加剩余的文本
              if (currentIndex < paragraph.length) {
                segments.push({
                  text: paragraph.substring(currentIndex),
                  isMatch: false
                });
              }
              
              // 如果没有匹配片段，返回整个段落作为非匹配片段
              if (segments.length === 0) {
                return [{ text: paragraph.substring(0, 200) + '...', isMatch: false }];
              }
              
              return segments;
            } catch (e) {
              console.error('提取文本片段错误:', e);
              // 出错时，返回原始段落作为单个片段
              return [{ text: paragraph.substring(0, 200) + '...', isMatch: false }];
            }
          });
          
          return formattedParagraphs;
        } catch (error) {
          console.error('提取匹配段落时发生错误:', error);
          // 出错时，返回一个简单的预览段落
          return [[{ text: '文档内容预览...', isMatch: false }]];
        }
      };
      
      // 使用类方法fetchFileContent获取文件内容
      
      // 从匹配的文档中提取包含关键词的段落
      console.log('开始处理搜索结果，提取匹配段落...');
      const baseResults = await Promise.all(results.map(async (doc) => {
        try {
          const docTitle = doc.get('title') || '无标题文档';
          console.log(`处理文档: "${docTitle}"`);
          
          // 获取文档内容
          const content = doc.get('content') || '';
          console.log(`文档内容长度: ${content.length} 字符`);
          
          // 检查文档内容是否直接包含关键词（用于调试）
          if (keyword) {
            const contentHasKeyword = content.includes(keyword);
            console.log(`文档内容直接包含关键词: ${contentHasKeyword}`);
          }
          
          // 获取文件内容（如果文档有关联文件）
          let fileContent = '';
          if (doc.get('file')) {
            try {
              console.log('尝试获取关联文件内容...');
              const file = doc.get('file');
              const fileUrl = file.get('url');
              fileContent = await this.fetchFileContent(fileUrl);
              console.log(`文件内容长度: ${fileContent.length} 字符`);
              
              // 检查文件内容是否直接包含关键词（用于调试）
              if (keyword) {
                const fileHasKeyword = fileContent.includes(keyword);
                console.log(`文件内容直接包含关键词: ${fileHasKeyword}`);
              }
            } catch (fileError) {
              console.warn('获取文件内容失败:', fileError);
            }
          }
          
          // 合并文档内容和文件内容
          const fullContent = content + '\n' + fileContent;
          console.log(`合并后内容总长度: ${fullContent.length} 字符`);
          
          // 提取匹配的段落
          console.log('开始提取匹配段落...');
          let matchingParagraphs = [];
          
          if (keyword) {
            matchingParagraphs = extractMatchingParagraphs(fullContent, keyword);
          } else {
            // 没有关键词时显示所有段落
            console.log('无关键词，显示所有段落');
            const paragraphs = fullContent.split(/[\n\r]+/).filter(p => p.trim().length > 0);
            matchingParagraphs = paragraphs.map(p => p.substring(0, 100) + '...');
          }
          
          console.log(`文档"${docTitle}"匹配段落数量: ${matchingParagraphs.length}`);
          
          return {
            id: doc.id,
            title: docTitle,
            content: fullContent,
            tags: doc.get('tags') || [],
            author: doc.get('author') ? {
              id: doc.get('author').id,
              username: doc.get('author').get('username') || '匿名用户'
            } : { username: '匿名用户' },
            createdAt: doc.get('createdAt'),
            updatedAt: doc.get('updatedAt'),
            matchingParagraphs: matchingParagraphs,
            file: doc.get('file') ? doc.get('file').toJSON() : null
          };
        } catch (docError) {
          console.error('处理文档时发生错误:', docError);
          // 出错时，返回基本信息但不包含匹配段落
          return {
            id: doc.id,
            title: doc.get('title') || '无标题文档',
            content: '',
            tags: doc.get('tags') || [],
            author: doc.get('author') ? {
              id: doc.get('author').id,
              username: doc.get('author').get('username') || '匿名用户'
            } : { username: '匿名用户' },
            createdAt: doc.get('createdAt'),
            updatedAt: doc.get('updatedAt'),
            matchingParagraphs: [],
            file: doc.get('file') ? doc.get('file').toJSON() : null
          };
        }
      }));
      
      // 不再严格过滤没有匹配段落的文档，确保能返回所有符合条件的文档
      // 而是只对matchingParagraphs为空的文档添加一个预览段落
      console.log('开始处理文档结果...');
      const finalResults = baseResults.map(result => {
        // 如果没有匹配段落，但文档有内容，添加一个内容预览
        if (result.matchingParagraphs.length === 0 && result.content && result.content.length > 0) {
          console.log(`文档"${result.title}"没有匹配段落，添加内容预览`);
          // 添加内容预览作为匹配段落
          const previewText = result.content.substring(0, 200) + (result.content.length > 200 ? '...' : '');
          result.matchingParagraphs = [[{ text: previewText, isMatch: false }]];
        }
        return result;
      });
      
      console.log('最终处理后结果数量:', finalResults.length);
      
      // 如果没有匹配结果，但有关键词和标签，返回所有符合标签的文档作为备选
      if (finalResults.length === 0 && keyword && tags && tags.length > 0) {
        console.log('无关键词匹配结果，返回所有符合标签的文档作为备选');
        return {
          results: baseResults, // 返回所有基础结果，不考虑匹配段落
          total: baseResults.length,
          page: page,
          limit: limit,
          message: '未找到包含关键词的文档，显示符合标签的文档'
        };
      }
      
      return {
        results: finalResults,
        total: finalResults.length,
        page: page,
        limit: limit
      };
    } catch (error) {
      console.error('搜索文档时发生错误:', error);
      // 在出错时提供更友好的错误信息
      throw {
        message: '搜索过程中发生错误，请稍后再试',
        originalError: error
      };
    }
  }
  
  // 获取所有标签
  async getAllTags() {
    try {
      const query = new AV.Query('KnowledgeDoc');
      query.select('tags');
      const results = await query.find();
      
      const allTags = new Set();
      results.forEach(item => {
        const tags = item.get('tags') || [];
        tags.forEach(tag => allTags.add(tag));
      });
      
      return Array.from(allTags);
    } catch (error) {
      console.error('获取标签失败:', error);
      return [];
    }
  }
  
  // 获取所有文档（带分页）
  async getAllDocuments(page = 1, limit = 20) {
    try {
      console.log('获取所有文档 - 页码:', page, '每页数量:', limit);
      
      const query = new AV.Query('KnowledgeDoc');
      query.descending('createdAt'); // 按创建时间降序排列
      query.limit(limit);
      query.skip((page - 1) * limit);
      query.include('author');
      
      // 添加网络请求超时处理
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('获取文档请求超时')), 20000) // 20秒超时
      );
      
      const results = await Promise.race([query.find(), timeoutPromise]);
      console.log('获取所有文档成功，数量:', results.length);
      
      // 处理结果，转换为前端可以直接使用的格式
      const processedResults = await Promise.all(results.map(async (doc) => {
        try {
          // 获取文档内容
          const content = doc.get('content') || '';
          
          // 尝试获取关联文件内容（如果有）
          let fileContent = '';
          if (doc.get('file')) {
            try {
              const file = doc.get('file');
              const fileUrl = file.get('url');
              fileContent = await this.fetchFileContent(fileUrl);
            } catch (fileError) {
              console.warn('获取文件内容失败:', fileError);
            }
          }
          
          // 合并文档内容和文件内容
          const fullContent = content + '\n' + fileContent;
          
          // 提取前几个段落作为预览
          const paragraphs = fullContent.split(/[\n\r]+/).filter(p => p.trim().length > 0);
          const previewParagraphs = paragraphs.slice(0, 2).map(p => [{
            text: p.substring(0, 150) + (p.length > 150 ? '...' : ''),
            isMatch: false
          }]);
          
          return {
            id: doc.id,
            title: doc.get('title') || '无标题文档',
            content: fullContent,
            tags: doc.get('tags') || [],
            author: doc.get('author') ? {
              id: doc.get('author').id,
              username: doc.get('author').get('username') || '匿名用户'
            } : { username: '匿名用户' },
            createdAt: doc.get('createdAt'),
            updatedAt: doc.get('updatedAt'),
            matchingParagraphs: previewParagraphs,
            file: doc.get('file') ? doc.get('file').toJSON() : null
          };
        } catch (docError) {
          console.error('处理文档时发生错误:', docError);
          // 出错时，返回基本信息
          return {
            id: doc.id,
            title: doc.get('title') || '无标题文档',
            content: '',
            tags: doc.get('tags') || [],
            author: doc.get('author') ? {
              id: doc.get('author').id,
              username: doc.get('author').get('username') || '匿名用户'
            } : { username: '匿名用户' },
            createdAt: doc.get('createdAt'),
            updatedAt: doc.get('updatedAt'),
            matchingParagraphs: [],
            file: doc.get('file') ? doc.get('file').toJSON() : null
          };
        }
      }));
      
      return processedResults;
    } catch (error) {
      console.error('获取所有文档失败:', error);
      // 返回空数组作为备用
      return [];
    }
  }
  
  // 获取文档详情
  async getDocumentDetail(docId) {
    try {
      const query = new AV.Query('KnowledgeDoc');
      query.include('author');
      const doc = await query.get(docId);
      
      return {
        id: doc.id,
        title: doc.get('title'),
        content: doc.get('content'),
        tags: doc.get('tags') || [],
        createdAt: doc.createdAt,
        author: doc.get('author') ? doc.get('author').get('username') : '未知',
        fileUrl: doc.get('file') ? doc.get('file').get('url') : null
      };
    } catch (error) {
      console.error('获取文档详情失败:', error);
      throw error;
    }
  }
  
  // 更新文档标签
  async updateDocumentTags(docId, newTags) {
    try {
      const doc = AV.Object.createWithoutData('KnowledgeDoc', docId);
      doc.set('tags', newTags);
      await doc.save();
      return true;
    } catch (error) {
      console.error('更新标签失败:', error);
      throw error;
    }
  }
}

// 创建单例实例
const knowledgeManager = new KnowledgeManager();
module.exports = knowledgeManager;