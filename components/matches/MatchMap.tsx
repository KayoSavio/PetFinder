'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { BASE_TILES } from '@/lib/map/tiles';
import 'leaflet/dist/leaflet.css';
import type { Post, MatchResult } from '@/types';

interface MatchMapProps {
    post: Post;                     // post de origem (ex: seu pet perdido)
    matches: MatchResult[];         // possíveis matches
    selectedMatch: MatchResult | null;
    onSelectMatch: (m: MatchResult | null) => void;
}

function createOriginIcon(): L.DivIcon {
    return L.divIcon({
        className: 'custom-marker',
        html: `<div class="map-pin" style="--pin-color: #7c3aed;"><span class="map-pin-emoji">🏠</span></div>`,
        iconSize: [40, 48],
        iconAnchor: [20, 48],
    });
}

function createMatchIcon(similarity: number, selected: boolean): L.DivIcon {
    // Verde forte para matches altos, amarelo para médios
    const color = similarity >= 0.8 ? '#10b981' : similarity >= 0.7 ? '#f59e0b' : '#94a3b8';
    const pct = Math.round(similarity * 100);
    return L.divIcon({
        className: 'custom-marker',
        html: `
      <div class="map-pin" style="--pin-color: ${color}; ${selected ? 'transform: scale(1.2);' : ''}">
        <span class="map-pin-emoji" style="font-size: 0.7rem; font-weight: 800;">${pct}%</span>
      </div>`,
        iconSize: [40, 48],
        iconAnchor: [20, 48],
    });
}

export default function MatchMap({ post, matches, selectedMatch, onSelectMatch }: MatchMapProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const markersRef = useRef<L.LayerGroup | null>(null);

    // Inicializa o mapa
    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;

        const map = L.map(containerRef.current, {
            center: [post.pin_lat, post.pin_lng],
            zoom: 13,
            zoomControl: false,
            attributionControl: false,
        });

        L.tileLayer(BASE_TILES.url, BASE_TILES.options).addTo(map);
        L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map);

        L.control.zoom({ position: 'bottomright' }).addTo(map);
        markersRef.current = L.layerGroup().addTo(map);
        mapRef.current = map;

        return () => {
            map.remove();
            mapRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Atualiza marcadores
    useEffect(() => {
        if (!mapRef.current || !markersRef.current) return;
        const group = markersRef.current;
        group.clearLayers();

        // Origem (local do post)
        group.addLayer(
            L.marker([post.pin_lat, post.pin_lng], { icon: createOriginIcon(), zIndexOffset: 500 })
        );

        const bounds: L.LatLngTuple[] = [[post.pin_lat, post.pin_lng]];

        matches.forEach((m) => {
            const mp = m.post;
            if (!mp) return;
            const marker = L.marker([mp.pin_lat, mp.pin_lng], {
                icon: createMatchIcon(m.similarity, selectedMatch?.photo_url === m.photo_url),
            });
            marker.on('click', () => onSelectMatch(m));

            // Linha ligando origem → match
            const line = L.polyline(
                [[post.pin_lat, post.pin_lng], [mp.pin_lat, mp.pin_lng]],
                {
                    color: m.similarity >= 0.8 ? '#10b981' : '#f59e0b',
                    weight: 1.5,
                    opacity: 0.4,
                    dashArray: '6 6',
                }
            );
            group.addLayer(line);
            group.addLayer(marker);
            bounds.push([mp.pin_lat, mp.pin_lng]);
        });

        if (bounds.length > 1) {
            mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
        }
    }, [post, matches, selectedMatch, onSelectMatch]);

    // Voa até o match selecionado
    useEffect(() => {
        if (!mapRef.current || !selectedMatch?.post) return;
        mapRef.current.flyTo(
            [selectedMatch.post.pin_lat, selectedMatch.post.pin_lng],
            15,
            { duration: 0.8 }
        );
    }, [selectedMatch]);

    return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
