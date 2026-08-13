interface StatCardProps {
  label: string;
  value: React.ReactNode;
  delta?: string;
  icon?: string;
  tone?: 'pri' | 'mint' | 'fine' | 'default';
}

/** 数据大卡（对应原型 .stat-card：.lb / .v / .delta / .ic） */
export function StatCard({ label, value, delta, icon, tone = 'default' }: StatCardProps) {
  return (
    <div className={`stat-card ${tone !== 'default' ? `tone-${tone}` : ''}`}>
      <div className="lb">
        {label}
        {icon ? <span className="ic">{icon}</span> : null}
      </div>
      <div className="v">{value}</div>
      {delta ? <div className="delta">{delta}</div> : null}
    </div>
  );
}
