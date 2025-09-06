Page({
    goSearch() {
      wx.navigateTo({
        url: '/pages/search/search' // 跳转到检索页面
      })
    },
    goFavorite() {
      wx.navigateTo({
        url: '/pages/collection/collection' // 跳转到收藏页面
      })
    },

    goToAgent() {
      wx.navigateTo({
        url: '/pages/agent/agent' // 跳转到智能体页面
      })
    },
    switchToKnowledge() {
      wx.navigateTo({
        url: '/pages/library/library'
      })
    },
  // 扫码功能
  goAdd: function() {
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
    switchToMine() {
      wx.navigateTo({
        url: '/pages/my_homepage/my_homepage'
      })
    }
  })
  