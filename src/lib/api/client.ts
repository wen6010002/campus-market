// 统一 API 客户端 —— 契约见 docs/API_CONTRACT.md §0.2 / §0.3
// 同源调用 /api/v1，cookie 自动携带；错误统一抛 ApiError，UI 按 code 映射文案。

export class ApiError extends Error {
  constructor(
    public code: string,
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  });

  const text = await res.text();
  const json = text ? safeParse(text) : null;

  if (!res.ok) {
    throw new ApiError(
      json?.error?.code ?? 'INTERNAL',
      res.status,
      json?.error?.message ?? '请求失败',
      json?.error?.details,
    );
  }
  return json?.data as T;
}

function safeParse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** 仅用于文件直传（二进制 PUT 到 presigned URL），不走 /api/v1 */
export async function uploadFile(url: string, file: File, onProgress?: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`上传失败 ${xhr.status}`));
    xhr.onerror = () => reject(new Error('网络错误'));
    xhr.send(file);
  });
}
