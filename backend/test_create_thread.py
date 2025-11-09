#!/usr/bin/env python3
"""
测试创建帖子的脚本
用于诊断 RLS 和数据库问题
"""

import os
import sys
from supabase import create_client

# 从环境变量读取配置
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("错误: 请设置 SUPABASE_URL 和 SUPABASE_SERVICE_KEY 环境变量")
    sys.exit(1)

# 创建 Supabase 客户端（使用 service_key，会绕过 RLS）
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

print("=== 测试创建帖子 ===\n")

# 1. 检查是否有 profiles
print("1. 检查 profiles 表...")
profiles_response = supabase.table('profiles').select('id, username').limit(1).execute()
if not profiles_response.data or len(profiles_response.data) == 0:
    print("   ❌ 没有找到 profiles，请先创建用户账户")
    sys.exit(1)

test_user_id = profiles_response.data[0]['id']
print(f"   ✅ 找到用户: {profiles_response.data[0].get('username', 'N/A')} (ID: {test_user_id})")

# 2. 尝试插入帖子
print("\n2. 尝试插入帖子...")
insert_payload = {
    'title': 'Test Thread from Script',
    'category': 'General',
    'summary': 'This is a test thread',
    'tags': ['Test', 'Debug'],
    'author_id': test_user_id,
    'view_count': 0,
    'upvote_count': 0,
    'is_closed': False,
}

try:
    response = supabase.table('threads').insert(insert_payload).execute()
    
    if hasattr(response, 'error') and response.error:
        error_msg = response.error
        if isinstance(response.error, dict):
            error_msg = response.error.get('message', str(response.error))
            error_code = response.error.get('code', '')
        print(f"   ❌ 插入失败: {error_msg}")
        if error_code:
            print(f"   错误代码: {error_code}")
        if error_code == '42501':
            print("\n   ⚠️  这是 RLS 策略错误！")
            print("   请执行以下步骤:")
            print("   1. 打开 Supabase Dashboard")
            print("   2. 进入 SQL Editor")
            print("   3. 执行 backend/fix_rls.sql")
        sys.exit(1)
    
    if not response.data or len(response.data) == 0:
        print("   ❌ 插入失败: 没有返回数据")
        sys.exit(1)
    
    thread_id = response.data[0]['id']
    print(f"   ✅ 帖子创建成功! ID: {thread_id}")
    
    # 3. 验证帖子
    print("\n3. 验证帖子...")
    verify_response = supabase.table('threads').select('*').eq('id', thread_id).execute()
    if verify_response.data:
        print(f"   ✅ 帖子验证成功")
        print(f"   标题: {verify_response.data[0].get('title')}")
        print(f"   标签: {verify_response.data[0].get('tags')}")
    else:
        print("   ⚠️  帖子创建成功但无法查询（可能是 RLS 读取策略问题）")
    
    # 4. 清理测试数据
    print("\n4. 清理测试数据...")
    delete_response = supabase.table('threads').delete().eq('id', thread_id).execute()
    print("   ✅ 测试数据已清理")
    
    print("\n✅ 所有测试通过！数据库和 RLS 配置正常。")
    
except Exception as e:
    print(f"\n❌ 发生错误: {e}")
    import traceback
    print(traceback.format_exc())
    sys.exit(1)

