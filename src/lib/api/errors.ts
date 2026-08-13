// 错误码 → 文案映射（契约 §2）。UI 层按 code 映射，message 仅作 fallback。

export const ERROR_MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: '请先登录',
  FORBIDDEN: '无权操作',
  NOT_FOUND: '内容不存在或已下架',
  VALIDATION: '参数有误，请检查后重试',
  CONFLICT: '操作冲突，请刷新后重试',
  RATE_LIMITED: '操作太频繁，请稍后再试',
  NOT_EDU: '请使用 .edu.cn 教育邮箱注册',
  CODE_INVALID: '验证码错误',
  CODE_EXPIRED: '验证码已过期，请重新获取',
  EMAIL_TAKEN: '该邮箱已注册',
  USERNAME_TAKEN: '用户名已被占用',
  INVALID_CREDENTIAL: '邮箱或密码错误',
  ALREADY_CREATOR: '你已是创作者',
  NO_RATING_ACCESS: '只有下载或购买过的同学才能评价',
  ALREADY_RATED: '你已经评价过这个作品了',
  PAYMENT_REQUIRED: '该作品需付费后才能下载',
  ORDER_CLOSED: '订单已关闭或过期，请重新下单',
  INSUFFICIENT_BALANCE: '可提现余额不足',
  COPYRIGHT_REQUIRED: '请勾选原创/授权声明',
  FILE_TOO_LARGE: '文件超出 200MB 上限',
  FILE_TYPE_DENIED: '不支持该文件类型',
  BAD_FILE: '文件未上传成功，请重新上传',
  INTERNAL: '服务开小差了，请稍后再试',
};

export function messageFor(code: string): string {
  return ERROR_MESSAGES[code] ?? '请求失败，请稍后再试';
}
