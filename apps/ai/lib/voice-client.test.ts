import { describe, expect, it } from "vitest";
import { encodePcm16Wav, rms } from "./voice-client";

describe("voice client audio primitives", () => {
  it("computes RMS and writes a mono PCM16 WAV envelope", () => {
    expect(rms(new Float32Array([0, 0, 0]))).toBe(0);
    expect(rms(new Float32Array([1, -1]))).toBeCloseTo(1);
    const wav = encodePcm16Wav(new Float32Array([0, 0.5, -0.5]), 16_000);
    expect(new TextDecoder().decode(wav.slice(0, 4))).toBe("RIFF");
    expect(new TextDecoder().decode(wav.slice(8, 12))).toBe("WAVE");
    expect(wav.byteLength).toBe(50);
  });
});
