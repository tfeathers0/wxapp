// pages/document/detail.js
const knowledgeManager = require('../../utils/knowledgeManager.js');

Page({
  data: {
    document: null,
    isLoading: true
  },

  onLoad: function(options) {
    this.loadDocumentDetail(options.id);
  },

  // 加载文档详情
  async loadDocumentDetail(docId) {
    try {
      const document = await knowledgeManager.getDocumentDetail(docId);
      this.setData({ document, isLoading: false });
    } catch (error) {
      console.error('加载文档详情失败:', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ isLoading: false });
    }
  },


  
  // 返回上一页
  goBack: function() {
    wx.navigateBack();
  }
});