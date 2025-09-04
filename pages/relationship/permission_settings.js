const AV = require('../../libs/av-core-min.js');
const keyDaysManager = require('../../utils/keyDaysManager.js');

Page({
  data: {
    contactId: '',
    contactName: '',
    canViewStatus: true,
    canViewMenstruation: true,
    canViewMood: true,
    canViewPassdays: true,
    loading: true
  },

  onLoad(options) {
    // 获取从上个页面传递过来的参数
    const contactId = options.contactId;
    const contactName = decodeURIComponent(options.contactName || '该联系人');
    
    this.setData({
      contactId: contactId,
      contactName: contactName
    });
    
    // 加载当前权限设置
    this.loadPermissions();
  },
  
  // 加载当前权限设置
  async loadPermissions() {
    try {
      this.setData({ loading: true });
      
      // 获取当前用户对目标联系人的权限设置
      const permissions = await keyDaysManager.getUserPermissions(this.data.contactId);
      
      this.setData({
        canViewStatus: permissions.canViewStatus !== false,
        canViewMenstruation: permissions.canViewMenstruation !== false,
        canViewMood: permissions.canViewMood !== false,
        canViewPassdays: permissions.canViewPassdays !== false,
        loading: false
      });
    } catch (error) {
      console.error('加载权限设置失败:', error);
      this.setData({ loading: false });
      wx.showToast({
        title: '加载权限设置失败',
        icon: 'none'
      });
    }
  },
  
  // 切换状态权限
  onStatusPermissionChange(e) {
    this.setData({
      canViewStatus: e.detail.value
    });
  },
  
  // 切换月经时间权限
  onMenstruationPermissionChange(e) {
    this.setData({
      canViewMenstruation: e.detail.value
    });
  },
  
  // 切换心情权限
  onMoodPermissionChange(e) {
    this.setData({
      canViewMood: e.detail.value
    });
  },
  
  // 切换关键日期权限
  onPassdaysPermissionChange(e) {
    this.setData({
      canViewPassdays: e.detail.value
    });
  },
  
  // 保存权限设置
  async savePermissions() {
    try {
      wx.showLoading({ title: '保存中...' });
      
      // 构建新的权限设置对象
      const userPermissions = {
        canViewStatus: this.data.canViewStatus,
        canViewMenstruation: this.data.canViewMenstruation,
        canViewMood: this.data.canViewMood,
        canViewPassdays: this.data.canViewPassdays
      };
      
      // 保存权限设置
      await keyDaysManager.setUserPermissions(this.data.contactId, userPermissions);
      
      wx.hideLoading();
      wx.showModal({
        title: '保存成功',
        content: `您已成功更新对${this.data.contactName}的权限设置`,
        showCancel: false,
        success: () => {
          // 返回上一页
          wx.navigateBack();
        }
      });
    } catch (error) {
      console.error('保存权限设置失败:', error);
      wx.hideLoading();
      wx.showToast({
        title: '保存失败，请重试',
        icon: 'none'
      });
    }
  },
  
  // 返回上一页
  navigateBack() {
    wx.navigateBack();
  }
});