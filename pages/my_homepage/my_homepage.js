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
          // 获取用户名以构建用户类名
          const username = currentUser.getUsername();
          const userClassName = `User_${username.replace(/[^a-zA-Z0-9]/g, '_')}`;
          
          // 先删除用户自定义类中的所有数据
          this.deleteAllUserClassData(userClassName)
            .then(() => {
              console.log('用户自定义类数据删除成功');
              
              // 然后删除用户对象本身
              return currentUser.destroy();
            })
            .then(() => {
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
            })
            .catch(error => {
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
    },
    
    // 删除用户自定义类中的所有数据 - 增强版，进一步避免请求过多
    deleteAllUserClassData(className) {
      return new Promise((resolve, reject) => {
        try {
          console.log(`开始删除用户自定义类 ${className} 中的所有数据`);
          
          // 首先尝试查询该类是否存在
          const query = new AV.Query(className);
          
          // 获取该类的所有数据
          query.find().then(results => {
            if (results.length === 0) {
              console.log(`用户自定义类 ${className} 中没有数据需要删除`);
              resolve();
              return;
            }
            
            console.log(`找到 ${results.length} 条数据需要删除`);
            
            // 分批删除，每批删除3条数据，减少单次请求数量
            const batchSize = 3;
            const deleteBatches = [];
            
            for (let i = 0; i < results.length; i += batchSize) {
              const batch = results.slice(i, i + batchSize);
              // 每批添加递增的延迟时间，确保请求不会太密集
              const delay = i > 0 ? 500 + (i / batchSize) * 200 : 0; // 递增延迟，最小500ms
              
              deleteBatches.push(new Promise((batchResolve) => {
                setTimeout(() => {
                  this._deleteBatchWithRetry(batch, Math.floor(i/batchSize)+1, 0)
                    .then(() => {
                      batchResolve();
                    })
                    .catch(err => {
                      console.error(`删除第 ${Math.floor(i/batchSize)+1} 批次数据最终失败:`, err);
                      // 即使失败也继续尝试其他批次
                      batchResolve();
                    });
                }, delay);
              }));
            }
            
            // 等待所有批次删除完成
            Promise.all(deleteBatches).then(() => {
              console.log(`成功删除用户自定义类 ${className} 中的所有数据（或部分数据删除失败但已尽力）`);
              resolve();
            });
          }).catch(err => {
            // 如果类不存在，也视为成功（因为目标是删除，不存在即表示已经删除了）
            if (err.code === 119 || err.code === 101) {
              console.log(`用户自定义类 ${className} 不存在，无需删除`);
              resolve();
            } else {
              console.error(`查询用户自定义类 ${className} 失败:`, err);
              reject(err);
            }
          });
        } catch (error) {
          console.error('删除用户自定义类数据时发生异常:', error);
          reject(error);
        }
      });
    },
    
    // 带重试机制的批次删除方法
    _deleteBatchWithRetry(batch, batchIndex, retryCount) {
      // 最大重试次数
      const maxRetries = 3;
      
      return new Promise((resolve, reject) => {
        if (retryCount > maxRetries) {
          console.error(`批次 ${batchIndex} 超过最大重试次数 ${maxRetries}，放弃删除`);
          reject(new Error(`Batch ${batchIndex} max retries exceeded`));
          return;
        }
        
        // 为每个对象创建单独的删除promise
        const itemPromises = batch.map((obj, idx) => {
          return new Promise((itemResolve, itemReject) => {
            obj.destroy()
              .then(() => {
                console.log(`批次 ${batchIndex} - 第 ${idx+1}/${batch.length} 条数据删除成功`);
                itemResolve();
              })
              .catch(err => {
                console.warn(`批次 ${batchIndex} - 第 ${idx+1}/${batch.length} 条数据删除失败:`, err);
                // 对于429错误（Too many requests），可以选择重试单个项目
                if (err.code === 429 && retryCount < maxRetries) {
                  console.log(`批次 ${batchIndex} - 第 ${idx+1} 条数据因为请求过多，将在延迟后重试`);
                  // 指数退避策略
                  const retryDelay = Math.pow(2, retryCount) * 1000 + Math.random() * 500;
                  setTimeout(() => {
                    obj.destroy()
                      .then(() => {
                        console.log(`批次 ${batchIndex} - 第 ${idx+1} 条数据重试删除成功`);
                        itemResolve();
                      })
                      .catch(retryErr => {
                        console.error(`批次 ${batchIndex} - 第 ${idx+1} 条数据重试删除失败:`, retryErr);
                        // 重试失败也继续，不阻塞其他删除
                        itemResolve();
                      });
                  }, retryDelay);
                } else {
                  // 其他错误或超过重试次数，记录并继续
                  itemResolve();
                }
              });
          });
        });
        
        Promise.all(itemPromises)
          .then(() => {
            console.log(`成功删除第 ${batchIndex} 批次数据`);
            resolve();
          })
          .catch(err => {
            console.error(`批次 ${batchIndex} 删除过程中出现异常:`, err);
            reject(err);
          });
      });
    }
})