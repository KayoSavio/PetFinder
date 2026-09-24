import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Túnel HTTPS (ngrok) usado pelo APK de teste para abrir o next dev
  allowedDevOrigins: ["hoveringly-subincomplete-leonida.ngrok-free.dev"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
};

export default nextConfig;
