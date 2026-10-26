import L from 'leaflet';

/**
 * Robust Leaflet monkey-patch to prevent:
 * "TypeError: Cannot read properties of undefined (reading '_leaflet_pos')"
 * 
 * This error occurs in Leaflet / React-Leaflet when DOM elements (markers, popups,
 * tiles, or map panes) are detached, removed, or unmounted mid-animation (e.g. flyTo,
 * panTo, fitBounds, zoom animation, or React fast-refresh/unmount).
 */
export function patchLeaflet(leafletInstance: any = L) {
  if (typeof window === 'undefined' || !leafletInstance) return;

  // 1. Fix default marker icon URLs
  try {
    if (leafletInstance.Icon && leafletInstance.Icon.Default) {
      delete (leafletInstance.Icon.Default.prototype as any)._getIconUrl;
      leafletInstance.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
      });
    }
  } catch (err) {
    console.warn('[LeafletPatch] Icon setup warning:', err);
  }

  // 2. Safe DomUtil.getPosition & setPosition
  if (leafletInstance.DomUtil) {
    const origGetPosition = leafletInstance.DomUtil.getPosition;
    leafletInstance.DomUtil.getPosition = function (el: any) {
      if (!el) {
        return leafletInstance.point ? leafletInstance.point(0, 0) : new (leafletInstance.Point as any)(0, 0);
      }
      try {
        if (origGetPosition) {
          const res = origGetPosition.call(this, el);
          return res || (leafletInstance.point ? leafletInstance.point(0, 0) : new (leafletInstance.Point as any)(0, 0));
        }
        return el._leaflet_pos || (leafletInstance.point ? leafletInstance.point(0, 0) : new (leafletInstance.Point as any)(0, 0));
      } catch {
        return el._leaflet_pos || (leafletInstance.point ? leafletInstance.point(0, 0) : new (leafletInstance.Point as any)(0, 0));
      }
    };

    const origSetPosition = leafletInstance.DomUtil.setPosition;
    leafletInstance.DomUtil.setPosition = function (el: any, point: any) {
      if (!el) return;
      try {
        if (origSetPosition) {
          origSetPosition.call(this, el, point);
        } else {
          el._leaflet_pos = point;
        }
      } catch {}
    };
  }

  // 3. Safe PosAnimation to abort gracefully if element is detached
  if (leafletInstance.PosAnimation && (leafletInstance.PosAnimation.prototype as any)._step) {
    const origStep = (leafletInstance.PosAnimation.prototype as any)._step;
    (leafletInstance.PosAnimation.prototype as any)._step = function (round?: boolean) {
      if (!this._el) {
        if (typeof this.stop === 'function') this.stop();
        return;
      }
      try {
        return origStep.call(this, round);
      } catch (err: any) {
        if (err?.message?.includes('_leaflet_pos') || err?.message?.includes('undefined')) {
          if (typeof this.stop === 'function') this.stop();
          return;
        }
        throw err;
      }
    };
  }
}

// Auto-patch on initial module load in browser
if (typeof window !== 'undefined') {
  patchLeaflet(L);
}

export default patchLeaflet;
