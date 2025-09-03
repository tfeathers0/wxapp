
Component({
    data: {},
    attached() {
      this.drawClock();
      this.timer = setInterval(() => {
        this.drawClock();
      }, 1000);
    },
    
    detached() {
      // 清除定时器
      if (this.timer) {
        clearInterval(this.timer);
      }
    },
    
    methods: {
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
        ctx.setStrokeStyle("#93c5fd"); // 带蓝色调的浅紫色主要刻度
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
        ctx.setStrokeStyle("#a5b4fc"); // 带蓝色调的淡紫色次要刻度
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
        this.drawHand(ctx, centerX, centerY, hourAngle, radius * 0.4, 4, "#a5b4fc"); // 更浅的带蓝色调淡紫色时针，更细
        
        // 分针
        const minuteAngle = (Math.PI / 30) * min + (Math.PI / 1800) * sec;
        this.drawHand(ctx, centerX, centerY, minuteAngle, radius * 0.6, 3, "#93c5fd"); // 带蓝色调的中紫色分针
        
        // 秒针
        const secondAngle = (Math.PI / 30) * sec;
        this.drawHand(ctx, centerX, centerY, secondAngle, radius * 0.7, 1, "#c4b5fd"); // 紫色系秒针，与整体色调协调
        
        // 中心点
        ctx.beginPath();
        ctx.arc(centerX, centerY, 6, 0, 2 * Math.PI);
        ctx.setFillStyle("#78ebea"); // 稍浅的蓝色中心点
        ctx.fill();
        
        // 中心内圆
        ctx.beginPath();
        ctx.arc(centerX, centerY, 3, 0, 2 * Math.PI);
        ctx.setFillStyle("#ffffff"); // 白色内圆，更醒目
        
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
      }
    }
})