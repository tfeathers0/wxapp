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
    goAdd() {
      wx.navigateTo({
        url: '/pages/add/add'
      })
    },
    switchToMine() {
      wx.navigateTo({
        url: '/pages/mine/mine'
      })
    }
  })
  