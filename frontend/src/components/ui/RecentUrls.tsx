import React, { useState, useEffect } from 'react';
import { Clock, X } from 'lucide-react';
import { storage } from '../../utils/storage';
import '../../assets/css/ui/RecentUrls.css';

interface RecentUrlsProps {
  onSelectUrl: (url: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function RecentUrls({ onSelectUrl, isOpen, onClose }: RecentUrlsProps) {
  const [recentUrls, setRecentUrls] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setRecentUrls(storage.getRecentUrls());
    }
  }, [isOpen]);

  const handleRemove = (url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = recentUrls.filter(u => u !== url);
    setRecentUrls(updated);
    // Update localStorage
    localStorage.setItem('modify_style_recent_urls', JSON.stringify(updated));
  };

  if (!isOpen) return null;

  return (
    <div className="recent-urls-dropdown">
      <div className="recent-urls-header">
        <Clock size={16} />
        <span>Recent URLs</span>
        <button className="recent-urls-close" onClick={onClose}>
          <X size={14} />
        </button>
      </div>
      <div className="recent-urls-list">
        {recentUrls.length === 0 ? (
          <div className="recent-urls-empty">No recent URLs</div>
        ) : (
          recentUrls.map((url, index) => (
            <div
              key={index}
              className="recent-url-item"
              onClick={() => {
                onSelectUrl(url);
                onClose();
              }}
            >
              <span className="recent-url-text">{url}</span>
              <button
                className="recent-url-remove"
                onClick={(e) => handleRemove(url, e)}
                title="Remove"
              >
                <X size={12} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
