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
    indicatorPosition: 0,
    periodNames: ['月经期', '卵泡期', '排卵期', '黄体期'],
    // 假设周期为28天，不同阶段的天数分布（与UI显示顺序保持一致）
    periodDistribution: {
      1: { start: 14, end: 18, name: '排卵期', color: '#8198c2', percentage: 17.86 },  // 浅蓝色段
      2: { start: 6, end: 13, name: '卵泡期', color: '#a5cdd7', percentage: 28.57 },    // 蓝色段
      3: { start: 1, end: 5, name: '月经期', color: '#d792a5', percentage: 17.86 },     // 红色段
      4: { start: 19, end: 28, name: '黄体期', color: '#dcb8ba', percentage: 35.71 }   // 粉色段
    },
    // 知识滚动相关
    currentKnowledgeIndex: 0,
    knowledgeTimer: null,
    // 添加弹窗相关数据
    showPopup: false,
    todayString: '',
  },

  onLoad: function() {
       // 从本地存储读取用户设置的周期天数
    const savedCycleLength = wx.getStorageSync('userCycleLength');
    if (savedCycleLength && typeof savedCycleLength === 'number') {
      this.setData({
        cycleLength: savedCycleLength
      });
    }
    this.calculateCycleInfo();
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

  onLoad: async function () {
    await this.loadUserSettings();
    this.calculateCycleInfo();
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
  },

  // 从 LeanCloud 加载用户设置
  loadUserSettings: async function () {
    const currentUser = AV.User.current();
    if (!currentUser) return;

    try {
      const query = new AV.Query('_User');
      query.equalTo('objectId', currentUser.id);
      const result = await query.first();
      
      if (result) {
        const cycleLength = result.get('cycleLength') || 28;
        const periodLength = result.get('periodLength') || 5;
        const lastPeriodStart = result.get('lastPeriodStart');
        
        this.setData({
          'userCycleSettings.cycleLength': cycleLength,
          'userCycleSettings.periodLength': periodLength,
          'userCycleSettings.lastPeriodStart': lastPeriodStart
        });
      }
    } catch (err) {
      console.error('获取用户设置失败', err);
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
    this.setData({
      showPopup: false
    });
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
  switchToMine() {
    wx.navigateTo({ url: '/pages/my_homepage/my_homepage' })
  },
   // 计算并更新生理周期信息
  calculateCycleInfo: function() {
    const now = new Date();
    const day = now.getDate();
    
    // 设置当前生理周期和周期天数
    const currentPeriod = this.getMenstrualPeriod(day);
    const currentCycleDay = (day - 1) % this.data.cycleLength + 1;

    // 计算指示器位置（考虑UI中各周期段的实际宽度分布）
    const indicatorPosition = this.calculateAccurateIndicatorPosition(currentCycleDay);
    
    this.setData({
      currentPeriod: currentPeriod,
      currentCycleDay: currentCycleDay,
      indicatorPosition: indicatorPosition
    });
  },
  
  
   // 精确计算指示器位置，考虑各周期段在UI中的实际宽度分布
  calculateAccurateIndicatorPosition: function(day) {
    // 由于UI中的周期段宽度是固定百分比（20%, 30%, 20%, 30%），需要重新映射
    // 我们需要根据实际周期阶段的天数来计算在UI中的准确位置
    const cycleLength = this.data.cycleLength;
    let accumulatedPercentage = 0;
    
    // 当前UI中各周期段的百分比宽度
    const uiWidths = [20, 30, 20, 30]; // 对应segment-1到segment-4
    
    // 根据用户的周期长度调整各阶段的天数范围
    // 基于标准28天周期的比例进行调整
    const baseRanges = {
      1: {start: 14, end: 18}, // 排卵期 (5天)
      2: {start: 6, end: 13},  // 卵泡期 (8天)
      3: {start: 1, end: 5},   // 月经期 (5天)
      4: {start: 19, end: 28}  // 黄体期 (10天)
    };
    
    // 找到当前日期所在的周期阶段
    for (let i = 1; i <= 4; i++) {
      const baseRange = baseRanges[i];
      // 基于用户的周期长度调整阶段范围
      const start = Math.round((baseRange.start / 28) * cycleLength);
      const end = Math.round((baseRange.end / 28) * cycleLength);
      
      if (day >= start && day <= end) {
        // 计算在当前阶段内的相对位置
        const daysInStage = end - start + 1;
        const relativePosition = (day - start) / daysInStage;
        // 计算在UI中的绝对位置
        const uiIndex = i - 1; // 转换为0-3的索引
        return accumulatedPercentage + (relativePosition * uiWidths[uiIndex]);
      }
      // 累加前一个阶段的宽度百分比
      accumulatedPercentage += uiWidths[i - 1];
    }
    
    return 0; // 默认位置
  },
  
  // 根据日期获取当前生理周期
  getMenstrualPeriod: function(day) {
    // 使用用户设置的周期长度来计算当前生理周期
    const cycleLength = this.data.cycleLength;
    const normalizedDay = (day - 1) % cycleLength + 1;
    
    // 根据用户的周期长度调整各阶段的天数范围
    // 基于标准28天周期的比例进行调整
    const baseRanges = this.data.periodDistribution;
    
    for (let key in baseRanges) {
      const baseRange = baseRanges[key];
      // 基于用户的周期长度调整阶段范围
      const start = Math.round((baseRange.start / 28) * cycleLength);
      const end = Math.round((baseRange.end / 28) * cycleLength);
      
      if (normalizedDay >= start && normalizedDay <= end) {
        return baseRange.name;
      }
    }
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
  }
})