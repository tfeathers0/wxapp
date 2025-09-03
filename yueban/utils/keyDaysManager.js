const AV = require('../libs/av-core-min.js'); 

// 不再使用类，而是直接导出对象
const keyDaysManager = {
  // 获取当前用户的 KeyDays 对象
  async getKeyDaysObject() {
    try {
      const user = AV.User.current();
      if (!user) {
        throw new Error('用户未登录');
      }
      
      const query = new AV.Query('keydays');
      query.equalTo('username', user);
      let keyDaysObj = await query.first();
      
      if (!keyDaysObj) {
        // 如果不存在 KeyDays 对象，则创建一个新的
        const KeyDays = AV.Object.extend('keydays');
        keyDaysObj = new KeyDays();
        keyDaysObj.set('username', user);
        keyDaysObj.set('auth', []); // 初始化授权列表
        keyDaysObj.set('permissions', {}); // 初始化细粒度权限
        keyDaysObj.set('passdays', []);
        await keyDaysObj.save();
      }
      
      return keyDaysObj;
    } catch (error) {
      console.error('获取或创建 keydays 对象失败:', error);
      throw error;
    }
  },
  
  // 读取 auth 数组
  async getAuthArray() {
    try {
      const keyDaysObj = await this.getKeyDaysObject();
      return keyDaysObj.get('auth') || [];
    } catch (error) {
      console.error('读取 auth 数组失败:', error);
      // 发生错误时返回空数组，不使用模拟数据
      return [];
    }
  },
  
  // 读取 permissions 对象
  async getPermissions() {
    try {
      const keyDaysObj = await this.getKeyDaysObject();
      return keyDaysObj.get('permissions') || {};
    } catch (error) {
      console.error('读取 permissions 对象失败:', error);
      return {};
    }
  },
  
  // 设置 permissions 对象
  async setPermissions(newPermissions) {
    try {
      const keyDaysObj = await this.getKeyDaysObject();
      keyDaysObj.set('permissions', newPermissions);
      await keyDaysObj.save();
      console.log('permissions 对象更新成功');
      return true;
    } catch (error) {
      console.error('更新 permissions 对象失败:', error);
      throw error;
    }
  },
  
  // 获取指定用户的权限设置
  async getUserPermissions(userId) {
    try {
      const permissions = await this.getPermissions();
      return permissions[userId] || {
        canViewStatus: true,
        canViewMenstruation: true,
        canViewMood: true,
        canViewPassdays: true
      }; // 默认权限
    } catch (error) {
      console.error('获取用户权限失败:', error);
      // 出错时返回默认权限
      return {
        canViewStatus: true,
        canViewMenstruation: true,
        canViewMood: true,
        canViewPassdays: true
      };
    }
  }, 
   
  // 设置指定用户的权限
  async setUserPermissions(userId, userPermissions) {
    try {
      const permissions = await this.getPermissions();
      permissions[userId] = userPermissions;
      await this.setPermissions(permissions);
      console.log('用户权限更新成功');
      return true;
    } catch (error) {
      console.error('更新用户权限失败:', error);
      throw error;
    }
  },
  
  // 检查用户是否有权限查看特定类型的信息
  async checkSpecificPermission(userId, permissionType) {
    try {
      const userPermissions = await this.getUserPermissions(userId);
      return userPermissions[permissionType] !== false;
    } catch (error) {
      console.error('检查特定权限失败:', error);
      // 出错时默认返回有权限
      return true;
    }
  },
  
  // 改写 auth 数组
  async setAuthArray(newAuthArray) {
    try {
      const keyDaysObj = await this.getKeyDaysObject();
      keyDaysObj.set('auth', newAuthArray);
      await keyDaysObj.save();
      console.log('auth 数组更新成功');
      return true;
    } catch (error) {
      console.error('更新 auth 数组失败:', error);
      throw error;
    }
  },
  
  // 向 auth 数组添加用户 objectId
  async addToAuth(userObjectId) {
    try {
      const currentAuth = await this.getAuthArray();
      if (!currentAuth.includes(userObjectId)) {
        currentAuth.push(userObjectId);
        await this.setAuthArray(currentAuth);
        console.log('已添加到 auth 数组');
      }
      return currentAuth;
    } catch (error) {
      console.error('添加到 auth 数组失败:', error);
      throw error;
    }
  },
  
  // 从 auth 数组移除用户 objectId
  async removeFromAuth(userObjectId) {
    try {
      const currentAuth = await this.getAuthArray();
      const newAuth = currentAuth.filter(id => id !== userObjectId);
      await this.setAuthArray(newAuth);
      console.log('已从 auth 数组移除');
      return newAuth;
    } catch (error) {
      console.error('从 auth 数组移除失败:', error);
      throw error;
    }
  },
  
  // 读取 passdays 数组
  async getPassDaysArray() {
    try {
      const keyDaysObj = await this.getKeyDaysObject();
      return keyDaysObj.get('passdays') || [];
    } catch (error) {
      console.error('读取 passdays 数组失败:', error);
      return [];
    }
  },
  
  // 改写 passdays 数组
  async setPassDaysArray(newPassDaysArray) {
    try {
      const keyDaysObj = await this.getKeyDaysObject();
      keyDaysObj.set('passdays', newPassDaysArray);
      await keyDaysObj.save();
      console.log('passdays 数组更新成功');
      return true;
    } catch (error) {
      console.error('更新 passdays 数组失败:', error);
      throw error;
    }
  },
  
  // 向 passdays 数组添加关键日期
  async addToPassDays(date) {
    try {
      const currentPassDays = await this.getPassDaysArray();
      // 确保传入的是 Date 对象或可以转换为 Date 的格式
      const dateToAdd = date instanceof Date ? date : new Date(date);
      currentPassDays.push(dateToAdd);
      await this.setPassDaysArray(currentPassDays);
      console.log('已添加到 passdays 数组');
      return currentPassDays;
    } catch (error) {
      console.error('添加到 passdays 数组失败:', error);
      throw error;
    }
  },
  
  // 读取最新的 keydate
  async getKeyDate() {
    try {
      const keyDaysObj = await this.getKeyDaysObject();
      return keyDaysObj.get('keydate');
    } catch (error) {
      console.error('读取 keydate 失败:', error);
      return null;
    }
  },
  
  // 改写 keydate
  async setKeyDate(newKeyDate) {
    try {
      const keyDaysObj = await this.getKeyDaysObject();
      // 确保传入的是 Date 对象
      const dateToSet = newKeyDate instanceof Date ? newKeyDate : new Date(newKeyDate);
      keyDaysObj.set('keydate', dateToSet);
      await keyDaysObj.save();
      console.log('keydate 更新成功');
      return true;
    } catch (error) {
      console.error('更新 keydate 失败:', error);
      throw error;
    }
  },
  
  // 更新 keydate 并自动将其添加到 passdays 历史记录
  async updateKeyDateAndHistory(newKeyDate) {
    try {
      const currentKeyDate = await this.getKeyDate();
      
      // 将当前 keydate 添加到 passdays 历史记录
      if (currentKeyDate) {
        await this.addToPassDays(currentKeyDate);
      }
      
      // 设置新的 keydate
      await this.setKeyDate(newKeyDate);
      
      console.log('keydate 更新并历史记录已保存');
      return true;
      
    } catch (error) {
      console.error('更新 keydate 和历史记录失败:', error);
      throw error;
    }
  },
  
  // 获取完整的 KeyDays 数据
  async getAllData() {
    try {
      const keyDaysObj = await this.getKeyDaysObject();
      return {
        auth: keyDaysObj.get('auth') || [],
        passdays: keyDaysObj.get('passdays') || [],
        keydate: keyDaysObj.get('keydate'),
        objectId: keyDaysObj.id,
        createdAt: keyDaysObj.createdAt,
        updatedAt: keyDaysObj.updatedAt
      };
    } catch (error) {
      console.error('获取完整数据失败:', error);
      throw error;
    }
  }
};

// 直接导出对象，不需要实例化
module.exports = keyDaysManager;