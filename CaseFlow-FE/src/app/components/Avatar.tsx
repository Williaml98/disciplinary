import { useState } from 'react';
import type { AppUser } from './mockData';

const NAVY = '#1D3A5F';

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map(part => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

interface Props {
  user: Pick<AppUser, 'name' | 'profilePictureUrl'>;
  size?: number;
  /** Use on the navy sidebar, where a solid navy initials circle would disappear. */
  variant?: 'solid' | 'translucent';
  className?: string;
}

/**
 * User avatar with an initials fallback.
 *
 * The image is loaded as a plain <img> against the backend's unauthenticated picture endpoint, so a
 * broken or deleted file would otherwise render as the browser's broken-image glyph. onError falls
 * back to the initials instead, which is indistinguishable from a user who never set a picture.
 */
export function Avatar({ user, size = 32, variant = 'solid', className = '' }: Props) {
  const [failed, setFailed] = useState(false);
  const showImage = !!user.profilePictureUrl && !failed;

  const style = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.36)) };

  if (showImage) {
    return (
      <img
        src={user.profilePictureUrl}
        alt={user.name}
        onError={() => setFailed(true)}
        style={style}
        className={`rounded-full object-cover shrink-0 bg-gray-100 ${className}`}
      />
    );
  }

  return (
    <div
      aria-label={user.name}
      style={{ ...style, backgroundColor: variant === 'solid' ? NAVY : 'rgba(255,255,255,0.2)' }}
      className={`rounded-full flex items-center justify-center text-white font-bold shrink-0 ${className}`}
    >
      {initials(user.name)}
    </div>
  );
}
