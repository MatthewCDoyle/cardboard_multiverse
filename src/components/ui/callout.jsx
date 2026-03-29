import React from 'react';

const typeStyles = {
  info: {
    border: '#2563eb',
    background: '#eff6ff',
    title: 'INFO'
  },
  warning: {
    border: '#d97706',
    background: '#fffbeb',
    title: 'WARNING'
  },
  error: {
    border: '#dc2626',
    background: '#fef2f2',
    title: 'ERROR'
  },
  tip: {
    border: '#059669',
    background: '#ecfdf5',
    title: 'TIP'
  }
};

export function Callout({ type = 'info', children }) {
  const style = typeStyles[type] || typeStyles.info;

  return (
    <div
      style={{
        borderLeft: `4px solid ${style.border}`,
        background: style.background,
        padding: '0.75rem 1rem',
        borderRadius: '6px',
        margin: '1rem 0'
      }}
    >
      <div
        style={{
          fontSize: '0.75rem',
          fontWeight: 700,
          letterSpacing: '0.04em',
          marginBottom: '0.25rem',
          color: style.border
        }}
      >
        {style.title}
      </div>
      <div>{children}</div>
    </div>
  );
}

export default Callout;