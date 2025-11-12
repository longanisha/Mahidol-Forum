#!/usr/bin/env python3
"""
创建或重置 admin 账户的脚本
用法: python create_admin.py
"""
import os
import sys
from dotenv import load_dotenv
from supabase import create_client, Client
import bcrypt

# 加载环境变量
load_dotenv()

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("❌ 错误: 请确保 .env 文件中设置了 SUPABASE_URL 和 SUPABASE_SERVICE_KEY")
    sys.exit(1)

# 创建 Supabase 客户端
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def get_password_hash(password: str) -> str:
    """生成密码哈希（与 admin_auth.py 中的方法一致）"""
    password_bytes = password.encode('utf-8')
    if len(password_bytes) > 72:
        password_bytes = password_bytes[:72]
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')

def create_or_reset_admin(email: str, password: str, username: str = None):
    """创建或重置 admin 账户"""
    print(f"\n🔍 检查账户: {email}")
    
    # 检查账户是否已存在
    check_response = (
        supabase.table('admins')
        .select('id, email, username')
        .eq('email', email)
        .execute()
    )
    
    if check_response.data and len(check_response.data) > 0:
        # 账户已存在，更新密码
        admin_id = check_response.data[0]['id']
        print(f"✅ 账户已存在 (ID: {admin_id})")
        print(f"🔄 正在重置密码...")
        
        password_hash = get_password_hash(password)
        update_data = {
            'password_hash': password_hash,
            'is_active': True
        }
        if username:
            update_data['username'] = username
        
        update_response = (
            supabase.table('admins')
            .update(update_data)
            .eq('id', admin_id)
            .execute()
        )
        
        if hasattr(update_response, 'error') and update_response.error:
            print(f"❌ 更新失败: {update_response.error}")
            return False
        
        print(f"✅ 密码已重置成功！")
        print(f"\n📋 账户信息:")
        print(f"   Email: {email}")
        print(f"   Password: {password}")
        if username:
            print(f"   Username: {username}")
        return True
    else:
        # 账户不存在，创建新账户
        print(f"📝 账户不存在，正在创建新账户...")
        
        password_hash = get_password_hash(password)
        insert_data = {
            'email': email,
            'password_hash': password_hash,
            'is_active': True
        }
        if username:
            insert_data['username'] = username
        
        insert_response = (
            supabase.table('admins')
            .insert(insert_data)
            .execute()
        )
        
        if hasattr(insert_response, 'error') and insert_response.error:
            print(f"❌ 创建失败: {insert_response.error}")
            return False
        
        print(f"✅ 账户创建成功！")
        print(f"\n📋 账户信息:")
        print(f"   Email: {email}")
        print(f"   Password: {password}")
        if username:
            print(f"   Username: {username}")
        return True

if __name__ == '__main__':
    print("=" * 50)
    print("Admin 账户创建/重置工具")
    print("=" * 50)
    
    # 默认值
    email = 'admin@mahidol.ac.th'
    password = 'admin123'  # 默认密码，建议修改
    username = 'admin'
    
    # 可以从命令行参数获取
    if len(sys.argv) > 1:
        email = sys.argv[1]
    if len(sys.argv) > 2:
        password = sys.argv[2]
    if len(sys.argv) > 3:
        username = sys.argv[3]
    
    print(f"\n📧 Email: {email}")
    print(f"🔑 Password: {password}")
    print(f"👤 Username: {username}")
    
    confirm = input("\n是否继续? (y/n): ")
    if confirm.lower() != 'y':
        print("❌ 已Cancel")
        sys.exit(0)
    
    success = create_or_reset_admin(email, password, username)
    
    if success:
        print(f"\n✅ 完成！现在可以使用以下信息登录:")
        print(f"   URL: http://localhost:5173/admin/login")
        print(f"   Email: {email}")
        print(f"   Password: {password}")
    else:
        print(f"\n❌ 操作失败")
        sys.exit(1)

