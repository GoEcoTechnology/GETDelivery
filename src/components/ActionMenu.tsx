'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';
import styles from './ActionMenu.module.css';

interface ActionItem {
  label: React.ReactNode;
  icon?: React.ReactNode;
  onClick: () => void;
  color?: string;
  disabled?: boolean;
}

interface Props {
  actions: ActionItem[];
}

export function ActionMenu({ actions }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node) && 
          triggerRef.current && !triggerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    const handleScroll = () => {
      if (isOpen) setIsOpen(false); // close on scroll to avoid floating menu detachment
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen]);

  const toggleMenu = useCallback((e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom,
        left: rect.right,
        width: rect.width
      });
    }
    setIsOpen(!isOpen);
  }, [isOpen]);

  return (
    <div className={styles.container}>
      <button 
        ref={triggerRef}
        className={`${styles.trigger} ${isOpen ? styles.active : ''}`}
        onClick={toggleMenu}
        aria-label="Actions"
      >
        <MoreHorizontal size={16} />
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div 
          ref={menuRef}
          className={styles.menu} 
          style={{ 
            position: 'fixed', 
            top: position.top, 
            left: position.left, 
            transform: 'translateX(-100%)', 
            zIndex: 9999 
          }}
        >
          {actions.map((action, i) => (
            <button
              key={i}
              className={styles.menuItem}
              onClick={(e) => {
                e.stopPropagation();
                if (!action.disabled) {
                  action.onClick();
                  setIsOpen(false);
                }
              }}
              style={{ color: action.color || '#475569' }}
              disabled={action.disabled}
            >
              {action.icon && <span className={styles.icon}>{action.icon}</span>}
              {action.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
