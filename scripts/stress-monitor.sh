#!/bin/sh
# 压测期间资源采样：每 5s 记录容器 CPU/内存 + 系统负载。
# 用法（服务器上）：sh /tmp/cm-stress-monitor.sh 120   # 采样 120 秒
# app 为多副本（replicas）时容器名动态生成，按名称正则自动发现。
DUR=${1:-60}
END=$(( $(date +%s) + DUR ))
echo "time cpu% mem app*|pg|redis|pgb|caddy loadavg"
while [ "$(date +%s)" -lt "$END" ]; do
  NAMES=$(docker ps --format '{{.Names}}' | grep -E '^docker-app-|^cm-postgres$|^cm-redis$|^cm-pgbouncer$|^cm-caddy$' | tr '\n' ' ')
  S=$(docker stats --no-stream --format '{{.Name}} {{.CPUPerc}} {{.MemUsage}}' $NAMES 2>/dev/null | tr '\n' '|' | sed 's/ | /|/g; s/  */ /g')
  L=$(cat /proc/loadavg | cut -d' ' -f1-3)
  echo "$(date +%H:%M:%S) $S load=$L"
  sleep 5
done
