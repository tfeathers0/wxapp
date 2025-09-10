// pages/relationship_information/relationship_information.js
const AV = require('../../libs/av-core-min.js');
const keyDaysManager = require('../../utils/keyDaysManager.js');

Page({
    data: {
      currentDay: '',
      currentWeekday: '',
      contactInfo: null,
      markedDates: {},       // 标记日期数据（保留以兼容旧逻辑）
      statusText: '',        // 状态文本
      statusClass: '',       // 状态样式类
      statusIcon: '',        // 存储状态图标路径
      hasPermission: false,  // 是否有权限查看详细信息
      permissions: {         // 细粒度权限设置
        canViewStatus: true,
        canViewMenstruation: true,
        canViewMood: true,
        canViewPassdays: true
      },
      // 日历相关数据
      currentYear: new Date().getFullYear(),
      currentMonth: new Date().getMonth(),
      days: [],
      cycleInfo: {
        nowPeriod: '',    // string YYYY-MM-DD
        futurePeriod: '', // string YYYY-MM-DD
        cycleLength: 28,  // 自动计算更新
        periodDays: 5     // 默认 5 天
      }
    },
  
    onLoad(options) {
      // 获取联系人ID
      const contactId = options.contactId;
      
      this.updateDate();

      // 初始化时间
      this.updateCurrentTime();
      setInterval(() => {
        this.updateCurrentTime();
      }, 60000);

      
      // 获取联系人详情并处理日历数据
      this.getContactDetails(contactId);
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

    /* ---------- 格式化日期为YYYY-MM-DD字符串 ---------- */
    formatDate(date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
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

        while (iterations < maxIterations) {

          const periodEnd = new Date(start.getFullYear(), start.getMonth(), start.getDate() + (this.data.cycleInfo.periodDays - 1));
          const ovulationDay = new Date(start.getFullYear(), start.getMonth(), start.getDate() + (cycleLength - 14));

          const startTime = start.getTime();
          const periodEndTime = periodEnd.getTime();
          const ovulationTime = ovulationDay.getTime();
        
          // 先处理排卵期预测，确保任何情况下都正常预测排卵期
          for (let i = 0; i < days.length; i++) {
            if (!days[i].day) continue;
            let d = new Date(year, month, days[i].day);
            let dTime = d.getTime();

            if (dTime === ovulationTime) {
              days[i].type = days[i].type ? days[i].type + ' ovulation' : 'ovulation';
            }
          }

        

          start = new Date(start.getFullYear(), start.getMonth(), start.getDate() + cycleLength);
          iterations++;
        }
      }
    }

    // 处理实际记录，添加更详细的日志
    if (records && records.length > 0) {
      records.forEach(r => {
        if (!r.year || !r.month || !r.day) {
          console.log('跳过无效记录:', r);
          return;
        }
        
        // 检查记录是否属于当前显示的月份
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
            
            // 将所有isInPeriod字段为true或type为menstrual的日期标记为生理期
            if (r.isInPeriod === true || r.type === 'menstrual') {
              console.log('✅ 标记为生理期:', r.date, 'isInPeriod:', r.isInPeriod, 'type:', r.type);
              days[index].type = days[index].type ? days[index].type + ' period' : 'period';
              
            } else {
              console.log('❌ 不是生理期:', r.date);
            }
            
            console.log('最终类型:', days[index].type);
          }
        }
      });
    }

    // 调试输出
    const periodDays = days.filter(d => d.type && d.type.includes('period'));
    const recordedDays = days.filter(d => d.type && d.type.includes('recorded'));
    console.log('生理期天数:', periodDays.length);
    console.log('已标记记录的天数:', recordedDays.length);
    
    this.setData({ days: days, currentYear: year, currentMonth: month });
  },

    /* ---------- 月份切换 ---------- */
    prevMonth() {
      let { currentYear, currentMonth } = this.data;
      if (currentMonth === 0) {
        currentYear -= 1;
        currentMonth = 11;
      } else currentMonth -= 1;
      const { nowPeriod, cycleLength } = this.data.cycleInfo;
      const { menstrualRecords } = this.data.contactInfo || {};
      this.generateCalendar(nowPeriod, cycleLength, currentYear, currentMonth, menstrualRecords);
    },

    nextMonth() {
      let { currentYear, currentMonth } = this.data;
      if (currentMonth === 11) {
        currentYear += 1;
        currentMonth = 0;
      } else currentMonth += 1;
      const { nowPeriod, cycleLength } = this.data.cycleInfo;
      const { menstrualRecords } = this.data.contactInfo || {};
      this.generateCalendar(nowPeriod, cycleLength, currentYear, currentMonth, menstrualRecords);
    },

    /* ---------- 日历日期点击事件 ---------- */
    onCustomCalendarDayTap(e) {
      const { day, year, month } = e.currentTarget.dataset;
      if (!day) return;
      
      // 构建完整日期字符串
      const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      
      // 调用现有的日期选择处理逻辑
      this.onDateSelect({detail: {date: dateStr}});
    },
    
    // 检查是否有访问权限
    async checkAccessPermission(friendId) {
      try {
        // 先检查是否是好友关系
        const currentUser = AV.User.current();
        const followeeQuery = new AV.Query('_Followee');
        followeeQuery.equalTo('user', currentUser);
        followeeQuery.equalTo('followee', AV.Object.createWithoutData('_User', friendId));
        followeeQuery.equalTo('friendStatus', true);
        const followeeResults = await followeeQuery.find();
        
        if (followeeResults.length === 0) {
          throw new Error('你们还不是好友关系');
        }
        
        // 然后检查是否有权限查看详细信息
        let hasPermission = true;
        let permissions = {
          canViewStatus: true,
          canViewMenstruation: true,
          canViewMood: true,
          canViewPassdays: true
        };
        
        try {
          // 调用getFriendPermissions方法获取对方设置的权限
          permissions = await this.getFriendPermissions(friendId);
        } catch (error) {
          console.error('检查权限过程中出错:', error);
        }
        
        this.setData({
          hasPermission: hasPermission,
          permissions: permissions
        });
        
        // 直接返回 AVObject，而不是创建一个新的普通对象
        // 将 hasPermission 属性添加到对象中
        followeeResults[0].hasPermission = hasPermission;
        followeeResults[0].permissions = permissions;
        return followeeResults[0];
      } catch (error) {
        console.error('检查访问权限失败:', error);
        this.setData({
          hasPermission: false,
          permissions: {
            canViewStatus: false,
            canViewMenstruation: false,
            canViewMood: false,
            canViewPassdays: false
          }
        });
        throw error;
      }
    },
    
    // 获取当前用户在对方的权限设置
    async getFriendPermissions(friendId) {
      try {
        const currentUser = AV.User.current();
        if (!currentUser) {
          throw new Error('用户未登录');
        }
        
        // 尝试从对方的keydays对象中获取权限设置
        const keyDaysQuery = new AV.Query('keydays');
        keyDaysQuery.equalTo('username', AV.Object.createWithoutData('_User', friendId));
        const keyDaysObj = await keyDaysQuery.first();
        
        // 如果找到了对方的keydays对象，并且有permissions字段
        if (keyDaysObj && keyDaysObj.get('permissions')) {
          const keyDaysPermissions = keyDaysObj.get('permissions');
          // 获取当前用户ID对应的权限设置
          const userPermissions = keyDaysPermissions[currentUser.id];
          
          // 如果有针对当前用户的权限设置，返回它；否则返回默认权限
          if (userPermissions) {
            return {
              canViewStatus: userPermissions.canViewStatus !== false,
              canViewMenstruation: userPermissions.canViewMenstruation !== false,
              canViewMood: userPermissions.canViewMood !== false,
              canViewPassdays: userPermissions.canViewPassdays !== false
            };
          }
        }
        
        // 如果没有找到对方的keydays对象或权限设置，返回默认权限
        return {
          canViewStatus: true,
          canViewMenstruation: true,
          canViewMood: true,
          canViewPassdays: true
        };
      } catch (error) {
        console.error('获取好友权限设置失败:', error);
        // 出错时返回默认权限
        return {
          canViewStatus: true,
          canViewMenstruation: true,
          canViewMood: true,
          canViewPassdays: true
        };
      }
    },

    updateDate() {
        const date = new Date();
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        this.setData({
          currentDay: date.getDate().toString(),
          currentWeekday: days[date.getDay()]
        });
      },
  
    // 确保用户类存在（与female_calendar.js保持一致）
    async ensureUserClass(className) {
      console.log('ensureUserClass - 开始检查类是否存在:', className);
      if (!className) {
        console.log('ensureUserClass - 类名为空');
        return false;
      }
      
      const query = new AV.Query(className);
      try {
        console.log('ensureUserClass - 执行查询以检查类是否存在');
        const result = await query.first();
        console.log('ensureUserClass - 类存在，查询结果:', result ? '找到了记录' : '未找到记录但类存在');
        return true;
      } catch (error) {
        console.log('ensureUserClass - 类可能不存在，错误:', error.message);
        try {
          console.log('ensureUserClass - 尝试创建类:', className);
          const UserClass = AV.Object.extend(className);
          const userObj = new UserClass();
          userObj.set('initialized', true);
          await userObj.save();
          console.log('ensureUserClass - 类创建成功');
          return true;
        } catch (createError) {
          console.error('ensureUserClass - 类创建失败:', createError);
          return false;
        }
      }
    },

    // 获取联系人生理周期的实际记录，保持与female_calendar.js一致的格式
    async getContactMenstrualRecords(contactId) {
      try {
        const user = AV.User.current();
        if (!user) {
          throw new Error('用户未登录');
        }
        
        console.log('开始获取联系人生理周期记录，contactId:', contactId);
        
        // 获取关联人的用户信息
        const userQuery = new AV.Query('_User');
        const targetUser = await userQuery.get(contactId);
        
        // 直接从用户对象获取username，用于构建自定义类名
        const username = targetUser.getUsername();
        
        // 获取用户类中的mood字段值
        const userMood = targetUser.get('mood') || '';
        
        console.log('成功获取关联人信息，username:', username);
        
        if (!username) {
          throw new Error('无法获取对方用户名');
        }
        
        // 构建用户自定义类名（确保与record.js中的命名规则一致）
        const className = `User_${username.replace(/[^a-zA-Z0-9]/g, '_')}`;
        console.log('构建的自定义类名:', className);
        
        // 确保类存在（与female_calendar.js保持一致）
        console.log('调用ensureUserClass确保类存在');
        const ensureResult = await this.ensureUserClass(className);
        console.log('ensureUserClass结果:', ensureResult);
        
        // 查看类是否存在的详细检查
        const checkQuery = new AV.Query(className);
        try {
          const checkResult = await checkQuery.first();
          console.log('类存在检查结果:', checkResult ? '存在' : '不存在');
        } catch (checkError) {
          console.error('类存在检查错误:', checkError);
        }
        
        const customClassQuery = new AV.Query(className);
        
        // 方法1：尝试使用与female_calendar.js一致的查询条件
        customClassQuery.containedIn('type', ['record', 'menstrual']);
        
        // 添加额外的日志记录查询条件
        console.log('查询条件 - 类名:', className, '类型:', ['record', 'menstrual']);
        
        customClassQuery.ascending('date');
        
        // 获取记录
        console.log('执行查询...');
        let results = await customClassQuery.find();
        
        // 如果第一次查询没有结果，尝试更通用的查询策略
        if (results.length === 0) {
          console.log('第一次查询无结果，尝试更通用的查询策略（不限制type字段）');
          const fallbackQuery = new AV.Query(className);
          fallbackQuery.exists('date'); // 只要有date字段的记录都查询
          fallbackQuery.ascending('date');
          
          results = await fallbackQuery.find();
          console.log('备用查询结果数量:', results.length);
        }
        
        console.log('查询结果数量:', results.length);
        if (results.length > 0) {
          console.log('查询结果示例:', results[0].toJSON());
        }
        
        // 格式化记录数据，确保与female_calendar.js返回的格式完全一致
        const records = results.map(record => {
          const rawDate = record.get('date');
          const dateStr = this.toYMD(rawDate);
          
          let year = null, month = null, day = null;
          if (dateStr) {
            const parts = dateStr.split('-');
            year = parseInt(parts[0], 10);
            month = parseInt(parts[1], 10); // 1-12
            day = parseInt(parts[2], 10);
          }
          
          const formattedRecord = {
            date: dateStr,
            year: year,
            month: month,
            day: day,
            type: record.get('type') || 'record',
            isInPeriod: !!record.get('isInPeriod'),
            note: record.get('note') || '',
            symptoms: record.get('symptoms') || [],
            flow: record.get('flow') || 'medium',
            mood: userMood || record.get('mood') || '', // 优先使用用户类中的mood字段
            rawData: rawDate // 用于调试
          };
          
          if (formattedRecord.isInPeriod) {
            console.log('找到isInPeriod=true的记录:', formattedRecord.date);
          }
          
          return formattedRecord;
        });
        
        console.log('加载的联系人生理周期记录总数:', records.length);
        console.log('其中isInPeriod=true的记录数:', records.filter(r => r.isInPeriod).length);
        return records;
      } catch (error) {
        console.error('获取联系人生理周期记录失败:', error);
        return [];
      }
    },
    

    onShow() {
      // 页面显示时刷新数据
      const contactId = this.data.contactInfo?.id;
      if (contactId) {
        this.getContactDetails(contactId);
      }
    },
    
    // 获取联系人详情
    async getContactDetails(contactId) {
      wx.showLoading({ title: '加载中...' });
      
      try {
        // 先检查访问权限
        const followeeRelation = await this.checkAccessPermission(contactId);
        
        // 获取关联人的用户信息
        const userQuery = new AV.Query('_User');
        const user = await userQuery.get(contactId);
        // 获取联系人头像 - 从LeanCloud user类的touxiang字段（File对象）获取
        const defaultAvatarUrl = '/images/wechatdefaultpic.png';
        let avatarUrl = defaultAvatarUrl;
        
        // 优先从touxiang字段获取头像
        const touxiangFile = user.get('touxiang');
        if (touxiangFile && typeof touxiangFile.get === 'function') {
          avatarUrl = touxiangFile.get('url') || avatarUrl;
        }
        
        // 如果touxiang不存在，尝试从avatarUrl字段获取
        if (avatarUrl === defaultAvatarUrl) {
          const directAvatarUrl = user.get('avatarUrl');
          if (directAvatarUrl) {
            avatarUrl = directAvatarUrl;
          }
        }
          
        // 基础信息，无论是否有权限都显示
        const contactInfo = {
          id: user.id,
          nickname: user.get('nickName') || user.get('username') || '未命名',
          // 从LeanCloud user类的avatar字段（File对象）获取头像URL
          avatar: avatarUrl,
          relation: followeeRelation.get('relation') || '朋友',
          lastUpdate: new Date().toISOString().split('T')[0]
        };
        
        // 获取权限设置
        const permissions = followeeRelation.permissions || this.data.permissions;
        
        // 根据权限设置获取详细信息
        if (followeeRelation.hasPermission) {
          // 根据canViewStatus权限决定是否显示状态信息
          if (permissions.canViewStatus) {
            contactInfo.status = user.get('state') || 'unknown';
            contactInfo.state = this.getStatusIcon(user.get('state') || 'unknown');
          }
          
          // 根据canViewMood权限决定是否显示心情信息
          if (permissions.canViewMood) {
            // 从自定义类中获取当天心情数据
            contactInfo.mood = await this.getTodayMoodFromCustomClass(user) || '未设置';
            console.log('从自定义类获取的当天心情信息:', contactInfo.mood);
          }
            }
      
          
          // 根据canViewStatus权限决定是否显示提示信息
          if (permissions.canViewStatus) {
            // 同时传递状态、心情和关系参数
            const tipsObj = this.generateTips(user.get('state') || 'unknown', contactInfo.mood, contactInfo.relation);
            contactInfo.statusTip = tipsObj.statusTip;
            contactInfo.moodTip = tipsObj.moodTip;
          }
          
          // 根据canViewMenstruation权限决定是否显示上次月经日期
          if (permissions.canViewMenstruation) {
            contactInfo.lastMenstruation = await this.getLastMenstruation(user);
          }
          
          // 根据canViewPassdays权限决定是否显示周期数据
          if (permissions.canViewPassdays) {
            contactInfo.cycleData = await this.getPassDays(user);
            // 设置passdays，用于generateMarkedDates方法
            contactInfo.passdays = contactInfo.cycleData;
          }
          
          // 状态配置（与male_home保持一致的状态体系）
          const statusConfig = {
            menstrual: { text: "月经期", class: "status-menstrual" },
            follicular: { text: "卵泡期", class: "status-follicular" },
            ovulation: { text: "排卵期", class: "status-ovulation" },
            luteal: { text: "黄体期", class: "status-luteal" },
            unknown: { text: "未知", class: "status-unknown" }
          };
          
          // 根据canViewPassdays权限决定是否生成日历标记
          let markedDates = {};
          
          // 添加详细日志确认权限状态
          console.log('权限检查 - followeeRelation.hasPermission:', followeeRelation.hasPermission);
          console.log('权限检查 - permissions.canViewPassdays:', permissions.canViewPassdays);
          console.log('准备调用getContactMenstrualRecords的contactId:', contactId);
          
          if (followeeRelation.hasPermission && permissions.canViewPassdays) {
              // 先尝试获取对方的实际生理周期记录
              console.log('调用getContactMenstrualRecords，contactId:', contactId);
              console.log('当前用户:', AV.User.current().getUsername());
              this.getContactMenstrualRecords(contactId).then(menstrualRecords => {
                console.log('获取到的生理周期记录数量:', menstrualRecords.length);
                contactInfo.menstrualRecords = menstrualRecords;
                
                // 设置周期信息（从contactInfo或默认值）
                let nowPeriod = '';
                let cycleLength = 28;
                
                // 从lastMenstruation中提取YYYY-MM-DD格式的日期
                if (contactInfo.lastMenstruation) {
                  const match = contactInfo.lastMenstruation.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
                  if (match) {
                    const [, year, month, day] = match;
                    nowPeriod = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                  }
                  console.log('提取的经期日期:', nowPeriod);
                }
                
                if (contactInfo.cycleData && contactInfo.cycleData.cycleLength) {
                  cycleLength = contactInfo.cycleData.cycleLength;
                }
                console.log('使用的周期长度:', cycleLength);
                
                // 更新周期信息，包括经期天数
                let periodDays = 5; // 默认5天
                if (contactInfo.cycleData && contactInfo.cycleData.periodLength) {
                  periodDays = contactInfo.cycleData.periodLength;
                }
                console.log('使用的经期天数:', periodDays);
                
                this.setData({
                  'cycleInfo.nowPeriod': nowPeriod,
                  'cycleInfo.cycleLength': cycleLength,
                  'cycleInfo.periodDays': periodDays
                });
                
                // 设置contactInfo中的menstrualRecords
                contactInfo.menstrualRecords = menstrualRecords;
                
                // 使用实际记录生成日历
                // 使用当前日期的年月，确保即使data中没有初始化也能正常工作
                const now = new Date();
                const year = this.data.currentYear || now.getFullYear();
                const month = this.data.currentMonth !== undefined ? this.data.currentMonth : now.getMonth();
                
                // 生成日历，传入所有需要的数据
                console.log('调用generateCalendar，参数:', { nowPeriod, cycleLength, year, month, recordsCount: menstrualRecords.length });
                this.generateCalendar(nowPeriod, cycleLength, year, month, menstrualRecords);
                
                // 生成markedDates
                console.log('调用generateMarkedDates，是否有passdays数据:', !!contactInfo.passdays);
                markedDates = this.generateMarkedDates(contactInfo.passdays || {});
                console.log('generateMarkedDates生成的标记数量:', Object.keys(markedDates).length);
                
                // 一次性更新所有数据，避免多次setData造成的性能问题和数据不一致
                this.setData({
                  contactInfo: contactInfo,
                  markedDates: markedDates
                });
                console.log('已更新contactInfo和markedDates数据');
              }).catch(error => {
                console.error('获取或生成生理周期记录失败:', error);
              // 如果获取记录失败，使用默认的周期数据
              this.generateCalendar('', 28, this.data.currentYear, this.data.currentMonth, []);
              markedDates = contactInfo.cycleData ? this.generateMarkedDates(contactInfo.passdays) : {};
              
              // 在同一个setData调用中更新所有相关数据
              this.setData({
                markedDates: markedDates,
                contactInfo: contactInfo
              });
            });
          } else {
            // 没有权限查看生理周期数据
            this.setData({ 
              markedDates: {},
              days: [] 
            });
          }
          
          // 根据canViewStatus权限决定状态文本
          let statusText = '未开放';
          let statusClass = 'status-unknown';
          
          if (followeeRelation.hasPermission && permissions.canViewStatus && contactInfo.status) {
            statusText = statusConfig[contactInfo.status]?.text || '未知';
            statusClass = statusConfig[contactInfo.status]?.class || 'status-unknown';
          } else if (followeeRelation.hasPermission && !permissions.canViewStatus) {
            statusText = '状态未开放';
            statusClass = 'status-unknown';
          }
          
          this.setData({
            contactInfo: contactInfo,
            markedDates: markedDates,
            statusText: statusText,
            statusClass: statusClass
          });
      } catch (error) {
        console.error('获取联系人详情失败', error);
        wx.showToast({
          title: '加载失败：' + error.message,
          icon: 'none'
        });
      } finally {
        wx.hideLoading();
      }
    },
    
    // 获取状态对应的图标
    getStatusIcon(status) {
      const iconMap = {
        menstrual: '/images/icon_state_menstrual.png',
        follicular: '/images/icon_state_follicular.png',
        ovulation: '/images/icon_state_ovulation.png',
        luteal: '/images/icon_state_Luteal.png'
      };
      return iconMap[status] || '/images/icon_state_follicular.png';
    },
    
     // 生成提示信息 - 将状态提示和心情提示分开，并根据关系提供个性化建议
    generateTips(status, mood, relation) {
      // 基础状态提示
      const baseTips = {
        menstrual: '她今天处于月经期，可能会肚子疼',
        follicular: '经期结束！状态回温',
        ovulation: '她现在处于排卵期，可能有轻微身体不适',
        luteal: '由于雌激素和孕激素影响，她情绪可能会有些波动',
        unknown: '她的状态信息暂不可用'
      };
      
      // 心情特定提示 - 使用中文标签与record.js保持一致
      const moodModifiers = {
        '低落': {
          general: '她今天心情低落',
          suggestions: {
            '恋人': ['当她想聊天时：“我知道经期真的很难受，我可能无法完全理解，但我很愿意听你说说。或者你希望我 distraction 你一下？”', '当她不想说话时：“我就在隔壁房间，有任何需要随时叫我。这是温水/药/零食，我放这里了。”', '为她准备小惊喜'],
            '家人': ['多关心她的感受', '为她准备爱吃的饭菜', '陪她聊聊天'],
            '朋友': ['约她出去喝杯奶茶', '讲个笑话/分享个沙雕视频，分散一下注意力', '陪她做喜欢的事']
          }
        },
        '焦虑': {
          general: '她今天有点焦虑',
          suggestions: {
            '恋人': ['给她安全感', '耐心倾听她的担忧', '带她做放松的活动'],
            '家人': ['多陪伴她', '给她一些鼓励的话', '帮她分担压力'],
            '朋友': ['避免让她感到压力', '陪她一起做能让她放松的事']
          }
        },
        '开心': {
          general: '她今天心情很好',
          suggestions: {
            '恋人': ['可以一起出去约会', '分享一些好消息', '安排一个惊喜活动'],
            '家人': ['可以一起做些愉快的事情', '分享她的快乐', '一起规划家庭活动'],
            '朋友': ['约她一起做些活动', '分享生活中的趣事', '一起庆祝她的好心情']
          }
        },
        '疲惫': {
          general: '她今天感觉疲惫',
          suggestions: {
            '恋人': ['让她多休息', '为她准备舒适的环境', '主动承担家务劳动，特别是需要弯腰或体力活的事情，让她能多休息。'],
            '家人': ['让她多休息', '帮她分担一些事情', '准备一些有营养的食物'],
            '朋友': ['不要过多打扰她', '提醒她注意休息', '“别硬撑，不舒服就好好休息。工作/学习的事有需要就叫我。” 表示你理解她的不适，并给予她“可以休息”的支持，减轻她的心理压力。']
          }
        },
        '烦躁': {
          general: '她今天有些烦躁',
          suggestions: {
            '恋人': ['激素变化可能导致情绪波动。不要把她的情绪化个人化，也要记住这是暂时的生理反应。', '避免和她发生争执', '带她去做能让她放松的事'],
            '家人': ['多理解她的情绪', '避免让她感到压力', '给她一些独处的空间'],
            '朋友': ['不要在她面前抱怨', '保持适度的社交距离', '如果她需要可以倾听']
          }
        },
        '平静': {
          general: '她今天心情平静',
          suggestions: {
            '恋人': ['可以一起做些轻松的事情', '享受彼此的陪伴', '聊聊近况'],
            '家人': ['可以一起做些家务', '聊聊日常生活', '保持轻松氛围'],
            '朋友': ['可以约她喝杯茶', '聊聊天', '做些轻松的活动']
          }
        }
      };
      
      // 状态特定的建议
      const statusSuggestions = {
        menstrual: {
          '恋人': ['悄悄准备她常用的卫生用品、止痛药(如布洛芬)和喜欢的零食。', '当她表达不适时，不要说“多喝热水”就结束话题。而是认真倾听，回应：“听起来真的好难受，我能为你做点什么吗？”让她感到被理解。', '主动承担家务劳动，特别是需要弯腰或体力活的事情，让她能多休息。','当她表达不适时，不要说“多喝热水”就结束话题。而是认真倾听，回应：“听起来真的好难受，我能为你做点什么吗？”让她感到被理解。'],
          '家人': ['避免让她受凉', '准备清淡易消化的食物', '不要否定她的感受：避免说“忍一忍就过去了”之类的话。承认她的不适是真实存在的。'],
          '朋友': ['“这几天是不是不太舒服？需要我陪你吗？”不要笼统地问“你没事吧？”，而是具体地问“是不是肚子疼/腰酸？”，并提供具体的帮助选项（陪你聊天、帮你做事），这让她更容易接受。', '观察情绪：有些人经期时更需要安静，有些人则需要倾诉。观察她的状态，提供她最需要的关心。', '“外卖已点，热奶茶半小时后到！”直接为她点一杯热饮（她喜欢的奶茶、红糖姜茶）或她爱吃的东西。这种“不说就做”的举动非常暖心。']
        },
        follicular: {
          '恋人': ['可以和她一起做户外运动', '安排一些轻松的约会', '带她去做她喜欢的事情'],
          '家人': ['可以做一些户外运动', '关注她的状态恢复情况', '多鼓励她'],
          '朋友': ['可以约她出去活动', '她现在精力充沛很适合社交', '一起做有活力的事情']
        },
        ovulation: {
          '恋人': ['需要特别注意', '提醒她注意避孕或备孕', '给予更多关心和理解'],
          '家人': ['需要特别注意', '提醒她注意身体', '多关心她的感受'],
          '朋友': ['如果她有备孕计划可以给予支持', '注意她的身体变化', '避免过度劳累']
        },
        luteal: {
          '恋人': ['多些耐心和理解', '网上的安全期并不安全，请做好避孕措施！', '可以提醒她月经快到了，准备好卫生巾', '多迁就她的情绪变化'],
          '家人': ['多些耐心和理解', '可以提醒她月经快到了，准备好卫生巾', '避免和她发生争执'],
          '朋友': ['多理解她的情绪变化', '不要在她面前过度抱怨', '保持适度的社交距离']
        }
      };
      
      // 初始化返回对象
      const result = {
        statusTip: '',
        moodTip: ''
      };
      
      // 处理状态提示
      const baseTip = baseTips[status] || baseTips.unknown;
      
      if (statusSuggestions[status] && relation) {
        // 获取当前关系对应的状态建议，如果没有则使用默认关系（朋友）的建议
        const relationSuggestions = statusSuggestions[status][relation] || statusSuggestions[status]['朋友'] || [];
        if (relationSuggestions.length > 0) {
          const randomStatusSuggestion = relationSuggestions[Math.floor(Math.random() * relationSuggestions.length)];
          result.statusTip = baseTip + '，' + randomStatusSuggestion;
        } else {
          result.statusTip = baseTip;
        }
      } else {
        result.statusTip = baseTip;
      }
      
      // 处理心情提示
      if (mood && mood !== '未设置') {
        const moodModifier = moodModifiers[mood] || { general: '', suggestions: {} };
        
        if (moodModifier.general) {
          if (moodModifier.suggestions && relation) {
            // 获取当前关系对应的心情建议，如果没有则使用默认关系（朋友）的建议
            const relationSuggestions = moodModifier.suggestions[relation] || moodModifier.suggestions['朋友'] || [];
            if (relationSuggestions.length > 0) {
              const randomMoodSuggestion = relationSuggestions[Math.floor(Math.random() * relationSuggestions.length)];
              result.moodTip = moodModifier.general + '，' + randomMoodSuggestion;
            } else {
              result.moodTip = moodModifier.general;
            }
          } else {
            result.moodTip = moodModifier.general;
          }
        }
      }
      
      return result;
    },
    
    
    // 从User_username类中获取周期数据
    async getPassDays(user) {
      const Passdays = {};
      
      try {
        // 获取关联人的用户名，用于构建自定义类名
        const username = user.getUsername();
        if (!username) {
          console.error('无法获取对方用户名');
          // 返回默认值
          return {
            menstrual: { start: 1, end: 5 },
            ovulation: { start: 13, end: 15 },
            cycleLength: 28,
            periodLength: 5
          };
        }
        
        // 构建用户自定义类名
        const className = `User_${username.replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        // 确保类存在
        await this.ensureUserClass(className);
        
        // 查询自定义类中最新的周期设置记录
        const customClassQuery = new AV.Query(className);
        customClassQuery.descending('updatedAt'); // 按更新时间降序排列
        customClassQuery.limit(1); // 只获取最新的一条记录
        
        const result = await customClassQuery.first();
        
        if (result) {
          // 从记录中获取周期相关信息
          const cycleLength = result.get('cycleLength') || 28;
          const periodLength = result.get('periodLength') || 5;
          
          // 计算排卵期（通常是下次月经前14天）
          const ovulationDay = cycleLength - 14;
          
          // 生成周期数据
          Passdays.menstrual = { start: 1, end: periodLength }; 
          Passdays.ovulation = { 
            start: Math.max(1, ovulationDay - 1), 
            end: Math.min(cycleLength, ovulationDay + 1) 
          }; 
          Passdays.cycleLength = cycleLength; 
          Passdays.periodLength = periodLength;
        }
      } catch (error) {
        console.error('获取周期数据失败:', error);
        // 返回默认值
        return {
          menstrual: { start: 1, end: 5 },
          ovulation: { start: 13, end: 15 },
          cycleLength: 28,
          periodLength: 5
        };
      } 
    
    return Passdays; 
    },
    
    // 从自定义类中获取当天心情数据
    async getTodayMoodFromCustomClass(user) {
      try {
        // 获取关联人的用户名，用于构建自定义类名
        const username = user.getUsername();
        if (!username) {
          console.error('无法获取对方用户名');
          return null;
        }
        
        // 构建用户自定义类名
        const className = `User_${username.replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        // 确保类存在
        await this.ensureUserClass(className);
        
        // 获取今天的日期（YYYY-MM-DD格式）
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        
        // 查询自定义类中今天的记录
        const customClassQuery = new AV.Query(className);
        
        // 尝试匹配日期（考虑不同的日期存储格式）
        const dateConditions = [];
        
        // 条件1：date字段等于今天的字符串格式
        const condition1 = new AV.Query(className);
        condition1.equalTo('date', todayStr);
        dateConditions.push(condition1);
        
        // 条件2：date字段是Date对象，日期部分等于今天
        const condition2 = new AV.Query(className);
        const startOfDay = new Date(todayStr);
        const endOfDay = new Date(todayStr);
        endOfDay.setHours(23, 59, 59, 999);
        condition2.greaterThanOrEqualTo('date', startOfDay);
        condition2.lessThanOrEqualTo('date', endOfDay);
        dateConditions.push(condition2);
        
        // 组合查询条件
        const todayQuery = AV.Query.or(...dateConditions);
        
        // 按更新时间降序，获取最新的一条记录
        todayQuery.descending('updatedAt');
        todayQuery.limit(1);
        
        const result = await todayQuery.first();
        
        if (result) {
          // 尝试从记录中获取心情数据
          const mood = result.get('mood');
          if (mood && mood !== '') {
            console.log(`找到${todayStr}的心情记录:`, mood);
            return mood;
          }
        }
        
        console.log(`未找到${todayStr}的心情记录`);
        return null;
      } catch (error) {
        console.error('获取当天心情数据失败:', error);
        return null;
      }
    },
    
    // 获取上次月经日期 - 从User_username类中获取所有isFirstDay=true的记录，并返回最靠近当天的日期
    async getLastMenstruation(user) {
      try {
        // 获取关联人的用户名，用于构建自定义类名
        const username = user.getUsername();
        if (!username) {
          console.error('无法获取对方用户名');
          return '暂无数据';
        }
        
        // 构建用户自定义类名
        const className = `User_${username.replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        // 确保类存在
        await this.ensureUserClass(className);
        
        // 查询自定义类中所有isFirstDay=true的记录
        const query = new AV.Query(className);
        query.equalTo('isFirstDay', true);
        
        // 获取所有符合条件的记录
        const results = await query.find();
        
        if (results && results.length > 0) {
          // 计算每条记录与今天的时间差
          const today = new Date();
          today.setHours(0, 0, 0, 0); // 忽略时间部分
          
          let closestDate = null;
          let minDiff = Infinity;
          
          for (const result of results) {
            try {
              const recordDate = result.get('date');
              if (recordDate) {
                let date;
                if (typeof recordDate === 'string') {
                  date = new Date(recordDate);
                } else {
                  date = new Date(recordDate);
                }
                
                if (!isNaN(date.getTime())) {
                  date.setHours(0, 0, 0, 0); // 忽略时间部分
                  const diff = Math.abs(today - date);
                  
                  // 找到最靠近今天的日期
                  if (diff < minDiff) {
                    minDiff = diff;
                    closestDate = date;
                  }
                }
              }
            } catch (error) {
              console.error('解析日期失败:', error);
            }
          }
          
          // 如果找到最靠近的日期，格式化并返回
          if (closestDate) {
            const year = closestDate.getFullYear();
            // 确保月份和日期都是两位数
            const month = String(closestDate.getMonth() + 1).padStart(2, '0');
            const day = String(closestDate.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          }
        }
      } catch (error) {
        console.error('获取上次月经日期失败:', error);
      }
      
      return '暂无数据';
    },
  
    // 生成日历标记数据
    generateMarkedDates(Passdays) {
      const markedDates = {};
      
      // 使用组件中保存的当前年月，而不是当前日期
      const { currentYear, currentMonth, contactInfo } = this.data;
      const firstDay = new Date(currentYear, currentMonth, 1);
      const lastDay = new Date(currentYear, currentMonth + 1, 0);
      const daysInMonth = lastDay.getDate();
      
      // 获取生理周期记录
      const menstrualRecords = contactInfo && contactInfo.menstrualRecords ? contactInfo.menstrualRecords : [];
      
      // 先初始化所有日期的默认标记
      if (Passdays && Passdays.menstrual && Passdays.ovulation) {
        // 如果有cycleData，则根据cycleData生成默认标记
        for (let day = 1; day <= daysInMonth; day++) {
          const currentDate = new Date(currentYear, currentMonth, day);
          const dateKey = currentDate.toISOString().split('T')[0];
          
          if (day >= Passdays.menstrual.start && day <= Passdays.menstrual.end) {
            // 月经
            markedDates[dateKey] = {
              dotColor: '#ff6b81',
              type: 'dot',
              text: '经期',
              textColor: '#ff6b81'
            };
          } else if (day >= Passdays.ovulation.start && day <= Passdays.ovulation.end) {
            // 排卵期
            markedDates[dateKey] = {
              dotColor: '#52c41a',
              type: 'dot',
              text: '排卵',
              textColor: '#52c41a'
            };
          } else if (day > Passdays.menstrual.end && day < Passdays.ovulation.start) {
            // 卵泡期
            markedDates[dateKey] = {
              dotColor: '#1890ff',
              type: 'dot',
              text: '卵泡',
              textColor: '#1890ff'
            };
          } else {
            // 黄体期
            markedDates[dateKey] = {
              dotColor: '#faad14',
              type: 'dot',
              text: '黄体',
              textColor: '#faad14'
            };
          }
        }
      } else {
        // 如果没有cycleData，生成默认的标记
        for (let day = 1; day <= daysInMonth; day++) {
          const currentDate = new Date(currentYear, currentMonth, day);
          const dateKey = currentDate.toISOString().split('T')[0];
          
          // 默认简单周期：1-5天为月经期，14-16天为排卵期，其余根据位置分配
          if (day >= 1 && day <= 5) {
            markedDates[dateKey] = {
              dotColor: '#ff6b81',
              type: 'dot',
              text: '经期',
              textColor: '#ff6b81'
            };
          } else if (day >= 14 && day <= 16) {
            markedDates[dateKey] = {
              dotColor: '#52c41a',
              type: 'dot',
              text: '排卵',
              textColor: '#52c41a'
            };
          } else if (day >= 6 && day <= 13) {
            markedDates[dateKey] = {
              dotColor: '#1890ff',
              type: 'dot',
              text: '卵泡',
              textColor: '#1890ff'
            };
          } else {
            markedDates[dateKey] = {
              dotColor: '#faad14',
              type: 'dot',
              text: '黄体',
              textColor: '#faad14'
            };
          }
        }
      }
      
      // 覆盖实际记录中isInPeriod为true或type为menstrual的日期，确保所有经期记录都被标记为生理期
      if (menstrualRecords && menstrualRecords.length > 0) {
        menstrualRecords.forEach(record => {
          if ((record.isInPeriod === true || record.type === 'menstrual') && record.date) {
            const dateKey = record.date;
            
            // 覆盖标记为生理期
            markedDates[dateKey] = {
              dotColor: '#ff6b81',
              type: 'dot',
              text: '经期',
              textColor: '#ff6b81'
            };
            
            console.log('在markedDates中标记经期:', dateKey, 'isInPeriod:', record.isInPeriod, 'type:', record.type);
          }
        });
      }
      
      return markedDates;
    },
    
    // 日期选择事件
    onDateSelect(e) {
      const selectedDate = e.detail.date;
      console.log('Selected date:', selectedDate);
      
      // 检查是否有权限查看详细信息
      if (!this.data.hasPermission) {
        wx.showToast({
          title: '对方未开放此权限',
          icon: 'none'
        });
        return;
      }
      
      const { contactInfo } = this.data;
      
      // 优先从实际生理周期记录中查找
      if (contactInfo && contactInfo.menstrualRecords && contactInfo.menstrualRecords.length > 0) {
        // 解析选中日期
        const [year, month, day] = selectedDate.split('-').map(Number);
        
        // 查找匹配的记录
        const matchingRecord = contactInfo.menstrualRecords.find(record => 
          record.year === year && 
          record.month === month && 
          record.day === day
        );
        
        if (matchingRecord) {
          // 构建显示内容
          let content = '';
          
          // 根据记录类型添加不同信息
          if (matchingRecord.isInPeriod || matchingRecord.type === 'menstrual') {
            content = '状态: 经期\n';
            if (matchingRecord.isLastDay) {
              content += '今天是经期最后一天\n';
            }
          } else if (matchingRecord.type === 'record') {
            content = '已记录日期\n';
          }
          
          // 如果有心情信息，添加心情
          if (matchingRecord.mood && matchingRecord.mood !== '未设置') {
            content += `心情: ${matchingRecord.mood}`;
          }
          
          wx.showModal({
            title: selectedDate,
            content: content,
            showCancel: false
          });
          return;
        }
      }
      
      // 如果没有实际记录或没有匹配的记录，使用原来的逻辑
      if (selectedDate && this.data.markedDates[selectedDate]) {
        const dateInfo = this.data.markedDates[selectedDate];
        wx.showModal({
          title: selectedDate,
          content: `状态: ${dateInfo.text || '未知'}`,
          showCancel: false
        });
      }
    },
    

    
    // 更新当前时间
    updateCurrentTime() {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const seconds = now.getSeconds().toString().padStart(2, '0');
      const currentTime = `${hours}:${minutes}:${seconds}`;
      
      this.setData({
        currentTime: currentTime
      });
    },
    
    // 导航返回
    navigateBack() {
      wx.navigateBack();
    }
  });
      