import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ViralDirector",
    short_name: "ViralDirector",
    description: "Tell us your idea; we’ll direct you shot by shot, then hand you a platform-ready video.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F4EEE3",
    theme_color: "#F4EEE3",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
