const AV = require('../../libs/av-core-min.js');
const oneDay = 24 * 60 * 60 * 1000;

Page({
  data: {
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth(),
    days: [],
    historyPeriods: [],
    records: [],
    isLastDay: false,
    selectedRecord: null,
    cycleInfo: {
      nowPeriod: '',    // string YYYY-MM-DD
      futurePeriod: '', // string YYYY-MM-DD
      cycleLength: 28,  // 自动计算更新
      periodDays: 5     // 默认 5 天
    },
    currentUser: null,
    // 标记是否已经检查过当天记录，防止重复检查和跳转
    hasCheckedTodayRecord: false
  },

  /* ---------- 日期工具函数 ---------- */
  toYMD(dateOrStr) {
    if (!dateOrStr) return '';
    if (typeof dateOrStr === 'string') {
      const m = dateOrStr.match(/^(\d{4}-\d{2}-\d{2})/);
      if (m) return m[1];
      const dd = new Date(dateOrStr);
      return this.formatDate(dd);
    }
    return this.formatDate(dateOrStr);
  },

  dateFromYMD(ymd) {
    if (!ymd) return null;
    const [yy, mm, dd] = ymd.split('-').map(n => parseInt(n, 10));
    return new Date(yy, mm - 1, dd);
  },

  isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
  },

  /* ---------- 生命周期函数 ---------- */
  async onLoad() {
    const currentUser = AV.User.current();
    this.setData({ currentUser });
    if (!currentUser) {
      wx.showToast({ title: '请先登录', icon: 'none', duration: 2000 });
      setTimeout(() => wx.navigateTo({ url: '/pages/login/login' }), 2000);
      return;
    }
    await this.refreshPage();
  },

  onShow() {
    // 从记录页面返回时，我们需要刷新数据
    // 检查是否有保存的记录状态，用于判断是否刚从记录页面返回
    if (this.data.hasCheckedTodayRecord) {
      // 保存当前的检查状态
      const currentCheckStatus = this.data.hasCheckedTodayRecord;
      
      // 刷新页面数据
      this.loadFromCloud().then(() => {
        this.loadUserCycleInfo().then(() => {
          const { historyPeriods, records, cycleInfo, currentYear, currentMonth } = this.data;
          if (historyPeriods.length > 0 && cycleInfo.nowPeriod) {
            this.generateCalendar(cycleInfo.nowPeriod, cycleInfo.cycleLength, currentYear, currentMonth, records);
          } else {
            this.generateCalendar('', cycleInfo.cycleLength, currentYear, currentMonth, records);
          }
          // 保留检查状态，防止重复检查
          this.setData({ hasCheckedTodayRecord: currentCheckStatus });
        });
      });
    } else {
      // 如果是首次进入页面或已重置检查状态，执行检查逻辑
      this.refreshPage();
    }
  },
  

  /* ---------- 检查当天是否已记录并自动弹出记录界面 ---------- */
  async checkTodayRecordAndShowModal() {
    try {
      const className = this.getUserClassName();
      if (!className) return;
      
      // 获取今天的日期字符串
      const today = new Date();
      const todayStr = this.formatDate(today);
      
      // 标记为已检查，防止重复检查
      this.setData({ hasCheckedTodayRecord: true });
      
      // 创建查询，同时检查type为record或menstrual的记录
      const query = new AV.Query(className);
      query.equalTo('date', todayStr);
      query.containedIn('type', ['record', 'menstrual']);
      const todayRecord = await query.first();
      
      // 如果当天没有记录，则跳转到记录页面
      if (!todayRecord) {
        console.log('今天没有记录，跳转到记录页面');
        wx.navigateTo({
          url: '/pages/record/record?date=' + todayStr
        });
      } else {
        // 如果当天已有记录，直接留在日历页面
        console.log('今天已有记录，留在日历页面');
      }
    } catch (err) {
      console.error('检查当天记录失败:', err);
    }
  },

  /* ---------- 格式化日期为YYYY-MM-DD字符串 ---------- */
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  async onPullDownRefresh() {
    await this.refreshPage();
    wx.stopPullDownRefresh();
  },

  async refreshPage() {
    try {
      await this.loadFromCloud();
      await this.loadUserCycleInfo();
      const { historyPeriods, records, cycleInfo, currentYear, currentMonth } = this.data;
      if (historyPeriods.length > 0 && cycleInfo.nowPeriod) {
        this.generateCalendar(cycleInfo.nowPeriod, cycleInfo.cycleLength, currentYear, currentMonth, records);
      } else {
        this.generateCalendar('', cycleInfo.cycleLength, currentYear, currentMonth, records);
      }
      
      // 页面加载后检查当天是否已记录
      // 使用setTimeout确保页面完全渲染后再触发
      setTimeout(() => {
        // 只有在首次加载或刷新页面时才检查，避免从记录页面返回后再次检查
        if (!this.data.hasCheckedTodayRecord) {
          this.checkTodayRecordAndShowModal();
        }
      }, 500);
    } catch (err) {
      console.error('刷新失败:', err);
    }
  },

  /* ---------- 重新加载用户记录和历史经期数据以更新日历视图 ---------- */
  updateCalendarView() {
    // 从记录页面返回时，确保设置为已检查状态，防止refreshPage中的检查逻辑被触发
    this.setData({ hasCheckedTodayRecord: true });
    this.refreshPage();
    // 不需要在刷新后恢复状态，因为我们已经明确知道这是从记录页面返回的操作
  },
  
  /* ---------- 重置检查状态（用于从记录页面返回后手动刷新） ---------- */
  resetCheckStatus() {
    this.setData({ hasCheckedTodayRecord: false });
  },
  
  /* ---------- 手动刷新日历页面（供用户主动触发） ---------- */
  manualRefresh() {
    this.setData({ hasCheckedTodayRecord: false });
    this.refreshPage();
  },

  /* ---------- LeanCloud 相关 ---------- */
  getUserClassName() {
    if (!this.data.currentUser) return null;
    const username = this.data.currentUser.getUsername();
    return `User_${username.replace(/[^a-zA-Z0-9]/g, '_')}`;
  },

  async ensureUserClass() {
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

  async loadFromCloud() {
    try {
      const className = this.getUserClassName();
      if (!className) return;
      await this.ensureUserClass();

      // 历史经期记录
      const HistoryPeriodsQuery = new AV.Query(className);
      HistoryPeriodsQuery.equalTo('type', 'historyPeriods');
      let historyPeriodsRes = await HistoryPeriodsQuery.first();

      let historyPeriods = [];
      if (historyPeriodsRes) {
        historyPeriods = historyPeriodsRes.get('dates') || [];
        historyPeriods.sort((a, b) => new Date(a) - new Date(b));
      }

      // 日常记录
      const Record = new AV.Query(className);
      // 同时查询'record'和'menstrual'类型的记录
      Record.containedIn('type', ['record', 'menstrual']);
      Record.ascending('date');
      let recordRes = await Record.find();

      let records = recordRes.map(r => {
        const rawDate = r.get('date');
        const dateStr = this.toYMD(rawDate);
        
        let year = null, month = null, day = null;
        if (dateStr) {
          const parts = dateStr.split('-');
          year = parseInt(parts[0], 10);
          month = parseInt(parts[1], 10); // 1-12
          day = parseInt(parts[2], 10);
        }

        return {
          date: dateStr,
          year: year,
          month: month,
          day: day,
          note: r.get('note') || '',
          symptoms: r.get('symptoms') || [],
          flow: r.get('flow') || 'medium',
          isFirstDay: !!r.get('isFirstDay'),
          isLastDay: !!r.get('isLastDay'),
          isInPeriod: !!r.get('isInPeriod'),
          type: r.get('type') || 'record', // 添加type字段
          rawData: rawDate // 用于调试
        };
      });

      console.log('加载的记录数据:', records);
      this.updateHistoryPeriods(historyPeriods);
      this.setData({ records });
      
      // 加载完记录后自动计算经期长度
      this.calculatePeriodLengthFromRecords();
    } catch (err) {
      console.error('加载云数据失败:', err);
    }
  },

  async loadUserCycleInfo() {
    try {
      const className = this.getUserClassName();
      if (!className) return;
      await this.ensureUserClass();

      const CycleInfo = new AV.Query(className);
      CycleInfo.equalTo('type', 'cycleInfo');
      const cycleInfoObj = await CycleInfo.first();

      if (cycleInfoObj) {
        this.setData({
          cycleInfo: {
            nowPeriod: cycleInfoObj.get('nowPeriod') || null,
            futurePeriod: cycleInfoObj.get('futurePeriod') || null,
            cycleLength: cycleInfoObj.get('cycleLength') || 28,
            periodDays: cycleInfoObj.get('periodDays') || 5
          }
        });
        if (this.data.historyPeriods.length >= 2) {
          await this.calculateCycleInfoFromHistory();
        }
      } else {
        await this.calculateCycleInfoFromHistory();
        await this.saveUserCycleInfo();
      }
    } catch (err) {
      console.error('加载周期信息失败:', err);
    }
  },

  async calculateCycleInfoFromHistory() {
    const { historyPeriods } = this.data;
    
    // 尝试从历史记录中获取 startDays 数据
    let startDays = [];
    try {
      const className = this.getUserClassName();
      if (className) {
        const query = new AV.Query(className);
        query.limit(1);
        const results = await query.find();
        if (results.length > 0) {
          const obj = results[0].toJSON();
          startDays = obj.startDays || [];
        }
      }
    } catch (err) {
      console.error('获取 startDays 失败:', err);
    }
  
    // 如果有 startDays 数据，使用它来计算周期长度
    if (startDays.length >= 2) {
      let totalCycleLength = 0;
      let cycleCount = 0;
      for (let i = 1; i < startDays.length; i++) {
        const prevDate = new Date(startDays[i - 1]);
        const currDate = new Date(startDays[i]);
        const cycleLength = Math.round((currDate - prevDate) / oneDay);
        totalCycleLength += cycleLength;
        cycleCount++;
      }
      const avgCycleLength = Math.round(totalCycleLength / cycleCount);
  
      const lastPeriod = startDays[startDays.length - 1];
      // 保留当前设置的经期长度，不要重置
      this.setData({
        'cycleInfo.nowPeriod': lastPeriod,
        'cycleInfo.futurePeriod': this.calculateFuturePeriod(lastPeriod, avgCycleLength),
        'cycleInfo.cycleLength': avgCycleLength
        // 不重置 periodDays
      });
      return;
    }
  
    // 如果没有 startDays 数据，但 historyPeriods 长度足够，使用 historyPeriods
    if (historyPeriods.length >= 2) {
      let totalCycleLength = 0;
      let cycleCount = 0;
      for (let i = 1; i < historyPeriods.length; i++) {
        const prevDate = new Date(historyPeriods[i - 1]);
        const currDate = new Date(historyPeriods[i]);
        const cycleLength = Math.round((currDate - prevDate) / oneDay);
        totalCycleLength += cycleLength;
        cycleCount++;
      }
      const avgCycleLength = Math.round(totalCycleLength / cycleCount);
  
      const lastPeriod = historyPeriods[historyPeriods.length - 1];
      // 保留当前设置的经期长度，不要重置
      this.setData({
        'cycleInfo.nowPeriod': lastPeriod,
        'cycleInfo.futurePeriod': this.calculateFuturePeriod(lastPeriod, avgCycleLength),
        'cycleInfo.cycleLength': avgCycleLength
        // 不重置 periodDays
      });
      return;
    }
  
    // 如果两者都不满足，使用默认值，但保留用户设置的经期长度
    const currentPeriodDays = this.data.cycleInfo.periodDays || 5; // 如果还没有设置过，默认为5
    this.setData({
      'cycleInfo.nowPeriod': historyPeriods.length > 0 ? historyPeriods[historyPeriods.length - 1] : '',
      'cycleInfo.futurePeriod': historyPeriods.length > 0 ?
        this.calculateFuturePeriod(historyPeriods[historyPeriods.length - 1], 28) : '',
      'cycleInfo.cycleLength': 28,
      'cycleInfo.periodDays': currentPeriodDays // 保留用户设置的经期长度，不重置
    });
  },

  async saveUserCycleInfo() {
    try {
      const className = this.getUserClassName();
      if (!className) {
        console.error('无法获取用户类名');
        return;
      }
      
      await this.ensureUserClass();

      const { cycleInfo } = this.data;
      console.log('准备保存经期长度到云端:', cycleInfo.periodDays);
      
      const CycleInfo = new AV.Query(className);
      CycleInfo.equalTo('type', 'cycleInfo');
      const cycleInfoObj = await CycleInfo.first();

      const nowPeriodStr = cycleInfo.nowPeriod || '';
      const futurePeriodStr = cycleInfo.futurePeriod || '';

      if (cycleInfoObj) {
        console.log('找到现有cycleInfo对象，更新periodDays字段');
        cycleInfoObj.set('nowPeriod', nowPeriodStr);
        cycleInfoObj.set('futurePeriod', futurePeriodStr);
        cycleInfoObj.set('cycleLength', cycleInfo.cycleLength);
        cycleInfoObj.set('periodDays', cycleInfo.periodDays);
        await cycleInfoObj.save();
        console.log('经期长度更新成功:', cycleInfo.periodDays);
      } else {
        console.log('创建新的cycleInfo对象，设置periodDays字段');
        const UserClass = AV.Object.extend(className);
        const obj = new UserClass();
        obj.set('type', 'cycleInfo');
        obj.set('nowPeriod', nowPeriodStr);
        obj.set('futurePeriod', futurePeriodStr);
        obj.set('cycleLength', cycleInfo.cycleLength);
        obj.set('periodDays', cycleInfo.periodDays);
        await obj.save();
        console.log('新cycleInfo对象创建并保存成功，经期长度:', cycleInfo.periodDays);
      }
    } catch (err) {
      console.error('保存周期信息失败:', err);
    }
  },

  calculateFuturePeriod(nowPeriod, cycleLength) {
    if (!nowPeriod) return '';
    const d = this.dateFromYMD(this.toYMD(nowPeriod));
    d.setDate(d.getDate() + cycleLength);
    return this.formatDate(d);
  },

  updateHistoryPeriods(newHistory) {
    newHistory.sort((a, b) => new Date(a) - new Date(b));
    this.setData({ historyPeriods: newHistory });
    this.calculateCycleInfoFromHistory()
      .then(() => this.saveUserCycleInfo())
      .catch(err => console.error('重新计算周期失败:', err));
  },

  /* ---------- 核心：生成日历 ---------- */
  generateCalendar(periodStartStr, cycleLength, year, month, records = []) {
    console.log('开始生成日历:', { year, month: month + 1, recordsCount: records.length });
    
    let days = [];
    let firstDay = new Date(year, month, 1).getDay();
    let daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) days.push({ day: '', type: '' });
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ day: i, type: '', year: year, month: month + 1 });
    }

    if (periodStartStr) {
      const startYMD = this.toYMD(periodStartStr);
      if (startYMD) {
        let start = this.dateFromYMD(startYMD);
        const maxIterations = 12;
        let iterations = 0;

        while (iterations < maxIterations &&
          (start.getFullYear() < year || (start.getFullYear() === year && start.getMonth() <= month))) {

          const periodEnd = new Date(start.getFullYear(), start.getMonth(), start.getDate() + (this.data.cycleInfo.periodDays - 1));
          const ovulationDay = new Date(start.getFullYear(), start.getMonth(), start.getDate() + (cycleLength - 14));

          const startTime = start.getTime();
          const periodEndTime = periodEnd.getTime();
          const ovulationTime = ovulationDay.getTime();
          
          // 检查用户记录是否与预测的经期冲突
          let hasConflict = false;
          for (let i = 0; i < records.length; i++) {
            const record = records[i];
            if (record.year === year && record.month === (month + 1)) {
              const recordDate = new Date(record.year, record.month - 1, record.day);
              const recordTime = recordDate.getTime();
              // 如果用户记录在预测的经期内，但标记为不在经期中
              if (recordTime >= startTime && recordTime <= periodEndTime && !record.isInPeriod && record.type !== 'menstrual') {
                console.log('发现冲突记录：用户标记了预测经期内的日期为非经期', record);
                hasConflict = true;
                break;
              }
            }
          }
          
          // 先处理排卵期预测，确保任何情况下都正常预测排卵期
          for (let i = 0; i < days.length; i++) {
            if (!days[i].day) continue;
            let d = new Date(year, month, days[i].day);
            let dTime = d.getTime();

            if (dTime === ovulationTime) {
              days[i].type = days[i].type ? days[i].type + ' ovulation' : 'ovulation';
            }
          }

          // 有冲突时，只停止当前周期内剩余天数的经期预测，不修改现有标记
          if (!hasConflict) {
            // 没有冲突，继续预测经期
            for (let i = 0; i < days.length; i++) {
              if (!days[i].day) continue;
              let d = new Date(year, month, days[i].day);
              let dTime = d.getTime();

              if (dTime >= startTime && dTime <= periodEndTime) {
                days[i].type = days[i].type ? days[i].type + ' period' : 'period';
                if (this.isSameDay(d, start)) {
                  days[i].type += ' first-period';
                }
              }
            }
          } else {
            console.log('停止当前周期内剩余天数的经期预测，因为用户记录与预测经期冲突');
          }

          start = new Date(start.getFullYear(), start.getMonth(), start.getDate() + cycleLength);
          iterations++;
        }
      }
    }

    // 在 records.forEach 循环中添加更详细的日志
