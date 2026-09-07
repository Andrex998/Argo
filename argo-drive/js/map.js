/* ============================================================
   ARGO Drive — map.js
   Leaflet, vendorizzato in locale (niente CDN: in viaggio la
   rete cade e l'app deve comunque aprirsi).

   Regola cromatica: la mappa resta monocroma. Rosso e ambra
   compaiono solo dove c'è un divieto o un pericolo — sono
   verdetti, non decorazione.
   ============================================================ */

export const TILE_THEMES = {
  scuro: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap · &copy; CARTO',
    subdomains: 'abcd', maxZoom: 20,
  },
  chiaro: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    subdomains: 'abc', maxZoom: 19,
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagery &copy; Esri',
    subdomains: 'abc', maxZoom: 19,
  },
};

const STYLE = {
  block: { color: '#FF3B30', weight: 5, opacity: 0.85 },
  rough: { color: '#FFB020', weight: 4, opacity: 0.7, dashArray: '8 8' },
  zone: { color: '#FF3B30', weight: 2, opacity: 0.9, fillColor: '#FF3B30', fillOpacity: 0.18 },
  curated: { color: '#FF3B30', weight: 1.5, opacity: 0.6, fillColor: '#FF3B30', fillOpacity: 0.08, dashArray: '6 8' },
  curatedSoft: { color: '#FFB020', weight: 1.5, opacity: 0.5, fillColor: '#FFB020', fillOpacity: 0.06, dashArray: '6 8' },
  matched: { color: '#3B8EFF', weight: 6, opacity: 0.55 },
  accuracy: { color: '#3B8EFF', weight: 1, opacity: 0.35, fillColor: '#3B8EFF', fillOpacity: 0.08 },
  trace: { color: '#3B8EFF', weight: 2, opacity: 0.4 },
};

const PT_GLYPH = {
  camera: '📸', calming: '⏛', crossing: '🚂', barrier: '⛓', hazard: '⚠',
};

export class DriveMap {
  constructor(el, opts = {}) {
    this.map = L.map(el, {
      zoomControl: false,
      attributionControl: false, // ne aggiungo uno solo, senza prefisso Leaflet
      preferCanvas: true,
      tap: false,
    }).setView(opts.center || [41.3275, 19.8187], opts.zoom || 16);

    L.control.attribution({ prefix: false }).addTo(this.map);
    L.control.zoom({ position: 'topright' }).addTo(this.map);

    this.tileLayer = null;
    this.setTheme(opts.theme || 'scuro');

    this.layers = {
      zones: L.layerGroup().addTo(this.map),
      roads: L.layerGroup().addTo(this.map),
      cameras: L.layerGroup().addTo(this.map),
      hazards: L.layerGroup().addTo(this.map),
      reports: L.layerGroup().addTo(this.map),
      curated: L.layerGroup().addTo(this.map),
      me: L.layerGroup().addTo(this.map),
    };

    this.matchedLine = null;
    this.marker = null;
    this.accuracy = null;
    this.trace = L.polyline([], STYLE.trace).addTo(this.map);
    this.follow = true;
    this.dataStamp = null;
    this.onFollowChange = opts.onFollowChange || (() => {});
    this.onMapLongPress = opts.onMapLongPress || null;

    // Se l'utente trascina, smetto di inseguirlo: sta guardando altro.
    this.map.on('dragstart', () => this.setFollow(false));

    if (this.onMapLongPress) {
      let timer = null;
      const cancel = () => { clearTimeout(timer); timer = null; };
      this.map.on('mousedown touchstart', (e) => {
        cancel();
        timer = setTimeout(() => this.onMapLongPress(e.latlng), 600);
      });
      this.map.on('mouseup touchend dragstart move', cancel);
    }
  }

  setTheme(name) {
    const t = TILE_THEMES[name] || TILE_THEMES.scuro;
    if (this.tileLayer) this.map.removeLayer(this.tileLayer);
    this.tileLayer = L.tileLayer(t.url, {
      attribution: t.attribution,
      subdomains: t.subdomains,
      maxZoom: t.maxZoom,
      crossOrigin: true,
    }).addTo(this.map);
    this.theme = name;
  }

  setFollow(on) {
    this.follow = on;
    this.onFollowChange(on);
  }

  setLayerVisible(name, visible) {
    const layer = this.layers[name];
    if (!layer) return;
    if (visible && !this.map.hasLayer(layer)) this.map.addLayer(layer);
    if (!visible && this.map.hasLayer(layer)) this.map.removeLayer(layer);
  }

