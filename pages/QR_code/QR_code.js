import drawQrcode from '../../utils/weapp-qrcode.js';
const AV = require('../../libs/av-core-min.js');

Page({
  
  onLoad: function() {
    const currentUser = AV.User.current();
    if (currentUser) {
      const username = currentUser.get(`username`); // 获取用户 ID
      const systemInfo = wx.getWindowInfo();
      const screenwidth = systemInfo.screenWidth; // 屏幕宽度，单位为 px

      const rpxToPx = (rpx) => (screenwidth / 750) * rpx;

      drawQrcode({
        width: rpxToPx(400),
        height: rpxToPx(400),
        canvasId: 'myQrcode',
        text: username
      });
    }
  },
});