// 导入知识管理器单例实例
const knowledgeManager = require('../../utils/knowledgeManager.js');

Page({
  data: {
    filePath: '',
    fileName: '',
    documentTitle: '',
    tagInput: '',
    tags: [],
    isSubmitting: false,
    isTitleValid: false
  },

  // 选择Word文档
  chooseDocument: function() {
    console.log('开始选择文档...');
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['docx', 'doc'],
      success: (res) => {
        console.log('文档选择成功:', res);
        const file = res.tempFiles[0];
        console.log('选择的文件:', file);
        this.setData({
          filePath: file.path,
          fileName: file.name
        }, () => {
          console.log('文件路径设置成功:', this.data.filePath);
        });
        
        // 自动填充标题（从文件名中提取）
        if (!this.data.documentTitle) {
          const title = file.name.replace(/\.docx?$/, '');
          this.setData({
            documentTitle: title,
            isTitleValid: title.trim() !== ''
          });
        } else {
          // 更新标题有效性状态
          this.setData({
            isTitleValid: this.data.documentTitle.trim() !== ''
          });
        }
      },
      fail: (err) => {
        console.error('选择文件失败:', err);
        wx.showToast({ title: '选择文件失败', icon: 'none' });
      }
    });
  },

  // 输入标题
  onTitleInput: function(e) {
    const title = e.detail.value;
    console.log('设置文档标题:', title);
    this.setData({
      documentTitle: title,
      isTitleValid: title.trim() !== ''
    });
  },

  // 输入标签
  onTagInput: function(e) {
    this.setData({ tagInput: e.detail.value });
  },

  // 添加标签
  addTag: function() {
    const tag = this.data.tagInput.trim();
    if (tag && !this.data.tags.includes(tag)) {
      this.setData({
        tags: [...this.data.tags, tag],
        tagInput: ''
      });
    }
  },

  // 按回车键添加标签
  onTagConfirm: function(e) {
    this.addTag();
  },

  // 删除标签
  removeTag: function(e) {
    const index = e.currentTarget.dataset.index;
    const tags = [...this.data.tags];
    tags.splice(index, 1);
    this.setData({ tags });
  },

  // 添加调试方法，查看当前状态
  showDebugInfo: function() {
    console.log('当前数据状态:', this.data);
    wx.showModal({
      title: '调试信息',
      content: `filePath: ${this.data.filePath ? '已选择' : '未选择'}\ndocumentTitle: ${this.data.documentTitle ? '已输入' : '未输入'}\nisSubmitting: ${this.data.isSubmitting}`,
      showCancel: false
    });
  },

  // 上传文档
  async uploadDocument() {
    const { filePath, documentTitle, tags } = this.data;
    
    // 验证输入
    if (!filePath) {
      return wx.showToast({ title: '请选择Word文档', icon: 'none' });
    }
    
    if (!documentTitle.trim()) {
      return wx.showToast({ title: '请输入文档标题', icon: 'none' });
    }
    
    if (this.data.isSubmitting) {
      console.log('上传请求被忽略，isSubmitting=true');
      return wx.showToast({ title: '正在处理中，请稍候', icon: 'none' });
    }
    
    try {
      this.setData({ isSubmitting: true });
      
      // 调用knowledgeManager的上传方法
      await knowledgeManager.uploadWordDocument(filePath, documentTitle, tags);
      
      // 上传成功后跳转到搜索页面
      wx.navigateTo({
        url: '/pages/search/search'
      });
      
    } catch (error) {
      console.error('上传文档失败:', error);
      wx.showToast({ title: '上传失败，请重试', icon: 'none' });
    } finally {
      this.setData({ isSubmitting: false });
    }
  },

  // 返回上一页
  goBack: function() {
    wx.navigateBack();
  }
});