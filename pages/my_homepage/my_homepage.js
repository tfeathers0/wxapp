const AV = require('../../libs/av-core-min.js')
const defaultAvatarUrl = '/images/wechatdefaultpic.png'

let saveTimeout = null // 防抖定时器

Page({
  data: {
    userInfo: {
      touxiang: defaultAvatarUrl,
      nickName: ''
    },
    hasUserInfo: false,
    showComplete: false
  },

  async onLoad() {
    // 本地缓存
    const storedInfo = wx.getStorageSync('userInfo')
    if (storedInfo) {
      this.setData({ userInfo: storedInfo })
    }

    // LeanCloud 用户数据
    let currentUser = AV.User.current()
    if (!currentUser) {
      currentUser = await AV.User.loginAnonymously()
    }

    const nickName = currentUser.get('nickName') || ''
    const touxiangFile = currentUser.get('touxiang');
    const avatarUrl = touxiangFile ? touxiangFile.get('url') : defaultAvatarUrl;
    this.setData({
      'userInfo.nickName': nickName,
      'userInfo.avatarUrl': avatarUrl
    })
  },

  // 👉 修改头像
  changeAvatar() {
    wx.chooseImage({
      count: 1,
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const filePath = res.tempFilePaths[0];
  
        try {
          // 1. 生成唯一文件名，避免覆盖
          const fileName = `touxiang_${Date.now()}.jpg`;
  
          // 2. 使用 AV.File 包装本地文件
          const file = new AV.File(fileName, { blob: { uri: filePath } });
          await file.save();
  
          // 3. 获取当前用户
          let currentUser = AV.User.current();
          if (!currentUser) {
            currentUser = await AV.User.loginAnonymously();
          }
  
          // 4. 存到 File 字段 touxiang
          currentUser.set('touxiang', file);
  
          // 5. 冗余 URL，方便前端直接绑定 <image>
          currentUser.set('avatarUrl', file.url());
  
          await currentUser.save();
  
          // 6. 更新页面和本地缓存
          const newInfo = { ...this.data.userInfo, touxiang: file.url() };
          this.setData({
            userInfo: newInfo,
            hasUserInfo: true
          });
          wx.setStorageSync('userInfo', newInfo);
  
          wx.showToast({ title: '头像上传成功', icon: 'success' });
          console.log('头像已上传并保存:', file.url());
  
        } catch (err) {
          console.error('头像上传失败:', err);
          wx.showToast({ title: '上传失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.showToast({ title: '选择头像失败', icon: 'none' });
      }
    });
  },  

  // 👉 昵称输入（自动保存，500ms 防抖）
  onInputChange(e) {
    const nickName = e.detail.value
    this.setData({ 'userInfo.nickName': nickName })

    if (saveTimeout) clearTimeout(saveTimeout)
    saveTimeout = setTimeout(async () => {
      try {
        let currentUser = AV.User.current()
        if (!currentUser) {
          currentUser = await AV.User.loginAnonymously()
        }

        currentUser.set('nickName', nickName)
        await currentUser.save()

        wx.setStorageSync('userInfo', this.data.userInfo)
        this.setData({ showComplete: true })
        setTimeout(() => this.setData({ showComplete: false }), 3000)

        console.log('昵称已保存:', nickName)
      } catch (err) {
        console.error('昵称保存失败:', err)
      }
    }, 500)
  },
  
     // Top menu
     goAbout() {
      wx.navigateTo({ url: '/pages/about_us/about_us' })
    },
    goCode() {
      wx.navigateTo({ url: '/pages/QR_code/QR_code' })
    },
    goReminder() {
      wx.navigateTo({ url: '/pages/prediction_reminder/prediction_reminder'})
    },
    goService() {
      wx.navigateTo({ url: '/pages/service/service' })
    },

    // Bottom bar
    switchToKnowledge() {
      wx.navigateTo({ url: '/pages/knowledge_base/knowledge_base' }) // change to your "知识库" page
    },

  // 扫码功能
  goScan: function() {
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
     // 显示删除账号确认对话框
    showDeleteAccountConfirm() {
      wx.showModal({
        title: '确认删除账号',
        content: '删除账号后，您的所有数据将被永久删除，且无法恢复。确定要删除账号吗？',
        confirmText: '确定删除',
        cancelText: '取消',
        confirmColor: '#ff6b6b',
        success: (res) => {
          if (res.confirm) {
            this.confirmDeleteAccount();
          }
        }
      });
    },
    
    // 确认删除账号操作
    confirmDeleteAccount() {
      try {
        // 显示加载状态
        wx.showLoading({
          title: '处理中...',
        });
        
        // 获取当前用户
        const currentUser = AV.User.current();
        
        if (currentUser) {
          // 删除后端用户数据
          currentUser.destroy().then(() => {
            console.log('User account deleted successfully from backend');
            
            // 清除用户登录状态
            AV.User.logOut();
            
            // 清除本地存储的用户信息
            wx.removeStorageSync('userInfo');
            wx.removeStorageSync('sessionToken');
            wx.removeStorageSync('sex');
            wx.removeStorageSync('sexObject');
            
            // 隐藏加载状态
            wx.hideLoading();
            
            // 显示成功提示
            wx.showToast({
              title: '账号已删除',
              icon: 'success',
              duration: 2000
            });
            
            // 延迟跳转到注册页面
            setTimeout(() => {
              wx.redirectTo({
                url: '/pages/register/register',
                success: () => {
                  console.log('Successfully navigated to gender selection page after account deletion');
                },
                fail: (err) => {
                  console.error('Navigation failed after account deletion:', err);
                }
              });
            }, 1500);
          }).catch(error => {
            wx.hideLoading();
            console.error('Delete account failed:', error);
            
            wx.showToast({
              title: '删除失败，请重试',
              icon: 'error',
              duration: 2000
            });
          });
        } else {
          wx.hideLoading();
          console.log('No user logged in, cannot delete account');
          
          // 清除本地存储的用户信息
          wx.removeStorageSync('userInfo');
          wx.removeStorageSync('sessionToken');
          wx.removeStorageSync('sex');
          wx.removeStorageSync('sexObject');
          
          wx.showToast({
            title: '操作成功',
            icon: 'success',
            duration: 2000
          });
          
          setTimeout(() => {
            wx.redirectTo({
              url: '/pages/Gender_selection/Gender_selection'
            });
          }, 1500);
        }
      } catch (error) {
        wx.hideLoading();
        console.error('Unexpected error during account deletion:', error);
        
        wx.showToast({
          title: '删除失败，请重试',
          icon: 'error',
          duration: 2000
        });
      }
    }
})