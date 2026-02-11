import { useEffect, useState } from 'react';

const DISPLAY_DURATION = 3000;
const FADEOUT_DURATION = 400;

interface StatusMessageProps {
  message: string;
  onDismiss: () => void;
}

export const StatusMessage = ({ message, onDismiss }: StatusMessageProps) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!message) {
      setVisible(false);
      return;
    }

    setVisible(true);
    const fadeTimer = setTimeout(() => setVisible(false), DISPLAY_DURATION);
    const dismissTimer = setTimeout(onDismiss, DISPLAY_DURATION + FADEOUT_DURATION);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(dismissTimer);
    };
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div
      className={`status-float ${visible ? 'status-float-in' : 'status-float-out'}`}
      role="status"
    >
      {message}
    </div>
  );
};
