// pages/Gender_selection/Gender_selection.js
const AV = require('../../libs/av-core-min.js');

Page({
  data: {},
  
  // 跳转到女生模式页面
  chooseFemale() {
    console.log('选择女性');
    this.saveGenderAndNavigate(1, '/pages/female_home/female_home');
  },
  
  // 跳转到男生模式页面
  chooseMale() {
    console.log('选择男性');
    this.saveGenderAndNavigate(0, '/pages/male_home/male_home');
  },

  // 保存性别信息并跳转
    saveGenderAndNavigate(sexValue, targetPage){
      // 获取当前用户
      const currentUser = AV.User.current();
     if(currentUser){
        currentUser.set('gender',sexValue);
        wx.navigateTo({
          url: targetPage
        });
        // 保存更改
      currentUser.save().then((user) => {
      console.log('更新成功:', user.get('sex'));
    }).catch((error) => {
      console.error('更新失败:', error);
    });
     } 
}
      } 
    
)
  