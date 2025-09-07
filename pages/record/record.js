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
    existingRecord: null,
    firstTime: false
  },

  onLoad(options) {
    const date = options.date || this.getCurrentDate();
    // 保存是否是首次记录的参数
    const firstTime = options.firstTime === 'true';
    this.setData({ 
      date, 
      firstTime 
    });
    this.loadRecord(date);
  },

  getCurrentDate() {
    const date = new Date();
    return this.formatDate(date);
  },

  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

  ensureUserClass() {
    return new Promise((resolve, reject) => {
      const className = this.getUserClassName();
      if (!className) {
        resolve(false);
        return;
      }
      const query = new AV.Query(className);
      query.first().then(() => {
        resolve(true);
      }).catch(() => {
        try {
          const UserClass = AV.Object.extend(className);
          const userObj = new UserClass();
          userObj.set('initialized', true);
          userObj.save().then(() => {
            resolve(true);
          }).catch(err => {
            console.error('创建用户类失败:', err);
            resolve(false);
          });
        } catch (error) {
          console.error('创建用户类异常:', error);
          resolve(false);
        }
      });
    });
  },

  // ============ 加载记录 ============
  loadRecord(date) {
    try {
      const className = this.getUserClassName();
      if (!className) return;

      this.ensureUserClass().then(() => {
        const query = new AV.Query(className);
        query.equalTo('date', date);
        return query.first();
      }).then(res => {
        if (res) {
          this.setData({
            bloodAmount: res.get('bloodAmount') || '中',
            symptoms: res.get('symptoms') || Array(9).fill(0),
            note: res.get('note') || '',
            isFirstDay: res.get('isFirstDay') || false,
            isLastDay: res.get('isLastDay') || false,
            isInPeriod: res.get('isInPeriod') || false,
            mood: res.get('mood') || '平静',
            existingRecord: res
          });

          if (res.get('isFirstDay')) {
            this.updateCycleInfo(date);
          }
        }
      }).catch(error => {
        console.error('加载记录失败:', error);
      });
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
  saveRecord() {
    if (this.data.isSaving) return;
    this.setData({ isSaving: true });

    const { date, bloodAmount, symptoms, note, isFirstDay, isInPeriod, mood, existingRecord } = this.data;
    const className = this.getUserClassName();
    if (!className) {
      this.setData({ isSaving: false });
      return;
    }

    // Check if isFirstDay status changed
    const wasFirstDay = existingRecord ? existingRecord.get('isFirstDay') : false;
    // 检查是否是经期状态变化
    const wasInPeriod = existingRecord ? existingRecord.get('isInPeriod') : false;
    const isInPeriodChanged = wasInPeriod !== isInPeriod;

    this.ensureUserClass().then(() => {
      let obj;
      if (existingRecord) {
        obj = existingRecord;
        // 确保更新记录时也设置date字段，保持一致性
        obj.set('date', date);
      } else {
        const UserClass = AV.Object.extend(className);
        obj = new UserClass();
        obj.set('date', date);
      }

      // 固定设置type字段为record
      obj.set('type', 'record');

      obj.set('bloodAmount', bloodAmount);
      obj.set('symptoms', symptoms);
      obj.set('note', note);
      obj.set('isFirstDay', isFirstDay);
      // 保留现有记录的isLastDay状态，仅在新建记录或明确需要设置时修改
      if (!existingRecord || isFirstDay) {
        // 第一天记录永远不是最后一天
        obj.set('isLastDay', false);
      } else {
        // 对于已存在的记录，保持其isLastDay状态不变
        const existingIsLastDay = existingRecord.get('isLastDay') || false;
        obj.set('isLastDay', existingIsLastDay);
      }
      obj.set('isInPeriod', isInPeriod);
      obj.set('mood', mood);

      return obj.save();
    }).then(() => {
      // 处理经期第一天状态变化
      if (isFirstDay && !wasFirstDay) {
        // Added first day
        return Promise.all([
          this.updateCycleInfo(date),
          this.addToHistoryPeriods(date)
        ]);
      } else if (!isFirstDay && wasFirstDay) {
        // Removed first day
        return this.removeFromHistoryPeriods(date);
      }
      return Promise.resolve();
    }).then(() => {
      // 如果经期状态发生变化，重新计算经期长度
      if (isInPeriodChanged) {
        return this.calculateAndUpdatePeriodLength();
      }
      return Promise.resolve();
    }).then(() => {
      wx.showToast({
        title: '保存成功',
        icon: 'success',
        duration: 1500,
        success: () => {
          setTimeout(() => {
            this.setData({ 
              isSaving: false,
              firstTime: false // 在导航前重置firstTime状态
            });
            // 更新日历页面
            this.updateCalendarPage();
            // 无论是否首次记录，都使用navigateBack返回，避免创建新的页面实例
            // 确保返回到原来的日历页面而不是创建新页面，防止跳转循环
            wx.navigateBack();
          }, 1500);
        }
      });
    }).catch(error => {
      console.error('保存失败:', error);
      this.setData({ isSaving: false });
    });
  },

  // ============ 添加到历史经期记录并自动标记后续日期 ============
  addToHistoryPeriods(dateStr) {
    return new Promise((resolve, reject) => {
      try {
        const className = this.getUserClassName();
        if (!className) {
          resolve();
          return;
        }
        
        // 获取经期长度
        let periodDays = 5; // 默认值
        const CycleInfo = new AV.Query(className);
        CycleInfo.equalTo('type', 'cycleInfo');
        
        CycleInfo.first().then(cycleInfoObj => {
          if (cycleInfoObj) {
            periodDays = cycleInfoObj.get('periodDays') || 5;
          }
          
          // 计算结束日期
          const startDate = new Date(dateStr);
          const endDate = new Date(startDate);
          endDate.setDate(startDate.getDate() + periodDays - 1);
          const endDateStr = this.formatDate(endDate);
          
          // 获取或创建历史记录对象
          const HistoryQuery = new AV.Query(className);
          HistoryQuery.equalTo('type', 'historyPeriods');
          
          HistoryQuery.first().then(historyObj => {
            if (historyObj) {
              // 更新现有记录
              let historyPeriods = historyObj.get('dates') || [];
              let startingdays = historyObj.get('startingdays') || [];
              let startDays = historyObj.get('startDays') || [];
              let endDays = historyObj.get('endDays') || [];
              let periodDaysArr = historyObj.get('periodDaysArr') || [];
              
              if (!historyPeriods.includes(dateStr)) {
                historyPeriods.push(dateStr);
                // 按日期排序（最新的在前）
                historyPeriods.sort((a, b) => new Date(b) - new Date(a));
                historyObj.set('dates', historyPeriods);
              }
              
              if (!startingdays.includes(dateStr)) {
                startingdays.push(dateStr);
                // 按日期排序（最新的在前）
                startingdays.sort((a, b) => new Date(b) - new Date(a));
                historyObj.set('startingdays', startingdays);
              }
              
              if (!startDays.includes(dateStr)) {
                startDays.push(dateStr);
                endDays.push(endDateStr);
                periodDaysArr.push(periodDays);
                // 按日期排序（最新的在前）
                const sortedIndexes = startDays.map((date, index) => ({date, index}))
                  .sort((a, b) => new Date(b.date) - new Date(a.date))
                  .map(item => item.index);
                
                // 根据排序后的索引重新排列数组
                const newStartDays = [];
                const newEndDays = [];
                const newPeriodDaysArr = [];
                
                for (const idx of sortedIndexes) {
                  newStartDays.push(startDays[idx]);
                  newEndDays.push(endDays[idx]);
                  newPeriodDaysArr.push(periodDaysArr[idx]);
                }
                
                historyObj.set('startDays', newStartDays);
                historyObj.set('endDays', newEndDays);
                historyObj.set('periodDaysArr', newPeriodDaysArr);
              }
              
              historyObj.save().then(() => {
                // 根据经期长度自动标记后续日期为经期中
                this.autoMarkSubsequentPeriodDays(dateStr, periodDays).then(() => {
                  resolve();
                }).catch(err => {
                  console.error('自动标记后续日期失败:', err);
                  resolve();
                });
              }).catch(err => {
                console.error('保存历史记录失败:', err);
                resolve();
              });
            } else {
              // 创建新记录
              const UserClass = AV.Object.extend(className);
              const newHistoryObj = new UserClass();
              newHistoryObj.set('type', 'historyPeriods');
              newHistoryObj.set('dates', [dateStr]);
              newHistoryObj.set('startingdays', [dateStr]);
              newHistoryObj.set('startDays', [dateStr]);
              newHistoryObj.set('endDays', [endDateStr]);
              newHistoryObj.set('periodDaysArr', [periodDays]);
              
              newHistoryObj.save().then(() => {
                // 根据经期长度自动标记后续日期为经期中
                this.autoMarkSubsequentPeriodDays(dateStr, periodDays).then(() => {
                  resolve();
                }).catch(err => {
                  console.error('自动标记后续日期失败:', err);
                  resolve();
                });
              }).catch(err => {
                console.error('创建历史记录失败:', err);
                resolve();
              });
            }
          }).catch(err => {
            console.error('获取历史记录对象失败:', err);
            resolve();
          });
        }).catch(err => {
          console.error('获取周期信息失败:', err);
          resolve();
        });
      } catch (err) {
        console.error('更新历史经期记录失败:', err);
        resolve();
      }
    });
  },
  
  // ============ 自动标记后续的经期日期 ============
  autoMarkSubsequentPeriodDays(startDateStr, periodDays){
    return new Promise((resolve, reject) => {
      try {
        console.log('开始自动标记后续经期日期:', startDateStr, '经期长度:', periodDays, '天');
        const className = this.getUserClassName();
        if (!className) {
          console.error('无法获取用户类名');
          resolve();
          return;
        }
        
        // 确保经期长度为有效数字
        let validPeriodDays = parseInt(periodDays) || 5;
        if (validPeriodDays < 2) {
          console.warn('经期长度无效，使用默认值5天');
          validPeriodDays = 5;
        }
        
        let startDate;
        try {
          startDate = new Date(startDateStr);
          if (isNaN(startDate.getTime())) {
            console.error('无效的开始日期:', startDateStr);
            resolve();
            return;
          }
        } catch (dateErr) {
          console.error('解析开始日期失败:', dateErr);
          resolve();
          return;
        }
        
        console.log('开始日期:', startDate, '经期长度:', validPeriodDays, '天');
        
        // 标记从第二天开始的经期日期
        const processPromises = [];
        
        for (let i = 1; i < validPeriodDays; i++) {
          processPromises.push(new Promise((dayResolve) => {
            try {
              const currentDate = new Date(startDate);
              currentDate.setDate(startDate.getDate() + i);
              const dateStr = this.formatDate(currentDate);
              console.log(`处理第${i}天: ${dateStr}`);
              
              // 判断是否为最后一天
              const isLastDay = (i === validPeriodDays - 1);
              
              // 检查该日期是否已有记录（不限制type类型）
              const RecordQuery = new AV.Query(className);
              RecordQuery.equalTo('date', dateStr);
              
              RecordQuery.first().then(existingRecord => {
                if (!existingRecord) {
                  console.log('未找到记录，创建新的经期记录:', dateStr);
                  // 创建新记录并标记为经期中，type字段设置为menstrual
                  const UserClass = AV.Object.extend(className);
                  const newRecord = new UserClass();
                  newRecord.set('type', 'menstrual');
                  newRecord.set('date', dateStr);
                  newRecord.set('isInPeriod', true);
                  newRecord.set('isFirstDay', false);
                  newRecord.set('isLastDay', isLastDay); // 设置是否为最后一天
                  // 初始化其他必要字段
                  newRecord.set('bloodAmount', '中'); // 默认血量
                  newRecord.set('symptoms', Array(9).fill(0)); // 默认症状数组
                  newRecord.set('note', ''); // 默认空备注
                  newRecord.set('mood', '平静'); // 默认心情
                  
                  newRecord.save().then(() => {
                    console.log(`成功创建新经期记录: ${dateStr}${isLastDay ? '（最后一天）' : ''}`);
                    
                    // 将日期添加到duringdays数组
                    this.updateDuringDays(dateStr).then(() => {
                      dayResolve();
                    }).catch(err => {
                      console.error('更新duringdays失败:', err);
                      dayResolve();
                    });
                  }).catch(err => {
                    console.error(`创建记录失败: ${dateStr}`, err);
                    dayResolve();
                  });
                } else {
                  // 更新现有记录为经期记录，但不修改type字段
                  const oldType = existingRecord.get('type');
                  const oldIsInPeriod = existingRecord.get('isInPeriod');
                  const oldIsLastDay = existingRecord.get('isLastDay') || false;
                  
                  existingRecord.set('isInPeriod', true);
                  existingRecord.set('isFirstDay', false);
                  existingRecord.set('isLastDay', isLastDay); // 更新是否为最后一天
                  
                  // 如果原有记录没有相关字段，初始化它们
                  if (existingRecord.get('bloodAmount') === undefined) {
                    existingRecord.set('bloodAmount', '中');
                  }
                  if (existingRecord.get('symptoms') === undefined) {
                    existingRecord.set('symptoms', Array(9).fill(0));
                  }
                  if (existingRecord.get('note') === undefined) {
                    existingRecord.set('note', '');
                  }
                  if (existingRecord.get('mood') === undefined) {
                    existingRecord.set('mood', '平静');
                  }
                  
                  existingRecord.save().then(() => {
                    console.log(`成功更新记录为经期: ${dateStr}${isLastDay ? '（最后一天）' : ''}, 原类型:`, oldType, '原经期状态:', oldIsInPeriod, '原最后一天状态:', oldIsLastDay);
                    
                    // 将日期添加到duringdays数组
                    this.updateDuringDays(dateStr).then(() => {
                      dayResolve();
                    }).catch(err => {
                      console.error('更新duringdays失败:', err);
                      dayResolve();
                    });
                  }).catch(err => {
                    console.error(`更新记录失败: ${dateStr}`, err);
                    dayResolve();
                  });
                }
              }).catch(err => {
                console.error(`查询记录失败: ${dateStr}`, err);
                dayResolve();
              });
            } catch (dayErr) {
              console.error(`处理日期时出错:`, dayErr);
              dayResolve();
            }
          }));
        }
        
        Promise.all(processPromises).then(() => {
          console.log('自动标记后续经期日期完成，共处理', validPeriodDays - 1, '天');
          resolve();
        }).catch(err => {
          console.error('处理过程中发生错误:', err);
          resolve();
        });
      } catch (err) {
        console.error('自动标记后续经期日期失败:', err);
        resolve();
      }
    });
  },
  
  // 更新duringdays数组（经期内的所有日期，不包括第一天）
  updateDuringDays(dateStr) {
    return new Promise((resolve, reject) => {
      try {
        const className = this.getUserClassName();
        if (!className) {
          resolve();
          return;
        }
        
        // 获取历史记录对象
        const HistoryQuery = new AV.Query(className);
        HistoryQuery.equalTo('type', 'historyPeriods');
        
        HistoryQuery.first().then(historyObj => {
          if (historyObj) {
            let duringdays = historyObj.get('duringdays') || [];
            
            if (!duringdays.includes(dateStr)) {
              duringdays.push(dateStr);
              // 按日期排序（最新的在前）
              duringdays.sort((a, b) => new Date(b) - new Date(a));
              historyObj.set('duringdays', duringdays);
              
              historyObj.save().then(() => {
                resolve();
              }).catch(err => {
                console.error('更新duringdays失败:', err);
                resolve();
              });
            } else {
              resolve();
            }
          } else {
            // 创建新记录
            const UserClass = AV.Object.extend(className);
            const newHistoryObj = new UserClass();
            newHistoryObj.set('type', 'historyPeriods');
            newHistoryObj.set('duringdays', [dateStr]);
            
            newHistoryObj.save().then(() => {
              resolve();
            }).catch(err => {
              console.error('创建历史记录失败:', err);
              resolve();
            });
          }
        }).catch(err => {
          console.error('获取历史记录对象失败:', err);
          resolve();
        });
      } catch (err) {
        console.error('更新duringdays失败:', err);
        resolve();
      }
    });
  },
  
  // ============ 计算最新经期长度（仅计算，不自动更新） ============
  calculateAndUpdatePeriodLength() {
    return new Promise((resolve, reject) => {
      try {
        const className = this.getUserClassName();
        if (!className) {
          resolve();
          return;
        }
        
        // 获取所有记录并按日期排序
        const RecordQuery = new AV.Query(className);
        // 查询所有记录，不限制type类型
        RecordQuery.descending('date');
        
        RecordQuery.find().then(records => {
          if (records.length === 0) {
            resolve();
            return;
          }
          
          // 找出最新一次经期的连续天数
          let periodLength = 0;
          let inPeriodSequence = false;
          let lastProcessedDate = null;
          
          for (const record of records) {
            const dateStr = record.get('date');
            const isInPeriod = record.get('isInPeriod');
            const currentDate = new Date(dateStr);
            
            if (lastProcessedDate && inPeriodSequence) {
              // 检查日期是否连续
              const dayDiff = Math.round((lastProcessedDate - currentDate) / (24 * 60 * 60 * 1000));
              if (dayDiff > 1) {
                // 日期不连续，经期结束
                break;
              }
            }
            
            if (isInPeriod) {
              periodLength++;
              inPeriodSequence = true;
            } else if (inPeriodSequence) {
              // 之前在经期中，现在不在，说明经期结束
              break;
            }
            
            lastProcessedDate = currentDate;
          }
          
          // 如果计算出的经期长度有效（1-15天），仅记录日志，不自动更新
          if (periodLength >= 1 && periodLength <= 15) {
            // 获取周期信息对象
            const CycleInfo = new AV.Query(className);
            CycleInfo.equalTo('type', 'cycleInfo');
            
            CycleInfo.first().then(cycleInfoObj => {
              const currentPeriodDays = cycleInfoObj ? (cycleInfoObj.get('periodDays') || 5) : 5;
              
              console.log(`计算的经期长度: ${periodLength}天，当前设置为: ${currentPeriodDays}天`);
              console.log(`注意：经期长度现在仅通过加减号按钮修改，不会自动更新`);
              
              // 不再自动更新经期长度
              // 保留现有设置，确保用户设置的经期长度不会被覆盖
              resolve();
            }).catch(err => {
              console.error('获取周期信息对象失败:', err);
              resolve();
            });
          } else {
            resolve();
          }
        }).catch(err => {
          console.error('查询记录失败:', err);
          resolve();
        });
      } catch (err) {
        console.error('计算和更新经期长度失败:', err);
        resolve();
      }
    });
  },
  
  // ============ 计算周期长度（基于历史记录） ============
  calculateCycleLength() {
    return new Promise((resolve, reject) => {
      try {
        const className = this.getUserClassName();
        if (!className) {
          resolve(28);
          return;
        }

        // 获取历史经期记录
        const HistoryQuery = new AV.Query(className);
        HistoryQuery.equalTo('type', 'historyPeriods');
        HistoryQuery.first().then(historyObj => {
          if (historyObj) {
            let historyPeriods = historyObj.get('dates') || [];
            
            // 如果有至少2个经期记录，计算平均周期长度
            if (historyPeriods.length >= 2) {
              // 按日期排序
              historyPeriods.sort((a, b) => new Date(a) - new Date(b));
              
              let totalCycleLength = 0;
              let cycleCount = 0;
              
              // 计算连续两个经期记录之间的天数差
              for (let i = 1; i < historyPeriods.length; i++) {
                const prevDate = new Date(historyPeriods[i - 1]);
                const currDate = new Date(historyPeriods[i]);
                const cycleLength = Math.round((currDate - prevDate) / (24 * 60 * 60 * 1000));
                
                // 只考虑合理范围内的周期长度（21-45天）
                if (cycleLength >= 21 && cycleLength <= 45) {
                  totalCycleLength += cycleLength;
                  cycleCount++;
                }
              }
              
              // 如果有有效周期数据，计算平均值
              if (cycleCount > 0) {
                const avgCycleLength = Math.round(totalCycleLength / cycleCount);
                console.log(`计算得到的平均周期长度: ${avgCycleLength}天`);
                resolve(avgCycleLength);
                return;
              } else {
                console.log('没有找到有效周期数据');
              }
            }
          }
          resolve(28);
        }).catch(err => {
          console.error('计算周期长度失败:', err);
          resolve(28);
        });
      } catch (err) {
        console.error('计算周期长度失败:', err);
        resolve(28);
      }
    });
  },

  // ============ 计算未来经期日期 ============
  calculateFuturePeriod(nowPeriod, cycleLength) {
    if (!nowPeriod || !cycleLength) return '';
    const d = new Date(nowPeriod);
    d.setDate(d.getDate() + cycleLength);
    return this.formatDate(d);
  },

  // ============ 从历史经期记录中移除 ============
  removeFromHistoryPeriods(dateStr) {
    return new Promise((resolve, reject) => {
      try {
        const className = this.getUserClassName();
        if (!className) {
          resolve();
          return;
        }
        
        // 获取历史记录对象
        const HistoryQuery = new AV.Query(className);
        HistoryQuery.equalTo('type', 'historyPeriods');
        
        HistoryQuery.first().then(historyObj => {
          if (historyObj) {
            let historyPeriods = historyObj.get('dates') || [];
            let startingdays = historyObj.get('startingdays') || [];
            let startDays = historyObj.get('startDays') || [];
            let endDays = historyObj.get('endDays') || [];
            let periodDaysArr = historyObj.get('periodDaysArr') || [];
            let duringdays = historyObj.get('duringdays') || [];
            
            // 移除指定日期
            historyPeriods = historyPeriods.filter(d => d !== dateStr);
            startingdays = startingdays.filter(d => d !== dateStr);
            
            // 找到startDays中对应日期的索引
            const index = startDays.indexOf(dateStr);
            if (index !== -1) {
              // 同步移除所有相关数组中的对应元素
              startDays.splice(index, 1);
              endDays.splice(index, 1);
              periodDaysArr.splice(index, 1);
            }
            
            // 同时从duringdays中移除该日期
            duringdays = duringdays.filter(d => d !== dateStr);
            
            // 保存所有更新后的数组
            historyObj.set('dates', historyPeriods);
            historyObj.set('startingdays', startingdays);
            historyObj.set('startDays', startDays);
            historyObj.set('endDays', endDays);
            historyObj.set('periodDaysArr', periodDaysArr);
            historyObj.set('duringdays', duringdays);
            
            historyObj.save().then(() => {
              resolve();
            }).catch(err => {
              console.error('从历史经期记录中移除失败:', err);
              resolve(); // 即使失败也继续执行
            });
          } else {
            resolve();
          }
        }).catch(err => {
          console.error('从历史经期记录中移除失败:', err);
          resolve(); // 即使失败也继续执行
        });
      } catch (err) {
        console.error('从历史经期记录中移除失败:', err);
        resolve(); // 即使失败也继续执行
      }
    });
  },

  // ============ 更新周期信息 ============
  updateCycleInfo(dateStr) {
    return new Promise((resolve, reject) => {
      try {
        const className = this.getUserClassName();
        if (!className) {
          resolve();
          return;
        }

        // 先调用ensureUserClass
        this.ensureUserClass().then(() => {
          const CycleInfo = new AV.Query(className);
          CycleInfo.equalTo('type', 'cycleInfo');
          
          // 获取当前周期信息
          CycleInfo.first().then(cycleInfoObj => {
            // 先获取当前设置的周期长度和经期长度
            let cycleLength = 28;
            let periodDays = 5;

            if (cycleInfoObj) {
              cycleLength = cycleInfoObj.get('cycleLength') || 28;
              periodDays = cycleInfoObj.get('periodDays') || 5;
            }

            // 尝试从历史记录计算周期长度
            this.calculateCycleLength().then(calculatedCycleLength => {
              if (calculatedCycleLength && calculatedCycleLength !== 28) {
                // 如果计算出的周期长度有效且不同于默认值，使用计算值
                cycleLength = calculatedCycleLength;
              }

              // 计算下一个经期日期
              const nextPeriodStr = this.calculateFuturePeriod(dateStr, cycleLength);

              if (cycleInfoObj) {
                cycleInfoObj.set('lastPeriod', dateStr);
                cycleInfoObj.set('nextPeriod', nextPeriodStr);
                cycleInfoObj.set('cycleLength', cycleLength);
                cycleInfoObj.set('periodDays', periodDays);
                
                // 保存更新
                cycleInfoObj.save().then(() => {
                  console.log('更新周期信息成功:', { lastPeriod: dateStr, nextPeriod: nextPeriodStr, cycleLength, periodDays });
                  resolve();
                }).catch(err => {
                  console.error('更新周期信息失败:', err);
                  resolve(); // 即使失败也继续执行
                });
              } else {
                const UserClass = AV.Object.extend(className);
                const obj = new UserClass();
                obj.set('type', 'cycleInfo');
                obj.set('lastPeriod', dateStr);
                obj.set('nextPeriod', nextPeriodStr);
                obj.set('cycleLength', cycleLength);
                obj.set('periodDays', periodDays);
                
                // 保存新建
                obj.save().then(() => {
                  console.log('更新周期信息成功:', { lastPeriod: dateStr, nextPeriod: nextPeriodStr, cycleLength, periodDays });
                  resolve();
                }).catch(err => {
                  console.error('更新周期信息失败:', err);
                  resolve(); // 即使失败也继续执行
                });
              }
            }).catch(err => {
              console.error('计算周期长度失败:', err);
              resolve(); // 即使失败也继续执行
            });
          }).catch(err => {
            console.error('获取周期信息失败:', err);
            resolve(); // 即使失败也继续执行
          });
        }).catch(err => {
          console.error('确保用户类失败:', err);
          resolve(); // 即使失败也继续执行
        });
      } catch (err) {
        console.error('更新周期信息失败:', err);
        resolve(); // 即使失败也继续执行
      }
    });
  },

  updateCalendarPage() {
    return new Promise((resolve, reject) => {
      try {
        const pages = getCurrentPages();
        if (pages.length > 1) {
          const prevPage = pages[pages.length - 2];
          if (prevPage) {
            // 优先使用updateCalendarView方法，如果不存在则使用refreshPage
            if (typeof prevPage.updateCalendarView === 'function') {
              prevPage.updateCalendarView();
            } else if (typeof prevPage.refreshPage === 'function') {
              prevPage.refreshPage();
            }

            // 如果是修改了第一天的记录，更新日历的lastPeriod显示
            if (this.data.isFirstDay && typeof prevPage.updateLastPeriod === 'function') {
              prevPage.updateLastPeriod(this.data.date);
            }
          }
        }
        resolve();
      } catch (err) {
        console.error('更新日历页面失败:', err);
        resolve();
      }
    });
  }})