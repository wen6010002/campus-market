// Next 服务端启动钩子（Next 14 需 next.config.mjs experimental.instrumentationHook）。
// 生产环境变量自检在这里触发——app 容器（next start / standalone server.js）启动即校验。
// 双重 guard 是生死线：
//  - NEXT_PHASE=phase-production-build：next build 阶段（docker build 内无任何 env，
//    且 NODE_ENV 已被置为 production），绝不能执行校验，否则构建直接挂；
//  - NEXT_RUNTIME=edge：edge 运行时无 node env，跳过。
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  const { assertProdEnv } = await import('./server/lib/env');
  assertProdEnv();
}
