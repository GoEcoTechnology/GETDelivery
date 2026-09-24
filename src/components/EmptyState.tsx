'use client';
import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionButton?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, actionButton }: EmptyStateProps) {
  return (
    <div style={{ 
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center', 
      padding: '64px 32px', 
      background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.02) 0%, rgba(147, 51, 234, 0.04) 100%)', 
      borderRadius: '24px', 
      border: '1px solid rgba(79, 70, 229, 0.1)',
      boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.5), 0 20px 25px -5px rgba(0, 0, 0, 0.02)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <style>{`
        @keyframes floating {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(2deg); }
          100% { transform: translateY(0px) rotate(0deg); }
        }
        @keyframes pulse-glow {
          0% { box-shadow: 0 10px 25px -5px rgba(79, 70, 229, 0.3), inset 0 2px 4px rgba(255,255,255,0.3); }
          50% { box-shadow: 0 15px 35px -5px rgba(79, 70, 229, 0.5), inset 0 2px 4px rgba(255,255,255,0.4); }
          100% { box-shadow: 0 10px 25px -5px rgba(79, 70, 229, 0.3), inset 0 2px 4px rgba(255,255,255,0.3); }
        }
      `}</style>
      <div style={{
        width: '80px',
        height: '80px',
        borderRadius: '24px',
        background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 24px',
        animation: 'floating 4s ease-in-out infinite, pulse-glow 4s ease-in-out infinite'
      }}>
        <Icon size={36} color="white" strokeWidth={1.5} />
      </div>
      <h3 style={{ margin: '0 0 12px 0', color: '#0f172a', fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em', textAlign: 'center', textTransform: 'none' }}>
        {title}
      </h3>
      <p style={{ color: '#475569', margin: '0 auto', maxWidth: '420px', fontSize: '15px', lineHeight: 1.6, fontWeight: 500, textAlign: 'center' }}>
        {description}
      </p>
      {actionButton && (
        <div style={{ marginTop: '24px' }}>
          {actionButton}
        </div>
      )}
    </div>
  );
}
