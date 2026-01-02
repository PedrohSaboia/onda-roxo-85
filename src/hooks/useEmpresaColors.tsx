import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type ColorPalette = {
  light: Record<string, string>;
  dark: Record<string, string>;
};

/**
 * Hook para carregar e aplicar as cores da empresa dinamicamente
 * Busca o campo cores_hsl da tabela empresas e aplica nas variáveis CSS
 * Suporta light mode e dark mode automaticamente
 */
export function useEmpresaColors(empresaId?: number | null) {
  const [colors, setColors] = useState<ColorPalette | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadEmpresaColors = async () => {
      if (!empresaId) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('empresas')
          .select('cores_hsl')
          .eq('id', empresaId)
          .single();

        if (error) {
          console.error('Erro ao carregar cores da empresa:', error);
          setLoading(false);
          return;
        }

        if (data?.cores_hsl && typeof data.cores_hsl === 'object') {
          const coresHsl = data.cores_hsl as any;
          
          // Check if it has the light/dark structure
          if (coresHsl.light && coresHsl.dark) {
            setColors(coresHsl as ColorPalette);
            applyColorsToCSS(coresHsl as ColorPalette);
          } else if (Object.keys(coresHsl).some(key => key.startsWith('custom-'))) {
            // Old format - apply to light mode only
            const legacyPalette: ColorPalette = {
              light: coresHsl as Record<string, string>,
              dark: coresHsl as Record<string, string>
            };
            setColors(legacyPalette);
            applyColorsToCSS(legacyPalette);
          }
        }
      } catch (err) {
        console.error('Erro ao processar cores da empresa:', err);
      } finally {
        setLoading(false);
      }
    };

    loadEmpresaColors();
  }, [empresaId]);

  return { colors, loading };
}

/**
 * Aplica as cores no CSS dinamicamente
 * Substitui as variáveis CSS --custom-50 até --custom-900
 * Monitora mudanças entre light/dark mode
 */
function applyColorsToCSS(palette: ColorPalette) {
  const root = document.documentElement;
  
  // Determine current mode
  const isDarkMode = root.classList.contains('dark');
  const colorsToApply = isDarkMode ? palette.dark : palette.light;
  
  // Apply colors to CSS variables
  Object.entries(colorsToApply).forEach(([key, value]) => {
    const cssVarName = `--${key}`;
    root.style.setProperty(cssVarName, value);
  });

  console.log(`✅ Cores da empresa aplicadas (${isDarkMode ? 'dark' : 'light'} mode):`, colorsToApply);

  // Listen for dark mode changes and reapply colors
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'class') {
        const isDark = root.classList.contains('dark');
        const newColors = isDark ? palette.dark : palette.light;
        
        Object.entries(newColors).forEach(([key, value]) => {
          const cssVarName = `--${key}`;
          root.style.setProperty(cssVarName, value);
        });
        
        console.log(`🔄 Cores atualizadas para ${isDark ? 'dark' : 'light'} mode`);
      }
    });
  });

  observer.observe(root, {
    attributes: true,
    attributeFilter: ['class']
  });

  // Return observer for potential cleanup (though it runs continuously)
  return observer;
}
