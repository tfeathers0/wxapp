const AV = require('../../libs/av-core-min.js');

Page({
  data: {
    subscriptionEnabled: false,
    reminderEnabled: false,
    templateId: 'YOUR_TEMPLATE_ID',
    Reminder_time: '12:00'
  },

  // 订阅开关
  toggleSubscription(e) {
    const enabled = e.detail.value;

    if (enabled) {
      wx.requestSubscribeMessage({
        tmplIds: [this.data.templateId],
        success: (res) => {
          const accepted = res[this.data.templateId] === 'accept';
          this.setData({ subscriptionEnabled: accepted });
          this.updateUserInfoInLeanCloud({ subscriptionEnabled: accepted });

          if (accepted) {
            wx.showToast({ title: '订阅成功', icon: 'success' });
          } else {
            wx.showToast({ title: '订阅未接受', icon: 'none' });
          }
        },
        fail: (err) => {
          console.error('订阅请求失败:', err);
          this.setData({ subscriptionEnabled: false });
          wx.showToast({ title: '订阅请求失败', icon: 'none' });
        }
      });
    } else {
      this.setData({ subscriptionEnabled: false });
      this.updateUserInfoInLeanCloud({ subscriptionEnabled: false });
      wx.showToast({ title: '已取消订阅', icon: 'none' });
    }
  },

  // 提醒开关
  toggleReminder(e) {
    const enabled = e.detail.value;
    this.setData({ reminderEnabled: enabled });
    this.updateUserInfoInLeanCloud({ reminderEnabled: enabled });

    if (enabled) {
      wx.showToast({ title: '提醒已开启', icon: 'success' });
    } else {
      wx.showToast({ title: '提醒已关闭', icon: 'none' });
    }
  },

  // 时间选择器
  onTimeChange(e) {
    const Reminder_time = e.detail.value; // "HH:MM"
    this.setData({ Reminder_time });
    this.updateUserInfoInLeanCloud({ Reminder_time });
  },

  // 更新 LeanCloud 用户资料
  updateUserInfoInLeanCloud(updateObj) {
    const user = AV.User.current();
    if (user) {
      Object.keys(updateObj).forEach(key => user.set(key, updateObj[key]));
      user.save()
        .then(() => {
          console.log('用户信息已更新到 LeanCloud:', updateObj);
          wx.setStorageSync('userInfo', user.toJSON());
        })
        .catch(err => console.error('更新 LeanCloud 失败:', err));
    } else {
      console.warn('没有登录用户，无法保存到 LeanCloud');
    }
  },

  // 页面加载时同步 LeanCloud 数据
  onLoad() {
    const user = AV.User.current();
    if (user) {
      this.setData({
        subscriptionEnabled: user.get('subscriptionEnabled') || false,
        reminderEnabled: user.get('reminderEnabled') || false,
        Reminder_time: user.get('Reminder_time') || '12:00'
      });
    }
  }
});
