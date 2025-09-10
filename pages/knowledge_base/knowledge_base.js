const AV = require('../../libs/av-core-min.js')
Page({
    goSearch() {
      wx.navigateTo({
        url: '/pages/search/search' // 跳转到检索页面
      })
    },
       // Bottom bar
    switchToKnowledge() {
      wx.navigateTo({ url: '/pages/knowledge_base/knowledge_base' })
    },
    
    switchToMine() {
      wx.navigateTo({ url: '/pages/my_homepage/my_homepage' })
    },

switchToHome() {
  const currentUser = AV.User.current();   // get logged-in user

  if (!currentUser) {
    wx.showToast({
      title: 'Please log in first',
      icon: 'none'
    });
    return;
  }

  const gender = currentUser.get('gender'); // assuming gender is stored as 0/1 in _User

  if (gender === 1) {
    wx.navigateTo({
      url: '/pages/female_home/female_home'
    });
  } else if (gender === 0) {
    wx.navigateTo({
      url: '/pages/male_home/male_home'
    });
  } else {
    // fallback if gender is missing
    wx.navigateTo({
      url: '/pages/home/home'
    });
  }
},   
    

    // 扫码功能
  switchToScan: function() {
    wx.scanCode({
      onlyFromCamera: true, // 只允许从相机扫码
      success: (res) => {
        console.log('扫码结果:', res.result);
        wx.navigateTo({
          url: `../relationship/relationship?scanResult=${encodeURIComponent(res.result)}`
        });
        wx.showToast({
          title: '扫码成功',
          icon: 'success'
        });
      },
      fail: (err) => {
        console.log('扫码失败:', err);
        // 取消扫码不会弹出提示
        if (err.errMsg !== 'scanCode:fail cancel') {
          wx.showToast({
            title: '扫码失败',
            icon: 'none'
          });
        }
      }
    });
  },

  })