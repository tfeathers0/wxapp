const AV = require('../../libs/av-core-min.js');

// 引入权限管理模块
const keyDaysManager = require('../../utils/keyDaysManager.js');

Page({
  data: {
    // 联系人列表数据（将从LeanCloud获取）
    contactList: [],
    contactGroups: [], // 按字母分组的联系人
    searchResults: [],
    activeLetter: "",
    searchQuery: '',
    isSearching: false,
    // 当前选中的关联人（用于同步到提醒板块）
    selectedContact: null,
    pendingRequests: [],
    // 字母导航数据
    letters: ['#', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'],
    // 请求操作弹窗
    showActionModal: false,
    selectedRequest: null,
    // 搜索结果弹窗
    showSearchResultModal: false,
    // 关系选择弹窗
    showRelationSelectModal: false,
    selectedRelation: '朋友',
    selectedUserId: '',
    selectedNickname: '',
    // 是否正在接受好友请求流程中
    isAcceptingRequest: false
  },

  onLoad() {
    console.log("关联人列表页面加载");
    // 从本地存储获取上次选中的关联人
    const lastSelected = wx.getStorageSync('selectedContact');
    if (lastSelected) {
      this.setData({ selectedContact: lastSelected });
    }
    
    // 获取当前登录用户的性别信息
    const app = getApp();
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo') || {};
    const currentUserGender = userInfo.gender !== undefined ? userInfo.gender : 1; // 默认1（女性）
    console.log('当前登录用户性别:', currentUserGender);
    
    this.setData({
      currentUserGender: currentUserGender
    });
    
    // 生成字母导航数据
    this.generateLetters();
    
    // 加载好友列表
    this.loadFriendList();
    
    // 加载待处理的好友请求
    this.loadPendingRequests();
  },
  
  // 页面显示时刷新数据
  onShow() {
    console.log("关联人列表页面显示");
    // 刷新待处理的好友请求，确保用户能及时看到新的请求
    this.loadPendingRequests();
  },

  // 生成字母导航数据
  generateLetters() {
    const letters = ['#', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
    this.setData({ letters });
  },

  // 按字母分组联系人
  groupContactsByLetter(contacts) {
    const groups = {};
    
    // 初始化所有字母分组
    this.data.letters.forEach(letter => {
      groups[letter] = [];
    });
    
    // 将联系人分配到对应的字母分组
    contacts.forEach(contact => {
      const letter = contact.letter;
      if (groups[letter] !== undefined) {
        groups[letter].push(contact);
      } else {
        groups['#'].push(contact);
      }
    });
    
    // 过滤掉没有联系人的分组，并按字母顺序排序
    const filteredGroups = [];
    this.data.letters.forEach(letter => {
      if (groups[letter].length > 0) {
        filteredGroups.push({
          letter: letter,
          contacts: groups[letter]
        });
      }
    });
    
    return filteredGroups;
  },

  // 点击字母导航时滚动到对应位置
  scrollToLetter(e) {
    const letter = e.currentTarget.dataset.letter;
    this.setData({ activeLetter: letter });
    
    // 滚动到对应的字母分组
    const groupElement = wx.createSelectorQuery().select(`#letter-${letter}`);
    groupElement.boundingClientRect(rect => {
      if (rect) {
        wx.pageScrollTo({
          scrollTop: rect.top + wx.getStorageSync('scrollTop') - 100,
          duration: 300
        });
      }
    }).exec();
  },

  // 页面滚动时更新当前激活的字母
  onPageScroll(e) {
    wx.setStorageSync('scrollTop', e.scrollTop);
    
    // 获取所有字母分组的位置信息
    const query = wx.createSelectorQuery();
    this.data.letters.forEach(letter => {
      query.select(`#letter-${letter}`).boundingClientRect();
    });
    
    query.exec(res => {
      // 找到当前可视区域内最上方的字母分组
      let activeLetter = '';
      for (let i = res.length - 1; i >= 0; i--) {
        if (res[i] && res[i].top <= 100) {
          activeLetter = this.data.letters[i];
          break;
        }
      }
      
      if (activeLetter !== this.data.activeLetter) {
        this.setData({ activeLetter });
      }
    });
  },

  // 根据状态获取对应的图标路径
  getStatusIcon(state) {
    if (!state) return '/images/moon2.png';
    
    // 标准化状态值为小写进行比较
    const stateLower = state.toLowerCase();
    
    switch (stateLower) {
      case '月经期':
      case '经期':
      case 'menstrual':
        return '/images/icon_state_menstrual.png';
      case '卵泡期':
      case '卵泡':
      case 'follicular':
        return '/images/icon_state_follicular.png';
      case '排卵期':
      case '排卵':
      case 'ovulation':
        return '/images/icon_state_ovulation.png';
      case '黄体期':
      case '黄体':
      case 'luteal':
        return '/images/icon_state_Luteal.png';
      default:
        // 如果是未知状态，尝试使用通用图标
        return '/images/moon2.png';
    }
  },
    
  // 加载好友列表
  loadFriendList() {
    wx.showLoading({ title: '加载中...' });
    
    const currentUser = AV.User.current();
    const query = new AV.Query('_Followee');
    query.equalTo('user', currentUser);
    query.equalTo('friendStatus', true);
    query.include('followee');
    
    query.find().then((results) => {
      // 保存当前好友列表，用于后续检测关系变化
      const previousFriendIds = this.data.contactList ? this.data.contactList.map(friend => friend.id) : [];
      
      // 创建一个数组来存储所有需要查询的好友关系
      const mutualCheckPromises = results.map(result => {
        const followee = result.get('followee');
        const followeeId = followee.id;
        
        // 查询对方是否也将当前用户标记为好友
        const reverseQuery = new AV.Query('_Followee');
        reverseQuery.equalTo('user', AV.Object.createWithoutData('_User', followeeId));
        reverseQuery.equalTo('followee', currentUser);
        reverseQuery.equalTo('friendStatus', true);
        
        return reverseQuery.find().then(reverseResults => ({
          result: result,
          isMutualFriend: reverseResults.length > 0
        }));
      });
      
      // 并行执行所有双向关系检查
      return Promise.all(mutualCheckPromises).then(mutualResults => ({
        mutualResults: mutualResults,
        previousFriendIds: previousFriendIds
      }));
    }).then(({ mutualResults, previousFriendIds }) => {
      // 先获取所有联系人的权限设置
      const getPermissionsPromises = mutualResults
        .filter(item => item.isMutualFriend) // 只保留双向都是好友的关系
        .map(item => {
          const followee = item.result.get('followee');
          // 获取当前用户对这个联系人的权限设置
          return keyDaysManager.getUserPermissions(followee.id).then(permissions => ({
            result: item.result,
            permissions: permissions
          }));
        });

      // 等待所有权限设置获取完成
      return Promise.all(getPermissionsPromises).then(permissionResults => {
        const friends = permissionResults.map(item => {
          const result = item.result;
          const followee = result.get('followee');
          const permissions = item.permissions;
          // 优先使用nickName，其次使用username
          let nickname = followee.get('nickName') || followee.get('username') || '未命名';
          let letter = nickname.charAt(0).toUpperCase();
          
          // 获取用户的性别信息
          let gender = followee.get('gender') !== undefined ? followee.get('gender') : 1; // 默认1（女性）
          console.log(`${nickname}的性别信息:`, gender);
          
          // 获取用户的状态信息（仅女性且有权限显示）
          let state = '';
          if (gender !== 0 && permissions.canViewStatus) { // 如果不是男性且有权限查看状态
            try {
              // 尝试多种可能的数据结构获取state信息
              state = followee.get('state') || followee.get('cycleStage') || '';
              
              // 如果没有直接的state字段，尝试从healthData获取
              if (!state) {
                const healthData = followee.get('healthData') || {};
                state = healthData.state || healthData.cycleStage || '';
              }
              
              console.log(`${nickname}的状态信息:`, state);
            } catch (e) {
              console.log('获取状态信息失败', e);
            }
          }
          
          // 获取联系人头像 - 从LeanCloud user类的touxiang字段（File对象）获取
          const defaultAvatarUrl = '/images/wechatdefaultpic.png';
          let avatarUrl = defaultAvatarUrl;
          
          // 优先从touxiang字段获取头像
          const touxiangFile = followee.get('touxiang');
          if (touxiangFile && typeof touxiangFile.get === 'function') {
            avatarUrl = touxiangFile.get('url') || avatarUrl;
          }
          
          // 如果touxiang不存在，尝试从avatarUrl字段获取
          if (avatarUrl === defaultAvatarUrl) {
            const directAvatarUrl = followee.get('avatarUrl');
            if (directAvatarUrl) {
              avatarUrl = directAvatarUrl;
            }
          }
          
          return {
            id: followee.id,
            nickname: nickname,
            // 从LeanCloud user类的avatar字段（File对象）获取头像URL
            avatar: avatarUrl,
            letter: letter,
            relation: result.get('relation') || '朋友',
            gender: gender, // 添加性别信息
            state: state, // 使用state字段存储状态信息
            cycleStage: state, // 保持向后兼容
            isOnline: Math.random() > 0.3, // 模拟在线状态
            createdAt: new Date().toLocaleString(),
            permissions: permissions // 保存权限设置，方便页面上使用
          };
        });
        
        return { friends, contactGroups: this.groupContactsByLetter(friends), previousFriendIds };
      });
    }).then(({ friends, contactGroups, previousFriendIds }) => {
        
        // 检测关系变化 - 找出之前是好友但现在不是的用户
        const currentFriendIds = friends.map(friend => friend.id);
        const removedFriends = previousFriendIds.filter(id => !currentFriendIds.includes(id));
        
        this.setData({
          contactList: friends,
          contactGroups: contactGroups
        });
        
        // 隐藏加载提示
        wx.hideLoading();
        
        // 如果有解除关系的提醒，只在被解除关联的用户端显示弹窗
        // 检查当前用户是否是被解除关联的一方
        const isCurrentUserRemoved = removedFriends.some(removedId => removedId === currentUser.id);
        if (removedFriends.length > 0 && isCurrentUserRemoved) {
          // 从mutualResults中找到被移除的好友名称
          const removedFriendNames = [];
          mutualResults.forEach(item => {
            if (removedFriends.includes(item.result.get('followee').id) && !item.isMutualFriend) {
              removedFriendNames.push(item.result.get('followee').get('username') || '对方');
            }
          });
          
          // 增强：确保至少有一个被移除的好友名称
          if (removedFriendNames.length > 0) {
            wx.showModal({
              title: '关系变更提醒',
              content: `${removedFriendNames.join('、')}已解除与您的关联关系`,
              showCancel: false,
              success: () => {
                console.log('用户已确认关系变更提醒');
                // 增强：确认后再次刷新列表，确保数据最新
                setTimeout(() => {
                  this.loadFriendList();
                }, 1000);
              }
            });
          } else if (removedFriends.length > 0) {
            // 增强：即使没有找到好友名称，也显示提醒
            wx.showModal({
              title: '关系变更提醒',
              content: '有用户已解除与您的关联关系',
              showCancel: false
            });
          }
        }
        
        // 如果有选中的联系人，检查是否在好友列表中
        if (this.data.selectedContact) {
          const contactExists = friends.some(friend => friend.id === this.data.selectedContact.id);
          if (!contactExists) {
            this.setData({ selectedContact: null });
            wx.removeStorageSync('selectedContact');
          }
        }
      }).catch((error) => {
        console.error('加载好友列表失败', error);
        wx.hideLoading();
        wx.showToast({
          title: '加载好友列表失败',
          icon: 'none'
        });
      });
    },
    
    // 加载待处理的好友请求
    loadPendingRequests() {
      const currentUser = AV.User.current();
      console.log('加载待处理好友请求，当前用户ID:', currentUser.id);
      
      // 根据LeanCloud官方文档，使用_FriendshipRequest表查询待处理请求
      const query = new AV.Query('_FriendshipRequest');
      
      // 查询发送给当前用户的待处理请求
      query.equalTo('friend', currentUser);
      query.equalTo('status', 'pending'); // 使用官方状态标记
      query.include('user'); // 包含发送者的用户信息
      query.descending('createdAt'); // 按创建时间倒序排列
      
      console.log('执行好友请求查询...');
      query.find().then((requests) => {
        console.log('查询到的待处理请求数量:', requests.length);
        
        // 打印每个请求的详细信息用于调试
        requests.forEach((request, index) => {
          console.log(`请求${index+1}:`, {
            id: request.id,
            fromUserId: request.get('user')?.id,
            fromUserName: request.get('user')?.get('username'),
            status: request.get('status'),
            createdAt: request.createdAt
          });
        });
        
        const formattedRequests = requests.map(request => {
          const user = request.get('user');
          return {
            id: request.id,
            fromUser: user,
            fromUserName: user?.get('nickName') || user?.get('username') || '未知用户',
            createdAt: new Date(request.createdAt).toLocaleString()
          };
        });
        
        this.setData({
          pendingRequests: formattedRequests
        });
        
        // 如果有新的请求，可以考虑添加通知提示
        if (formattedRequests.length > 0) {
          console.log('成功加载所有待处理请求');
        } else {
          console.log('当前没有待处理的好友请求');
        }
      }).catch((error) => {
        console.error('加载好友请求失败详细信息:', {
          code: error.code,
          message: error.message,
          stack: error.stack
        });
        
        // 添加用户可见的错误提示
        wx.showToast({
          title: '加载好友请求失败，请稍后重试',
          icon: 'none'
        });
      });
    },
    
    // 显示请求操作弹窗
    showRequestActions(e) {
      const requestId = e.currentTarget.dataset.requestid;
      const request = this.data.pendingRequests.find(req => req.id === requestId);
      
      if (request) {
        this.setData({
          showActionModal: true,
          selectedRequest: request
        });
      }
    },
  
    // 隐藏请求操作弹窗
    hideActionModal() {
      this.setData({
        showActionModal: false,
        selectedRequest: null
      });
    },
  
    // 搜索用户
    onSearchInput(e) {
      this.setData({
        searchQuery: e.detail.value
      });
    },
      
    // 执行搜索
    async searchUser() {
      const keyword = this.data.searchQuery.trim();
      console.log('开始搜索，关键词:', keyword);
      
      if (!keyword) {
        wx.showToast({
          title: '请输入搜索关键词',
          icon: 'none'
        });
        return;
      }
      
      this.setData({ isSearching: true });
      
      try {
        // 检查用户是否登录
        const currentUser = AV.User.current();
        if (!currentUser) {
          console.error('用户未登录');
          this.setData({ isSearching: false });
          wx.showToast({
            title: '请先登录',
            icon: 'none'
          });
          return;
        }
        
        // 搜索用户
        const query = new AV.Query('_User');
        query.contains('username', keyword);
        query.notEqualTo('objectId', currentUser.id);
        console.log('查询条件设置完成');
        
        const users = await query.find();
        console.log('搜索结果数量:', users.length);
        console.log('搜索结果详情:', users);
        
        // 获取当前好友列表的ID，但只考虑活跃的好友关系
        // 添加对contactList是否存在的检查
        const activeFriendIds = this.data.contactList && Array.isArray(this.data.contactList) 
          ? this.data.contactList
              .filter(contact => contact.friendStatus !== false || contact.status !== 'declined')
              .map(contact => contact.id) 
          : [];
        console.log('当前活跃好友列表ID:', activeFriendIds);
        
        const searchResults = users.map(user => {
          // 从LeanCloud user类的touxiang字段（File对象）获取头像URL
          const defaultAvatarUrl = '/images/wechatdefaultpic.png';
          let avatarUrl = defaultAvatarUrl;
          
          // 优先从touxiang字段获取头像
          const touxiangFile = user.get('touxiang');
          if (touxiangFile && typeof touxiangFile.get === 'function') {
            avatarUrl = touxiangFile.get('url') || avatarUrl;
          }
          
          // 如果touxiang不存在，尝试从avatarUrl字段获取
          if (avatarUrl === defaultAvatarUrl) {
            const directAvatarUrl = user.get('avatarUrl');
            if (directAvatarUrl) {
              avatarUrl = directAvatarUrl;
            }
          }
          
          return {
            id: user.id,
            nickname: user.get('nickName') || user.get('username') || '未命名',
            avatar: avatarUrl,
            isFriend: activeFriendIds.includes(user.id) // 只将活跃的关系视为好友
          };
        });
        
        console.log('处理后的搜索结果:', searchResults);
        
        this.setData({
            searchResults: searchResults,
            isSearching: false,
            showSearchResultModal: true // 显示搜索结果弹窗
          }, () => {
            console.log('搜索结果已更新到UI并显示弹窗');
          });
      } catch (error) {
        console.error('搜索用户失败', error);
        this.setData({ isSearching: false });
        wx.showToast({
          title: '搜索失败: ' + (error.message || '未知错误'),
          icon: 'none',
          duration: 3000
        });
      }
    },
    
    // 关闭搜索结果弹窗
    closeSearchResultModal() {
      this.setData({
        showSearchResultModal: false
      });
    },
  
  // 发送好友请求 - 使用LeanCloud官方API
  sendFriendRequest(e) {
    console.log('发送好友请求开始', e);
    const userId = e.currentTarget.dataset.userid;
    const nickname = e.currentTarget.dataset.nickname;
    
    console.log('用户ID:', userId, '昵称:', nickname);
    
    if (!userId || !nickname) {
      console.error('用户ID或昵称为空');
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      });
      return;
    }
    
    // 设置选中的用户信息和默认关系
    this.setData({
      selectedUserId: userId,
      selectedNickname: nickname,
      selectedRelation: '朋友',
      showRelationSelectModal: true
    });
  },
  
  // 选择关系
  selectRelation(e) {
    const relation = e.currentTarget.dataset.relation;
    this.setData({
      selectedRelation: relation
    });
  },
  
  // 确认关系选择
  confirmRelationSelect() {
    // 检查当前是否是接受请求流程
    if (this.data.isAcceptingRequest) {
      // 如果是接受请求流程，直接调用确认接受请求的方法
      this.confirmAcceptWithRelation();
    } else {
      const userId = this.data.selectedUserId;
      const nickname = this.data.selectedNickname;
      const relation = this.data.selectedRelation;
      
      wx.showLoading({ title: '发送中...' });
      
      try {
        const currentUser = AV.User.current();
        console.log('当前用户:', currentUser ? currentUser.id : '未登录');
        
        if (!currentUser) {
          wx.hideLoading();
          wx.showToast({
            title: '请先登录',
            icon: 'none'
          });
          this.setData({ showRelationSelectModal: false });
          return;
        }
        
        // 创建目标用户对象
        const targetUser = AV.Object.createWithoutData('_User', userId);
        
        // 先检查是否已经存在关注关系
        const followeeQuery = new AV.Query('_Followee');
        followeeQuery.equalTo('user', currentUser);
        followeeQuery.equalTo('followee', targetUser);
        
        followeeQuery.first().then(existingRelation => {
          if (existingRelation) {
            // 如果已经存在关系，更新relation字段
            existingRelation.set('relation', relation);
            return existingRelation.save().then(() => {
              // 然后发送好友请求
              return AV.Friendship.request(targetUser);
            });
          } else {
            // 直接发送好友请求
            return AV.Friendship.request(targetUser);
          }
        }).then(() => {
          console.log('好友请求发送成功');
          wx.hideLoading();
          wx.showModal({
            title: '好友请求已发送',
            content: '请等待对方确认后，你们才能成为好友',
            showCancel: false,
            success: () => {
              // 刷新好友列表
              this.loadFriendList();
            }
          });
        }).catch(error => {
          console.error('添加好友失败详细信息:', error.code, error.message);
          wx.hideLoading();
                      
                      // 处理唯一性约束错误或其他错误
                      wx.showModal({
                        title: '添加失败',
                        content: error.message || '添加好友失败，请稍后重试',
                        showCancel: false
                      });
                    });
      } catch (error) {
        console.error('捕获到异常:', error);
        wx.hideLoading();
        wx.showToast({
          title: '操作异常',
          icon: 'none'
        });
      } finally {
        // 无论成功失败，都关闭模态框
        this.setData({ showRelationSelectModal: false });
      }
    }
  },
  
  // 取消关系选择
  cancelRelationSelect() {
    this.setData({
      showRelationSelectModal: false
    });
  },
    
  // 接受好友请求
  acceptFriendRequest() {
    if (!this.data.selectedRequest) {
      console.error('没有选中的请求');
      return;
    }
    
    const request = this.data.selectedRequest;
    const fromUserName = request.fromUserName || request.fromUser?.get('username') || '对方';
    
    console.log('接受好友请求，请求信息:', {
      id: request.id,
      fromUserId: request.fromUser?.id,
      fromUserName: fromUserName
    });
    
    // 设置为接受请求流程，并打开关系选择模态框
    this.setData({
      selectedRelation: '朋友', // 默认关系为朋友
      selectedNickname: fromUserName, // 设置选中的昵称，用于模态框显示
      isAcceptingRequest: true,
      showRelationSelectModal: true,
      showActionModal: false // 关闭操作弹窗
    });
  },
  
  // 确认接受好友请求并设置关系
  confirmAcceptWithRelation() {
    const request = this.data.selectedRequest;
    if (!request) {
      console.error('没有选中的请求');
      return;
    }
    
    const relation = this.data.selectedRelation;
    const fromUserName = request.fromUserName || request.fromUser?.get('username') || '对方';
    
    wx.showLoading({ title: '处理中...' });
    
    // 获取当前用户
    const currentUser = AV.User.current();
    if (!currentUser) {
      wx.hideLoading();
      wx.showToast({ title: '用户未登录', icon: 'none' });
      return;
    }
    
    const targetUser = AV.Object.createWithoutData('_User', request.fromUser.id);
    
    // 先检查是否已经存在关注关系
    const followeeQuery = new AV.Query('_Followee');
    followeeQuery.equalTo('user', currentUser);
    followeeQuery.equalTo('followee', targetUser);
    
    followeeQuery.first().then(existingRelation => {
      if (existingRelation) {
        // 如果已经存在关系，更新relation字段
        existingRelation.set('relation', relation);
        return existingRelation.save().then(() => {
          // 然后接受好友请求
          return AV.Friendship.acceptRequest(request);
        });
      } else {
        // 先接受好友请求
        return AV.Friendship.acceptRequest(request).then(() => {
          // 接受后再次查询，确保能获取到自动创建的_Followee记录
          return followeeQuery.first();
        }).then(followee => {
          if (followee) {
            // 更新自动创建的记录中的relation字段
            followee.set('relation', relation);
            return followee.save();
          } else {
            // 如果仍然没有记录，手动创建一个关注关系
            return currentUser.follow(request.fromUser.id).then(() => {
              return followeeQuery.first().then(followee => {
                if (followee) {
                  followee.set('relation', relation);
                  return followee.save();
                }
                return Promise.resolve();
              });
            });
          }
        });
      }
    }).then(() => {
      wx.hideLoading();
      wx.showModal({
        title: '已接受',
        content: `您已成功接受${fromUserName}的好友请求，关系设置为${relation}`,
        showCancel: false,
        success: () => {
          // 更新UI
          const updatedRequests = this.data.pendingRequests.filter(req => req.id !== request.id);
          
          this.setData({
            pendingRequests: updatedRequests,
            selectedRequest: null,
            isAcceptingRequest: false
          });
          
          // 刷新好友列表，显示新添加的好友
          setTimeout(() => {
            this.loadFriendList();
          }, 500);
        }
      });
    }).catch((error) => {
      wx.hideLoading();
      console.error('接受好友请求失败详细信息:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      wx.showModal({
        title: '操作失败',
        content: `接受好友请求失败：${error.message || '未知错误'}`,
        showCancel: false
      });
    }).finally(() => {
      // 无论成功失败，都关闭模态框并重置状态
      this.setData({
        showRelationSelectModal: false,
        isAcceptingRequest: false
      });
    });
  },
  
  // 拒绝好友请求
  declineFriendRequest() {
    if (!this.data.selectedRequest) {
      console.error('没有选中的请求');
      return;
    }
    
    const request = this.data.selectedRequest;
    console.log('拒绝好友请求，请求信息:', {
      id: request.id,
      fromUserId: request.fromUser?.id,
      fromUserName: request.fromUser?.get('username')
    });
    
    wx.showLoading({ title: '处理中...' });
    
    // 根据LeanCloud官方文档，使用AV.Friendship.declineRequest方法拒绝好友请求
    AV.Friendship.declineRequest(request).then(() => {
      console.log('拒绝好友请求成功');
      
      wx.hideLoading();
      wx.showToast({
        title: '已拒绝',
        icon: 'success'
      });
      
      // 更新UI
      const updatedRequests = this.data.pendingRequests.filter(req => req.id !== request.id);
      
      this.setData({
        pendingRequests: updatedRequests,
        showActionModal: false,
        selectedRequest: null
      });
    }).catch((error) => {
      wx.hideLoading();
      console.error('拒绝好友请求失败', error);
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      });
    });
  },
  
  // 关闭请求操作弹窗
  closeActionModal() {
    this.setData({
      showActionModal: false,
      selectedRequest: null
    });
  },
    
  // 解除关联（删除好友）
  removeFriend(e) {
    console.log('解除关联按钮点击事件触发', e);
    const userId = e.currentTarget.dataset.id;
    const userName = e.currentTarget.dataset.name;
    console.log('获取的用户ID:', userId);
    
    if (!userId) {
      console.error('未获取到用户ID');
      wx.showToast({
        title: '操作失败：未找到用户ID',
        icon: 'none'
      });
      return;
    }
    
    wx.showModal({
      title: '解除关联',
      content: `确定要解除与${userName}的关联吗？解除后不可重新发送关联请求。`,
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...' });
          
          // 只查询并更新当前用户对目标用户的关系记录
          // 根据LeanCloud安全规则，用户只能修改自己创建的对象
          const currentUser = AV.User.current();
          const query = new AV.Query('_Followee');
          query.equalTo('user', currentUser);
          query.equalTo('followee', AV.Object.createWithoutData('_User', userId));
          
          query.find().then((results) => {
            if (results.length === 0) {
              throw new Error('未找到好友关系记录');
            }
            
            // 更新当前用户对目标用户的关系记录
            const record = results[0];
            record.set('friendStatus', false);
            record.set('status', 'requested');

            return record.save();
          }).then(() => {
            wx.hideLoading();
            
            // 使用showModal而不是showToast，提供更明显的反馈
            wx.showModal({
              title: '解除成功',
              content: `您已成功解除与${userName}的关联关系。`,
              showCancel: false,
              success: () => {
                // 刷新好友列表
                this.loadFriendList();
                
                // 如果删除的是当前选中的关联人，清除选中状态
                if (this.data.selectedContact && this.data.selectedContact.id === userId) {
                  this.setData({ selectedContact: null });
                  wx.removeStorageSync('selectedContact');
                }
              }
            });
          }).catch((error) => {
            wx.hideLoading();
            console.error('解除关联失败', error);
            wx.showToast({
              title: '操作失败',
              icon: 'none'
            });
          });
        }
      }
    });
  },

  // 跳转到联系人具体信息界面
  goToRelationshipInfo(e) {
    // 获取当前点击的联系人ID和性别
    const contactId = e.currentTarget.dataset.contactid;
    const gender = e.currentTarget.dataset.gender;
    
    // 如果不是女性（gender不为1），不跳转到详细信息页面
    if (gender !== 1) {
      console.log(`用户${contactId}不是女性，不跳转到详细信息页面`);
      return;
    }
    
    // 查找对应的联系人信息，获取权限设置
    const contact = this.data.contactList.find(c => c.id === contactId);
    
    // 跳转到relationship_information页面并携带联系人ID和权限参数
    wx.navigateTo({
      url: `/pages/relationship_information/relationship_information?contactId=${contactId}`,
      success: () => {
        console.log(`跳转到ID为${contactId}的联系人详情页`);
      }
    })
  },
  
  // 直接打开权限设置界面
  openPermissionSettings(e) {
    const contactId = e.currentTarget.dataset.contactid;
    const contactName = e.currentTarget.dataset.name;
    
    // 直接跳转到权限设置页面
    wx.navigateTo({
      url: `/pages/relationship/permission_settings?contactId=${contactId}&contactName=${encodeURIComponent(contactName)}`,
      success: () => {
        console.log(`跳转到ID为${contactId}的权限设置页面`);
      }
    });
  }
});