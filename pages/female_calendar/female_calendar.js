// calendar.js
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
    cycleInfo: {      // ✅ 所有周期相关信息
      lastPeriod: '',
      nextPeriod: '',
      cycleLength: 28,
      periodDays: 5
    }
  },

  async onLoad() {
    await this.refreshPage();
  },

  onShow() {
    this.refreshPage();
  },

  // ================== 下拉刷新 ==================
  async onPullDownRefresh() {
    console.log("Pull-down refresh triggered");
    await this.refreshPage();
    wx.stopPullDownRefresh();
  },

  // ================== 主刷新逻辑 ==================
  async refreshPage() {
    try {
      await this.loadFromCloud();
      this.loadUserCycleInfo();
      const { historyPeriods, records, cycleInfo, currentYear, currentMonth } = this.data;

      if (historyPeriods.length > 0 && cycleInfo.lastPeriod) {
        this.generateCalendar(cycleInfo.lastPeriod, cycleInfo.cycleLength, currentYear, currentMonth, records);
      } else {
        this.generateCalendar('', cycleInfo.cycleLength, currentYear, currentMonth, records);
      }
    } catch (err) {
      console.error('❌ Refresh failed:', err);
    }
  },

  // ================== LeanCloud ==================
  async loadFromCloud() {
    try {
      const History = new AV.Query('HistoryPeriods');
      History.ascending('date');
      let historyRes = await History.find();

      const Record = new AV.Query('PeriodRecords');
      Record.ascending('date');
      let recordRes = await Record.find();

      let historyPeriods = historyRes.map(h => h.get('date'));
      let records = recordRes.map(r => ({
        date: r.get('date'),
        record: r.get('record') || '',
        symptoms: r.get('symptoms') || [],
        isFirstDay: r.get('isFirstDay') || false,
        isInPeriod: r.get('isInPeriod') || false
      }));

      this.setData({ historyPeriods, records });
    } catch (err) {
      console.error('❌ 加载云数据失败:', err);
    }
  },

  async saveHistory(dateStr) {
    try {
      const History = AV.Object.extend('HistoryPeriods');
      const obj = new History();
      obj.set('date', dateStr);
      await obj.save();
      await this.refreshPage(); // 保存后刷新
    } catch (err) {
      console.error('❌ 保存历史失败:', err);
    }
  },

  // ================== 用户周期 ==================
  loadUserCycleInfo() {
    const user = AV.User.current();
    if (!user) return;

    const passdays = user.get('passdays') || [];
    if (passdays.length === 0) return;

    const firstDayRecord = passdays.slice().reverse().find(r => r.lastPeriod);
    const lastPeriodDate = firstDayRecord ? firstDayRecord.lastPeriod : '';
    const nextPeriodDate = firstDayRecord ? firstDayRecord.nextPeriod : '';

    this.setData({
      cycleInfo: {
        lastPeriod: lastPeriodDate,
        nextPeriod: nextPeriodDate,
        cycleLength: firstDayRecord?.cycleLength || 28,
        periodDays: firstDayRecord?.periodDays || 5
      },
      lastPeriod: lastPeriodDate,
      nextPeriod: nextPeriodDate
    });
  },

  async saveUserCycleInfo() {
    const user = AV.User.current();
    if (!user) return;

    const { cycleInfo } = this.data;
    let passdays = user.get('passdays') || [];
    let newData = { ...cycleInfo };

    if (passdays.length > 0) {
      passdays[passdays.length - 1] = newData;
    } else {
      passdays.push(newData);
    }

    user.set('passdays', passdays);
    try {
      await user.save();
      wx.showToast({ title: '周期信息已保存', icon: 'success' });
      await this.refreshPage();
    } catch (err) {
      console.error('❌ 保存用户周期失败:', err);
    }
  },

  // ================== 输入框事件 ==================
  onCycleLengthChange(e) {
    const length = parseInt(e.detail.value) || 28;
    const { lastPeriod } = this.data.cycleInfo;
    const next = lastPeriod ? this.calculateNextPeriod(lastPeriod, length) : '';
    this.setData({
      'cycleInfo.cycleLength': length,
      'cycleInfo.nextPeriod': next
    });
    if (lastPeriod) this.generateCalendar(lastPeriod, length, this.data.currentYear, this.data.currentMonth, this.data.records);
    this.saveUserCycleInfo();
  },

  onPeriodDaysChange(e) {
    const days = parseInt(e.detail.value) || 5;
    this.setData({ 'cycleInfo.periodDays': days });
    const { lastPeriod, cycleLength } = this.data.cycleInfo;
    if (lastPeriod) this.generateCalendar(lastPeriod, cycleLength, this.data.currentYear, this.data.currentMonth, this.data.records);
    this.saveUserCycleInfo();
  },

  // ================== 日历生成 ==================
  generateCalendar(periodStart, cycleLength, year, month, records = []) {
    let days = [];
    let firstDay = new Date(year, month, 1).getDay();
    let daysInMonth = new Date(year, month + 1, 0).getDate();

    // 空格
    for (let i = 0; i < firstDay; i++) days.push({ day: '', type: '' });
    // 日期
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ day: i, type: '', year, month: month + 1 });
    }

    // 生理期计算
    if (periodStart) {
      let start = new Date(periodStart);
      const maxIterations = 12;
      let iterations = 0;

      while (
        iterations < maxIterations &&
        (start.getFullYear() < year || (start.getFullYear() === year && start.getMonth() <= month))
      ) {
        let periodEnd = new Date(start.getTime() + (this.data.cycleInfo.periodDays - 1) * oneDay);
        let ovulationDay = new Date(start.getTime() + (cycleLength - 14) * oneDay);

        const startTime = start.getTime();
        const periodEndTime = periodEnd.getTime();
        const ovulationTime = ovulationDay.getTime();

        days.forEach(item => {
          if (!item.day) return;
          let d = new Date(year, month, item.day);
          let dTime = d.getTime();

          if (dTime >= startTime && dTime <= periodEndTime) {
            item.type += ' period';
            if (d.getDate() === start.getDate()) {
              item.type += ' first-period'; 
            }
          } else if (dTime === ovulationTime) {
            item.type += ' ovulation';
          }
        });

        start = new Date(start.getTime() + cycleLength * oneDay);
        iterations++;
      }
    }

    // 云端记录覆盖
    records.forEach(r => {
      const d = new Date(r.date);
      days.forEach(item => {
        if (item.day === d.getDate() && item.month === d.getMonth() + 1 && item.year === d.getFullYear()) {
          if (r.isFirstDay) item.type += ' first-period';
          if (r.isInPeriod) item.type += ' period';
          if (r.record || r.symptoms?.length > 0) item.type += ' recorded';
        }
      });
    });

    this.setData({ days, currentYear: year, currentMonth: month });
  },

  // ================== 月份切换 ==================
  prevMonth() {
    let { currentYear, currentMonth } = this.data;
    if (currentMonth === 0) {
      currentYear -= 1;
      currentMonth = 11;
    } else currentMonth -= 1;
    const { lastPeriod, cycleLength } = this.data.cycleInfo;
    this.generateCalendar(lastPeriod, cycleLength, currentYear, currentMonth, this.data.records);
  },

  nextMonth() {
    let { currentYear, currentMonth } = this.data;
    if (currentMonth === 11) {
      currentYear += 1;
      currentMonth = 0;
    } else currentMonth += 1;
    const { lastPeriod, cycleLength } = this.data.cycleInfo;
    this.generateCalendar(lastPeriod, cycleLength, currentYear, currentMonth, this.data.records);
  },

  // ================== 点击日期 ==================
  onDayTap(e) {
    const day = e.currentTarget.dataset.day;
    if (!day) return;
    const { currentYear, currentMonth } = this.data;
    const dateStr = this.formatDate(new Date(currentYear, currentMonth, day));
    wx.navigateTo({ url: `/pages/record/record?date=${dateStr}` });
  },

  // ================== 工具函数 ==================
  calculateAverageCycle(history) {
    if (history.length < 2) return this.data.cycleInfo.cycleLength;
    let total = 0;
    for (let i = 1; i < history.length; i++) {
      total += (new Date(history[i]) - new Date(history[i - 1])) / oneDay;
    }
    return Math.round(total / (history.length - 1));
  },

  calculateNextPeriod(lastPeriod, cycleLength) {
    if (!lastPeriod) return '';
    const nextDate = new Date(new Date(lastPeriod).getTime() + cycleLength * oneDay);
    return this.formatDate(nextDate);
  },

  updateLastPeriod(date) {
    this.setData({
      'cycleInfo.lastPeriod': date,
      'lastPeriod': date
    });
    const { cycleInfo } = this.data;
    const next = date ? this.calculateNextPeriod(date, cycleInfo.cycleLength) : '';
    this.setData({
      'cycleInfo.nextPeriod': next,
      'nextPeriod': next
    });
    this.generateCalendar(date, cycleInfo.cycleLength, this.data.currentYear, this.data.currentMonth, this.data.records);
    this.saveUserCycleInfo();
  },

  formatDate(date) {
    let y = date.getFullYear();
    let m = date.getMonth() + 1;
    let d = date.getDate();
    return `${y}-${m < 10 ? '0'+m : m}-${d < 10 ? '0'+d : d}`;
  },

  goHistoryPage() {
    wx.navigateTo({ url: '/pages/history/history' });
  }
});
