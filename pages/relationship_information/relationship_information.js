// pages/relationship_information/relationship_information.js
const AV = require('../../libs/av-core-min.js');
const keyDaysManager = require('../../utils/keyDaysManager.js');

Page({
    data: {
      currentDay: '',
      currentWeekday: '',
      contactInfo: null,
      defaultDate: '',       // 日历默认日期
      markedDates: {},       // 标记日期数据
      statusText: '',        // 状态文本
      statusClass: '',       // 状态样式类
      statusIcon: '',        // 存储状态图标路径
      hasPermission: false,  // 是否有权限查看详细信息
      selectedFullDate: '',  // 当前选中的日期
      permissions: {         // 细粒度权限设置
        canViewStatus: true,
        canViewMenstruation: true,
        canViewMood: true,
        canViewPassdays: true
      }
    },
  
    onLoad(options) {
      // 获取联系人ID
      const contactId = options.contactId;
      
      this.updateDate();

      // 初始化默认日期
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const defaultDate = `${year}-${month}-${day}`;
      this.setData({
        defaultDate: defaultDate,
        selectedFullDate: defaultDate
      });

      // 初始化时间
      this.updateCurrentTime();
      setInterval(() => {
        this.updateCurrentTime();
      }, 60000);

      
      // 获取联系人详情并处理日历数据
      this.getContactDetails(contactId);
    },
    
    // 检查是否有访问权限
    async checkAccessPermission(friendId) {
      try {
        // 先检查是否是好友关系
        const currentUser = AV.User.current();
        const followeeQuery = new AV.Query('_Followee');
        followeeQuery.equalTo('user', currentUser);
        followeeQuery.equalTo('followee', AV.Object.createWithoutData('_User', friendId));
        followeeQuery.equalTo('friendStatus', true);
        const followeeResults = await followeeQuery.find();
        
        if (followeeResults.length === 0) {
          throw new Error('你们还不是好友关系');
        }
        
        // 然后检查是否有权限查看详细信息
        let hasPermission = true;
        let permissions = {
          canViewStatus: true,
          canViewMenstruation: true,
          canViewMood: true,
          canViewPassdays: true
        };
        
        try {
          // 调用getFriendPermissions方法获取对方设置的权限
          permissions = await this.getFriendPermissions(friendId);
        } catch (error) {
          console.error('检查权限过程中出错:', error);
        }
        
        this.setData({
          hasPermission: hasPermission,
          permissions: permissions
        });
        
        // 直接返回 AVObject，而不是创建一个新的普通对象
        // 将 hasPermission 属性添加到对象中
        followeeResults[0].hasPermission = hasPermission;
        followeeResults[0].permissions = permissions;
        return followeeResults[0];
      } catch (error) {
        console.error('检查访问权限失败:', error);
        this.setData({
          hasPermission: false,
          permissions: {
            canViewStatus: false,
            canViewMenstruation: false,
            canViewMood: false,
            canViewPassdays: false
          }
        });
        throw error;
      }
    },
    
    // 获取当前用户在对方的权限设置
    async getFriendPermissions(friendId) {
      try {
        const currentUser = AV.User.current();
        if (!currentUser) {
          throw new Error('用户未登录');
        }
        
        // 尝试从对方的keydays对象中获取权限设置
        const keyDaysQuery = new AV.Query('keydays');
        keyDaysQuery.equalTo('username', AV.Object.createWithoutData('_User', friendId));
        const keyDaysObj = await keyDaysQuery.first();
        
        // 如果找到了对方的keydays对象，并且有permissions字段
        if (keyDaysObj && keyDaysObj.get('permissions')) {
          const keyDaysPermissions = keyDaysObj.get('permissions');
          // 获取当前用户ID对应的权限设置
          const userPermissions = keyDaysPermissions[currentUser.id];
          
          // 如果有针对当前用户的权限设置，返回它；否则返回默认权限
          if (userPermissions) {
            return {
              canViewStatus: userPermissions.canViewStatus !== false,
              canViewMenstruation: userPermissions.canViewMenstruation !== false,
              canViewMood: userPermissions.canViewMood !== false,
              canViewPassdays: userPermissions.canViewPassdays !== false
            };
          }
        }
        
        // 如果没有找到对方的keydays对象或权限设置，返回默认权限
        return {
          canViewStatus: true,
          canViewMenstruation: true,
          canViewMood: true,
          canViewPassdays: true
        };
      } catch (error) {
        console.error('获取好友权限设置失败:', error);
        // 出错时返回默认权限
        return {
          canViewStatus: true,
          canViewMenstruation: true,
          canViewMood: true,
          canViewPassdays: true
        };
      }
    },

    updateDate() {
        const date = new Date();
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        this.setData({
          currentDay: date.getDate().toString(),
          currentWeekday: days[date.getDay()]
        });
      },
  
    // 获取联系人详情
    getContactDetails(contactId) {
      wx.showLoading({ title: '加载中...' });
      
      // 先检查访问权限
      this.checkAccessPermission(contactId).then(followeeRelation => {
        // 获取关联人的用户信息
        const userQuery = new AV.Query('_User');
        return userQuery.get(contactId).then(user => {
          // 获取联系人头像 - 从LeanCloud user类的touxiang字段（File对象）获取
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
          
          // 基础信息，无论是否有权限都显示
          const contactInfo = {
            id: user.id,
            nickname: user.get('nickName') || user.get('username') || '未命名',
            // 从LeanCloud user类的avatar字段（File对象）获取头像URL
            avatar: avatarUrl,
            relation: followeeRelation.get('relation') || '朋友',
            lastUpdate: new Date().toISOString().split('T')[0]
          };
          
          // 获取权限设置
          const permissions = followeeRelation.permissions || this.data.permissions;
          
          // 根据权限设置获取详细信息
          if (followeeRelation.hasPermission) {
            // 根据canViewStatus权限决定是否显示状态信息
            if (permissions.canViewStatus) {
              contactInfo.status = user.get('state') || 'unknown';
              contactInfo.state = this.getStatusIcon(user.get('state') || 'unknown');
            }
            
            // 根据canViewMood权限决定是否显示心情信息
            if (permissions.canViewMood) {
              contactInfo.mood = user.get('mood') || '未设置';
            }
            
            // 根据canViewStatus权限决定是否显示提示信息
            if (permissions.canViewStatus) {
              // 同时传递状态、心情和关系参数
            const tipsObj = this.generateTips(user.get('state') || 'unknown', user.get('mood'), contactInfo.relation);
            contactInfo.statusTip = tipsObj.statusTip;
            contactInfo.moodTip = tipsObj.moodTip;
            }
            
            // 根据canViewMenstruation权限决定是否显示上次月经日期
            if (permissions.canViewMenstruation) {
              contactInfo.lastMenstruation = this.getLastMenstruation(user);
            }
            
            // 根据canViewCycleData权限决定是否显示周期数据
            if (permissions.canViewPassdays) {
              contactInfo.cycleData = this.getPassDays(user);
            }
          }
          
          // 状态配置（与male_home保持一致的状态体系）
          const statusConfig = {
            menstrual: { text: "月经期", class: "status-menstrual" },
            follicular: { text: "卵泡期", class: "status-follicular" },
            ovulation: { text: "排卵期", class: "status-ovulation" },
            luteal: { text: "黄体期", class: "status-luteal" },
            unknown: { text: "未知", class: "status-unknown" }
          };
          
          // 根据canViewCycleData权限决定是否生成日历标记
          const markedDates = followeeRelation.hasPermission && permissions.canViewPassdays && contactInfo.cycleData ? 
            this.generateMarkedDates(contactInfo.passdays) : {};
          
          // 根据canViewStatus权限决定状态文本
          let statusText = '未开放';
          let statusClass = 'status-unknown';
          
          if (followeeRelation.hasPermission && permissions.canViewStatus && contactInfo.status) {
            statusText = statusConfig[contactInfo.status]?.text || '未知';
            statusClass = statusConfig[contactInfo.status]?.class || 'status-unknown';
          } else if (followeeRelation.hasPermission && !permissions.canViewStatus) {
            statusText = '状态未开放';
            statusClass = 'status-unknown';
          }
          
          this.setData({
            contactInfo: contactInfo,
            markedDates: markedDates,
            statusText: statusText,
            statusClass: statusClass
          });
        });
      }).catch(error => {
        console.error('获取联系人详情失败', error);
        wx.showToast({
          title: '加载失败：' + error.message,
          icon: 'none'
        });
      }).finally(() => {
        wx.hideLoading();
      });
    },
    
    // 获取状态对应的图标
    getStatusIcon(status) {
      const iconMap = {
        menstrual: '/images/icon_state_menstrual.png',
        follicular: '/images/icon_state_follicular.png',
        ovulation: '/images/icon_state_ovulation.png',
        luteal: '/images/icon_state_Luteal.png'
      };
      return iconMap[status] || '/images/icon_state_follicular.png';
    },
    
     // 生成提示信息 - 将状态提示和心情提示分开，并根据关系提供个性化建议
    generateTips(status, mood, relation) {
      // 基础状态提示
      const baseTips = {
        menstrual: '她今天处于月经期，可能会肚子疼',
        follicular: '经期结束！状态回温！',
        ovulation: '她现在处于排卵期，可能有轻微身体不适',
        luteal: '由于雌激素和孕激素影响，她情绪可能会有些波动',
        unknown: '她的状态信息暂不可用'
      };
      
      // 心情特定提示
      const moodModifiers = {
        low: {
          general: '她今天心情低落',
          suggestions: {
            '恋人': ['可以给她一个温暖的拥抱', '带她出去散散心', '为她准备小惊喜'],
            '家人': ['多关心她的感受', '为她准备爱吃的饭菜', '陪她聊聊天'],
            '朋友': ['约她出去喝杯奶茶', '给她讲个笑话', '陪她做喜欢的事']
          }
        },
        anxious: {
          general: '她今天有点焦虑',
          suggestions: {
            '恋人': ['给她安全感', '耐心倾听她的担忧', '带她做放松的活动'],
            '家人': ['多陪伴她', '给她一些鼓励的话', '帮她分担压力'],
            '朋友': ['避免让她感到压力', '陪她一起做能让她放松的事']
          }
        },
        happy: {
          general: '她今天心情很好',
          suggestions: {
            '恋人': ['可以一起出去约会', '分享一些好消息', '安排一个惊喜活动'],
            '家人': ['可以一起做些愉快的事情', '分享她的快乐', '一起规划家庭活动'],
            '朋友': ['约她一起做些活动', '分享生活中的趣事', '一起庆祝她的好心情']
          }
        },
        tired: {
          general: '她今天感觉疲惫',
          suggestions: {
            '恋人': ['让她多休息', '为她准备舒适的环境', '主动承担家务'],
            '家人': ['让她多休息', '帮她分担一些事情', '准备一些有营养的食物'],
            '朋友': ['不要过多打扰她', '提醒她注意休息', '必要时提供帮助']
          }
        }
      };
      
      // 状态特定的建议
      const statusSuggestions = {
        menstrual: {
          '恋人': ['可以为她准备热饮', '帮她按摩腹部', '主动承担家务'],
          '家人': ['避免让她受凉', '准备清淡易消化的食物', '不要让她做重活'],
          '朋友': ['不要和她开玩笑', '如果她需要可以陪她去买卫生用品', '给她提供温暖的关心']
        },
        follicular: {
          '恋人': ['可以和她一起做户外运动', '安排一些轻松的约会', '带她去做她喜欢的事情'],
          '家人': ['可以做一些户外运动', '关注她的状态恢复情况', '多鼓励她'],
          '朋友': ['可以约她出去活动', '她现在精力充沛很适合社交', '一起做有活力的事情']
        },
        ovulation: {
          '恋人': ['需要特别注意', '提醒她注意避孕或备孕', '给予更多关心和理解'],
          '家人': ['需要特别注意', '提醒她注意身体', '多关心她的感受'],
          '朋友': ['如果她有备孕计划可以给予支持', '注意她的身体变化', '避免过度劳累']
        },
        luteal: {
          '恋人': ['多些耐心和理解', '网上的安全期并不安全，请做好避孕措施！', '可以提醒她月经快到了，准备好卫生巾', '多迁就她的情绪变化'],
          '家人': ['多些耐心和理解', '可以提醒她月经快到了，准备好卫生巾', '避免和她发生争执'],
          '朋友': ['多理解她的情绪变化', '不要在她面前过度抱怨', '保持适度的社交距离']
        }
      };
      
      // 初始化返回对象
      const result = {
        statusTip: '',
        moodTip: ''
      };
      
      // 处理状态提示
      const baseTip = baseTips[status] || baseTips.unknown;
      
      if (statusSuggestions[status] && relation) {
        // 获取当前关系对应的状态建议，如果没有则使用默认关系（朋友）的建议
        const relationSuggestions = statusSuggestions[status][relation] || statusSuggestions[status]['朋友'] || [];
        if (relationSuggestions.length > 0) {
          const randomStatusSuggestion = relationSuggestions[Math.floor(Math.random() * relationSuggestions.length)];
          result.statusTip = baseTip + '，' + randomStatusSuggestion;
        } else {
          result.statusTip = baseTip;
        }
      } else {
        result.statusTip = baseTip;
      }
      
      // 处理心情提示
      if (mood && mood !== '未设置' && mood !== 'normal') {
        const moodModifier = moodModifiers[mood] || { general: '', suggestions: {} };
        
        if (moodModifier.suggestions && relation) {
          // 获取当前关系对应的心情建议，如果没有则使用默认关系（朋友）的建议
          const relationSuggestions = moodModifier.suggestions[relation] || moodModifier.suggestions['朋友'] || [];
          if (relationSuggestions.length > 0) {
            const randomMoodSuggestion = relationSuggestions[Math.floor(Math.random() * relationSuggestions.length)];
            result.moodTip = moodModifier.general + '，' + randomMoodSuggestion;
          } else {
            result.moodTip = moodModifier.general;
          }
        } else {
          result.moodTip = moodModifier.general;
        }
      }
      
      return result;
    },
    
    
    // 从用户数据中提取周期数据
    getPassDays(user) {
      const Passdays = {};
      
      // 尝试获取月经相关信息
      const myear = user.get('myear');
      const mmonth = user.get('mmonth');
      const mday = user.get('mday');
      const cycleLength = user.get('cycleLength') || 28;
      const periodLength = user.get('periodLength') || 5;
      
      if (myear && mmonth && mday) {
        // 计算当前月份中的日期
        const today = new Date();
        const currentMonth = today.getMonth() + 1;
        const currentYear = today.getFullYear();
        
        // 计算排卵期（通常是下次月经前14天）
        const ovulationDay = cycleLength - 14;
        
        // 生成周期数据
        Passdays.menstrual = { start: 1, end: periodLength }; 
        Passdays.ovulation = { 
          start: Math.max(1, ovulationDay - 1), 
          end: Math.min(cycleLength, ovulationDay + 1) 
        };
        Passdays.cycleLength = cycleLength;
      }
      
      return Passdays;
    },
    
    // 获取上次月经日期
    getLastMenstruation(user) {
      const myear = user.get('myear');
      const mmonth = user.get('mmonth');
      const mday = user.get('mday');
      
      if (myear && mmonth && mday) {
        return `${myear}年${mmonth}月${mday}日`;
      }
      return '暂无数据';
    },
  
    // 生成日历标记数据
    generateMarkedDates(Passdays) {
      const markedDates = {};
      
      // 获取当前月份的第一天和最后一天
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const daysInMonth = lastDay.getDate();
      
      // 如果有cycleData，则根据cycleData生成标记
      if (Passdays && Passdays.menstrual && Passdays.ovulation) {
        // 生成当月的标记数据
        for (let day = 1; day <= daysInMonth; day++) {
          const currentDate = new Date(year, month, day);
          const dateKey = currentDate.toISOString().split('T')[0];
          
          if (day >= Passdays.menstrual.start && day <= Passdays.menstrual.end) {
            // 月经
            markedDates[dateKey] = {
              dotColor: '#ff6b81',
              type: 'dot',
              text: '经期',
              textColor: '#ff6b81'
            };
          } else if (day >= Passdays.ovulation.start && day <= Passdays.ovulation.end) {
            // 排卵期
            markedDates[dateKey] = {
              dotColor: '#52c41a',
              type: 'dot',
              text: '排卵',
              textColor: '#52c41a'
            };
          } else if (day > Passdays.menstrual.end && day < Passdays.ovulation.start) {
            // 卵泡期
            markedDates[dateKey] = {
              dotColor: '#1890ff',
              type: 'dot',
              text: '卵泡',
              textColor: '#1890ff'
            };
          } else {
            // 黄体期
            markedDates[dateKey] = {
              dotColor: '#faad14',
              type: 'dot',
              text: '黄体',
              textColor: '#faad14'
            };
          }
        }
      } else {
        // 如果没有cycleData，生成默认的标记
        for (let day = 1; day <= daysInMonth; day++) {
          const currentDate = new Date(year, month, day);
          const dateKey = currentDate.toISOString().split('T')[0];
          
          // 默认简单周期：1-5天为月经期，14-16天为排卵期，其余根据位置分配
          if (day >= 1 && day <= 5) {
            markedDates[dateKey] = {
              dotColor: '#ff6b81',
              type: 'dot',
              text: '经期',
              textColor: '#ff6b81'
            };
          } else if (day >= 14 && day <= 16) {
            markedDates[dateKey] = {
              dotColor: '#52c41a',
              type: 'dot',
              text: '排卵',
              textColor: '#52c41a'
            };
          } else if (day >= 6 && day <= 13) {
            markedDates[dateKey] = {
              dotColor: '#1890ff',
              type: 'dot',
              text: '卵泡',
              textColor: '#1890ff'
            };
          } else {
            markedDates[dateKey] = {
              dotColor: '#faad14',
              type: 'dot',
              text: '黄体',
              textColor: '#faad14'
            };
          }
        }
      }
      
      return markedDates;
    },
    
    // 日期选择事件
    onDateSelect(e) {
      const selectedDate = e.detail.date;
      console.log('Selected date:', selectedDate);
      
      // 检查是否有权限查看详细信息
      if (!this.data.hasPermission) {
        wx.showToast({
          title: '对方未开放此权限',
          icon: 'none'
        });
        return;
      }
      
      // 显示选中日期的详细信息
      if (selectedDate && this.data.markedDates[selectedDate]) {
        const dateInfo = this.data.markedDates[selectedDate];
        wx.showModal({
          title: selectedDate,
          content: `状态: ${dateInfo.text || '未知'}`,
          showCancel: false
        });
      }
    },
    
    // 日历日期选择事件（针对组件）
    onCalendarDateSelect(e) {
      const selectedFullDate = e.detail.date;
      this.setData({ selectedFullDate });
      wx.setStorageSync('selectedDate', selectedFullDate);
      this.onDateSelect({detail: {date: selectedFullDate}});
    },
    
    onCalendarDayClick(e) {
      console.log('选中的日期:', e.detail.date);
      this.onDateSelect({detail: {date: e.detail.date}});
    },
    
    // 更新当前时间
    updateCurrentTime() {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const seconds = now.getSeconds().toString().padStart(2, '0');
      const currentTime = `${hours}:${minutes}:${seconds}`;
      
      this.setData({
        currentTime: currentTime
      });
    },
    
    // 导航返回
    navigateBack() {
      wx.navigateBack();
    }
  });
      