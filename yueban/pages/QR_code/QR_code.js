Page({
    goBack() {
      wx.navigateBack();
    },
    onShareAppMessage() {
      return {
        title: "我的月亮码",
        path: "/pages/mooncode/mooncode"
      }
    }
  })
  