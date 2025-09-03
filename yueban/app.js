// app.js
const AV = require('./libs/av-core-min.js');
const adapters = require('./libs/leancloud-adapters-weapp.js');

AV.setAdapters(adapters);
AV.init({
    appId : 'RfRfBK0HJtBqepNIEzj1TvXF-gzGzoHsz',
    appKey : 'VTwRjJh77eigaxQuLvLhSoBD',
    serverURLs : "https://rfrfbk0h.lc-cn-n1-shared.com",
});
App({
  onLaunch() {
    // 展示本地存储能力
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    // 检查用户登录状态和性别信息
    this.checkUserStatus();
  },
  
  // 检查用户登录状态和性别信息
  checkUserStatus() {
    try {
      // 从本地存储获取用户信息
      const localUserInfo = wx.getStorageSync('userInfo');
      
      if (localUserInfo && localUserInfo._sessionToken) {
        console.log('检测到本地用户信息，尝试验证会话');
        
        // 使用 sessionToken 重新登录
        AV.User.become(localUserInfo._sessionToken).then((user) => {
          console.log('用户会话验证成功');
          
          // 更新全局用户信息
          this.globalData.userInfo = user.toJSON();
          
          // 更新全局用户信息和本地存储
          const userInfo = user.toJSON();
          this.globalData.userInfo = userInfo;
          this.globalData.userOpenid = userInfo.openid || userInfo.objectId; // 初始化userOpenid
          // 从安全存储获取Coze令牌（实际项目中应从后端获取）
          this.globalData.cozeAgentToken = wx.getStorageSync('cozeAgentToken') || '';
          wx.setStorageSync('userInfo', userInfo);
          
          console.log('用户信息更新后:', userInfo);
          
          // 检查用户是否已经选择性别，优先使用本地存储的信息
          const localUserInfo = wx.getStorageSync('userInfo') || {};
          const sex = localUserInfo.sex;
          
          console.log('检测到的性别信息:', sex);
          
          if (sex !== undefined && sex !== null) {
            // 用户已选择性别，直接跳转到对应主页
            const targetPage = sex === 0 ? '/pages/female_home/female_home' : '/pages/male_home/male_home';
            console.log('用户已选择性别，跳转到:', targetPage);
            
            // 延迟跳转，避免与启动页冲突
            setTimeout(() => {
              wx.navigateTo({ url: targetPage });
            }, 500);
          } else {
              // 用户未选择性别，跳转到性别选择页面
              console.log('用户未选择性别，跳转到性别选择页面');
              
              // 延迟跳转，避免与启动页冲突
              setTimeout(() => {
                wx.navigateTo({ url: '/pages/Gender_selection/Gender_selection' });
              }, 500);
            }
        }).catch((error) => {
          console.error('用户会话验证失败:', error);
          // 会话验证失败，清除本地存储的用户信息
          wx.removeStorageSync('userInfo');
          this.globalData.userInfo = null;
        });
      } else {
        console.log('未检测到本地用户信息');
      }
    } catch (e) {
      console.error('检查用户状态异常:', e);
    }
  },
  
  globalData: {
    userInfo: null,
    cozeAgentToken: 'pat_ghpgU6gAUZeeaBBZLEnPVsUjK1v7fArgZNivL6AMDf85xV9bz5YX6Wuz3iZjNx7d', // Coze API授权令牌
    userOpenid: '' // 用户唯一标识
  }
})
