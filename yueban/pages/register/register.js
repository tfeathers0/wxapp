// pages/register/register.js
const AV = require('../../libs/av-core-min.js');
const keyDaysManager = require('../../utils/keyDaysManager.js');

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
      console.log('注册页面加载');
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
    
    // 处理注册逻辑
    handleRegister() {
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
        title: '注册中...',
      });
      
      // 创建用户对象并初始化所有必要字段
      const user = new AV.User();
      const keyDaysObj = new AV.Object('keydays');
      user.setUsername(username);
      user.setPassword(password);
        user.set('gender', 2);  // 初始化，等待用户选择
        user.set('myear', 0);
        user.set('mmonth', 0);
        user.set('mday', 0);
        user.set('state', 'menstrual');
        user.set('mood', 'happy');
        user.set('subscription', 0);
        user.set('reminder', 0);
        user.set('Reminder_time', '12:00');
        user.set('collection', 'nothing');
        user.set('nickname', 'nick');
        user.set('passdays',[]);
        keyDaysObj.set('username', user);
        keyDaysObj.set('mood', 'happy');
        keyDaysObj.set('state', 'menstrual');
        keyDaysObj.set('auth', []); // 初始化为空数组
        keyDaysObj.set('passdays', []); // 初始化为空数组
        keyDaysObj.set('keydate', new Date()); // 默认设置为当前时间
    
      // 注册用户（仅基本信息）
      user.signUp().then(() => {
        // 注册成功后，先登录
        return AV.User.logIn(username, password);
      }).then(async (currentUser) => {
        wx.hideLoading();
        
        // 获取完整的用户信息，包括sessionToken
        const userInfo = currentUser.toJSON();
        console.log('注册成功，用户信息:', userInfo);
        
        // 确保创建并保存keydays对象
        try {
          // 更新keydays对象的用户引用为当前登录的用户
          keyDaysObj.set('username', currentUser);
          // 保存keydays对象到LeanCloud
          await keyDaysObj.save();
          console.log('keydays对象已成功创建并保存');
        } catch (error) {
          console.error('创建keydays对象失败:', error);
        }
        
        wx.showToast({
          title: '注册成功',
          icon: 'success'
        });
        
        // 注册成功后跳转到性别选择页面
        setTimeout(() => {
          wx.navigateTo({
            url: '/pages/Gender_selection/Gender_selection'
          });
        }, 1500);
      }).catch((error) => {
        wx.hideLoading();
        console.error('注册失败:', error);
        wx.showToast({
          title: error.message || '注册失败',
          icon: 'none',
          duration: 3000
        });
      });
    }
  });