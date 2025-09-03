Page({
    data: {
      time: '',
    },
  
    onLoad() {
      this.updateTime();
      setInterval(this.updateTime, 1000 * 60); // 每分钟更新一次时间
    },
  
    updateTime() {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      
      // 更新显示的时间，确保分钟数始终两位数
      this.setData({
        time: `${hours}:${minutes < 10 ? '0' + minutes : minutes}`
      });
    },
  
    handleLogin() {
      // 跳转到登录页面
      wx.navigateTo({
        url: '/pages/login/login'
      });
    },
  
    handleRegister() {
      // 跳转到注册页面
      wx.navigateTo({
        url: '/pages/register/register'
      });
    }
  });
  