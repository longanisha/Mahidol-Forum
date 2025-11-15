/**
 * 标签翻译工具
 * 将常见的英文标签翻译成不同语言
 */

// 常见标签的翻译映射
const TAG_TRANSLATIONS: Record<string, Record<string, string>> = {
  // 学术相关
  'Academic': {
    en: 'Academic',
    zh: '学术',
    th: 'วิชาการ',
  },
  'Research': {
    en: 'Research',
    zh: '研究',
    th: 'วิจัย',
  },
  'Study': {
    en: 'Study',
    zh: '学习',
    th: 'การศึกษา',
  },
  'Course': {
    en: 'Course',
    zh: '课程',
    th: 'หลักสูตร',
  },
  'Exam': {
    en: 'Exam',
    zh: '考试',
    th: 'สอบ',
  },
  'Assignment': {
    en: 'Assignment',
    zh: '作业',
    th: 'งานมอบหมาย',
  },
  'Graduate': {
    en: 'Graduate',
    zh: '研究生',
    th: 'บัณฑิต',
  },
  'Undergraduate': {
    en: 'Undergraduate',
    zh: '本科生',
    th: 'ปริญญาตรี',
  },
  
  // 生活相关
  'General': {
    en: 'General',
    zh: '一般',
    th: 'ทั่วไป',
  },
  'Life': {
    en: 'Life',
    zh: '生活',
    th: 'ชีวิต',
  },
  'Campus': {
    en: 'Campus',
    zh: '校园',
    th: 'วิทยาเขต',
  },
  'Dormitory': {
    en: 'Dormitory',
    zh: '宿舍',
    th: 'หอพัก',
  },
  'Food': {
    en: 'Food',
    zh: '美食',
    th: 'อาหาร',
  },
  'Transportation': {
    en: 'Transportation',
    zh: '交通',
    th: 'การขนส่ง',
  },
  
  // 活动相关
  'Event': {
    en: 'Event',
    zh: '活动',
    th: 'กิจกรรม',
  },
  'Activities': {
    en: 'Activities',
    zh: '活动',
    th: 'กิจกรรม',
  },
  'Club': {
    en: 'Club',
    zh: '社团',
    th: 'ชมรม',
  },
  'Sports': {
    en: 'Sports',
    zh: '运动',
    th: 'กีฬา',
  },
  'Volunteer': {
    en: 'Volunteer',
    zh: '志愿者',
    th: 'อาสาสมัคร',
  },
  
  // 职业相关
  'Career': {
    en: 'Career',
    zh: '职业',
    th: 'อาชีพ',
  },
  'Job': {
    en: 'Job',
    zh: '工作',
    th: 'งาน',
  },
  'Internship': {
    en: 'Internship',
    zh: '实习',
    th: 'ฝึกงาน',
  },
  'Interview': {
    en: 'Interview',
    zh: '面试',
    th: 'สัมภาษณ์',
  },
  
  // 技术相关
  'Technology': {
    en: 'Technology',
    zh: '技术',
    th: 'เทคโนโลยี',
  },
  'Programming': {
    en: 'Programming',
    zh: '编程',
    th: 'การเขียนโปรแกรม',
  },
  'IT': {
    en: 'IT',
    zh: '信息技术',
    th: 'เทคโนโลยีสารสนเทศ',
  },
  
  // 健康相关
  'Health': {
    en: 'Health',
    zh: '健康',
    th: 'สุขภาพ',
  },
  'Medical': {
    en: 'Medical',
    zh: '医疗',
    th: 'การแพทย์',
  },
  'Wellness': {
    en: 'Wellness',
    zh: '健康',
    th: 'สุขภาพ',
  },
  
  // 其他
  'Question': {
    en: 'Question',
    zh: '问题',
    th: 'คำถาม',
  },
  'Help': {
    en: 'Help',
    zh: '帮助',
    th: 'ช่วยเหลือ',
  },
  'Advice': {
    en: 'Advice',
    zh: '建议',
    th: 'คำแนะนำ',
  },
  'Discussion': {
    en: 'Discussion',
    zh: '讨论',
    th: 'การสนทนา',
  },
  'Announcement': {
    en: 'Announcement',
    zh: '公告',
    th: 'ประกาศ',
  },
  'News': {
    en: 'News',
    zh: '新闻',
    th: 'ข่าว',
  },
  'Update': {
    en: 'Update',
    zh: '更新',
    th: 'อัปเดต',
  },
}

/**
 * 翻译标签
 * @param tag 原始标签（通常是英文）
 * @param language 目标语言 ('en' | 'zh' | 'th')
 * @returns 翻译后的标签，如果没有翻译则返回原始标签
 */
export function translateTag(tag: string, language: string = 'en'): string {
  if (!tag) return tag
  
  // 规范化标签（去除空格，首字母大写）
  const normalizedTag = tag.trim()
  const capitalizedTag = normalizedTag.charAt(0).toUpperCase() + normalizedTag.slice(1)
  
  // 查找翻译
  const translation = TAG_TRANSLATIONS[capitalizedTag] || TAG_TRANSLATIONS[normalizedTag]
  
  if (translation) {
    // 支持 'en', 'zh', 'th' 或 'en-US', 'zh-CN' 等格式
    const langCode = language.split('-')[0].toLowerCase()
    return translation[langCode] || translation.en || tag
  }
  
  // 如果没有找到翻译，返回原始标签
  return tag
}

/**
 * 批量翻译标签数组
 * @param tags 标签数组
 * @param language 目标语言
 * @returns 翻译后的标签数组
 */
export function translateTags(tags: string[], language: string = 'en'): string[] {
  return tags.map(tag => translateTag(tag, language))
}

