import * as React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
}

export function Button({ label, ...props }: ButtonProps) {
  return (
    <button
      style={{
        padding: '8px 16px',
        backgroundColor: '#0070f3',
        color: '#white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
      }}
      {...props}
    >
      {label}
    </button>
  );
}
