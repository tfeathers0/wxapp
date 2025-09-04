// search.js
const knowledgeManager = require('../../utils/knowledgeManager.js');

Page({
  data: {
    searchKeyword: '',
    selectedTags: [],
    allTags: [],
    documents: [],
    currentPage: 1,
    hasMore: true,
    isLoading: false,
    isSearching: false
  },

  onLoad: function() {
    this.loadAllTags();
  },

  // 加载所有标签
  async loadAllTags() {
    try {
      wx.showLoading({ title: '加载标签中...', mask: true });
      const tags = await knowledgeManager.getAllTags();
      this.setData({ allTags: tags });
    } catch (error) {
      console.error('加载标签失败:', error);
      wx.showToast({ title: '加载标签失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  // 搜索文档
  async loadDocuments() {
    if (this.data.isLoading) return;
    
    // 只有当有关键词或已选标签时才执行搜索
    if (!this.data.searchKeyword && (!this.data.selectedTags || this.data.selectedTags.length === 0)) {
      this.setData({
        documents: [],
        isLoading: false,
        hasMore: false,
        isSearching: false,
        searchResultText: ''
      });
      return;
    }
    
    this.setData({ isLoading: true });
    
    try {
      // 调用搜索接口
      const results = await knowledgeManager.searchDocuments(
        this.data.searchKeyword,
        this.data.selectedTags,
        this.data.currentPage,
        10
      );
      
      // 处理结果格式
      const docs = results.results || results;
      
      // 筛选有匹配段落的文档
      const docsWithMatches = docs.filter(doc => {
        // 检查是否有matchingParagraphs且不为空数组
        return doc.matchingParagraphs && doc.matchingParagraphs.length > 0;
      });
      
      if (docsWithMatches.length === 0) {
        this.setData({ hasMore: false });
      }
      
      // 确保每个文档对象有fullFileContent字段，与search.wxml中的引用匹配
      const formattedDocs = docsWithMatches.map(doc => Object.assign({}, doc, {
        fullFileContent: doc.content || ''
      }));
      
      this.setData({
        documents: this.data.currentPage === 1 ? formattedDocs : this.data.documents.concat(formattedDocs),
        isLoading: false,
        isSearching: false
      });
      
    } catch (error) {
      console.error('加载文档失败:', error);
      this.setData({ isLoading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  // 输入关键词
  onInput: function(e) {
    this.setData({ searchKeyword: e.detail.value });
  },

  // 处理搜索输入的回车事件
  onSearchConfirm: function(e) {
    this.doSearch();
  },

  // 执行搜索
  doSearch: function() {
    this.setData({ 
      currentPage: 1, 
      hasMore: true,
      isSearching: true
    });
    this.loadDocuments();
  },

  // 切换标签选择
  onTagToggle: function(e) {
    const tag = e.currentTarget.dataset.tag;
    const selectedTags = this.data.selectedTags.slice();
    const index = selectedTags.indexOf(tag);
    
    if (index === -1) {
      selectedTags.push(tag);
    } else {
      selectedTags.splice(index, 1);
    }
    
    this.setData({
      selectedTags,
      currentPage: 1,
      hasMore: true
    });
    this.loadDocuments();
  },

  // 加载更多
  loadMore: function() {
    if (!this.data.hasMore || this.data.isLoading) return;
    
    this.setData({ currentPage: this.data.currentPage + 1 });
    this.loadDocuments();
  },

  // 查看文档详情
  onDocItemTap: function(e) {
    const docId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/document/detail?id=${docId}`
    });
  },
  
  // 返回上一页
  goBack: function() {
    wx.navigateBack();
  },
  
  // 清除搜索关键词
  clearSearchKeyword: function() {
    this.setData({
      searchKeyword: '',
      currentPage: 1,
      hasMore: true
    });
    this.loadDocuments();
  },
  
  // 跳转到上传文档页面
  navigateToUpload: function() {
    wx.navigateTo({
      url: '/pages/upload_document/upload_document'
    });
  },
  
  // 清除选中的标签
  clearSelectedTags: function() {
    this.setData({
      selectedTags: [],
      currentPage: 1,
      hasMore: true
    });
    this.loadDocuments();
  }
});