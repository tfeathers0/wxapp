Component({
    properties: {
      // 外部传入的默认选中日期（可选，格式：YYYY-MM-DD）
      defaultDate: {
        type: String,
        value: ''
      },
      // 外部传入的需要标记的日期数据
      markedDates: {
        type: Object,
        value: {}
      }
    },
  
    data: {
      currentYear: 0,    // 当前展示的年份
      currentMonth: 0,   // 当前展示的月份
      selectedDate: 0,   // 选中的日期（仅当月日期）
      currentDate: 0,    // 当天日期
      prevMonthDates: [], // 上个月的日期（填充到当月日历开头）
      currentMonthDates: [], // 当月的所有日期
      nextMonthDates: []  // 下个月的日期（填充到当月日历结尾）
    },
  
    lifetimes: {
      // 组件初始化时触发
      attached() {
        // 初始化当前年月和日期数据
        const today = this.properties.defaultDate 
          ? new Date(this.properties.defaultDate) 
          : new Date();
        this.setData({
          currentYear: today.getFullYear(),
          currentMonth: today.getMonth() + 1, // 月份从 0 开始，转成 1-12
          selectedDate: today.getDate(),
        }, () => {
          // 初始化日历数据（必须在 setData 完成后调用）
          this.updateCalendar();
        })
      }
    },
    
    methods: {
      // 更新日历数据（核心方法：计算上月、当月、下月日期）
      updateCalendar() {
        const { currentYear, currentMonth } = this.data;
        const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1); // 当月1号
        const lastDayOfMonth = new Date(currentYear, currentMonth, 0); // 当月最后一天
        const firstDayWeek = firstDayOfMonth.getDay(); // 当月1号是星期几（0=周日，6=周六）
        const currentMonthDayCount = lastDayOfMonth.getDate(); // 当月总天数
  
        // 1. 计算上个月需要显示的日期（填充开头空白）
        const prevMonthLastDay = new Date(currentYear, currentMonth - 1, 0).getDate(); // 上月最后一天
        const prevMonthDates = [];
        for (let i = 0; i < firstDayWeek; i++) {
          prevMonthDates.push(prevMonthLastDay - firstDayWeek + 1 + i);
        }
  
        // 2. 计算当月日期
        const currentMonthDates = [];
        for (let i = 1; i <= currentMonthDayCount; i++) {
          currentMonthDates.push(i);
        }
  
        // 3. 计算下个月需要显示的日期（填充结尾空白，凑够 6 行 * 7 列 = 42 个格子）
        const totalGridCount = 42; // 日历默认显示 6 行
        const nextMonthDates = [];
        const needNextDayCount = totalGridCount - prevMonthDates.length - currentMonthDates.length;
        for (let i = 1; i <= needNextDayCount; i++) {
          nextMonthDates.push(i);
        }
  
        // 更新数据
        this.setData({
          prevMonthDates,
          currentMonthDates,
          nextMonthDates
        });
      },
  
      // 切换到上个月
      prevMonth() {
        let { currentYear, currentMonth } = this.data;
        if (currentMonth === 1) {
          currentYear--;
          currentMonth = 12;
        } else {
          currentMonth--;
        }
        this.setData({ currentYear, currentMonth }, () => {
          this.updateCalendar();
        });
      },
  
      // 切换到下个月
      nextMonth() {
        let { currentYear, currentMonth } = this.data;
        if (currentMonth === 12) {
          currentYear++;
          currentMonth = 1;
        } else {
          currentMonth++;
        }
        this.setData({ currentYear, currentMonth }, () => {
          this.updateCalendar();
        });
      },
  
      // 点击日期（不做任何操作，因为不需要弹出弹窗）
      onDateClick(e) {
        // 不触发任何事件，不显示弹窗
      },
      
      // 检查日期是否需要标记
      isMarkedDate(year, month, date) {
        // 构建日期对象，确保月份正确（JavaScript月份从0开始）
        const currentDate = new Date(year, month - 1, date);
        // 构建与relationship_information.js中相同格式的日期字符串：YYYY-MM-DD
        const fullDate = currentDate.toISOString().split('T')[0];
        // 检查该日期是否在markedDates中
        return !!this.data.markedDates[fullDate];
      },
      
      // 获取日期标记的类型
      getMarkedType(year, month, date) {
        // 构建日期对象，确保月份正确
        const currentDate = new Date(year, month - 1, date);
        // 构建与relationship_information.js中相同格式的日期字符串：YYYY-MM-DD
        const fullDate = currentDate.toISOString().split('T')[0];
        return this.data.markedDates[fullDate]?.type || '';
      },
      
      // 获取日期标记的颜色
      getMarkedColor(year, month, date) {
        // 构建日期对象，确保月份正确
        const currentDate = new Date(year, month - 1, date);
        // 构建与relationship_information.js中相同格式的日期字符串：YYYY-MM-DD
        const fullDate = currentDate.toISOString().split('T')[0];
        return this.data.markedDates[fullDate]?.dotColor || '#ff6b81'; // 默认使用红色作为月经标记颜色
      }
    }
  });