const AV = require('../../libs/av-core-min.js'); 
const oneDay = 24 * 60 * 60 * 1000;

Page({
  data: {
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth(),
    days: [],
    lastPeriod: '',
    nextPeriod: '',
    cycleLength: 28,
    periodDays: 5,
    historyPeriods: [],
    records: [],
    selectedRecord: null // ✅ 新增：保存已点击日期的记录
  },

  async onLoad() {
    let { currentYear, currentMonth } = this.data;

    await this.loadFromCloud();
    this.loadUserPeriods();

    let { historyPeriods, records, lastPeriod } = this.data;

    if (historyPeriods.length > 0) {
      let last = lastPeriod || historyPeriods[historyPeriods.length - 1];
      let avgCycle = this.calculateAverageCycle(historyPeriods);
      let next = this.calculateNextPeriod(last, avgCycle);

      this.setData({
        lastPeriod: last,
        cycleLength: avgCycle,
        nextPeriod: next
      });

      this.generateCalendar(last, avgCycle, currentYear, currentMonth, records);
    } else {
      this.generateCalendar('', this.data.cycleLength, currentYear, currentMonth, records);
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
      let records = recordRes.map(r => ({ date: r.get('date'), note: r.get('note') || '' }));

      this.setData({ historyPeriods, records });
    } catch (err) {
      console.error('❌ 加载云数据失败:', err);
    }
  },

  async saveHistory(dateStr) {
    try {
      let History = AV.Object.extend('HistoryPeriods');
      let obj = new History();
      obj.set('date', dateStr);
      await obj.save();
    } catch (err) {
      console.error('❌ 保存历史失败:', err);
    }
  },

  async saveRecord(dateStr, note = '') {
    try {
      let Record = new AV.Object.extend('PeriodRecords');
      let obj = new Record();
      obj.set('date', dateStr);
      obj.set('note', note);
      await obj.save();
    } catch (err) {
      console.error('❌ 保存记录失败:', err);
    }
  },

  // ================== User Periods ==================
  loadUserPeriods() {
    const user = AV.User.current();
    if (user) {
      const last = user.get('lastPeriod');
      const next = user.get('nextPeriod');
      const cycle = user.get('cycleLength');
      const period = user.get('periodDays');
  
      if (last) this.setData({ lastPeriod: last.toISOString().split('T')[0] });
      if (next) this.setData({ nextPeriod: next.toISOString().split('T')[0] });
      if (cycle) this.setData({ cycleLength: cycle });
      if (period) this.setData({ periodDays: period });
    }
  },  

  async saveUserPeriods() {
    const user = AV.User.current();
    if (!user) return;
  
    if (this.data.lastPeriod && this.data.nextPeriod) {
      user.set('lastPeriod', new Date(this.data.lastPeriod));
      user.set('nextPeriod', new Date(this.data.nextPeriod));
      user.set('cycleLength', this.data.cycleLength);
      user.set('periodDays', this.data.periodDays);
  
      try {
        await user.save();
        wx.showToast({ title: 'Saved!', icon: 'success' });
      } catch (err) {
        console.error('❌ 保存用户周期失败:', err);
      }
    }
  },  

  // ================== 日历逻辑 ==================
  generateCalendar(periodStart, cycleLength, year, month, records = []) {
    let days = [];
    let firstDay = new Date(year, month, 1).getDay();
    let daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) days.push({ day: '', type: '' });
    for (let i = 1; i <= daysInMonth; i++) days.push({ day: i, type: '' });

    if (periodStart) {
      let start = new Date(periodStart);
      const maxIterations = 12;
      let iterations = 0;

      while (
        iterations < maxIterations &&
        (start.getFullYear() < year || (start.getFullYear() === year && start.getMonth() <= month))
      ) {
        let periodEnd = new Date(start.getTime() + (this.data.periodDays - 1) * oneDay);
        let ovulationDay = new Date(start.getTime() + (cycleLength - 14) * oneDay);

        const startTime = start.getTime();
        const periodEndTime = periodEnd.getTime();
        const ovulationTime = ovulationDay.getTime();

        for (let i = 0; i < days.length; i++) {
          if (!days[i].day) continue;
          let d = new Date(year, month, days[i].day);
          let dTime = d.getTime();

          if (dTime >= startTime && dTime <= periodEndTime) {
            days[i].type = days[i].type ? days[i].type + ' period' : 'period';
          } else if (dTime === ovulationTime) {
            days[i].type = days[i].type ? days[i].type + ' ovulation' : 'ovulation';
          }
        }

        start = new Date(start.getTime() + cycleLength * oneDay);
        iterations++;
      }
    }

    records.forEach(r => {
      let d = new Date(r.date);
      if (d.getFullYear() === year && d.getMonth() === month) {
        let index = firstDay + d.getDate() - 1;
        if (days[index] && days[index].day) {
          days[index].type = days[index].type ? days[index].type + ' recorded' : 'recorded';
        }
      }
    });

    this.setData({ days, currentYear: year, currentMonth: month });
  },

  prevMonth() {
    let { currentYear, currentMonth, lastPeriod, cycleLength, records } = this.data;
    if (currentMonth === 0) {
      currentYear -= 1;
      currentMonth = 11;
    } else {
      currentMonth -= 1;
    }
    this.generateCalendar(lastPeriod, cycleLength, currentYear, currentMonth, records);
  },

  nextMonth() {
    let { currentYear, currentMonth, lastPeriod, cycleLength, records } = this.data;
    if (currentMonth === 11) {
      currentYear += 1;
      currentMonth = 0;
    } else {
      currentMonth += 1;
    }
    this.generateCalendar(lastPeriod, cycleLength, currentYear, currentMonth, records);
  },

  // ================== onDayTap ==================
  async onDayTap(e) {
    let day = e.currentTarget.dataset.day;
    if (!day) return;

    let { currentYear, currentMonth, records, historyPeriods, periodDays } = this.data;
    let date = new Date(currentYear, currentMonth, day);
    let dateStr = this.formatDate(date);

    let existing = records.find(r => r.date === dateStr);

    if (existing) {
      // ✅ 已有记录 → 只显示记录，不跳转
      this.setData({ selectedRecord: existing });
      return;
    } else {
      // ✅ 没有记录 → 跳转 record 页面
      let lastPeriodDate = historyPeriods.length > 0 ? new Date(historyPeriods[historyPeriods.length - 1]) : null;
      let diffDays = lastPeriodDate ? (date - lastPeriodDate) / oneDay : null;

      if (lastPeriodDate && diffDays >= 0 && diffDays < periodDays) {
        await this.saveRecord(dateStr, '经期中');
        wx.navigateTo({
          url: `/pages/record/record?date=${dateStr}&period=1`
        });
        await this.loadFromCloud();
        this.generateCalendar(this.data.lastPeriod, this.data.cycleLength, currentYear, currentMonth, this.data.records);
        return;
      }

      wx.showModal({
        title: '确认记录',
        content: `标记 ${dateStr} 为新的月经开始日？`,
        success: async (res) => {
          if (res.confirm) {
            let history = this.data.historyPeriods || [];
            if (!history.includes(dateStr)) {
              history.push(dateStr);
              history.sort((a, b) => new Date(a) - new Date(b));
              await this.saveHistory(dateStr);
            }

            let avgCycle = this.calculateAverageCycle(history);
            let next = this.calculateNextPeriod(dateStr, avgCycle);

            this.setData({
              lastPeriod: dateStr,
              historyPeriods: history,
              cycleLength: avgCycle,
              nextPeriod: next
            });

            await this.saveUserPeriods();

            wx.navigateTo({
              url: `/pages/record/record?date=${dateStr}&first=1`
            });

            await this.loadFromCloud();
            this.generateCalendar(dateStr, avgCycle, currentYear, currentMonth, this.data.records);
          }
        }
      });
    }
  },

  calculateAverageCycle(history) {
    if (history.length < 2) return this.data.cycleLength;
    let total = 0;
    for (let i = 1; i < history.length; i++) {
      total += (new Date(history[i]) - new Date(history[i - 1])) / oneDay;
    }
    return Math.round(total / (history.length - 1));
  },

  calculateNextPeriod(lastPeriod, cycleLength) {
    if (!lastPeriod) return '';
    const lastDate = new Date(lastPeriod);
    const nextDate = new Date(lastDate.getTime() + cycleLength * oneDay);
    return this.formatDate(nextDate);
  },

  formatDate(date) {
    let y = date.getFullYear();
    let m = date.getMonth() + 1;
    let d = date.getDate();
    return `${y}-${m < 10 ? '0'+m : m}-${d < 10 ? '0'+d : d}`;
  },

  async onLastPeriodChange(e) {
    let dateStr = e.detail.value;
    let history = this.data.historyPeriods || [];
    if (!history.includes(dateStr)) {
      history.push(dateStr);
      history.sort((a, b) => new Date(a) - new Date(b));
      await this.saveHistory(dateStr);
    }

    let avgCycle = this.calculateAverageCycle(history);
    let next = this.calculateNextPeriod(dateStr, avgCycle);

    this.setData({
      lastPeriod: dateStr,
      historyPeriods: history,
      cycleLength: avgCycle,
      nextPeriod: next
    });

    await this.saveUserPeriods();

    await this.loadFromCloud();
    this.generateCalendar(dateStr, avgCycle, this.data.currentYear, this.data.currentMonth, this.data.records);
  },

  onCycleLengthChange(e) {
    this.setData({ cycleLength: parseInt(e.detail.value) || 28 });
    if (this.data.lastPeriod) {
      let next = this.calculateNextPeriod(this.data.lastPeriod, this.data.cycleLength);
      this.setData({ nextPeriod: next });
      this.generateCalendar(this.data.lastPeriod, this.data.cycleLength,
                            this.data.currentYear, this.data.currentMonth, this.data.records);
      this.saveUserPeriods();
    }
  },
  
  onPeriodDaysChange(e) {
    this.setData({ periodDays: parseInt(e.detail.value) || 5 });
    if (this.data.lastPeriod) {
      this.generateCalendar(this.data.lastPeriod, this.data.cycleLength,
                            this.data.currentYear, this.data.currentMonth, this.data.records);
      this.saveUserPeriods();
    }
  },  

  goHistoryPage() {
    wx.navigateTo({ url: '/pages/history/history' });
  }

});
