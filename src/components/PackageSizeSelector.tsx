'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronDown, Check } from 'lucide-react';
import { PACKAGE_SIZE_OPTIONS, PackageSizeOption } from '@/lib/packageSizes';

interface PackageSizeSelectorProps {
  selectedCode?: string;
  onSelect: (tier: PackageSizeOption) => void;
  title?: string;
  subtitle?: string;
  error?: string;
  compact?: boolean;
  required?: boolean;
}

export default function PackageSizeSelector({
  selectedCode,
  onSelect,
  title = 'Package Size *',
  subtitle,
  error,
}: PackageSizeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const selectedOption = PACKAGE_SIZE_OPTIONS.find(t => t.code === selectedCode);

  const handleSelectTier = (tier: PackageSizeOption) => {
    onSelect(tier);
    setIsOpen(false);
  };

  const modalContent = isOpen ? (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      onClick={() => setIsOpen(false)}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 20,
          width: '100%',
          maxWidth: 680,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.3)',
          overflow: 'hidden',
          animation: 'fadeIn 0.15s ease-out',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header - Bigger & More Visible */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 26px',
            borderBottom: '1px solid #e2e8f0',
            background: '#ffffff',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a' }}>
              Select Package Size
            </h3>
            <p style={{ margin: '3px 0 0', fontSize: 13.5, color: '#64748b' }}>
              Choose a standard package size tier. Dimensions will be applied automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: 10,
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#e2e8f0';
              e.currentTarget.style.color = '#0f172a';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '#f1f5f9';
              e.currentTarget.style.color = '#64748b';
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Tiers List - Larger, High Visibility Cards */}
        <div style={{ padding: '16px 22px', overflowY: 'auto', display: 'grid', gap: 10 }}>
          {PACKAGE_SIZE_OPTIONS.map(tier => {
            const isSelected = selectedCode === tier.code;

            return (
              <div
                key={tier.code}
                onClick={() => handleSelectTier(tier)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                  borderRadius: 12,
                  border: isSelected ? `2.5px solid ${tier.activeBorder}` : '1.5px solid #e2e8f0',
                  background: isSelected ? tier.activeBg : '#fff',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease-in-out',
                  boxShadow: isSelected ? `0 4px 12px ${tier.border}` : '0 1px 3px rgba(0,0,0,0.02)',
                }}
                onMouseEnter={e => {
                  if (!isSelected) {
                    e.currentTarget.style.background = '#f8fafc';
                    e.currentTarget.style.borderColor = '#cbd5e1';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={e => {
                  if (!isSelected) {
                    e.currentTarget.style.background = '#fff';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      background: tier.bg,
                      color: tier.color,
                      border: `1.5px solid ${tier.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                      flexShrink: 0,
                    }}
                  >
                    📦
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: 16,
                          fontWeight: 800,
                          color: isSelected ? tier.color : '#0f172a',
                        }}
                      >
                        {tier.name}
                      </span>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: '#1e293b',
                          background: isSelected ? '#ffffff' : '#f1f5f9',
                          border: isSelected ? `1px solid ${tier.border}` : '1px solid #e2e8f0',
                          padding: '2px 8px',
                          borderRadius: 6,
                        }}
                      >
                        {tier.shortRangeLabel || tier.rangeLabel}
                      </span>
                    </div>

                    <div style={{ fontSize: 13, color: '#475569', marginTop: 3, fontWeight: 500 }}>
                      {tier.description}
                    </div>
                  </div>
                </div>

                <div style={{ paddingLeft: 12, flexShrink: 0 }}>
                  {isSelected ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 13,
                        fontWeight: 800,
                        color: '#fff',
                        background: tier.color,
                        padding: '6px 14px',
                        borderRadius: 20,
                        boxShadow: `0 2px 6px ${tier.border}`,
                      }}
                    >
                      <Check size={14} strokeWidth={3} /> Selected
                    </span>
                  ) : (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        fontSize: 13,
                        fontWeight: 700,
                        color: '#475569',
                        background: '#f8fafc',
                        border: '1.5px solid #cbd5e1',
                        padding: '6px 14px',
                        borderRadius: 8,
                      }}
                    >
                      Select
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '14px 22px',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            justifyContent: 'flex-end',
            background: '#f8fafc',
          }}
        >
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            style={{
              padding: '10px 20px',
              border: '1.5px solid #cbd5e1',
              borderRadius: 8,
              background: '#fff',
              fontSize: 13.5,
              fontWeight: 700,
              color: '#475569',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#f1f5f9';
              e.currentTarget.style.color = '#0f172a';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '#fff';
              e.currentTarget.style.color = '#475569';
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div style={{ width: '100%', marginTop: 6, marginBottom: 6 }}>
      {/* Label & Error Row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 6,
        }}
      >
        <label
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: '#334155',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          📦 {title}
          {subtitle && (
            <span style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8', textTransform: 'none' }}>
              ({subtitle})
            </span>
          )}
        </label>
        {error && (
          <span
            style={{
              color: '#dc2626',
              fontSize: 12,
              fontWeight: 700,
              background: '#fef2f2',
              padding: '3px 10px',
              borderRadius: 6,
              border: '1px solid #fecdd3',
            }}
          >
            {error}
          </span>
        )}
      </div>

      {/* Clickable Field Trigger - Bigger & More Visible */}
      <div
        onClick={() => setIsOpen(true)}
        style={{
          width: '100%',
          minHeight: 48,
          padding: '10px 16px',
          background: selectedOption ? selectedOption.bg : '#fff',
          border: `1.5px solid ${error ? '#ef4444' : selectedOption ? selectedOption.border : '#cbd5e1'}`,
          borderRadius: 10,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
          boxSizing: 'border-box',
          transition: 'all 0.15s ease',
          boxShadow: '0 1px 3px rgba(15,23,42,0.03)',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = selectedOption ? selectedOption.activeBorder : '#94a3b8';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = error ? '#ef4444' : selectedOption ? selectedOption.border : '#cbd5e1';
        }}
      >
        {selectedOption ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flex: 1 }}>
            <span
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: selectedOption.color,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: '#fff',
                padding: '3px 10px',
                borderRadius: 6,
                border: `1px solid ${selectedOption.border}`,
              }}
            >
              📦 {selectedOption.name}
            </span>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a' }}>
              {selectedOption.rangeLabel}
            </span>
            <span style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>
              — {selectedOption.description}
            </span>
          </div>
        ) : (
          <span style={{ fontSize: 14, color: '#94a3b8', fontWeight: 500 }}>
            Click to select package size (e.g. Small, Med, Large, XL...)
          </span>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              color: selectedOption ? selectedOption.color : '#4f46e5',
              background: '#fff',
              border: '1px solid #cbd5e1',
              padding: '5px 12px',
              borderRadius: 6,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            }}
          >
            {selectedOption ? 'Change' : 'Select'} <ChevronDown size={14} />
          </span>
        </div>
      </div>

      {/* Render Modal via Portal */}
      {mounted && typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent}
    </div>
  );
}
