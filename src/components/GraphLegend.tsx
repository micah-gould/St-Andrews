import React from 'react';

export function GraphLegend() {
  return (
    <div className="legend">
      <span className="leg"><span className="dot" style={{ background: 'var(--c-1000)' }} />1000</span>
      <span className="leg"><span className="dot" style={{ background: 'var(--c-2000)' }} />2000</span>
      <span className="leg"><span className="dot" style={{ background: 'var(--c-3000)' }} />3000</span>
      <span className="leg"><span className="dot" style={{ background: 'var(--c-4000)' }} />4000</span>
      <span className="leg"><span className="dot" style={{ background: 'var(--c-5000)' }} />5000</span>
      <span className="leg"><span className="dot" style={{ background: 'var(--c-ext)' }} />Ext</span>
      <span className="divider" />
      <span className="leg"><span className="dot" style={{ background: 'var(--c-sel)' }} />Selected</span>
      <span className="leg"><span className="dot" style={{ background: 'var(--c-passed)' }} />Passed</span>
      <span className="leg"><span className="dot" style={{ background: 'var(--c-excl)' }} />Excluded</span>
      <span className="leg"><span className="dot" style={{ background: 'var(--c-hover-pre-required)' }} />Required prereq</span>
      <span className="leg"><span className="dot" style={{ background: 'var(--c-hover-pre-optional)' }} />Optional prereq</span>
      <span className="leg"><span className="dot" style={{ background: 'var(--c-hover-fwd)' }} />Hover unlocks</span>
      <span className="leg"><span className="dot" style={{ background: 'var(--c-sel-fwd)' }} />Selected unlocks</span>
    </div>
  );
}