  /** Posizione utente: freccia orientata + cerchio di precisione. */
  updatePosition(fix, heading) {
    const ll = [fix.lat, fix.lon];
    const rot = Number.isFinite(heading) ? heading : 0;
    const html = `<div class="me-arrow" style="transform: rotate(${rot}deg)">
      <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true">
        <path d="M12 2 L19 21 L12 17 L5 21 Z" fill="#3B8EFF" stroke="#050507" stroke-width="1.2"/>
      </svg></div>`;
    const icon = L.divIcon({ className: 'me-icon', html, iconSize: [34, 34], iconAnchor: [17, 17] });

    if (!this.marker) {
      this.marker = L.marker(ll, { icon, interactive: false, zIndexOffset: 1000 }).addTo(this.layers.me);
      this.accuracy = L.circle(ll, { radius: fix.accuracy || 20, ...STYLE.accuracy }).addTo(this.layers.me);
    } else {
      this.marker.setLatLng(ll);
      this.marker.setIcon(icon);
      this.accuracy.setLatLng(ll);
      this.accuracy.setRadius(fix.accuracy || 20);
    }

    const pts = this.trace.getLatLngs();
    const last = pts[pts.length - 1];
    if (!last || this.map.distance(last, ll) > 12) {
      this.trace.addLatLng(ll);
      if (pts.length > 600) this.trace.setLatLngs(pts.slice(-600));
    }

    if (this.follow) {
      this._autoZoom = true;
      this.map.panTo(ll, { animate: true, duration: 0.5, easeLinearity: 0.4 });
      this._autoZoom = false;
    }
  }

  recenter() {
    this.setFollow(true);
    if (this.marker) this.map.setView(this.marker.getLatLng(), Math.max(this.map.getZoom(), 16), { animate: true });
  }

  /** Ridisegna zone/strade/punti solo quando i dati cambiano davvero. */
  renderData(data) {
    if (!data || data.ts === this.dataStamp) return;
    this.dataStamp = data.ts;

    this.layers.zones.clearLayers();
    this.layers.roads.clearLayers();
    this.layers.cameras.clearLayers();
    this.layers.hazards.clearLayers();

    for (const z of data.zones) {
      L.polygon(z.ring, STYLE.zone)
        .bindPopup(`<b>${z.kind === 'lez' ? 'Zona a emissioni limitate' : 'Area pedonale'}</b><br>${esc(z.name || '')}<br><i>Fonte: OpenStreetMap</i>`)
        .addTo(this.layers.zones);
    }

    for (const r of data.roads) {
      if (r.block) {
        L.polyline(r.coords, STYLE.block)
          .bindPopup(`<b>Vietata alle auto</b><br>${esc(r.name || 'Strada senza nome')}<br>${esc(r.block)}`)
          .addTo(this.layers.roads);
      } else if (r.rough) {
        L.polyline(r.coords, STYLE.rough)
          .bindPopup(`<b>Fondo dissestato</b><br>${esc(r.name || 'Strada senza nome')}<br>${esc(r.rough)}`)
          .addTo(this.layers.roads);
      }
    }

    for (const p of data.points) {
      L.marker([p.lat, p.lon], {
        icon: L.divIcon({
          className: `pt-icon pt-${p.kind}`,
          html: `<span>${PT_GLYPH[p.kind] || '•'}</span>`,
          iconSize: [26, 26], iconAnchor: [13, 13],
        }),
      }).bindPopup(`<b>${esc(p.label)}</b><br><i>Fonte: OpenStreetMap</i>`)
        .addTo(p.kind === 'camera' ? this.layers.cameras : this.layers.hazards);
    }
  }

  /** La strada agganciata, evidenziata: si vede a colpo d'occhio se il limite è quello giusto. */
  highlightRoad(road) {
    if (this.matchedLine) {
      this.map.removeLayer(this.matchedLine);
      this.matchedLine = null;
    }
    if (!road) return;
    this.matchedLine = L.polyline(road.coords, STYLE.matched).addTo(this.map);
    this.matchedLine.bringToBack();
  }

  renderReports(items, kinds, onDelete) {
    this.layers.reports.clearLayers();
    for (const r of items) {
      const meta = kinds.find((k) => k.id === r.kind) || { emoji: '⚠️', label: 'Segnalazione' };
      const age = Math.round((Date.now() - r.ts) / 60000);
      const when = age < 60 ? `${age} min fa` : `${Math.round(age / 60)} h fa`;
      const marker = L.marker([r.lat, r.lon], {
        icon: L.divIcon({ className: 'pt-icon pt-report', html: `<span>${meta.emoji}</span>`, iconSize: [26, 26], iconAnchor: [13, 13] }),
      }).addTo(this.layers.reports);
      marker.bindPopup(
        `<b>${esc(meta.label)}</b><br>${esc(r.note || '')}<br><i>${when} · segnalazione locale</i><br>
         <button class="popup-del" data-id="${r.id}">Elimina</button>`
      );
      marker.on('popupopen', (e) => {
        const btn = e.popup.getElement().querySelector('.popup-del');
        if (btn) btn.addEventListener('click', () => { onDelete(r.id); this.map.closePopup(); });
      });
    }
  }

  renderCurated(spots) {
    this.layers.curated.clearLayers();
    for (const c of spots) {
      const style = c.kind === 'pedestrian' ? STYLE.curated : STYLE.curatedSoft;
      L.circle([c.lat, c.lon], { radius: c.radius, ...style })
        .bindPopup(`<b>${esc(c.name)}</b><br>${esc(c.note)}<br><i>Indicativo — verifica la segnaletica</i>`)
        .addTo(this.layers.curated);
    }
  }
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
