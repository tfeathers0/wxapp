Page({
  data: {
    history: [],
    periodDays: [],
    avgCycleDays: 0,
    avgPeriodDays: 0,
    nextPrediction: ''
  },

  onLoad() {
    this.loadHistoryData();
  },

  onShow() {
    // 当页面显示时重新加载数据
    this.loadHistoryData();
  },

  loadHistoryData() {
    let history = wx.getStorageSync('historyPeriods') || [];
    let periodRecords = wx.getStorageSync('periodRecords') || [];
    
    // 计算经期天数（这里需要根据实际数据结构调整）
    let periodDays = history.map(date => {
      let record = periodRecords.find(r => r.date === date);
      return record && record.periodDays ? record.periodDays : '?';
    });
    
    // 计算统计数据
    let stats = this.calculateStats(history);
    
    this.setData({
      history: history,
      periodDays: periodDays,
      avgCycleDays: stats.avgCycleDays,
      avgPeriodDays: stats.avgPeriodDays,
      nextPrediction: stats.nextPrediction
    });
  },

  calculateStats(history) {
    if (history.length < 2) {
      return {
        avgCycleDays: 0,
        avgPeriodDays: 0,
        nextPrediction: ''
      };
    }

    // 计算平均周期天数
    let cycleDays = [];
    for (let i = 1; i < history.length; i++) {
      let prevDate = new Date(history[i - 1]);
      let currDate = new Date(history[i]);
      let diffTime = Math.abs(currDate - prevDate);
      let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      cycleDays.push(diffDays);
    }
    
    let avgCycleDays = Math.round(cycleDays.reduce((a, b) => a + b, 0) / cycleDays.length);
    
    // 计算平均经期天数（这里需要根据实际数据调整）
    let avgPeriodDays = 5; // 默认值，实际应从记录中计算
    
    // 预测下次经期
    let lastDate = new Date(history[history.length - 1]);
    let nextDate = new Date(lastDate);
    nextDate.setDate(nextDate.getDate() + avgCycleDays);
    let nextPrediction = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`;
    
    return {
      avgCycleDays: avgCycleDays,
      avgPeriodDays: avgPeriodDays,
      nextPrediction: nextPrediction
    };
  },

  navigateToRecord() {
    wx.navigateTo({
      url: '/pages/record/record'
    });
  }
});