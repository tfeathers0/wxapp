const AV = require('../../libs/av-core-min.js')
Page({
  data: {
    currentDay: new Date().getDate(),
    currentMonth: new Date().getMonth() + 1,
    currentYear: new Date().getFullYear(),
    currentWeekday: new Date().getDay(),
    activeTab: 0,
    tabs: ['知识库', '+', '我的'],
    weekDays: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'],
    // 生理周期相关
    currentPeriod: '',
    currentCycleDay: 0,
    indicatorPosition: '0%', // 初始化为带有%的字符串
    periodNames: ['月经期', '卵泡期', '排卵期', '黄体期'],
    // 默认周期长度为28天
    cycleLength: 28,
    // 假设周期为28天，不同阶段的天数分布（与UI显示顺序保持一致）
    periodDistribution: {
      1: { start: 1, end: 5, name: '月经期', color: '#d792a5', percentage: 17.86 },     // 红色段
      2: { start: 6, end: 13, name: '卵泡期', color: '#a5cdd7', percentage: 28.57 },    // 蓝色段
      3: { start: 14, end: 18, name: '排卵期', color: '#8198c2', percentage: 17.86 },  // 浅蓝色段
      4: { start: 19, end: 28, name: '黄体期', color: '#dcb8ba', percentage: 35.71 }   // 粉色段
    },
    // 知识滚动相关
    currentKnowledgeIndex: 0,
    knowledgeTimer: null,
    // 添加弹窗相关数据
    showPopup: false,
    todayString: '',
    // 用户周期设置对象
    userCycleSettings: {
      cycleLength: 28,
      periodLength: 5,
      lastPeriodStart: null
    },
    // 用户最后一次经期开始日期
    lastPeriodStart: null
  },

  onLoad: async function () {
    // 设置一个默认的指示器位置作为后备
    this.setData({
      indicatorPosition: '30%'
    });
    
    await this.loadUserSettings();
    await this.calculateCycleInfo(); // 添加await确保指示器位置计算完成
    this.formatTodayDate();

    // 检查是否是首次使用应用
    const isFirstTime = wx.getStorageSync('isFirstTime');
    
    if (isFirstTime === '') {
      // 首次使用，显示欢迎弹窗
      this.setData({
        showPopup: true,
        popupMessage: '欢迎使用月伴'
      });
      // 标记为已使用过
      wx.setStorageSync('isFirstTime', 'false');
    } else {
      // 老用户 -> 去 LeanCloud 取数据
      this.loadNextPeriodDate();
    }
    
    // 启动知识内容自动滚动
    this.startKnowledgeScroll();
  },

  // 格式化日期
  formatTodayDate: function () {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const weekDays = ['周日','周一','周二','周三','周四','周五','周六'];
    const weekday = weekDays[now.getDay()];

    // 分开存储日期和星期
    this.setData({
      popupDateString: `${year}年${month}月${day}日`,
      popupWeekdayString: weekday
    });
  },

  closePopup: function () {
    this.setData({ showPopup: false });
  },

  // 从 LeanCloud 加载用户设置
  loadUserSettings: async function () {
    const currentUser = AV.User.current();
    if (!currentUser) {
      // 未登录时，使用默认周期长度
      return;
    }

    try {
      const query = new AV.Query('_User');
      query.equalTo('objectId', currentUser.id);
      const result = await query.first();
      
      if (result) {
        const cycleLength = result.get('cycleLength') || 28;
        const periodLength = result.get('periodLength') || 5;
        const lastPeriodStart = result.get('lastPeriodStart');
        
        // 同时更新userCycleSettings对象和直接可访问的cycleLength属性
        this.setData({
          'userCycleSettings.cycleLength': cycleLength,
          'userCycleSettings.periodLength': periodLength,
          'userCycleSettings.lastPeriodStart': lastPeriodStart,
          cycleLength: cycleLength,
          lastPeriodStart: lastPeriodStart
        });
      }
    } catch (err) {
      console.error('获取用户设置失败', err);
      // 出错时确保使用默认周期长度
      this.setData({
        cycleLength: 28
      });
    }
  },

  // 计算两个日期之间的天数差
  calculateDaysDifference: function(date1, date2) {
    const oneDay = 24 * 60 * 60 * 1000; // 毫秒/天
    const firstDate = new Date(date1);
    const secondDate = new Date(date2);
    
    // 重置时间为同一天开始，避免时间部分影响计算
    firstDate.setHours(0, 0, 0, 0);
    secondDate.setHours(0, 0, 0, 0);
    
    const diffDays = Math.round(Math.abs((firstDate - secondDate) / oneDay));
    return diffDays;
  },

  // 从 LeanCloud 查询下次月经日期
  loadNextPeriodDate: async function () {
    const currentUser = AV.User.current();
    if (!currentUser) {
      this.setData({
        showPopup: true,
        popupMessage: '记得登录后设置周期'
      });
      return;
    }

    try {
      // 首先从用户自定义表中查询周期信息
      const className = this.getUserClassName();
      if (className) {
        await this.ensureUserClass();
        
        const cycleInfoQuery = new AV.Query(className);
        cycleInfoQuery.equalTo('type', 'cycleInfo');
        const cycleInfoResult = await cycleInfoQuery.first();
        
        if (cycleInfoResult) {
          const futurePeriod = cycleInfoResult.get('futurePeriod');
          if (futurePeriod) {
            const dateObj = new Date(futurePeriod);
            const year = dateObj.getFullYear();
            const month = dateObj.getMonth() + 1;
            const day = dateObj.getDate();

            // 计算距离下次月经的天数
            const today = new Date();
            const daysUntilNextPeriod = this.calculateDaysDifference(today, dateObj);

            let message = `下次月经预计始于：${year}年${month}月${day}日`;

            if (dateObj > today) {
              message += `\n距离来月经还有 ${daysUntilNextPeriod} 天哦，记得做好准备～`;

              // 添加卫生棉提醒
              if (daysUntilNextPeriod <= 5) {
                message += "\n小贴士：别忘了带上卫生棉，保持舒适和安心~";
              }
            } else if (
              dateObj.getDate() === today.getDate() &&
              dateObj.getMonth() === today.getMonth() &&
              dateObj.getFullYear() === today.getFullYear()
            ) {
              message += "\n今天是预计的月经开始日\n温馨提示：注意休息，照顾好自己哦~";
            } else {
              message += `\n月经已经延迟 ${daysUntilNextPeriod} 天了，建议关注身体状况～`;
            }

            this.setData({
              showPopup: true,
              popupMessage: message
            });
            return;
          }
        }
      }

      // 如果用户自定义表中没有数据，再从 _User 表中查询
      const query = new AV.Query('_User');
      query.equalTo('objectId', currentUser.id);
      const result = await query.first();

      if (result) {
        const nextPeriod = result.get('nextPeriod');
        if (nextPeriod) {
          const dateObj = new Date(nextPeriod);
          const year = dateObj.getFullYear();
          const month = dateObj.getMonth() + 1;
          const day = dateObj.getDate();

          // 计算距离下次月经的天数
          const today = new Date();
          const daysUntilNextPeriod = this.calculateDaysDifference(today, dateObj);

          let message = `下次月经预计始于：${year}年${month}月${day}日`;

          if (dateObj > today) {
            message += `\n距离来月经还有 ${daysUntilNextPeriod} 天哦，记得做好准备～`;

            // 添加卫生棉提醒
            if (daysUntilNextPeriod <= 5) {
              message += "\n小贴士：别忘了带上卫生棉，保持舒适和安心~";
            }
          } else if (
            dateObj.getDate() === today.getDate() &&
            dateObj.getMonth() === today.getMonth() &&
            dateObj.getFullYear() === today.getFullYear()
          ) {
            message += "\n今天是预计的月经开始日\n温馨提示：注意休息，照顾好自己哦~";
          } else {
            message += `\n月经已经延迟 ${daysUntilNextPeriod} 天了，建议关注身体状况～`;
          }

          this.setData({
            showPopup: true,
            popupMessage: message
          });
          return;
        }
      }

      // 没有数据
      this.setData({
        showPopup: true,
        popupMessage: '还没有设置下次月经日呢～\n快来记录吧，让月伴更好地陪伴你~'
      });

    } catch (err) {
      console.error('查询失败', err);
      this.setData({
        showPopup: true,
        popupMessage: '抱歉，暂时无法获取数据～记得设置下次月经日，让月伴贴心提醒你哦~'
      });
    }
  },  

  // 显示自定义弹窗
  showCustomPopup: function(title, content) {
    this.setData({
      showPopup: true,
      popupTitle: title,
      popupContent: content
    });
  },

  // 隐藏弹窗
  hidePopup: function() {
    this.setData({ showPopup: false });
  },

  // 弹窗确认事件
  onPopupConfirm: function() {
    console.log('弹窗确认按钮被点击');
    this.hidePopup();
  },
  // 开始知识内容自动滚动
  startKnowledgeScroll: function() {
    const totalKnowledgeItems = 5; // 知识条目总数
    
    // 清除之前的定时器（如果存在）
    if (this.data.knowledgeTimer) {
      clearInterval(this.data.knowledgeTimer);
    }
    
    // 设置新的定时器，每3秒切换一次知识内容
    const timer = setInterval(() => {
      this.setData({
        currentKnowledgeIndex: (this.data.currentKnowledgeIndex + 1) % totalKnowledgeItems
      });
    }, 3000);
    
    this.setData({ knowledgeTimer: timer });
  },

  // 页面卸载时清除定时器
  onUnload: function() {
    if (this.data.knowledgeTimer) {
      clearInterval(this.data.knowledgeTimer);
    }
  },
  
  // 获取用户类名（与female_calendar.js中保持一致）
  getUserClassName: function() {
    if (!AV.User.current()) return null;
    const username = AV.User.current().getUsername();
    return `User_${username.replace(/[^a-zA-Z0-9]/g, '_')}`;
  },
  
  // 确保用户类存在
  ensureUserClass: async function() {
    const className = this.getUserClassName();
    if (!className) return false;
    const query = new AV.Query(className);
    try {
      await query.first();
      return true;
    } catch {
      const UserClass = AV.Object.extend(className);
      const userObj = new UserClass();
      userObj.set('initialized', true);
      await userObj.save();
      return true;
    }
  },

  // 计算并更新生理周期信息 - 改为基于用户实际记录的经期时间
  calculateCycleInfo: async function() {
    const now = new Date();
    const cycleLength = this.data.cycleLength;
    let lastPeriodStart = this.data.lastPeriodStart;
    
    // 如果本地没有最后一次经期开始日期，尝试从云端获取
    if (!lastPeriodStart) {
      try {
        const className = this.getUserClassName();
        if (className) {
          await this.ensureUserClass();
          
          // 从用户自定义类中获取周期信息
          const CycleInfo = new AV.Query(className);
          CycleInfo.equalTo('type', 'cycleInfo');
          const cycleInfoObj = await CycleInfo.first();
          
          if (cycleInfoObj && cycleInfoObj.get('nowPeriod')) {
            lastPeriodStart = cycleInfoObj.get('nowPeriod');
            this.setData({ lastPeriodStart });
          }
        }
      } catch (err) {
        console.error('获取用户周期信息失败:', err);
      }
    }
    
    // 如果有用户实际记录的经期开始日期，使用它来计算
    if (lastPeriodStart) {
      const lastPeriodDate = new Date(lastPeriodStart);
      const daysSinceLastPeriod = this.calculateDaysDifference(lastPeriodDate, now);
      const currentCycleDay = daysSinceLastPeriod + 1;
      
      console.log('有实际记录 - 周期天数:', currentCycleDay);
      console.log('周期分布 - 月经期:', this.data.periodDistribution[1].start, '-', this.data.periodDistribution[1].end);
      console.log('周期分布 - 卵泡期:', this.data.periodDistribution[2].start, '-', this.data.periodDistribution[2].end);
      console.log('周期分布 - 排卵期:', this.data.periodDistribution[3].start, '-', this.data.periodDistribution[3].end);
      console.log('周期分布 - 黄体期:', this.data.periodDistribution[4].start, '-', this.data.periodDistribution[4].end);
      
      // 设置当前生理周期
      const currentPeriod = this.getMenstrualPeriod(currentCycleDay);
      console.log('当前生理周期:', currentPeriod);
      
      // 计算指示器位置
      const indicatorPosition = this.calculateAccurateIndicatorPosition(currentCycleDay);
      
      console.log('有实际记录 - 指示器位置:', indicatorPosition);
      this.setData({
        currentPeriod: currentPeriod,
        currentCycleDay: currentCycleDay,
        indicatorPosition: indicatorPosition
      });
      
      console.log('设置数据后 - 指示器位置:', this.data.indicatorPosition);
      
      // 更新到 LeanCloud 的 state 字段
      await this.updateUserStateToCloud(currentPeriod);
    } else {
      // 如果没有用户实际记录的经期开始日期，使用原有的计算方式
      const referenceDate = new Date('2023-01-01');
      const daysSinceReference = this.calculateDaysDifference(referenceDate, now);
      const currentCycleDay = (daysSinceReference % cycleLength) + 1;
      
      console.log('无实际记录 - 周期天数:', currentCycleDay, '周期长度:', cycleLength);
      console.log('周期分布 - 月经期:', this.data.periodDistribution[1].start, '-', this.data.periodDistribution[1].end);
      console.log('周期分布 - 卵泡期:', this.data.periodDistribution[2].start, '-', this.data.periodDistribution[2].end);
      console.log('周期分布 - 排卵期:', this.data.periodDistribution[3].start, '-', this.data.periodDistribution[3].end);
      console.log('周期分布 - 黄体期:', this.data.periodDistribution[4].start, '-', this.data.periodDistribution[4].end);
      
      // 设置当前生理周期
      const currentPeriod = this.getMenstrualPeriod(currentCycleDay);
      console.log('当前生理周期:', currentPeriod);
      
      // 计算指示器位置
      const indicatorPosition = this.calculateAccurateIndicatorPosition(currentCycleDay);
      
      console.log('无实际记录 - 指示器位置:', indicatorPosition);
      this.setData({
        currentPeriod: currentPeriod,
        currentCycleDay: currentCycleDay,
        indicatorPosition: indicatorPosition
      });
      
      console.log('设置数据后 - 指示器位置:', this.data.indicatorPosition);
    }
  },
  
  // 将用户当前生理周期状态更新到 LeanCloud
  updateUserStateToCloud: async function(state) {
    try {
      const currentUser = AV.User.current();
      if (!currentUser) {
        console.log('用户未登录，无法更新状态');
        return;
      }
      
      // 将中文状态转换为英文状态
      let englishState = '';
      switch(state) {
        case '月经期':
          englishState = 'menstrual';
          break;
        case '卵泡期':
          englishState = 'follicular';
          break;
        case '排卵期':
          englishState = 'ovulation';
          break;
        case '黄体期':
          englishState = 'luteal';
          break;
        default:
          englishState = 'unknown';
      }
      
      // 1. 更新 _User 表中的 state 字段
      currentUser.set('state', englishState);
      await currentUser.save();
      console.log('用户状态已更新到 _User 表');
      
      // 2. 同时更新到用户自定义表中
      const className = this.getUserClassName();
      if (className) {
        await this.ensureUserClass();
        
        // 查找或创建 state 记录
        const StateQuery = new AV.Query(className);
        StateQuery.equalTo('type', 'state');
        let stateObj = await StateQuery.first();
        
        if (stateObj) {
          stateObj.set('currentState', englishState);
          stateObj.set('updateTime', new Date());
          await stateObj.save();
        } else {
          const UserClass = AV.Object.extend(className);
          const newStateObj = new UserClass();
          newStateObj.set('type', 'state');
          newStateObj.set('currentState', englishState);
          newStateObj.set('updateTime', new Date());
          await newStateObj.save();
        }
        console.log('用户状态已更新到自定义用户表');
      }
    } catch (err) {
      console.error('更新用户状态失败:', err);
    }
  },
  
  // 精确计算指示器位置，考虑各周期段在UI中的实际宽度分布
  calculateAccurateIndicatorPosition: function(day) {
    // 使用与getMenstrualPeriod相同的数据源，确保周期阶段判断一致
    const cycleLength = this.data.cycleLength;
    let accumulatedPercentage = 0;
    
    // 对日期进行归一化处理，确保与getMenstrualPeriod方法判断一致
    const normalizedDay = (day - 1) % cycleLength + 1;
    console.log('原始日期:', day, '归一化日期:', normalizedDay, '周期长度:', cycleLength);
    
    // 使用与UI显示顺序一致的周期阶段
    const periodStages = [
      this.data.periodDistribution[1], // 月经期
      this.data.periodDistribution[2], // 卵泡期
      this.data.periodDistribution[3], // 排卵期
      this.data.periodDistribution[4]  // 黄体期
    ];
    
    // 当前UI中各周期段的百分比宽度
    const uiWidths = [17.86, 28.57, 17.86, 35.71]; // 对应UI顺序：月经期(17.86%), 卵泡期(28.57%), 排卵期(17.86%), 黄体期(35.71%)
    
    // 找到当前日期所在的周期阶段
    for (let i = 0; i < periodStages.length; i++) {
      const stage = periodStages[i];
      // 基于用户的周期长度调整阶段范围
      const start = Math.round((stage.start / 28) * cycleLength);
      const end = Math.round((stage.end / 28) * cycleLength);
      
      console.log('阶段', i+1, ':', stage.name, '范围:', start, '-', end);
      if (normalizedDay >= start && normalizedDay <= end) {
        console.log('当前日期在阶段', i+1, '-', stage.name);
        // 计算在当前阶段内的相对位置
        const daysInStage = end - start + 1;
        const relativePosition = (normalizedDay - start) / daysInStage;
        console.log('阶段天数:', daysInStage, '相对位置:', relativePosition);
        // 计算在UI中的绝对位置
        const positionPercentage = accumulatedPercentage + (relativePosition * uiWidths[i]);
        console.log('计算位置百分比:', positionPercentage);
        // 返回带有%符号的字符串，确保CSS正确解析为百分比
        return positionPercentage + '%';
      }
      // 累加前一个阶段的宽度百分比
      accumulatedPercentage += uiWidths[i];
    }
    
    console.log('未找到匹配的周期阶段，返回默认位置');
    return '0%'; // 默认位置
  },
  
  // 根据日期获取当前生理周期
  getMenstrualPeriod: function(day) {
    // 使用用户设置的周期长度来计算当前生理周期
    const cycleLength = this.data.cycleLength;
    const normalizedDay = (day - 1) % cycleLength + 1;
    
    console.log('getMenstrualPeriod - 原始日期:', day, '归一化日期:', normalizedDay, '周期长度:', cycleLength);
    
    // 根据用户的周期长度调整各阶段的天数范围
    // 使用数组确保遍历顺序与UI显示顺序一致
    const periodStages = [
      this.data.periodDistribution[1], // 月经期
      this.data.periodDistribution[2], // 卵泡期
      this.data.periodDistribution[3], // 排卵期
      this.data.periodDistribution[4]  // 黄体期
    ];
    
    for (let i = 0; i < periodStages.length; i++) {
      const stage = periodStages[i];
      // 基于用户的周期长度调整阶段范围
      const start = Math.round((stage.start / 28) * cycleLength);
      const end = Math.round((stage.end / 28) * cycleLength);
      
      console.log('getMenstrualPeriod - 阶段', i+1, ':', stage.name, '范围:', start, '-', end);
      if (normalizedDay >= start && normalizedDay <= end) {
        console.log('getMenstrualPeriod - 当前日期在阶段', i+1, '-', stage.name);
        return stage.name;
      }
    }
    
    console.log('getMenstrualPeriod - 未找到匹配的周期阶段');
    return null;
  },

  // 点击关联切换按钮
  onSwitchClick: function() {
    try {
      wx.navigateTo({
        url: '../relationship/relationship'
      });
    } catch (error) {
      console.log('页面不存在');
      wx.showToast({
        title: '页面开发中',
        icon: 'none'
      });
    }
  },

  // 点击知识卡片
  onKnowledgeClick: function() {
    try {
      wx.navigateTo({
        url: '../knowledge/knowledge'
      });
    } catch (error) {
      console.log('页面不存在');
      wx.showToast({
        title: '页面开发中',
        icon: 'none'
      });
    }
  },

  // 点击日期卡片
  onDateCardClick: function() {
    wx.navigateTo({
      url: '../female_calendar/female_calendar'
    });
  },

  // 点击选项卡
  onTabClick: function(e) {
    const tabIndex = e.currentTarget.dataset.index;
    
    // 设置当前激活的选项卡
    this.setData({
      activeTab: tabIndex
    });
    
    // 点击加号按钮时调用微信扫一扫
    if (tabIndex === 1) {
      wx.scanCode({
        onlyFromCamera: true, // 只允许从相机扫码
        success: (res) => {
          console.log('扫码结果:', res.result);
          // 这里可以处理扫码成功后的逻辑
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
    } else if (tabIndex === 0) {
      // 点击知识库选项卡
      wx.navigateTo({
        url: '../knowledge_base/knowledge_base'
      });
    } else if (tabIndex === 2) {
      // 点击我的选项卡
      wx.navigateTo({
        url: '../my_homepage/my_homepage'
      });
    }
  },
  
  // 导航到知识库
  switchToKnowledge: function() {
    wx.navigateTo({
      url: '../knowledge_base/knowledge_base'
    });
  },
  
  // 扫码功能
  switchToScan: function() {
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
  
  // 导航到我的页面
  switchToMine: function() {
    wx.navigateTo({
      url: '../my_homepage/my_homepage'
    });
  }
})