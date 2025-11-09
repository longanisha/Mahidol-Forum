#!/usr/bin/env python3
"""
创建积分系统公告的脚本
需要管理员权限
"""
import os
import sys
import requests
from datetime import datetime

# 从环境变量或配置中获取
SUPABASE_URL = os.getenv('SUPABASE_URL', 'http://localhost:54321')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY', '')
API_BASE_URL = os.getenv('API_BASE_URL', 'http://localhost:8000')

# 公告内容
ANNOUNCEMENT_TITLE = "🎉 校园论坛积分系统正式上线公告"
ANNOUNCEMENT_CONTENT = """# 🎉 校园论坛积分系统正式上线公告

## 📢 重要通知

亲爱的同学们：

我们很高兴地宣布，**Mahidol大学论坛积分系统**正式上线啦！这是一个专属于我们校园社区的奖励机制，旨在鼓励大家积极参与讨论、分享知识、帮助他人。

---

## 💫 积分系统有什么用？

### 🏆 荣誉与成就
- **等级徽章**：通过积分提升论坛等级，展示您的活跃度
- **排行榜**：登上校园贡献榜，成为校园明星
- **特殊称号**：获得"热心助人"、"知识达人"等荣誉称号

### 🎁 实用权益兑换

#### 学习资源类
- **图书馆延长借阅**：50积分兑换额外7天借书时间
- **打印券**：20积分兑换10张免费打印
- **学习资料下载**：30积分解锁优质学习资源

#### 校园生活类
- **食堂优惠券**：40积分兑换9折餐饮优惠
- **咖啡券**：15积分兑换校园咖啡店买一送一
- **活动优先报名**：25积分获得热门活动优先参与权

#### 论坛特权类
- **帖子置顶**：50积分可将重要帖子置顶（永久）
- **创建私人群组**：30积分可创建专属私人群组

#### 实物奖励类
- **校园纪念品**：200积分兑换定制文具、T恤
- **合作商家折扣**：与周边商家合作提供专属优惠
- **抽奖机会**：定期举办积分抽奖活动

---

## 📈 如何获得积分？

### 日常活跃
- **每日登录**：+1 积分（每天首次登录）

### 内容贡献
- **发布帖子**：+10 积分
- **发表评论**：+5 积分

### 社区互动
- **帖子被点赞**：+2 积分/赞（每次新增点赞）
- **评论被点赞**：+1 积分/赞（每次新增点赞）
- **创建群组**：+20 积分

### 积分消耗
- **置顶帖子**：-50 积分（永久置顶）
- **创建私人群组**：-30 积分

### 即将推出
- 完善个人资料奖励
- 邮箱验证奖励
- 帖子被加精奖励
- 内容被收藏奖励
- 帮助解决问题奖励
- 连续登录奖励
- 月度活跃用户奖励
- 优质内容创作者奖励

---

## 🎯 积分等级体系

| 等级 | 所需积分 | 特权 |
|------|----------|------|
| 🥉 新手上路 | 0-100 | 基础功能 |
| 🥈 活跃分子 | 101-500 | 个性装扮 |
| 🥇 社区达人 | 501-1000 | 帖子置顶、创建私人群组 |
| 💎 校园明星 | 1001+ | 所有特权 |

---

## 📅 重要提醒

### 兑换时间
- 每月1-5日开放积分兑换
- 兑换后积分相应扣除
- 部分热门奖励数量有限，先到先得

### 积分规则
- 积分有效期为1年
- 禁止刷分行为，违者清零处理
- 最终解释权归论坛管理团队所有

---

## 🚀 立即开始赚取积分！

从现在开始，您的每一个帖子、每一次点赞、每一份分享都将为您积累宝贵的积分。让我们一起建设更加活跃、友好的校园社区！

💝 **感谢您的参与，让Mahidol校园更加精彩！**

---
*Mahidol大学论坛管理团队*  
*发布日期：2024年1月*
"""

def create_announcement():
    """创建积分系统公告"""
    
    # 检查是否有管理员凭据
    admin_id = os.getenv('ADMIN_ID')
    admin_email = os.getenv('ADMIN_EMAIL')
    
    if not admin_id or not admin_email:
        print("❌ 错误: 需要设置 ADMIN_ID 和 ADMIN_EMAIL 环境变量")
        print("   或者通过 admin 登录页面创建公告")
        return False
    
    # 准备请求
    url = f"{API_BASE_URL}/announcements"
    headers = {
        'Content-Type': 'application/json',
        'X-Admin-ID': admin_id,
        'X-Admin-Email': admin_email,
    }
    
    payload = {
        'title': ANNOUNCEMENT_TITLE,
        'content': ANNOUNCEMENT_CONTENT,
        'priority': 10,  # 最高优先级，确保置顶
        'is_active': True,
    }
    
    try:
        print(f"📢 正在创建公告: {ANNOUNCEMENT_TITLE}")
        print(f"   请求 URL: {url}")
        
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        
        if response.status_code == 201:
            result = response.json()
            print("✅ 公告创建成功！")
            print(f"   公告 ID: {result.get('id')}")
            print(f"   标题: {result.get('title')}")
            print(f"   优先级: {result.get('priority')}")
            print(f"   状态: {'激活' if result.get('is_active') else '未激活'}")
            return True
        else:
            print(f"❌ 创建失败: HTTP {response.status_code}")
            try:
                error_data = response.json()
                print(f"   错误信息: {error_data.get('detail', 'Unknown error')}")
            except:
                print(f"   响应内容: {response.text[:200]}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ 请求失败: {e}")
        return False
    except Exception as e:
        print(f"❌ 发生错误: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == '__main__':
    print("=" * 60)
    print("创建积分系统公告")
    print("=" * 60)
    print()
    
    success = create_announcement()
    
    print()
    if success:
        print("✨ 完成！公告已创建并设置为最高优先级（长期置顶）")
    else:
        print("⚠️  创建失败，请检查:")
        print("   1. 后端服务是否运行 (http://localhost:8000)")
        print("   2. 是否设置了正确的 ADMIN_ID 和 ADMIN_EMAIL")
        print("   3. 或者通过管理后台手动创建公告")
    
    sys.exit(0 if success else 1)