records.forEach(r => {
  if (!r.year || !r.month || !r.day) {
    console.log('跳过无效记录:', r);
    return;
  }
  
  // 月份比较：month是0-11，r.month是1-12
  if (r.year === year && r.month === (month + 1)) {
    let index = firstDay + r.day - 1;
    
    if (index >= 0 && index < days.length && days[index] && days[index].day === r.day) {
      console.log('处理记录:', {
        date: r.date,
        isInPeriod: r.isInPeriod,
        index: index,
        currentType: days[index].type,
        shouldHavePeriod: r.isInPeriod
      });
      
      // 根据记录的isInPeriod字段等于true或者type字段等于menstrual判断是否显示生理期标记
      if (r.isInPeriod === true || r.type === 'menstrual') {
        console.log('✅ 标记为生理期:', r.date);
        days[index].type = days[index].type ? days[index].type + ' period' : 'period';
        // 如果是最后一天，添加last-period标记
        if (r.isLastDay) {
          console.log('📅 标记为经期最后一天:', r.date);
          days[index].type += ' last-period';
        }
      } else {
        console.log('❌ 不是生理期:', r.date);
      }
      
      // 只有当type类型等于record时才添加recorded类
      if (r.type === 'record') {
        days[index].type = days[index].type ? days[index].type + ' recorded' : 'recorded';
      }
      
      console.log('最终类型:', days[index].type);
    }
  }
});

    // 调试输出
    const periodDays = days.filter(d => d.type && d.type.includes('period'));
    const recordedDays = days.filter(d => d.type && d.type.includes('recorded'));
    console.log('生理期天数:', periodDays.length);
    console.log('已标记记录的天数:', recordedDays.length);
    
    this.setData({ days, currentYear: year, currentMonth: month });
  },

  /* ---------- 翻月 ---------- */
  prevMonth() {
    let { currentYear, currentMonth } = this.data;
    if (currentMonth === 0) {
      currentYear -= 1;
      currentMonth = 11;
    } else currentMonth -= 1;
    const { nowPeriod, cycleLength } = this.data.cycleInfo;
    this.generateCalendar(nowPeriod, cycleLength, currentYear, currentMonth, this.data.records);
  },

  nextMonth() {
    let { currentYear, currentMonth } = this.data;
    if (currentMonth === 11) {
      currentYear += 1;
      currentMonth = 0;
    } else currentMonth += 1;
    const { nowPeriod, cycleLength } = this.data.cycleInfo;
    this.generateCalendar(nowPeriod, cycleLength, currentYear, currentMonth, this.data.records);
  },

  /* ---------- 自动计算经期长度 ---------- */
  calculatePeriodLengthFromRecords() {
    const { records } = this.data;
    if (!records || records.length === 0) return;
    
    // 按日期排序记录
    const sortedRecords = [...records].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // 找出最新一次经期的连续天数
    let currentPeriodLength = 0;
    let inPeriodSequence = false;
    
    for (let i = 0; i < sortedRecords.length; i++) {
      const record = sortedRecords[i];
      
      if (record.type === 'menstrual') {
        // 如果当前记录类型为menstrual，增加经期长度计数
        currentPeriodLength++;
        inPeriodSequence = true;
      } else if (inPeriodSequence) {
        // 如果当前记录类型不是menstrual，但之前在经期序列中，说明经期结束
        break;
      } else if (i > 0) {
        // 如果既不在经期中，也不在经期序列中，且不是第一条记录，检查是否与前一条记录日期连续
        const currentDate = new Date(record.date);
        const prevDate = new Date(sortedRecords[i-1].date);
        const dayDiff = Math.round((prevDate - currentDate) / oneDay);
        
        if (dayDiff > 1) {
          // 如果日期不连续，说明经期序列已经结束
          break;
        }
      }
    }
    
    // 仅记录计算结果，但不自动更新经期长度
    // 根据需求，经期长度只能通过加减号按钮修改
    if (currentPeriodLength >= 1 && currentPeriodLength <= 15) {
      console.log(`记录计算的经期长度: ${currentPeriodLength}天，当前设置为: ${this.data.cycleInfo.periodDays}天`);
      console.log(`注意：经期长度现在仅通过加减号按钮修改，不会自动更新`);
    }
  },
  
  /* ---------- 其它 ---------- */
  updateNowPeriod(dateStr) {
    const { cycleLength } = this.data.cycleInfo;
    const nowStr = dateStr || '';
    const futureStr = dateStr ? this.calculateFuturePeriod(dateStr, cycleLength) : '';

    this.setData({
      'cycleInfo.nowPeriod': nowStr,
      'cycleInfo.futurePeriod': futureStr
    });

    this.generateCalendar(nowStr, cycleLength, this.data.currentYear, this.data.currentMonth, this.data.records);
    this.saveUserCycleInfo();
  },

  onDayTap(e) {
    const { day } = e.currentTarget.dataset;
    if (!day) return;
    const { currentYear, currentMonth } = this.data;
    const dateStr = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    wx.navigateTo({ url: `/pages/record/record?date=${dateStr}` });
  },

  // 注意：formatDate函数在文件上方已定义，这里不再重复定义

  decreasePeriodDays() {
    let days = this.data.cycleInfo.periodDays;
    if (days > 1) {  // 限制最少 1 天
      const newDays = days - 1;
      console.log('减少经期长度:', days, '→', newDays);
      this.setData({
        'cycleInfo.periodDays': newDays
      });
      this.refreshCalendarAfterChange();
    } else {
      console.log('经期长度已达最小值(1天)，无法继续减少');
      wx.showToast({
        title: '经期长度最少为1天',
        icon: 'none',
        duration: 2000
      });
    }
  },
  
  increasePeriodDays() {
    let days = this.data.cycleInfo.periodDays;
    if (days < 15) {  // 限制最多 15 天，可自行调整
      const newDays = days + 1;
      console.log('增加经期长度:', days, '→', newDays);
      this.setData({
        'cycleInfo.periodDays': newDays
      });
      this.refreshCalendarAfterChange();
    } else {
      console.log('经期长度已达最大值(15天)，无法继续增加');
      wx.showToast({
        title: '经期长度最多为15天',
        icon: 'none',
        duration: 2000
      });
    }
  },
  
  async refreshCalendarAfterChange() {
    console.log('开始刷新日历并保存经期长度:', this.data.cycleInfo.periodDays);
    
    const { nowPeriod, cycleLength } = this.data.cycleInfo;
    this.generateCalendar(
      nowPeriod,
      cycleLength,
      this.data.currentYear,
      this.data.currentMonth,
      this.data.records
    );
    
    try {
      console.log('准备调用saveUserCycleInfo保存经期长度');
      await this.saveUserCycleInfo(); // 保存到云端
      console.log('经期长度保存成功');
      
      // 显示保存成功提示
      wx.showToast({
        title: '经期长度已保存',
        icon: 'success',
        duration: 2000
      });
    } catch (error) {
      console.error('经期长度保存失败:', error);
      wx.showToast({
        title: '保存失败，请重试',
        icon: 'none',
        duration: 2000
      });
    }
  },


  goHistoryPage() {
    wx.navigateTo({ url: '/pages/history/history' });
  }
});