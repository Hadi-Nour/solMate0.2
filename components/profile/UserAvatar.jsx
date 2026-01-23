'use client';

// Avatar display component with emoji mapping
const AVATAR_EMOJIS = {
  default: '👤',
  pawn: '♟️',
  knight: '♞',
  bishop: '♝',
  rook: '♜',
  queen: '♛',
  king: '♚',
  grandmaster: '🏆',
};

const SIZE_CLASSES = {
  xs: 'w-6 h-6 text-sm',
  sm: 'w-8 h-8 text-lg',
  md: 'w-10 h-10 text-xl',
  lg: 'w-14 h-14 text-2xl',
  xl: 'w-20 h-20 text-4xl',
};

export default function UserAvatar({ 
  avatarId = 'default', 
  size = 'md',
  className = '',
  showBorder = true
}) {
  const emoji = AVATAR_EMOJIS[avatarId] || AVATAR_EMOJIS.default;
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  
  return (
    <div 
      className={`
        rounded-full bg-secondary flex items-center justify-center
        ${showBorder ? 'border-2 border-primary/30' : ''}
        ${sizeClass}
        ${className}
      `}
    >
      {emoji}
    </div>
  );
}

// Helper to get avatar emoji by ID
export function getAvatarEmoji(avatarId) {
  return AVATAR_EMOJIS[avatarId] || AVATAR_EMOJIS.default;
}

// Export avatar data for other components
export { AVATAR_EMOJIS };
