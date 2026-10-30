import React from 'react';
import { getNameInitial, getAvatarColor } from '../utils/imageUtils';

/**
 * Reusable LetterAvatar component for Category / Product when no image is uploaded.
 */
export const LetterAvatar = ({ name, size = 48, className = '', rounded = 'rounded-xl', textClassName = '' }) => {
  const initial = getNameInitial(name);
  const color = getAvatarColor(name);

  return (
    <div 
      className={`flex items-center justify-center font-bold select-none shrink-0 shadow-2xs ${rounded} ${className}`}
      style={{
        width: typeof size === 'number' ? `${size}px` : size,
        height: typeof size === 'number' ? `${size}px` : size,
        backgroundColor: color.bg,
        color: color.text,
      }}
    >
      <span className={textClassName || 'text-base font-extrabold leading-none'}>
        {initial}
      </span>
    </div>
  );
};

export default LetterAvatar;
