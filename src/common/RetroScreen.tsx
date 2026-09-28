import React, { useRef, useMemo } from 'react';
import {
  Canvas,
  Rect,
  Shader,
  ImageShader,
  Skia,
  AlphaType,
  ColorType,
} from '@shopify/react-native-skia';
import { LCD_GHOSTING_SHADER } from './Shader';

interface RetroScreenProps {
  currentBuffer: Uint8Array; // 400 bytes from the engine (20x20)
  size?: number;
}

const makeTexture = (buffer: Uint8Array) => {
  const data = Skia.Data.fromBytes(buffer);
  return Skia.Image.MakeImage(
    {
      width: 20,
      height: 20,
      alphaType: AlphaType.Opaque,
      colorType: ColorType.Alpha_8,
    },
    data,
    20,
  );
};

export const RetroScreen = ({
  currentBuffer,
  size = 320,
}: RetroScreenProps) => {
  // Retain previous tick buffer across re-renders
  const prevBufferRef = useRef<Uint8Array>(new Uint8Array(400));

  // 1. Create textures for both frames
  const currentTexture = useMemo(
    () => makeTexture(currentBuffer),
    [currentBuffer],
  );
  const prevTexture = useMemo(
    () => makeTexture(prevBufferRef.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentBuffer],
  );

  // 2. Store current as previous for next tick cycle
  useMemo(() => {
    prevBufferRef.current = new Uint8Array(currentBuffer);
  }, [currentBuffer]);

  const uniforms = useMemo(
    () => ({
      u_resolution: [size, size],
      u_decayFactor: 0.32, // 32% ghost opacity mimics the original STN display
    }),
    [size],
  );

  if (!currentTexture || !prevTexture || !LCD_GHOSTING_SHADER) return null;

  return (
    <Canvas style={{ width: size, height: size }}>
      <Rect x={0} y={0} width={size} height={size}>
        <Shader source={LCD_GHOSTING_SHADER} uniforms={uniforms}>
          {/* Child shaders bind sequentially to uniform shader declarations */}
          <ImageShader image={currentTexture} />
          <ImageShader image={prevTexture} />
        </Shader>
      </Rect>
    </Canvas>
  );
};
