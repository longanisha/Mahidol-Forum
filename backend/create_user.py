#!/usr/bin/env python3
"""
创建普通用户账户的脚本（Supabase Auth）
用法: python create_user.py [email] [password]
"""
import os
import sys
import requests
from dotenv import load_dotenv
from supabase import create_client, Client

# 加载环境变量
load_dotenv()

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("❌ 错误: 请确保 .env 文件中设置了 SUPABASE_URL 和 SUPABASE_SERVICE_KEY")
    sys.exit(1)

# 创建 Supabase 客户端（用于数据库操作）
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def create_user(email: str, password: str):
    """创建普通用户账户（Supabase Auth）"""
    print(f"\n🔍 正在创建用户: {email}")
    
    try:
        # 使用 Supabase Admin API 创建用户（通过 REST API）
        # 注意：这需要使用 service role key
        auth_url = f"{SUPABASE_URL}/auth/v1/admin/users"
        
        headers = {
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "email": email,
            "password": password,
            "email_confirm": True,  # 自动确认邮箱，不需要验证
            "user_metadata": {}
        }
        
        print(f"📡 调用 Supabase Admin API...")
        response = requests.post(auth_url, json=payload, headers=headers)
        
        if response.status_code == 200:
            user_data = response.json()
            user_id = user_data.get('id')
            user_email = user_data.get('email')
            
            print(f"✅ 用户创建成功！")
            print(f"\n📋 账户信息:")
            print(f"   User ID: {user_id}")
            print(f"   Email: {user_email}")
            print(f"   Email Confirmed: {user_data.get('email_confirmed_at') is not None}")
            
            # 检查并创建 profile
            _ensure_profile(user_id, email)
            
            print(f"\n✅ 完成！现在可以使用以下信息登录:")
            print(f"   URL: http://localhost:5173/login")
            print(f"   Email: {email}")
            print(f"   Password: {password}")
            return True
        elif response.status_code == 422:
            # 用户已存在，尝试重置密码
            error_json = response.json()
            error_code = error_json.get('error_code', '')
            
            if error_code == 'email_exists':
                print(f"⚠️  用户已存在，正在重置密码...")
                
                # 先查找用户
                get_user_url = f"{SUPABASE_URL}/auth/v1/admin/users"
                headers = {
                    "apikey": SUPABASE_SERVICE_KEY,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                }
                
                # 通过邮箱查找用户
                search_response = requests.get(
                    f"{get_user_url}?email={email}",
                    headers=headers
                )
                
                if search_response.status_code == 200:
                    users = search_response.json().get('users', [])
                    if users:
                        user_id = users[0].get('id')
                        print(f"   找到用户 ID: {user_id}")
                        
                        # 更新密码
                        update_url = f"{get_user_url}/{user_id}"
                        update_payload = {
                            "password": password,
                            "email_confirm": True
                        }
                        
                        update_response = requests.put(
                            update_url,
                            json=update_payload,
                            headers={**headers, "Content-Type": "application/json"}
                        )
                        
                        if update_response.status_code == 200:
                            print(f"✅ 密码已重置成功！")
                            
                            # 检查并创建 profile
                            _ensure_profile(user_id, email)
                            
                            print(f"\n✅ 完成！现在可以使用以下信息登录:")
                            print(f"   URL: http://localhost:5173/login")
                            print(f"   Email: {email}")
                            print(f"   Password: {password}")
                            return True
                        else:
                            print(f"❌ 重置密码失败: {update_response.text}")
                            return False
                    else:
                        print(f"❌ 无法找到用户")
                        return False
                else:
                    print(f"❌ 查找用户失败: {search_response.text}")
                    return False
            else:
                print(f"❌ 创建失败: {error_json.get('msg', 'Unknown error')}")
                return False
        else:
            error_msg = response.text
            print(f"❌ 创建失败: HTTP {response.status_code}")
            print(f"   错误: {error_msg}")
            
            # 尝试解析错误信息
            try:
                error_json = response.json()
                if 'msg' in error_json:
                    print(f"   详情: {error_json['msg']}")
            except:
                pass
            
            return False
            
    except Exception as e:
        print(f"❌ 创建用户失败: {e}")
        import traceback
        print(traceback.format_exc())
        return False

def _ensure_profile(user_id: str, email: str):
    """确保用户 profile 存在"""
    print(f"\n🔍 检查 profile...")
    profile_check = (
        supabase.table('profiles')
        .select('id, username')
        .eq('id', user_id)
        .execute()
    )
    
    if profile_check.data and len(profile_check.data) > 0:
        profile = profile_check.data[0]
        print(f"✅ Profile 已存在")
        print(f"   Username: {profile.get('username', 'N/A')}")
    else:
        print(f"⚠️  Profile 不存在，正在创建...")
        # 创建 profile
        username = email.split('@')[0] if email else 'User'
        profile_insert = {
            'id': user_id,
            'username': username,
        }
        profile_response = supabase.table('profiles').insert(profile_insert).execute()
        
        if hasattr(profile_response, 'error') and profile_response.error:
            print(f"❌ 创建 profile 失败: {profile_response.error}")
        else:
            print(f"✅ Profile 创建成功")
            print(f"   Username: {username}")

if __name__ == '__main__':
    print("=" * 50)
    print("普通用户账户创建工具（Supabase Auth）")
    print("=" * 50)
    
    # 默认值
    email = 'aa@mahidol.ac.th'
    password = 'admin123'
    
    # 可以从命令行参数获取
    if len(sys.argv) > 1:
        email = sys.argv[1]
    if len(sys.argv) > 2:
        password = sys.argv[2]
    
    print(f"\n📧 Email: {email}")
    print(f"🔑 Password: {password}")
    
    confirm = input("\n是否继续? (y/n): ")
    if confirm.lower() != 'y':
        print("❌ 已取消")
        sys.exit(0)
    
    success = create_user(email, password)
    
    if not success:
        sys.exit(1)

