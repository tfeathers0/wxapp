Page({
    data: {},
    onLoad() {
      this.drawClock();
      this.timer = setInterval(() => {
        this.drawClock();
      }, 1000);
    },
    
    onUnload() {
      // 清除定时器
      if (this.timer) {
        clearInterval(this.timer);
      }
    },
    
    drawClock() {
      const ctx = wx.createCanvasContext('clock', this);
      const size = 200;
      const radius = size / 2;
      const centerX = radius;
      const centerY = radius;
      
      // 清除画布
      ctx.clearRect(0, 0, size, size);
      
        // --- 绘制图片背景 ---
        // 绘制clock.png作为背景图片
        ctx.drawImage('/images/clock.png', 0, 0, size, size);
      
         // --- 绘制刻度 ---
        // 主要刻度（12、3、6、9点位置）
        const majorTickLength = 15;
        const majorTickWidth = 4;
        ctx.setStrokeStyle("#1e3a8a"); // 带蓝色调的浅紫色主要刻度
        ctx.setLineWidth(majorTickWidth);
        
        // 四个主要刻度位置
        const majorTicks = [
          {x: 0, y: -radius + 20}, // 12点
          {x: radius - 20, y: 0},  // 3点
          {x: 0, y: radius - 20},  // 6点
          {x: -radius + 20, y: 0}  // 9点
        ];
        
        majorTicks.forEach(pos => {
          ctx.beginPath();
          ctx.moveTo(centerX + pos.x * 0.9, centerY + pos.y * 0.9);
          ctx.lineTo(centerX + pos.x, centerY + pos.y);
          ctx.stroke();
        });
        
        // 次要刻度（其他小时刻度）
        const minorTickLength = 8;
        const minorTickWidth = 2;
        ctx.setStrokeStyle("#4338ca"); // 带蓝色调的淡紫色次要刻度
        ctx.setLineWidth(minorTickWidth);
        
        for (let i = 0; i < 12; i++) {
          // 跳过已经绘制的主要刻度位置
          if (i % 3 === 0) continue;
          
          const angle = (Math.PI / 6) * i;
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          
          ctx.beginPath();
          ctx.moveTo(
            centerX + cos * (radius - 20) * 0.9, 
            centerY + sin * (radius - 20) * 0.9
          );
          ctx.lineTo(
            centerX + cos * (radius - 20), 
            centerY + sin * (radius - 20)
          );
          ctx.stroke();
        }
        
        // --- 绘制时钟指针 ---
        const now = new Date();
        const sec = now.getSeconds();
        const min = now.getMinutes();
        const hr = now.getHours() % 12;
        
        // 时针
        const hourAngle = (Math.PI / 6) * hr + (Math.PI / 360) * min;
        this.drawHand(ctx, centerX, centerY, hourAngle, radius * 0.4, 4, "#312e81"); // 更浅的带蓝色调淡紫色时针，更细
        
        // 分针
        const minuteAngle = (Math.PI / 30) * min + (Math.PI / 1800) * sec;
        this.drawHand(ctx, centerX, centerY, minuteAngle, radius * 0.6, 3, "#1d4ed8"); // 带蓝色调的中紫色分针
        
        // 秒针
        const secondAngle = (Math.PI / 30) * sec;
        this.drawHand(ctx, centerX, centerY, secondAngle, radius * 0.7, 1, "#6d28d9"); // 紫色系秒针，与整体色调协调
        
        // 中心点
        ctx.beginPath();
        ctx.arc(centerX, centerY, 6, 0, 2 * Math.PI);
        ctx.setFillStyle("#0e7490"); // 稍浅的蓝色中心点
        ctx.fill();
        
        // 绘制
        ctx.draw();
      },
      
      drawHand(ctx, x, y, angle, length, width, color) {
        ctx.beginPath();
        ctx.setLineWidth(width);
        ctx.setStrokeStyle(color);
        ctx.setLineCap("round");
        ctx.moveTo(x, y);
        ctx.lineTo(
          x + Math.cos(angle - Math.PI/2) * length, 
          y + Math.sin(angle - Math.PI/2) * length
        );
        ctx.stroke();
      },
  
    data: {
      items: [
        {
          title: "应用介绍",
          details: [
            { text: "《月伴》是一款专注于女性健康的智能月经管理小程序。它不仅帮助女性用户记录和预测生理周期，还在数据安全的前提下，为伴侣、家人和朋友提供关怀通道，打造科学、温暖、包容的女性健康关怀生态系统。", style: "details-text" },
            { text: "、\n\n与传统应用不同，《月伴》以“记录 + 科普 + 共享 + 关怀”为核心理念，除了周期管理，还融入了健康教育、情感支持和社会互动，旨在帮助女性更好地了解身体，提升幸福感，同时推动家庭和社会层面对女性健康的理解与支持。", style: "details-text" }
          ],
          isOpen: false,
          height: 0
        },
        {
          title: "主要功能",
          details: [
            { text: "1. 周期追踪与预测", style: "big-bold-text" },
            { text: "- 支持标记月经开始与结束日期\n- 智能预测下次月经到来时间，并提供提前提醒\n- 倒计时显示，帮助用户合理安排学习、工作与出行", style: "details-text" },
  
            { text: "2. 多维健康记录", style: "big-bold-text" },
            { text: "- 可记录日常症状（如痛经、长痘、乏力）、情绪波动和生活方式（饮食、睡眠）\n- 生成周期性健康数据，辅助用户自我观察与改善", style: "details-text" },
  
            { text: "3. 健康科普教育", style: "big-bold-text" },
            { text: "- 针对女性用户：提供经期饮食、运动、卫生保健建议\n- 针对男性用户：提供经期认知、关怀方式指导，消除误解与偏见\n- 针对儿童用户：提供适龄化、温和的健康教育内容", style: "details-text" },
  
            { text: "4. 多模式共享与关怀", style: "big-bold-text" },
            { text: "- 支持 个人、伴侣、家庭、朋友 四种模式\n- 用户可自主选择授权对象，在隐私保护前提下共享周期信息\n- 提供贴心提示，例如：“月经将至，记得提醒她带上卫生用品”\n- 促进伴侣理解、家庭关怀与朋友互助", style: "details-text" },
            {text:"\n"},
            {text:"\n"},
          ],
          isOpen: false,
          height: 0
        },
        {
          title: "隐私政策",
          details: [
            { text: "《月伴》高度重视用户的个人隐私与数据安全，承诺做到：", style: "details-text" },
  
            { text: "1. 最小化数据收集", style: "big-bold-text" },
            { text: "仅收集与经期记录、症状和用户设置相关的数据，不采集与功能无关的敏感信息。", style: "details-text" },
  
            { text: "2. 自主可控的共享机制", style: "big-bold-text" },
            { text: "用户完全自主选择是否与伴侣、家人、朋友共享周期信息。\n所有共享均基于 明确授权，随时可取消，确保隐私可控。", style: "details-text" },
  
            { text: "3. 严格的数据加密与保护", style: "big-bold-text" },
            { text: "所有传输过程采用加密协议，防止数据泄露。\n不会向任何第三方出售或泄露用户数据。", style: "details-text" },
  
            { text: "4. 广告与商业化限制", style: "big-bold-text" },
            { text: "《月伴》不推送低俗或无关广告，不做过度商业化运营，确保用户专注于健康管理。", style: "details-text" },
            { text: "\n" },
          ],
          isOpen: false,
          height: 0
        }
      ]
    },
  
    toggleBox(e) {
      const index = e.currentTarget.dataset.index;
      const query = wx.createSelectorQuery();
  
      query.select(`#content-${index}`).boundingClientRect(rect => {
        const items = this.data.items.map((item, i) => {
          if (i === index) {
            if (item.isOpen) {
              return { ...item, isOpen: false, height: 0 };
            } else {
              return { ...item, isOpen: true, height: rect.height };
            }
          } else {
            return { ...item, isOpen: false, height: 0 };
          }
        });
        this.setData({ items });
      }).exec();
    }
  })
  