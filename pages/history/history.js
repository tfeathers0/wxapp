const AV = require('../../libs/av-core-min.js');


Page({
  data: {
    avgCycleDays: null,
    avgPeriodDays: null,
    nextPrediction: null,
    showModal: false,
    startDate: '',
    endDate: '',
    periodDays: '',
    startDays: [],       // 存储历史开始日期
    endDays: [],         // 存储历史结束日期
    periodDaysArr: [],   // 存储历史周期天数
    history: [],         // 组合后的历史记录
    cycleInfo: {}        // 添加 cycleInfo 数据
  },


  onLoad() {
    this.loadCycleInfo();
    this.loadHistory();
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


  // 加载周期信息
  async loadCycleInfo() {
    const UserClass = this.getUserClass();
    if (!UserClass) return;


    try {
      const query = new AV.Query(UserClass);
      query.equalTo('type', 'cycleInfo');
      const cycleInfoObj = await query.first();


      if (cycleInfoObj) {
        const cycleInfo = {
          cycleLength: cycleInfoObj.get('cycleLength') || 28,
          futurePeriod: cycleInfoObj.get('futurePeriod') || '',
          periodDays: cycleInfoObj.get('periodDays') || 5,
          nowPeriod: cycleInfoObj.get('nowPeriod') || '', // 添加 nowPeriod
          endPeriod: cycleInfoObj.get('endPeriod') || ''  // 添加 endPeriod
        };
        
        this.setData({ cycleInfo });
        
        // 检查并添加已结束的周期到历史记录
        await this.checkAndAddCompletedPeriod();
        
        // 更新统计数据
        this.calculateStats();
      }
    } catch (err) {
      console.error('加载周期信息失败', err);
    }
  },


  // 检查并添加已结束的周期到历史记录
  // 检查并添加已结束的周期到历史记录
async checkAndAddCompletedPeriod() {
  const { cycleInfo } = this.data;
  const { nowPeriod, endPeriod } = cycleInfo;

  if (nowPeriod && endPeriod) {
    const endDate = new Date(endPeriod);
    const today = new Date();

    // 如果已结束
    if (endDate < today) {
      const startDate = new Date(nowPeriod);
      const daysDiff = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

      // 保存到历史记录
      await this.addPeriodToHistory(
        this.formatDate(startDate),
        this.formatDate(endDate),
        daysDiff
      );

      // 清空 cycleInfo
      await this.clearCompletedPeriod();

      // 重新加载历史记录，保证页面显示最新数据
      await this.loadHistory();
    }
  }
},

// 添加周期到历史记录
// 添加周期到历史记录
async addPeriodToHistory(startDate, endDate, days) {
  const UserClass = this.getUserClass();
  if (!UserClass) return;

  try {
    const query = new AV.Query(UserClass);
    query.equalTo('type', 'history');   // ✅ 指定只查历史记录
    const results = await query.find();
    let obj;

    if (results.length > 0) {
      obj = results[0];
    } else {
      obj = new UserClass();
      obj.set('type', 'history');       // ✅ 新建时一定要标记类型
      obj.set('startDays', []);
      obj.set('endDays', []);
      obj.set('periodDaysArr', []);
    }

    const startDays = obj.get('startDays') || [];
    const endDays = obj.get('endDays') || [];
    const periodDaysArr = obj.get('periodDaysArr') || [];

    startDays.push(startDate);
    endDays.push(endDate);
    periodDaysArr.push(Number(days));

    obj.set('startDays', startDays);
    obj.set('endDays', endDays);
    obj.set('periodDaysArr', periodDaysArr);

    await obj.save();

    this.setData({
      startDays,
      endDays,
      periodDaysArr,
      history: startDays.map((s, i) => ({
        startDate: s,
        endDate: endDays[i] || '',
        days: periodDaysArr[i] || 0
      }))
    });

    console.log('已添加完成的周期到历史:', { startDate, endDate, days });
  } catch (err) {
    console.error('添加历史记录失败', err);
  }
},

// 清空已完成的周期信息
async clearCompletedPeriod() {
  const UserClass = this.getUserClass();
  if (!UserClass) return;

  try {
    const query = new AV.Query(UserClass);
    query.equalTo('type', 'cycleInfo');
    const cycleInfoObj = await query.first();

    if (cycleInfoObj) {
      cycleInfoObj.set('nowPeriod', '');
      cycleInfoObj.set('endPeriod', '');
      await cycleInfoObj.save();

      this.setData({
        'cycleInfo.nowPeriod': '',
        'cycleInfo.endPeriod': ''
      });

      console.log('已清空已完成的周期信息');
    }
  } catch (err) {
    console.error('清空周期信息失败', err);
  }
},

  // 显示/隐藏记录弹窗
  showRecordModal() {
    this.setData({ showModal: true, startDate: '', endDate: '', periodDays: '' });
  },

  hideRecordModal() {
    this.setData({ showModal: false });
  },

  // 日期变化处理
  onStartDateChange(e) {
    this.setData({ startDate: e.detail.value }, this.calculatePeriodDays);
  },
  onEndDateChange(e) {
    this.setData({ endDate: e.detail.value }, this.calculatePeriodDays);
  },
  onPeriodDaysChange(e) {
    this.setData({ periodDays: e.detail.value });
  },

  // 自动计算周期天数
  calculatePeriodDays() {
    const { startDate, endDate } = this.data;
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      this.setData({ periodDays: diffDays.toString() });
    }
  },

  // 保存记录到 LeanCloud
  async onSaveRecord() {
    const { startDate, endDate, periodDays } = this.data;
    if (!startDate || !endDate || !periodDays) {
      wx.showToast({ title: '请填写完整信息', icon: 'none' });
      return;
    }

    const UserClass = this.getUserClass();
    if (!UserClass) return;

    try {
      const query = new AV.Query(UserClass);
      query.limit(1);
      const results = await query.find();
      let obj;

      if (results.length > 0) {
        obj = results[0];
      } else {
        obj = new UserClass();
        obj.set('startDays', []);
        obj.set('endDays', []);
        obj.set('periodDaysArr', []);
      }

      // 获取现有数组
      const startDays = obj.get('startDays') || [];
      const endDays = obj.get('endDays') || [];
      const periodDaysArr = obj.get('periodDaysArr') || [];

      // 添加新记录
      startDays.push(startDate);
      endDays.push(endDate);
      periodDaysArr.push(Number(periodDays));

      obj.set('startDays', startDays);
      obj.set('endDays', endDays);
      obj.set('periodDaysArr', periodDaysArr);

      await obj.save();
      wx.showToast({ title: '保存成功', icon: 'success' });
      this.hideRecordModal();

      // 更新本地 history
      this.setData({
        startDays,
        endDays,
        periodDaysArr,
        history: startDays.map((start, i) => ({
          startDate: start,
          endDate: endDays[i] || '',
          days: periodDaysArr[i] || 0
        }))
      });

      // 更新统计数据
      this.calculateStats();
    } catch (err) {
      console.error('保存失败', err);
      wx.showToast({ title: '保存失败: ' + err.message, icon: 'none' });
    }
  },

  // 加载历史记录
  async loadHistory() {
    const UserClass = this.getUserClass();
    if (!UserClass) return;

    try {
      const query = new AV.Query(UserClass);
      query.limit(1);
      const results = await query.find();

      if (results.length > 0) {
        const obj = results[0].toJSON();
        const startDays = obj.startDays || [];
        const endDays = obj.endDays || [];
        const periodDaysArr = obj.periodDaysArr || [];

        const history = startDays.map((start, i) => ({
          startDate: start,
          endDate: endDays[i] || '',
          days: periodDaysArr[i] || 0
        }));

        this.setData({ startDays, endDays, periodDaysArr, history });
        
        // 更新统计数据
        this.calculateStats();
      } else {
        this.setData({ startDays: [], endDays: [], periodDaysArr: [], history: [] });
        
        // 更新统计数据
        this.calculateStats();
      }
    } catch (err) {
      console.error('加载失败', err);
    }
  },

  // 删除某条记录
  async onDeleteRecord(e) {
    const index = e.currentTarget.dataset.index;
    const UserClass = this.getUserClass();
    if (!UserClass) return;

    try {
      const query = new AV.Query(UserClass);
      query.limit(1);
      const results = await query.find();

      if (results.length > 0) {
        const obj = results[0];

        const startDays = obj.get('startDays') || [];
        const endDays = obj.get('endDays') || [];
        const periodDaysArr = obj.get('periodDaysArr') || [];

        startDays.splice(index, 1);
        endDays.splice(index, 1);
        periodDaysArr.splice(index, 1);

        obj.set('startDays', startDays);
        obj.set('endDays', endDays);
        obj.set('periodDaysArr', periodDaysArr);


        await obj.save();
        wx.showToast({ title: '删除成功', icon: 'success' });


        // 更新本地 history
        this.setData({
          startDays,
          endDays,
          periodDaysArr,
          history: startDays.map((start, i) => ({
            startDate: start,
            endDate: endDays[i] || '',
            days: periodDaysArr[i] || 0
          }))
        });


        // 更新统计数据
        this.calculateStats();
      }
    } catch (err) {
      console.error('删除失败', err);
      wx.showToast({ title: '删除失败', icon: 'none' });
    }
  },


  // 计算统计数据
  calculateStats() {
    const { periodDaysArr, cycleInfo } = this.data;
    
    // 平均周期天数从 cycleInfo.cycleLength 获取
    const avgCycleDays = cycleInfo.cycleLength || null;
    
    // 下一次预测从 cycleInfo.futurePeriod 获取
    const nextPrediction = cycleInfo.futurePeriod || null;
    
    // 平均经期天数通过计算 periodDaysArr 的平均值
    let avgPeriodDays = null;
    if (periodDaysArr && periodDaysArr.length > 0) {
      const totalPeriodDays = periodDaysArr.reduce((sum, days) => sum + Number(days), 0);
      avgPeriodDays = Math.round(totalPeriodDays / periodDaysArr.length);
    }


    this.setData({ avgCycleDays, avgPeriodDays, nextPrediction });
  },


  // 格式化日期
  formatDate(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
});
