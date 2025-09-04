const AV = require('../../libs/av-core-min.js');

Page({
  data: {
    date: '',
    bloodAmount: '中',
    symptoms: Array(9).fill(0),
    record: '',
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
    ]
  },

  async onLoad(options) {
    const date = options.date || this.getCurrentDate();
    this.setData({ date });

    try {
      const query = new AV.Query('PeriodRecords');
      query.equalTo('date', date);
      const res = await query.first();

      if (res) {
        this.setData({
          bloodAmount: res.get('bloodAmount') || '中',
          symptoms: res.get('symptoms') || Array(9).fill(0),
          record: res.get('record') || '',
          isFirstDay: res.get('isFirstDay') || false,
          isInPeriod: res.get('isInPeriod') || false,
          mood: res.get('mood') || '平静'
        });
      }
    } catch (error) {
      console.error('加载记录失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  getCurrentDate() {
    const date = new Date();
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}-${month < 10 ? '0' + month : month}-${day < 10 ? '0' + day : day}`;
  },

  onBloodAmountChange(e) {
    const value = e.currentTarget.dataset.value;
    this.setData({ bloodAmount: value });
  },

  onSymptomToggle(e) {
    const idx = Number(e.currentTarget.dataset.index);
    const symptoms = this.data.symptoms.map((item, index) => 
      index === idx ? (item === 1 ? 0 : 1) : item
    );
    this.setData({ symptoms });
  },

  onRecordInput(e) {
    this.setData({ record: e.detail.value });
  },

  onFirstDayChange(e) {
    this.setData({ isFirstDay: e.detail.value });
  },

  onInPeriodChange(e) {
    this.setData({ isInPeriod: e.detail.value });
  },

  onMoodSelect(e) {
    const mood = e.currentTarget.dataset.mood;
    this.setData({ mood });
  },

  async saveRecord() {
    if (this.data.isSaving) return;
    
    this.setData({ isSaving: true });
    
    const { date, bloodAmount, symptoms, record, isFirstDay, isInPeriod, mood } = this.data;

    try {
      const query = new AV.Query('PeriodRecords');
      query.equalTo('date', date);
      let existing = await query.first();

      if (existing) {
        existing.set('bloodAmount', bloodAmount);
        existing.set('symptoms', symptoms);
        existing.set('record', record);
        existing.set('isFirstDay', isFirstDay);
        existing.set('isInPeriod', isInPeriod);
        existing.set('mood', mood);
        await existing.save();
      } else {
        const PeriodRecords = AV.Object.extend('PeriodRecords');
        const newRecord = new PeriodRecords();
        newRecord.set('date', date);
        newRecord.set('bloodAmount', bloodAmount);
        newRecord.set('symptoms', symptoms);
        newRecord.set('record', record);
        newRecord.set('isFirstDay', isFirstDay);
        newRecord.set('isInPeriod', isInPeriod);
        newRecord.set('mood', mood);
        await newRecord.save();
      }

      // 更新日历页面
      const pages = getCurrentPages();
      const prevPage = pages[pages.length - 2];
      if (prevPage && prevPage.updateLastPeriod) {
        if (isFirstDay) {
          prevPage.updateLastPeriod(date);
        } else {
          const allQuery = new AV.Query('PeriodRecords');
          allQuery.equalTo('isFirstDay', true);
          allQuery.ascending('date');
          const all = await allQuery.find();
          const latestFirstDay = all.length > 0 ? all[all.length - 1].get('date') : '';
          prevPage.updateLastPeriod(latestFirstDay || '');
        }
      }

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
      console.error('保存记录失败:', error);
      this.setData({ isSaving: false });
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      });
    }
  }
});