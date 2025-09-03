// pages/login/login.js
const AV = require('../../libs/av-core-min.js');

Page({

  /**
   * 页面的初始数据
   */
  data: {
    username: '',
    password: ''
  },
  
  /**
   * 生命周期函数--监听页面加载
   */
  onLoad() {
    console.log('登录页面加载');
  },
  
  // 处理账号输入
  handleUsernameInput(e) {
    this.setData({
      username: e.detail.value
    });
  },
  
  // 处理密码输入
  handlePasswordInput(e) {
    this.setData({
      password: e.detail.value
    });
  },
  
  // 处理登录逻辑
  handleLogin() {
    const { username, password } = this.data;
    
    // 简单的表单验证
    if (!username || !password) {
      wx.showToast({
        title: '请填写完整信息',
        icon: 'none'
      });
      return;
    }
    
    // 显示加载状态
    wx.showLoading({
      title: '登录中...',
    });
    
    try {
      // 登录用户
      AV.User.logIn(username, password).then((user) => {
        wx.hideLoading();
        
        // 获取完整的用户信息，包括sessionToken
        const userInfo = user.toJSON();
        console.log('登录成功，用户信息:', userInfo);
        
        // 保存用户信息到本地存储
        wx.setStorageSync('userInfo', userInfo);
        
        wx.showToast({
          title: '登录成功',
          icon: 'success'
        });
        
        // 更新全局用户信息
        const app = getApp();
        app.globalData.userInfo = userInfo;
        
        // 检查用户的性别信息，优先使用本地存储的信息
        console.log('登录成功的用户信息:', userInfo);
        const Sex = userInfo.gender;
        console.log('检测到的性别信息:', Sex);
        
        // 登录成功后，根据性别跳转到对应的主界面
        setTimeout(() => {
         
            if (Sex !== undefined && Sex !== null&&Sex!=2) {
                if (Sex === 1) {
                  // 女性用户跳转到女性主界面
                  wx.navigateTo({
                    url: '/pages/female_home/female_home'
                  });
                } else if (Sex === 0) {
                  // 男性用户跳转到男性主界面
                  wx.navigateTo({
                    url: '/pages/male_home/male_home'
                  });
                }
              } else {
                // 如果用户没有性别信息，跳转到性别选择页面
                wx.navigateTo({
                  url: '/pages/Gender_selection/Gender_selection'
                });
              }
          
        }, 1500);
      }).catch((error) => {
        wx.hideLoading();
        console.error('登录失败:', error);
        wx.showToast({
          title: error.message || '登录失败',
          icon: 'none',
          duration: 3000
        });
      });
    } catch (e) {
      wx.hideLoading();
      console.error('登录过程异常:', e);
      wx.showToast({
        title: '登录异常，请重试',
        icon: 'none'
      });
    }
  },
  
  // 跳转到注册页面
  goToRegister() {
    wx.navigateTo({
      url: '/pages/register/register'
    });
  },


  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  }
})