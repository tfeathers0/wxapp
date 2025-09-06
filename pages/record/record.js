const AV = require('../../libs/av-core-min.js');

Page({
  data: {
    date: '',
    bloodAmount: '中',
    symptoms: Array(9).fill(0),
    note: '',
    isFirstDay: false,
    isInPeriod: false,
    mood: '平静',
    isSaving: false,
    bloodOptions: ['少', '中', '多'],
    symptomOptions: ['头痛', '经痛', '腰酸', '情绪低落', '发烧', '乏力', '恶心', '腹泻', '其他'],
    moodOptions: [
      { icon: '😄', label: '开心' },
      { icon: '😐', label: '平静' },
      { icon: '😢', label: '低落' },
      { icon: '😡', label: '烦躁' },
      { icon: '😰', label: '焦虑' },
      { icon: '😴', label: '疲惫' }
    ],
    existingRecord: null
  },

  async onLoad(options) {
    const date = options.date || this.getCurrentDate();
    this.setData({ date });
    await this.loadRecord(date);
  },

  getCurrentDate() {
    const date = new Date();
    return this.formatDate(date);
  },

  formatDate(date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}-${month < 10 ? '0' + month : month}-${day < 10 ? '0' + day : day}`;
  },

  // ============ 用户类相关 ============
  getUserClassName() {
    const user = AV.User.current();
    if (!user) {
      wx.showToast({ title: '请先登录', icon: 'none', duration: 2000 });
      setTimeout(() => wx.navigateBack(), 2000);
      return null;
    }
    const username = user.getUsername();
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

  // ============ 加载记录 ============
  async loadRecord(date) {
    try {
      const className = this.getUserClassName();
      if (!className) return;

      await this.ensureUserClass();

      const query = new AV.Query(className);
      query.equalTo('date', date);
      const res = await query.first();

      if (res) {
        this.setData({
          bloodAmount: res.get('bloodAmount') || '中',
          symptoms: res.get('symptoms') || Array(9).fill(0),
          note: res.get('note') || '',
          isFirstDay: res.get('isFirstDay') || false,
          isInPeriod: res.get('isInPeriod') || false,
          mood: res.get('mood') || '平静',
          existingRecord: res
        });

        if (res.get('isFirstDay')) {
          await this.updateCycleInfo(date);
        }
      }
    } catch (error) {
      console.error('加载记录失败:', error);
    }
  },

  // ============ 事件 ============
  onBloodAmountChange(e) {
    this.setData({ bloodAmount: e.currentTarget.dataset.value });
  },

  onSymptomToggle(e) {
    const idx = Number(e.currentTarget.dataset.index);
    const symptoms = this.data.symptoms.map((item, index) =>
      index === idx ? (item === 1 ? 0 : 1) : item
    );
    this.setData({ symptoms });
  },

  onNoteInput(e) {
    this.setData({ note: e.detail.value });
  },

  onFirstDayChange(e) {
    const isFirstDay = e.detail.value;
    this.setData({ 
      isFirstDay,
      // Automatically enable isInPeriod when isFirstDay is enabled
      isInPeriod: isFirstDay ? true : this.data.isInPeriod
    });
  },

  onInPeriodChange(e) {
    this.setData({ isInPeriod: e.detail.value });
  },

  onMoodSelect(e) {
    this.setData({ mood: e.currentTarget.dataset.mood });
  },

  // ============ 保存记录 ============
  async saveRecord() {
    if (this.data.isSaving) return;
    this.setData({ isSaving: true });

    const { date, bloodAmount, symptoms, note, isFirstDay, isInPeriod, mood, existingRecord } = this.data;
    const className = this.getUserClassName();
    if (!className) {
      this.setData({ isSaving: false });
      return;
    }

    try {
      await this.ensureUserClass();

      let obj;
      if (existingRecord) {
        obj = existingRecord;
      } else {
        const UserClass = AV.Object.extend(className);
        obj = new UserClass();
        obj.set('date', date);
      }

      // Check if isFirstDay status changed
      const wasFirstDay = existingRecord ? existingRecord.get('isFirstDay') : false;
      
      obj.set('bloodAmount', bloodAmount);
      obj.set('symptoms', symptoms);
      obj.set('note', note);
      obj.set('isFirstDay', isFirstDay);
      obj.set('isInPeriod', isInPeriod);
      obj.set('mood', mood);

      await obj.save();

      if (isFirstDay && !wasFirstDay) {
        // Added first day
        await this.updateCycleInfo(date);
        await this.addToHistoryPeriods(date);
      } else if (!isFirstDay && wasFirstDay) {
        // Removed first day
        await this.removeFromHistoryPeriods(date);
      }

      await this.updateCalendarPage();

      wx.showToast({
        title: '保存成功',
        icon: 'success',
        duration: 1500,
        success: () => {
          setTimeout(() => {
            this.setData({ isSaving: false });
            wx.navigateBack();
          }, 1500);
        }
      });
    } catch (error) {
      console.error('保存失败:', error);
      this.setData({ isSaving: false });
    }
  },

  // ============ 添加到历史经期记录 ============
  async addToHistoryPeriods(dateStr) {
    try {
      const className = this.getUserClassName();
      if (!className) return;
      
      // 获取或创建历史记录对象
      const HistoryQuery = new AV.Query(className);
      HistoryQuery.equalTo('type', 'historyPeriods');
      let historyObj = await HistoryQuery.first();
      
      if (historyObj) {
        // 更新现有记录
        let historyPeriods = historyObj.get('dates') || [];
        if (!historyPeriods.includes(dateStr)) {
          historyPeriods.push(dateStr);
          // 按日期排序（最新的在前）
          historyPeriods.sort((a, b) => new Date(b) - new Date(a));
          historyObj.set('dates', historyPeriods);
          await historyObj.save();
        }
      } else {
        // 创建新记录
        const UserClass = AV.Object.extend(className);
        const newHistoryObj = new UserClass();
        newHistoryObj.set('type', 'historyPeriods');
        newHistoryObj.set('dates', [dateStr]);
        await newHistoryObj.save();
      }
    } catch (err) {
      console.error('更新历史经期记录失败:', err);
    }
  },

  // ============ 从历史经期记录中移除 ============
  async removeFromHistoryPeriods(dateStr) {
    try {
      const className = this.getUserClassName();
      if (!className) return;
      
      // 获取历史记录对象
      const HistoryQuery = new AV.Query(className);
      HistoryQuery.equalTo('type', 'historyPeriods');
      let historyObj = await HistoryQuery.first();
      
      if (historyObj) {
        let historyPeriods = historyObj.get('dates') || [];
        // 移除指定日期
        historyPeriods = historyPeriods.filter(d => d !== dateStr);
        historyObj.set('dates', historyPeriods);
        await historyObj.save();
      }
    } catch (err) {
      console.error('从历史经期记录中移除失败:', err);
    }
  },

  // ============ 更新周期信息 ============
  async updateCycleInfo(dateStr) {
    try {
      const className = this.getUserClassName();
      if (!className) return;
      await this.ensureUserClass();

      const CycleInfo = new AV.Query(className);
      CycleInfo.equalTo('type', 'cycleInfo');
      const cycleInfoObj = await CycleInfo.first();

      let cycleLength = 28;
      let periodDays = 5;

      if (cycleInfoObj) {
        cycleLength = cycleInfoObj.get('cycleLength') || 28;
        periodDays = cycleInfoObj.get('periodDays') || 5;

        const nextDate = new Date(dateStr);
        nextDate.setDate(nextDate.getDate() + cycleLength);
        const nextPeriodStr = this.formatDate(nextDate);

        cycleInfoObj.set('lastPeriod', dateStr);
        cycleInfoObj.set('nextPeriod', nextPeriodStr);
        await cycleInfoObj.save();
      } else {
        const UserClass = AV.Object.extend(className);
        const obj = new UserClass();
        obj.set('type', 'cycleInfo');
        obj.set('lastPeriod', dateStr);

        const nextDate = new Date(dateStr);
        nextDate.setDate(nextDate.getDate() + cycleLength);
        const nextPeriodStr = this.formatDate(nextDate);

        obj.set('nextPeriod', nextPeriodStr);
        obj.set('cycleLength', cycleLength);
        obj.set('periodDays', periodDays);
        await obj.save();
      }
    } catch (err) {
      console.error('更新周期信息失败:', err);
    }
  },

  async updateCalendarPage() {
    try {
      const pages = getCurrentPages();
      if (pages.length > 1) {
        const prevPage = pages[pages.length - 2];
        if (prevPage) {
          // Refresh calendar normally
          if (typeof prevPage.refreshPage === 'function') {
            await prevPage.refreshPage();
          }
  
          // If this record is the first day, update lastPeriod
          if (this.data.isFirstDay && typeof prevPage.updateLastPeriod === 'function') {
            prevPage.updateLastPeriod(this.data.date); // update calendar page
          }
        }
      }
    } catch (err) {
      console.error('更新日历页面失败:', err);
    }
  }  
});