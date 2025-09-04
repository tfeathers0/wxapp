import drawQrcode from '../../utils/weapp-qrcode.js';
const AV = require('../../libs/av-core-min.js');

Page({

  onLoad: function(){
    const currentUser = AV.User.current();
      if (currentUser) {
        const userId = currentUser.id; // 获取用户 ID
        // 获取设备信息
      const systemInfo = wx.getWindowInfo();
      const screenwidth = systemInfo.screenWidth; // 屏幕宽度，单位为 px

      // 将 rpx 转换为 px
      const rpxToPx = (rpx) => (screenwidth / 750) * rpx;

      // 生成二维码
      drawQrcode({
        width: rpxToPx(400), // 将 400rpx 转换为 px
        height: rpxToPx(400), // 将 400rpx 转换为 px
        canvasId: 'myQrcode',
        text: userId // 使用实际的用户 ID
      });
    }
  },

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
  