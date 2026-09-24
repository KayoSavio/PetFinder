'use client';

import { useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Post } from '@/types';
import { getSpeciesEmoji } from '@/lib/utils';
import { BASE_TILES } from '@/lib/map/tiles';

interface MapComponentProps {
    posts: Post[];
    userLocation: [number, number] | null;
    selectedPost: Post | null;
    onSelectPost: (post: Post | null) => void;
}

// Custom marker icons using divIcon for each post type
function createPostIcon(post: Post): L.DivIcon {
    const colors: Record<string, string> = {
        lost: '#f43f5e',
        found: '#10b981',
        help_request: '#f59e0b',
    };
    const color = colors[post.type] || '#7c3aed';
    const emoji = getSpeciesEmoji(post.species);
    const isUrgent = post.urgency === 'urgent';

    return L.divIcon({
        className: 'custom-marker',
        html: `
      <div class="map-pin" style="
        --pin-color: ${color};
        ${isUrgent ? 'animation: pulse-urgent 2s infinite;' : ''}
      ">
        <span class="map-pin-emoji">${emoji}</span>
      </div>
    `,
        iconSize: [40, 48],
        iconAnchor: [20, 48],
        popupAnchor: [0, -48],
    });
}

function createUserIcon(): L.DivIcon {
    return L.divIcon({
        className: 'custom-marker',
        html: `
      <div class="user-marker">
        <div class="user-marker-pulse"></div>
        <div class="user-marker-dot"></div>
      </div>
    `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
    });
}

export default function MapComponent({ posts, userLocation, selectedPost, onSelectPost }: MapComponentProps) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const markersRef = useRef<L.LayerGroup | null>(null);
    const userMarkerRef = useRef<L.Marker | null>(null);
    const userCircleRef = useRef<L.Circle | null>(null);
    const hasFlewToUser = useRef(false);

    // Default center: São Paulo
    const center = useMemo<[number, number]>(
        () => userLocation || [-23.5505, -46.6333],
        [userLocation]
    );

    // Initialize map
    useEffect(() => {
        if (!mapContainerRef.current || mapRef.current) return;

        const map = L.map(mapContainerRef.current, {
            center: center,
            zoom: 13,
            zoomControl: false,
            attributionControl: false,
        });

        // Camada base: OpenStreetMap (sem chave de API)
        L.tileLayer(BASE_TILES.url, BASE_TILES.options).addTo(map);

        // Zoom control bottom-right
        L.control.zoom({ position: 'bottomright' }).addTo(map);

        // Attribution
        L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map);

        // Create marker layer group
        markersRef.current = L.layerGroup().addTo(map);

        mapRef.current = map;

        return () => {
            map.remove();
            mapRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Update user location marker
    useEffect(() => {
        if (!mapRef.current || !userLocation) return;
        const map = mapRef.current;
        const [lat, lng] = userLocation;

        if (userMarkerRef.current) {
            userMarkerRef.current.setLatLng([lat, lng]);
            userCircleRef.current?.setLatLng([lat, lng]);
        } else {
            // Create user marker
            userMarkerRef.current = L.marker([lat, lng], {
                icon: createUserIcon(),
                zIndexOffset: 1000,
            }).addTo(map);

            // Accuracy circle
            userCircleRef.current = L.circle([lat, lng], {
                radius: 200,
                color: '#7c3aed',
                fillColor: '#7c3aed',
                fillOpacity: 0.08,
                weight: 1,
                opacity: 0.3,
            }).addTo(map);
        }

        // Always fly to user on first real GPS fix
        if (!hasFlewToUser.current) {
            hasFlewToUser.current = true;
            map.flyTo([lat, lng], 15, { duration: 1.5 });
        }
    }, [userLocation]);

    // Update post markers
    useEffect(() => {
        if (!mapRef.current || !markersRef.current) return;
        const group = markersRef.current;
        group.clearLayers();

        posts.forEach((post) => {
            const marker = L.marker([post.pin_lat, post.pin_lng], {
                icon: createPostIcon(post),
            });

            marker.on('click', () => {
                onSelectPost(post);
            });

            // Help request: show radius circle
            if (post.type === 'help_request' && post.search_radius_km) {
                const helpCircle = L.circle([post.pin_lat, post.pin_lng], {
                    radius: post.search_radius_km * 1000,
                    color: '#f59e0b',
                    fillColor: '#f59e0b',
                    fillOpacity: 0.06,
                    weight: 1.5,
                    opacity: 0.4,
                    dashArray: '8 4',
                });
                group.addLayer(helpCircle);
            }

            group.addLayer(marker);
        });
    }, [posts, onSelectPost]);

    // Fly to selected post
    useEffect(() => {
        if (!mapRef.current || !selectedPost) return;
        mapRef.current.flyTo([selectedPost.pin_lat, selectedPost.pin_lng], 15, { duration: 0.8 });
    }, [selectedPost]);

    return (
        <div
            ref={mapContainerRef}
            style={{ width: '100%', height: '100%' }}
        />
    );
}
