const AV = require('../../libs/av-core-min.js');
const oneDay = 24 * 60 * 60 * 1000;

Page({
  data: {
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth(),
    days: [],
    historyPeriods: [],
    records: [],
    selectedRecord: null,
    cycleInfo: {
      nowPeriod: '',    // string YYYY-MM-DD
      futurePeriod: '', // string YYYY-MM-DD
      cycleLength: 28,  // 自动计算更新
      periodDays: 5     // 默认 5 天
    },
    currentUser: null
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
    this.refreshPage();
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
    } catch (err) {
      console.error('刷新失败:', err);
    }
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
      Record.equalTo('type', 'record');
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
          isInPeriod: !!r.get('isInPeriod'), // 添加这行！
          rawData: rawDate // 用于调试
        };
      });

      console.log('加载的记录数据:', records);
      this.updateHistoryPeriods(historyPeriods);
      this.setData({ records });
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
      this.setData({
        'cycleInfo.nowPeriod': lastPeriod,
        'cycleInfo.futurePeriod': this.calculateFuturePeriod(lastPeriod, avgCycleLength),
        'cycleInfo.cycleLength': avgCycleLength,
        'cycleInfo.periodDays': 5
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
      this.setData({
        'cycleInfo.nowPeriod': lastPeriod,
        'cycleInfo.futurePeriod': this.calculateFuturePeriod(lastPeriod, avgCycleLength),
        'cycleInfo.cycleLength': avgCycleLength,
        'cycleInfo.periodDays': 5
      });
      return;
    }
  
    // 如果两者都不满足，使用默认值
    this.setData({
      'cycleInfo.nowPeriod': historyPeriods.length > 0 ? historyPeriods[historyPeriods.length - 1] : '',
      'cycleInfo.futurePeriod': historyPeriods.length > 0 ?
        this.calculateFuturePeriod(historyPeriods[historyPeriods.length - 1], 28) : '',
      'cycleInfo.cycleLength': 28,
      'cycleInfo.periodDays': 5
    });
  },

  async saveUserCycleInfo() {
    try {
      const className = this.getUserClassName();
      if (!className) return;
      await this.ensureUserClass();

      const { cycleInfo } = this.data;
      const CycleInfo = new AV.Query(className);
      CycleInfo.equalTo('type', 'cycleInfo');
      const cycleInfoObj = await CycleInfo.first();

      const nowPeriodStr = cycleInfo.nowPeriod || '';
      const futurePeriodStr = cycleInfo.futurePeriod || '';

      if (cycleInfoObj) {
        cycleInfoObj.set('nowPeriod', nowPeriodStr);
        cycleInfoObj.set('futurePeriod', futurePeriodStr);
        cycleInfoObj.set('cycleLength', cycleInfo.cycleLength);
        cycleInfoObj.set('periodDays', cycleInfo.periodDays);
        await cycleInfoObj.save();
      } else {
        const UserClass = AV.Object.extend(className);
        const obj = new UserClass();
        obj.set('type', 'cycleInfo');
        obj.set('nowPeriod', nowPeriodStr);
        obj.set('futurePeriod', futurePeriodStr);
        obj.set('cycleLength', cycleInfo.cycleLength);
        obj.set('periodDays', cycleInfo.periodDays);
        await obj.save();
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

          for (let i = 0; i < days.length; i++) {
            if (!days[i].day) continue;
            let d = new Date(year, month, days[i].day);
            let dTime = d.getTime();

            if (dTime >= startTime && dTime <= periodEndTime) {
              days[i].type = days[i].type ? days[i].type + ' period' : 'period';
              if (this.isSameDay(d, start)) {
                days[i].type += ' first-period';
              }
            } else if (dTime === ovulationTime) {
              days[i].type = days[i].type ? days[i].type + ' ovulation' : 'ovulation';
            }
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
      
      // 如果是在经期中，添加period类
      if (r.isInPeriod) {
        console.log('✅ 标记为生理期:', r.date);
        days[index].type = days[index].type ? days[index].type + ' period' : 'period';
      } else {
        console.log('❌ 不是生理期:', r.date);
      }
      
      // 添加recorded类
      days[index].type = days[index].type ? days[index].type + ' recorded' : 'recorded';
      
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

  formatDate(date) {
    if (!date) return '';
    let y = date.getFullYear();
    let m = date.getMonth() + 1;
    let d = date.getDate();
    return `${y}-${m < 10 ? '0' + m : m}-${d < 10 ? '0' + d : d}`;
  },

  decreasePeriodDays() {
    let days = this.data.cycleInfo.periodDays;
    if (days > 1) {  // 限制最少 1 天
      this.setData({
        'cycleInfo.periodDays': days - 1
      });
      this.refreshCalendarAfterChange();
    }
  },
  
  increasePeriodDays() {
    let days = this.data.cycleInfo.periodDays;
    if (days < 15) {  // 限制最多 15 天，可自行调整
      this.setData({
        'cycleInfo.periodDays': days + 1
      });
      this.refreshCalendarAfterChange();
    }
  },
  
  refreshCalendarAfterChange() {
    const { nowPeriod, cycleLength } = this.data.cycleInfo;
    this.generateCalendar(
      nowPeriod,
      cycleLength,
      this.data.currentYear,
      this.data.currentMonth,
      this.data.records
    );
    this.saveUserCycleInfo(); // 保存到云端
  },  


  goHistoryPage() {
    wx.navigateTo({ url: '/pages/history/history' });
  }
});