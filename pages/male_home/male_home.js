// 直接导入keyDaysManager对象，不需要实例化
const keyDaysManager = require('../../utils/keyDaysManager.js');
const AV = require('../../libs/av-core-min.js');

Page({
    data: {
      currentDay: '',
      currentWeekday: '',
      markedDates: [
          '2023-10-05',
          '2023-10-15',
          '2023-10-25'
        ],
      reminderText: "正在获取关联人状态...",
      statusIcon: "", // 新增：状态图标
      statusType: '', // 新增：状态类型，用于显示不同样式
      isCaringMessage: false, // 新增：是否为关爱提示语
      currentTime: "",
      defaultDate: '', 
      selectedFullDate: '',
      currentKnowledgeIndex: 0,
      knowledgeScrollTimer: null,
      contactList: [], // 新增：存储所有关联人
      abnormalContacts: [] // 存储有异常状况的关联人
    },

    onLoad() {
      this.updateDate();
      
      // 初始化默认日期
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const defaultDate = `${year}-${month}-${day}`;
      this.setData({
        defaultDate: defaultDate,
        selectedFullDate: defaultDate
      });

      // 初始化时间
      this.updateCurrentTime();
      setInterval(() => {
        this.updateCurrentTime();
      }, 60000);

      // 启动知识滚动
      this.startKnowledgeScroll();

      // 新增：获取关联人数据并检查异常状况
      this.loadContactListAndCheckAbnormal();
    },

    // 加载关联人列表并检查异常状况
    async loadContactListAndCheckAbnormal() {
      try {
        // 从权限管理器获取授权列表
        const authArray = await keyDaysManager.getAuthArray();
        
        // 从LeanCloud获取好友列表
        const currentUser = AV.User.current();
        if (!currentUser) {
          throw new Error('用户未登录');
        }
        
        // 查询好友关系（与relationship_information界面保持一致的查询方式）
        const query = new AV.Query('_Followee');
        query.equalTo('user', currentUser);
        query.equalTo('friendStatus', true);
        query.include('followee');
        
        const followeeResults = await query.find();
        
        // 构建联系人列表
        const contacts = followeeResults.map(result => {
          const followee = result.get('followee');
          return {
            id: followee.id,
            nickname: followee.get('nickName') || '未命名',
            avatar: followee.get('avatar') ,
            objectId: followee.id,
            relation: result.get('relation') || '朋友',
            gender: followee.get('gender') || 'unknown' // 获取性别信息
          };
        });

        // 过滤出有权限查看的联系人
        // 如果授权列表为空，则显示所有好友关系的联系人
        // 如果授权列表不为空，则只显示在授权列表中的联系人
        const authorizedContacts = authArray.length > 0 
          ? contacts.filter(contact => authArray.includes(contact.objectId))
          : contacts;
        
        // 只显示女性关联人的状态（gender=1表示女性）
        const femaleAuthorizedContacts = authorizedContacts.filter(contact => contact.gender === 1);
        
        // 如果没有女性关联人，显示提示信息
        if (femaleAuthorizedContacts.length === 0) {
          this.setData({
            reminderText: "暂无女性关联人授权信息",
            statusIcon: "/images/icon_state_normal.png",
            statusType: 'normal',
            isCaringMessage: true,
            contactList: [],
            abnormalContacts: []
          });
          return;
        }
        
        // 检查每个女性关联人的异常状况
        const abnormalContacts = [];
        
        for (const contact of femaleAuthorizedContacts) {
          // 获取权限设置（与relationship_information界面保持一致的权限获取方式）
          let permissions = await keyDaysManager.getUserPermissions(contact.objectId);
          
          // 从LeanCloud获取联系人的详细数据
          const contactUserQuery = new AV.Query('_User');
          const contactUser = await contactUserQuery.get(contact.objectId);
          
          // 构建联系人数据，严格按照权限来决定获取哪些信息
          const contactData = {};
          
          // 只在有权限的情况下获取相应字段
          if (permissions.canViewStatus) {
            contactData.status = contactUser.get('state') || 'unknown';
          }
          
          if (permissions.canViewMood) {
            contactData.mood = contactUser.get('mood') || 'normal';
          }
          
          if (permissions.canViewMenstruation) {
            contactData.status = contactUser.get('state') || 'unknown';
            contactData.periodDays = contactUser.get('periodDays') || 0;
          }
          
          if (permissions.canViewPassdays) {
            // 获取passdays数组
            const passdays = await keyDaysManager.getPassDaysArray(contact.objectId);
            contactData.passdays = passdays || [];
          }
          
          // 根据权限检查异常状况
          const abnormalReasons = [];
          // 存储个性化的提示信息
          const personalizedTips = [];
          
          // 检查月经期状态（如果有权限）
          if (permissions.canViewMenstruation && contactData.status === "menstrual") {
            const periodReason = `处于月经期${contactData.periodDays > 0 ? `第${contactData.periodDays}天` : ''}`;
            abnormalReasons.push(periodReason);
            personalizedTips.push(`${contact.nickname}今天${periodReason}，记得关心她`);
          }
          
          // 检查心情状态（如果有权限）
          if (permissions.canViewMood && contactData.mood && (contactData.mood === "low" || contactData.mood === "anxious")) {
            const moodMap = { "low": "心情低落", "anxious": "情绪焦虑" };
            const moodReason = moodMap[contactData.mood];
            abnormalReasons.push(moodReason);
            
            const tipMap = {
              "low": `${contact.nickname}今天${moodReason}，可以给她讲个笑话`,
              "anxious": `${contact.nickname}今天${moodReason}，记得多安慰她`
            };
            personalizedTips.push(tipMap[contactData.mood]);
          }
          
          // 检查即将到来的月经期（如果有权限）
          if (permissions.canViewPassdays && contactData.passdays && contactData.passdays.length > 0) {
            const today = new Date();
            
            // 在passdays中查找未来几天的月经日期
            contactData.passdays.forEach(day => {
              if (day.type === 'menstruation') {
                const periodDate = new Date(day.date);
                const diffDays = Math.ceil((periodDate - today) / (1000 * 60 * 60 * 24));
                
                if (diffDays >= 0 && diffDays <= 3) {
                  const periodReason = `预计${diffDays === 0 ? '今天' : diffDays === 1 ? '明天' : `未来${diffDays}天内`}来月经`;
                  abnormalReasons.push(periodReason);
                  
                  const tipMap = {
                    0: `${contact.nickname}${periodReason}，记得提前准备必需品`,
                    1: `${contact.nickname}${periodReason}，明天记得多关心她`,
                    2: `${contact.nickname}${periodReason}，可以提前准备些热饮`,
                    3: `${contact.nickname}${periodReason}，近期注意她的情绪变化`
                  };
                  personalizedTips.push(tipMap[diffDays] || `${contact.nickname}${periodReason}，请注意她的状态`);
                }
              }
            });
          }
          
          // 如果有异常状况，添加到异常联系人列表
          if (abnormalReasons.length > 0) {
            abnormalContacts.push({
              ...contact,
              abnormalReasons: abnormalReasons,
              personalizedTips: personalizedTips
            });
          }
        }
        
        this.setData({
          contactList: femaleAuthorizedContacts,
          abnormalContacts: abnormalContacts
        }, () => {
          // 更新提醒信息
          this.updateAbnormalReminder();
        });
      } catch (error) {
        console.error('加载关联人数据失败:', error);
        this.setData({
          reminderText: '获取关联人状态失败',
          statusIcon: "/images/icon_error.png",
          statusType: 'error',
          isCaringMessage: false
        });
      }
    },

    // 更新异常状况提醒
    updateAbnormalReminder() {
      const { abnormalContacts, contactList } = this.data;
      
      if (abnormalContacts.length > 0) {
        // 有处于异常状况的关联人
        let reminderTexts = [];
        let statusIcon = "";
        
        abnormalContacts.forEach(contact => {
          // 优先使用个性化提示信息，确保显示清晰的用户名和状态
          if (contact.personalizedTips && contact.personalizedTips.length > 0) {
            reminderTexts = reminderTexts.concat(contact.personalizedTips);
          } else {
            // 如果没有个性化提示，则使用通用提醒文本
            const reasons = contact.abnormalReasons.join('，');
            reminderTexts.push(`${contact.nickname}(${contact.relation})${reasons}，请多关心`);
          }
          
          // 设置状态图标（优先显示月经期图标）
          if (contact.abnormalReasons.some(reason => reason.includes('月经期')) && !statusIcon) {
            statusIcon = "/images/icon_state_menstrual.png";
          } else if (!statusIcon && contact.abnormalReasons.some(reason => reason.includes('心情'))) {
            statusIcon = "/images/icon_state_mood.png";
          }
        });
        
        // 限制显示的提醒条数，避免过长
        const displayReminders = reminderTexts.slice(0, 2);
        const reminderText = displayReminders.join('；');
        
        this.setData({
          reminderText: reminderText + (reminderTexts.length > 2 ? `...还有${reminderTexts.length - 2}位关联人需要关心` : ''),
          statusIcon: statusIcon || "/images/icon_state_attention.png",
          statusType: 'abnormal',
          isCaringMessage: false
        });
      } else if (contactList.length > 0) {
        // 有关联人但没有异常状况
        this.setData({
          reminderText: "所有关联人状态良好",
          statusIcon: "/images/icon_state_normal.png",
          statusType: 'normal',
          isCaringMessage: true
        });
      } else {
        // 没有关联人
        this.setData({
          reminderText: "暂无关联人授权信息",
          statusIcon: "/images/icon_state_normal.png",
          statusType: 'normal',
          isCaringMessage: true
        });
      }
    },

    startKnowledgeScroll() {
      if (this.data.knowledgeScrollTimer) {
        clearInterval(this.data.knowledgeScrollTimer);
      }
      
      this.data.knowledgeScrollTimer = setInterval(() => {
        let newIndex = this.data.currentKnowledgeIndex + 1;
        if (newIndex >= 4) {
          newIndex = 0;
        }
        this.setData({
          currentKnowledgeIndex: newIndex
        });
      }, 3000);
    },

    onUnload() {
      if (this.data.knowledgeScrollTimer) {
        clearInterval(this.data.knowledgeScrollTimer);
      }
    },

    updateDate() {
      const date = new Date();
      const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const fullDate = `${year}年${month}月${day}日`;
      
      this.setData({
        currentDay: day,
        currentWeekday: days[date.getDay()],
        fullDate: fullDate,
        currentMonth: parseInt(month) // 添加月份数值，用于显示
      });
    },

    goToRelationship() {
      wx.navigateTo({
        url: '/pages/relationship/relationship'
      });
    },

    // 点击关联人提醒板块跳转到对应关联人的信息页面
    onReminderTap() {
      const { abnormalContacts, contactList } = this.data;
      
      // 如果只有一个异常关联人，直接跳转到该关联人的信息页面
      if (abnormalContacts.length === 1) {
        wx.navigateTo({
          url: `/pages/relationship_information/relationship_information?contactId=${abnormalContacts[0].objectId}&nickname=${abnormalContacts[0].nickname}`
        });
      } 
      // 如果有多个异常关联人或有关联人但没有异常，跳转到关联人列表页面
      else if (abnormalContacts.length > 1 || contactList.length > 0) {
        wx.navigateTo({
          url: '/pages/relationship/relationship'
        });
      }
      // 如果没有关联人，不进行跳转
    },

    switchToKnowledge() {
      wx.navigateTo({ url: '/pages/knowledge_base/knowledge_base' })
    },

  // 扫码功能
  switchToScan: function() {
    wx.scanCode({
      onlyFromCamera: true, // 只允许从相机扫码
      success: (res) => {
        console.log('扫码结果:', res.result);
        wx.navigateTo({
          url: `../relationship/relationship?scanResult=${encodeURIComponent(res.result)}`
        });
        wx.showToast({
          title: '扫码成功',
          icon: 'success'
        });
      },
      fail: (err) => {
        console.log('扫码失败:', err);
        // 取消扫码不会弹出提示
        if (err.errMsg !== 'scanCode:fail cancel') {
          wx.showToast({
            title: '扫码失败',
            icon: 'none'
          });
        }
      }
    });
  },

    switchToMine() {
      wx.navigateTo({ url: '/pages/my_homepage/my_homepage' })
    },

    onCalendarDateSelect(e) {
      const selectedFullDate = e.detail.date;
      this.setData({ selectedFullDate });
      wx.setStorageSync('selectedDate', selectedFullDate);
    },

    onCalendarDayClick(e) {
      console.log('选中的日期:', e.detail.date);
    },

    updateCurrentTime() {
      const date = new Date();
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      this.setData({
        currentTime: `${hours}:${minutes}`
      });
    }
});
    