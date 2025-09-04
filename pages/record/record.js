Page({
    data: {
      date: '',
      bloodAmount: '',
      symptoms: [], // 这个数组将存储选中的症状值
      record: '',
      bloodOptions: ['多', '中', '少'],
      symptomOptions: ['头痛', '经痛', '腰酸', '情绪低落', '发烧', '乏力', '恶心', '腹泻', '其他']
    },
  
    onLoad(options) {
      const date = options.date || this.getCurrentDate();
      const records = wx.getStorageSync('periodRecords') || [];
      const existing = records.find(r => r.date === date);
  
      console.log('加载数据:', existing); // 调试信息
  
      if (existing) {
        this.setData({
          date: date,
          bloodAmount: existing.bloodAmount || '',
          symptoms: existing.symptoms || [], // 确保是数组
          record: existing.record || ''
        });
      } else {
        this.setData({
          date: date,
          bloodAmount: '',
          symptoms: [],
          record: ''
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
      this.setData({
        bloodAmount: e.detail.value
      });
    },
  
    onSymptomsChange(e) {
      console.log('症状变化:', e.detail.value); // 调试信息
      this.setData({
        symptoms: e.detail.value
      });
    },
  
    onRecordInput(e) {
      this.setData({
        record: e.detail.value
      });
    },
  
    saveRecord() {
      const { date, bloodAmount, symptoms, record } = this.data;
      
      console.log('保存数据:', { date, bloodAmount, symptoms, record }); // 调试信息
  
      const records = wx.getStorageSync('periodRecords') || [];
      const idx = records.findIndex(r => r.date === date);
  
      const recordData = {
        date: date,
        bloodAmount: bloodAmount,
        symptoms: symptoms, // 这里保存的是选中的症状值数组
        record: record
      };
  
      if (idx >= 0) {
        records[idx] = recordData;
      } else {
        records.push(recordData);
      }
  
      wx.setStorageSync('periodRecords', records);
  
      wx.showToast({
        title: '保存成功',
        icon: 'success',
        duration: 1500,
        success: () => {
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        }
      });
    }
  });