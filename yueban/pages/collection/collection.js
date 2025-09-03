Page({
    // Bottom bar
    switchToKnowledge() {
      wx.switchTab({ url: '/pages/knowledge_base/knowledge_base' })
    },
    switchToCenter() {
      wx.navigateTo({ url: '/pages/record/record' })
    },
    
    switchToMine() {
      wx.switchTab({ url: '/pages/my_homepage/my_homepage' })
    }
  })