'use client';

interface Step {
  label: string;
  desc?: string;
}

interface StepperProps {
  steps: Step[];
  current: number; // 0-based
}

/** 步骤条（对应原型 .stepper，用于发布 5 步流程） */
export function Stepper({ steps, current }: StepperProps) {
  return (
    <div className="stepper">
      {steps.map((s, i) => (
        <div key={i} className={`step ${i < current ? 'done' : i === current ? 'active' : ''}`}>
          <div className="step-dot">{i < current ? '✓' : i + 1}</div>
          <div className="step-label">
            <b>{s.label}</b>
            {s.desc ? <span>{s.desc}</span> : null}
          </div>
          {i < steps.length - 1 ? <div className="step-line" /> : null}
        </div>
      ))}
    </div>
  );
}
