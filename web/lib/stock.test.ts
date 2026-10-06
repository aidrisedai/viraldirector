import { describe, expect, it } from "vitest";
import { isPexels, pickFile, toClips } from "./stock";

const file = (width: number, height: number, type = "video/mp4", host = "videos.pexels.com") => ({ file_type: type, width, height, link: `https://${host}/v/${width}x${height}.mp4` });

describe("stock footage", () => {
  it("only lets Pexels' own https hosts through", () => {
    expect(isPexels("https://videos.pexels.com/video-files/1/a.mp4")).toBe(true);
    expect(isPexels("https://player.vimeo.com/x.mp4")).toBe(false);
    expect(isPexels("http://videos.pexels.com/a.mp4")).toBe(false);
    expect(isPexels("https://videos.pexels.com.evil.example/a.mp4")).toBe(false);
    expect(isPexels("https://evilpexels.com/a.mp4")).toBe(false);
    expect(isPexels("not a url")).toBe(false);
  });

  it("picks the MP4 closest to 1080 wide, avoiding huge files", () => {
    expect(pickFile([file(540, 960), file(1080, 1920), file(2160, 3840), file(1080, 1920, "video/webm")])?.width).toBe(1080);
    expect(pickFile([file(720, 1280), file(2160, 3840)])?.width).toBe(720);
    expect(pickFile([file(1080, 1920, "video/mp4", "example.com")])).toBeNull();
  });

  it("maps search results and drops ones without a usable file", () => {
    const clips = toClips([
      { id: 1, width: 1080, height: 1920, url: "https://www.pexels.com/video/1/", image: "https://images.pexels.com/1.jpg", duration: 9, user: { name: "Ana" }, video_files: [file(1080, 1920)] },
      { id: 2, width: 1080, height: 1920, url: "https://www.pexels.com/video/2/", image: "https://images.pexels.com/2.jpg", duration: 5, user: { name: "Bo" }, video_files: [file(1080, 1920, "video/webm")] },
    ]);
    expect(clips).toEqual([{ id: 1, thumb: "https://images.pexels.com/1.jpg", seconds: 9, width: 1080, height: 1920, file: "https://videos.pexels.com/v/1080x1920.mp4", author: "Ana", page: "https://www.pexels.com/video/1/" }]);
  });
});
