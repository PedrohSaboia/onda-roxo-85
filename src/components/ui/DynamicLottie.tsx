import { useEffect, useState, useMemo } from 'react';
import Lottie from 'lottie-react';

interface DynamicLottieProps {
  animationData: object;
  className?: string;
  loop?: boolean;
  autoplay?: boolean;
  /**
   * Cor original no Lottie que será substituída (em formato RGBA normalizado 0-1)
   * Exemplo: [0.329, 0.321, 0.965, 1] para a cor roxa/azul
   */
  originalColor?: [number, number, number, number];
}

/**
 * Componente que renderiza animações Lottie com cores dinâmicas
 * Substitui a cor original pela cor custom-600 do sistema
 */
export function DynamicLottie({
  animationData,
  className,
  loop = true,
  autoplay = true,
  originalColor = [0.329, 0.321, 0.965, 1], // Cor azul/roxa padrão do Lottie
}: DynamicLottieProps) {
  const [customColor, setCustomColor] = useState<[number, number, number, number] | null>(null);

  useEffect(() => {
    const updateColor = () => {
      const root = document.documentElement;
      const computedStyle = getComputedStyle(root);
      const hslValue = computedStyle.getPropertyValue('--custom-600').trim();

      if (hslValue) {
        const rgbColor = hslToRgbNormalized(hslValue);
        if (rgbColor) {
          setCustomColor([...rgbColor, 1]);
        }
      }
    };

    updateColor();

    // Observa mudanças no tema (dark/light mode)
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          updateColor();
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });

    return () => observer.disconnect();
  }, []);

  const modifiedAnimationData = useMemo(() => {
    if (!customColor) return animationData;
    
    return replaceColorInLottie(
      JSON.parse(JSON.stringify(animationData)),
      originalColor,
      customColor
    );
  }, [animationData, customColor, originalColor]);

  return (
    <Lottie
      animationData={modifiedAnimationData}
      className={className}
      loop={loop}
      autoplay={autoplay}
    />
  );
}

/**
 * Converte HSL (formato "H S% L%" ou "H, S%, L%") para RGB normalizado (0-1)
 */
function hslToRgbNormalized(hslString: string): [number, number, number] | null {
  // Parse HSL string - pode vir como "250 91% 64%" ou "250, 91%, 64%"
  const cleanString = hslString.replace(/,/g, ' ').replace(/%/g, '');
  const parts = cleanString.split(/\s+/).filter(Boolean).map(Number);
  
  if (parts.length < 3) return null;
  
  const h = parts[0] / 360;
  const s = parts[1] / 100;
  const l = parts[2] / 100;

  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return [r, g, b];
}

/**
 * Substitui uma cor específica em toda a estrutura do Lottie
 */
function replaceColorInLottie(
  obj: any,
  originalColor: [number, number, number, number],
  newColor: [number, number, number, number]
): any {
  if (obj === null || obj === undefined) return obj;

  if (Array.isArray(obj)) {
    // Verifica se é um array de cor RGBA (4 elementos, todos números entre 0 e 1)
    if (
      obj.length === 4 &&
      obj.every((v) => typeof v === 'number' && v >= 0 && v <= 1)
    ) {
      // Verifica se é a cor original (com tolerância)
      if (isColorMatch(obj as [number, number, number, number], originalColor)) {
        return newColor;
      }
    }
    return obj.map((item) => replaceColorInLottie(item, originalColor, newColor));
  }

  if (typeof obj === 'object') {
    const newObj: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        // Propriedade 'c' em 'fl' (fill) e 'st' (stroke) contém cores
        if (key === 'c' && obj[key]?.k) {
          newObj[key] = {
            ...obj[key],
            k: replaceColorInLottie(obj[key].k, originalColor, newColor),
          };
        } else {
          newObj[key] = replaceColorInLottie(obj[key], originalColor, newColor);
        }
      }
    }
    return newObj;
  }

  return obj;
}

/**
 * Verifica se duas cores são iguais (com tolerância para floating point)
 */
function isColorMatch(
  color1: [number, number, number, number],
  color2: [number, number, number, number],
  tolerance: number = 0.01
): boolean {
  return (
    Math.abs(color1[0] - color2[0]) < tolerance &&
    Math.abs(color1[1] - color2[1]) < tolerance &&
    Math.abs(color1[2] - color2[2]) < tolerance
  );
}

export default DynamicLottie;
