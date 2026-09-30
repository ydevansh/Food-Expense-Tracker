import React, { useEffect } from 'react';

export default function Toast({ msg, type = 'success' }) {
  return (
    <div className={`toast show ${type}`}>
      {type === 'success' && '✅ '}
      {type === 'error'   && '❌ '}
      {msg}
    </div>
  );
}
