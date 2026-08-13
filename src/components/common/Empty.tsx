interface EmptyProps {
  icon?: string;
  title: string;
  desc?: string;
  action?: React.ReactNode;
}

/** 空态（对应原型 .empty） */
export function Empty({ icon = '🗂️', title, desc, action }: EmptyProps) {
  return (
    <div className="empty">
      <div className="e-ic">{icon}</div>
      <div className="e-title">{title}</div>
      {desc ? <div className="e-desc">{desc}</div> : null}
      {action}
    </div>
  );
}
