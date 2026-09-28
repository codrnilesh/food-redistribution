import React from 'react';

export default function ErrorBox({ message }) {
  if (!message || (typeof message === 'string' && !message.trim())) {
    return null;
  }

  return (
    <div className="error-box" role="alert">
      {message}
    </div>
  );
}
