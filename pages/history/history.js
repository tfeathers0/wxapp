// pages/history/history.js
const AV = require('../../libs/av-core-min.js');

Page({
  data: {
    avgCycleDays: null,     // ← connected with calendar.cycleLength
    avgPeriodDays: null,    // ← calculated locally
    nextPrediction: null,   // ← connected with calendar.futurePeriod
    showModal: false,
    startDate: '',
    endDate: '',
    periodDays: '',
    startDays: [],          // 存储历史开始日期
    endDays: [],            // 存储历史结束日期
    periodDaysArr: [],      // 存储历史周期天数
    duringdays: [],         // 存储经期内的所有日期（不包括第一天）
    startingdays: [],       // 存储经期第一天的日期
    history: [],            // 历史记录列表
    cycleDetails: [],       // 周期详情列表
    startingDaysList: [],   // 格式化后的开始日期列表
    duringDaysList: [],     // 格式化后的经期日期列表
    totalRecords: 0
  },

  onLoad() {
    this.loadHistory();
    this.loadCycleInfo(); // ⚡ 加载周期信息
  },

  // 获取用户对应的 LeanCloud Class
  getUserClass() {
    const user = AV.User.current();
    if (!user) {
      wx.showToast({ title: '请先登录', icon: 'none', duration: 2000 });
      setTimeout(() => wx.navigateBack(), 2000);
      return null;
    }
    const username = user.getUsername();
    const className = `User_${username.replace(/[^a-zA-Z0-9]/g, '_')}`;
    return AV.Object.extend(className);
  },

  // 格式化日期数组为显示列表
  formatDaysList(daysArray, type) {
    return daysArray.map(date => ({
      date: date,
      type: type,
      displayText: type === 'starting' ? '经期第一天' : '经期中',
      icon: type === 'starting' ? '🔴' : '🟣'
    })).sort((a, b) => new Date(b.date) - new Date(a.date)); // 倒序
  },

  // ⚡ 加载周期信息（与 calendar.js 保持一致）
  async loadCycleInfo() {
    try {
      const UserClass = this.getUserClass();
      if (!UserClass) return;

      const query = new AV.Query(UserClass);
      query.equalTo('type', 'cycleInfo');
      const cycleInfoObj = await query.first();

      if (cycleInfoObj) {
        const cycleLength = cycleInfoObj.get('cycleLength') || null;
        const periodDays = cycleInfoObj.get('periodDays') || null;
        const futurePeriod = cycleInfoObj.get('futurePeriod') || null;

        this.setData({
          avgCycleDays: cycleLength,   // ← connected
          avgPeriodDays: periodDays,   // 初始值
          nextPrediction: futurePeriod // ← connected
        });
        console.log('周期信息加载成功:', this.data);
      } else {
        console.log('未找到 cycleInfo 对象');
      }
    } catch (err) {
      console.error('加载周期信息失败:', err);
    }
  },

  // 加载历史记录
  async loadHistory() {
    const UserClass = this.getUserClass();
    if (!UserClass) return;

    try {
      // 直接查询type为record的记录
      const query = new AV.Query(UserClass);
      query.equalTo('type', 'record');
      query.descending('date'); // 按日期降序排列，最新的在前
      const results = await query.find();

      if (results.length > 0) {
        // 处理结果
        const records = results.map(result => result.toJSON());
        
        // 筛选出经期第一天的记录
        const startingdays = records.filter(record => record.isFirstDay).map(record => record.date);
        
        // 筛选出经期中的记录（不包括第一天）
        const duringdays = records.filter(record => record.isInPeriod && !record.isFirstDay).map(record => record.date);
        
        // 获取开始日期和结束日期（从记录中推导）
        const startDays = [];
        const endDays = [];
        const periodDaysArr = [];
        
        // 处理每个经期第一天记录，计算对应的周期
        startingdays.forEach(startDate => {
          const startDateObj = new Date(startDate);
          
          // 查找该周期内的所有经期记录
          const periodRecords = records.filter(record => {
            if (!record.isInPeriod) return false;
            const recordDate = new Date(record.date);
            // 日期在开始日期之后，且不超过7天（合理的经期长度）
            return recordDate >= startDateObj && recordDate <= new Date(startDateObj.getTime() + 7 * 24 * 60 * 60 * 1000);
          });
          
          if (periodRecords.length > 0) {
            // 按日期排序
            periodRecords.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            const firstRecord = periodRecords[0];
            const lastRecord = periodRecords[periodRecords.length - 1];
            
            startDays.push(firstRecord.date);
            endDays.push(lastRecord.date);
            // 计算经期天数
            const periodDays = Math.floor((new Date(lastRecord.date) - new Date(firstRecord.date)) / (1000 * 60 * 60 * 24)) + 1;
            periodDaysArr.push(periodDays);
          }
        });

        // 历史记录
        const history = startDays.map((startDate, index) => ({
          startDate: startDate,
          endDate: endDays[index] || '',
          days: periodDaysArr[index] || ''
        }));

        // 周期详情
        const cycleDetails = startDays.map((startDate, index) => ({
          dateRange: `${startDate} - ${endDays[index] || ''}`,
          cycleDays: periodDaysArr[index] || '',
          periodDays: periodDaysArr[index] || ''
        }));

        // 格式化日期列表
        const startingDaysList = this.formatDaysList(startingdays, 'starting');
        const duringDaysList = this.formatDaysList(duringdays, 'during');

        // Calculate total records (only startingdays + duringdays)
        const totalRecords = startingdays.length + duringdays.length;

        this.setData({ 
          startDays, 
          endDays, 
          periodDaysArr, 
          duringdays, 
          startingdays,
          history,
          cycleDetails,
          startingDaysList,
          duringDaysList,
          totalRecords  // Set the total records count
        });

        this.calculateStats();

      } else {
        this.setData({ 
          startDays: [], 
          endDays: [], 
          periodDaysArr: [], 
          duringdays: [],
          startingdays: [],
          history: [],
          cycleDetails: [],
          startingDaysList: [],
          duringDaysList: [],
          totalRecords: 0  // Set to 0 when no records
        });

        this.calculateStats();
      }
    } catch (err) {
      console.error('加载失败', err);
    }
  },

  // 删除记录
  async deleteRecord(e) {
    const index = e.currentTarget.dataset.index;
    const UserClass = this.getUserClass();
    if (!UserClass) return;

    try {
      const query = new AV.Query(UserClass);
      query.equalTo('type', 'historyPeriods');
      const results = await query.find();

      if (results.length > 0) {
        const obj = results[0];
        const startDays = obj.get('startDays') || [];
        const endDays = obj.get('endDays') || [];
        const periodDaysArr = obj.get('periodDaysArr') || [];

        const dateToRemove = startDays[index];

        const duringdays = obj.get('duringdays') || [];
        const startingdays = obj.get('startingdays') || [];

        // 移除 startingdays
        const startIndex = startingdays.indexOf(dateToRemove);
        if (startIndex !== -1) startingdays.splice(startIndex, 1);

        // 移除 duringdays
        const duringIndex = duringdays.indexOf(dateToRemove);
        if (duringIndex !== -1) duringdays.splice(duringIndex, 1);

        // 移除其他数组
        startDays.splice(index, 1);
        endDays.splice(index, 1);
        periodDaysArr.splice(index, 1);

        obj.set('startDays', startDays);
        obj.set('endDays', endDays);
        obj.set('periodDaysArr', periodDaysArr);
        obj.set('duringdays', duringdays);
        obj.set('startingdays', startingdays);

        await obj.save();
        wx.showToast({ title: '删除成功', icon: 'success' });
        this.loadHistory();
      }
    } catch (err) {
      console.error('删除失败', err);
      wx.showToast({ title: '删除失败', icon: 'none' });
    }
  },

  // 计算统计数据
  calculateStats() {
    const { periodDaysArr } = this.data;

    // 平均经期天数
    let avgPeriodDays = null;
    if (periodDaysArr && periodDaysArr.length > 0) {
      const total = periodDaysArr.reduce((sum, days) => sum + Number(days), 0);
      avgPeriodDays = Math.round(total / periodDaysArr.length);
    }

    // ⚡ 不覆盖 avgCycleDays / nextPrediction
    this.setData({ avgPeriodDays });
  },

  navigateToDateRecord(e) {
    const date = e.currentTarget.dataset.date;
    if (date) {
      wx.navigateTo({
        url: `/pages/record/record?date=${date}`
      });
    }
  },

  // 格式化日期
  formatDate(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
});
