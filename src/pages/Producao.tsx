import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, Loader2, TriangleAlert, List, X, Search, Printer, Truck, PackageCheck, CheckSquare, Users, CheckCircle2, XCircle, Clock, Copy, Check } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { registrarHistoricoMovimentacao } from '@/lib/historicoMovimentacoes';

type SectionKey = 'yampi' | 'mercado_livre' | 'leads' | 'urgentes';
type DateRangeKey = 'r1_10' | 'r11_20' | 'r21_30' | 'r31_plus' | 'ml_r1_5' | 'ml_r6_11' | 'ml_r11_20' | 'ml_r20_plus'; // r31_plus mantido para yampi/leads

type DateRangeConfig = {
  key: DateRangeKey;
  label: string;
  minDaysAgo: number;
  maxDaysAgo: number | null;
};

type SectionConfig = {
  key: SectionKey;
  label: string;
};

/** Tipo flat retornado pela RPC producao_get_itens */
type ProducaoItem = {
  quantidade: number | null;
  pedido_id: string | null;
  produto_id: string | null;
  variacao_id: string | null;
  nome_produto: string | null;
  img_url_produto: string | null;
  nome_variacao: string | null;
  img_url_variacao: string | null;
  criado_em: string | null;
  id_externo: string | null;
  status_id: string | null;
  urgente: boolean | null;
  plataforma_id: string | null;
  plataforma_nome: string | null;
};

type GroupedItem = {
  produto_id: string | null;
  variacao_id: string | null;
  nome_produto: string;
  nome_variacao: string | null;
  img_url: string | null;
  quantidade_total: number;
};

type DateRangeCardProps = {
  range: DateRangeConfig;
  quantity: number;
  expanded: boolean;
  onToggle: () => void;
};

type ProductFilter = {
  produto_id: string | null;
  variacao_id: string | null;
  nome: string;
  nomeVariacao: string | null;
};

type ProgressItem = {
  orderId: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  message?: string;
};

type SingleLabelProgress = {
  open: boolean;
  orderId: string;
  isMl: boolean;
  status: 'processing' | 'success' | 'error';
  message?: string;
};

type PlatformSectionProps = {
  section: SectionConfig;
  ranges: DateRangeConfig[];
  totals: Partial<Record<DateRangeKey, number>>;
  expandedKey: DateRangeKey | null;
  loadingByRange: Partial<Record<DateRangeKey, boolean>>;
  itemsByRange: Partial<Record<DateRangeKey, GroupedItem[]>>;
  orderIdsByRange: Partial<Record<DateRangeKey, string[]>>;
  onToggleRange: (rangeKey: DateRangeKey) => void;
  onOpenOrderIds: (rangeKey: DateRangeKey) => void;
  onOpenOrderIdsForProduct: (rangeKey: DateRangeKey, filter: ProductFilter, overrideOrderIds?: string[]) => void;
  imageUrl?: string | null;
  // urgentes-specific
  urgentesRawItems?: ProducaoItem[];
  urgentesMainTab?: UrgenteMainTab;
  urgentesSubTab?: string;
  onUrgentesMainTabChange?: (tab: UrgenteMainTab) => void;
  onUrgentesSubTabChange?: (subTab: string) => void;
};

const LEADS_PLATFORM_IDS = new Set([
  '0e27f292-924c-4ffc-a141-bbe00ec00428',
  'c85e1fc7-b03e-48a2-92ec-9123dcb3dd4f',
  'd83fff08-7ac4-4a15-9e6d-0a9247b24fe4',
]);

const SECTION_CONFIGS: SectionConfig[] = [
  { key: 'urgentes', label: 'URGENTES' },
  { key: 'mercado_livre', label: 'MERCADO LIVRE' },
  { key: 'leads', label: 'COMERCIAL' },
  { key: 'yampi', label: 'YAMPI' },
];

const DATE_RANGES: DateRangeConfig[] = [
  { key: 'r1_10', label: '(1 A 10 DIAS)', minDaysAgo: 1, maxDaysAgo: 10 },
  { key: 'r11_20', label: '(11 A 20 DIAS)', minDaysAgo: 11, maxDaysAgo: 20 },
  { key: 'r21_30', label: '(21 A 30 DIAS)', minDaysAgo: 21, maxDaysAgo: 30 },
  { key: 'r31_plus', label: '(31+ DIAS)', minDaysAgo: 31, maxDaysAgo: null },
];

const COMERCIAL_DATE_RANGES: DateRangeConfig[] = [
  { key: 'r1_10', label: '(1 A 2 DIAS)', minDaysAgo: 1, maxDaysAgo: 2 },
  { key: 'r11_20', label: '(3 A 4 DIAS)', minDaysAgo: 3, maxDaysAgo: 4 },
  { key: 'r21_30', label: '(5 DIAS)', minDaysAgo: 5, maxDaysAgo: 5 },
];

const URGENTES_DATE_RANGES: DateRangeConfig[] = [
  { key: 'r1_10', label: '(HOJE)', minDaysAgo: 0, maxDaysAgo: 0 },
  { key: 'r11_20', label: '(AMANHÃ)', minDaysAgo: 1, maxDaysAgo: 1 },
  { key: 'r21_30', label: '(DEPOIS DE AMANHÃ)', minDaysAgo: 2, maxDaysAgo: 2 },
];

const ML_DATE_RANGES: DateRangeConfig[] = [
  { key: 'ml_r1_5',    label: '(1 A 5 DIAS)',   minDaysAgo: 1,  maxDaysAgo: 5 },
  { key: 'ml_r6_11',   label: '(6 A 11 DIAS)',  minDaysAgo: 6,  maxDaysAgo: 11 },
  { key: 'ml_r11_20',  label: '(11 A 20 DIAS)', minDaysAgo: 11, maxDaysAgo: 20 },
  { key: 'ml_r20_plus', label: '(20+ DIAS)',     minDaysAgo: 20, maxDaysAgo: null },
];

type UrgenteMainTab = 'comercial' | 'yampi' | 'ecommerce';

const ECOMMERCE_SUB_TABS = [
  { key: 'shopee', label: 'Shopee' },
  { key: 'tiktok', label: 'TikTok Shop' },
  { key: 'magalu', label: 'Magalu' },
  { key: 'ml', label: 'ML' },
  { key: 'ml_org', label: 'ML Organizador' },
] as const;

const URGENT_PLATFORMS = new Set(['shopee', 'tiktok_shop', 'magazine_luiza']);
const ML_KEYWORD = 'organizador de relogio';
const SPECIAL_URGENT_PRODUCT_ID = 'ab8a89a1-aa95-4a98-99c2-eaa3de670462';
const SPECIAL_URGENT_PLATFORM_ID = '3e5a2b44-245a-4be9-a0b1-ef67d83fd8ec';
const ORDER_IDS_PAGE_SIZE = 20;
const URGENTES_DAY_BY_RANGE: Partial<Record<DateRangeKey, 0 | 1 | 2>> = {
  r1_10: 0,
  r11_20: 1,
  r21_30: 2,
};

const COMERCIAL_FAIXA_BY_RANGE: Partial<Record<DateRangeKey, 'r1_3' | 'r3_5' | 'r5_plus'>> = {
  r1_10: 'r1_3',
  r11_20: 'r3_5',
  r21_30: 'r5_plus',
};

// ---------------------------------------------------------------------------
// RPC call — status é filtro primário dentro da função SQL
// ---------------------------------------------------------------------------
const fetchProducaoItens = async (opts: {
  start: Date | null;
  end: Date;
}): Promise<ProducaoItem[]> => {
  const { data, error } = await (supabase as any).rpc('producao_get_itens', {
    p_end: opts.end.toISOString(),
    p_start: opts.start ? opts.start.toISOString() : null,
  });
  if (error) throw error;
  return (data || []) as ProducaoItem[];
};

const fetchProducaoItensMl = async (opts: {
  diasMin: number;
  diasMax: number | null;
}): Promise<ProducaoItem[]> => {
  const { data, error } = await (supabase as any).rpc('producao_get_itens_ml', {
    p_dias_min: opts.diasMin,
    p_dias_max: opts.diasMax ?? 9999,
  });
  if (error) throw error;
  return (data || []) as ProducaoItem[];
};

const fetchProducaoItensUrgentes = async (opts: {
  diasParaEnvio: 0 | 1 | 2;
}): Promise<ProducaoItem[]> => {
  const { data, error } = await (supabase as any).rpc('producao_get_itens_urgentes', {
    p_dias_para_envio: opts.diasParaEnvio,
  });
  if (error) throw error;
  return (data || []) as ProducaoItem[];
};

const fetchProducaoItensComercial = async (opts: {
  faixa: 'r1_3' | 'r3_5' | 'r5_plus';
}): Promise<ProducaoItem[]> => {
  const { data, error } = await (supabase as any).rpc('producao_get_itens_comercial', {
    p_faixa: opts.faixa,
  });
  if (error) throw error;
  return (data || []) as ProducaoItem[];
};

const normalize = (text: string | null | undefined): string => {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, '_');
};

const getProdutoFamiliaKey = (nome: string | null | undefined): string => {
  const normalized = normalize(nome);
  if (!normalized) return '';
  return normalized.split('_')[0] || normalized;
};

const subtractDays = (base: Date, days: number) => {
  const date = new Date(base);
  date.setDate(date.getDate() - days);
  return date;
};

const startOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const getRangeBounds = (range: DateRangeConfig, now: Date) => {
  const start = range.maxDaysAgo !== null ? startOfDay(subtractDays(now, range.maxDaysAgo)) : null;
  const end = endOfDay(subtractDays(now, range.minDaysAgo));
  return { start, end };
};

const itemMatchesSection = (item: ProducaoItem, section: SectionKey): boolean => {
  const plataformaNome = normalize(item.plataforma_nome);
  const produtoNome    = normalize(item.nome_produto);
  const variacaoNome   = normalize(item.nome_variacao);
  const isUrgente      = item.urgente === true;

  const isSpecialUrgent =
    item.produto_id === SPECIAL_URGENT_PRODUCT_ID &&
    item.plataforma_id === SPECIAL_URGENT_PLATFORM_ID;

  // urgente → exclusivo na coluna urgentes
  if (isUrgente) return section === 'urgentes';

  if (section === 'yampi')          return plataformaNome === 'yampi' && !isSpecialUrgent;
  if (section === 'mercado_livre')  return plataformaNome === 'mercado_livre' && !isSpecialUrgent;
  if (section === 'leads')          return LEADS_PLATFORM_IDS.has(item.plataforma_id ?? '');

  // section === 'urgentes'
  const isUrgentPlatform = URGENT_PLATFORMS.has(plataformaNome);
  const isMercadoLivreKw =
    plataformaNome === 'mercado_livre' &&
    (produtoNome.includes(ML_KEYWORD) || variacaoNome.includes(ML_KEYWORD));

  return isUrgentPlatform || isMercadoLivreKw || isSpecialUrgent;
};

const itemInRange = (item: ProducaoItem, range: DateRangeConfig, now: Date): boolean => {
  if (!item.criado_em) return false;
  const createdAt = new Date(item.criado_em);
  if (Number.isNaN(createdAt.getTime())) return false;
  const { start, end } = getRangeBounds(range, now);
  if (start === null) return createdAt <= end;
  return createdAt >= start && createdAt <= end;
};

const groupItems = (items: ProducaoItem[]): GroupedItem[] => {
  const grouped = new Map<string, GroupedItem>();

  for (const item of items) {
    const key = `${item.produto_id ?? 'null'}::${item.variacao_id ?? 'null'}`;
    const qty = Number(item.quantidade || 0);
    const current = grouped.get(key);
    if (current) {
      current.quantidade_total += qty;
    } else {
      grouped.set(key, {
        produto_id:       item.produto_id,
        variacao_id:      item.variacao_id,
        nome_produto:     item.nome_produto || 'Produto sem nome',
        nome_variacao:    item.nome_variacao ?? null,
        img_url:          item.img_url_variacao || item.img_url_produto || null,
        quantidade_total: qty,
      });
    }
  }

  return Array.from(grouped.values()).sort((a, b) => b.quantidade_total - a.quantidade_total);
};

function ItemsDropdown({ items, onProductClick }: { items: GroupedItem[]; onProductClick?: (filter: ProductFilter) => void }) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        Nenhum item encontrado para este intervalo.
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-muted/20 p-3" onClick={(event) => event.stopPropagation()}>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => (
          <div
            key={`${item.produto_id ?? 'null'}-${item.variacao_id ?? 'null'}`}
            className="h-20 rounded-lg border bg-background px-3 py-2 shadow-sm transition-shadow hover:shadow-md cursor-pointer select-none"
            title="Clique para ver pedidos com este produto"
            onClick={() => onProductClick?.({ produto_id: item.produto_id, variacao_id: item.variacao_id, nome: item.nome_produto, nomeVariacao: item.nome_variacao })}
          >
            <div className="flex h-full items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <div className="h-12 w-12 overflow-hidden rounded-md border bg-muted/30">
                  {item.img_url ? (
                    <img src={item.img_url} alt={item.nome_produto} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                      Sem foto
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold leading-tight">{item.nome_produto}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.nome_variacao || 'Sem variação'}</p>
                </div>
              </div>

              <div className="flex min-w-[56px] items-center justify-end">
                <span className="text-2xl font-extrabold leading-none tabular-nums">{item.quantidade_total}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function filterUrgentesItems(
  rawItems: ProducaoItem[],
  mainTab: UrgenteMainTab,
  subTab: string,
): ProducaoItem[] {
  if (mainTab === 'comercial') {
    const withLeads = rawItems.filter((item) => LEADS_PLATFORM_IDS.has(item.plataforma_id ?? ''));
    if (!subTab) return withLeads;
    return withLeads.filter((item) => item.plataforma_id === subTab);
  }

  if (mainTab === 'yampi') {
    return rawItems.filter((item) => normalize(item.plataforma_nome) === 'yampi');
  }

  if (mainTab === 'ecommerce') {
    const withEco = rawItems.filter((item) => {
      const pn = normalize(item.plataforma_nome);
      const pd = normalize(item.nome_produto) + ' ' + normalize(item.nome_variacao);
      const isSpecial =
        item.produto_id === SPECIAL_URGENT_PRODUCT_ID &&
        item.plataforma_id === SPECIAL_URGENT_PLATFORM_ID;
      return (
        isSpecial ||
        pn.includes('shopee') ||
        pn.includes('tiktok') ||
        pn.includes('magalu') ||
        pn.includes('magazine') ||
        pn === 'mercado_livre'
      );
    });
    if (!subTab) return withEco;
    return withEco.filter((item) => {
      const pn = normalize(item.plataforma_nome);
      const pd = normalize(item.nome_produto) + ' ' + normalize(item.nome_variacao);
      const isSpecial =
        item.produto_id === SPECIAL_URGENT_PRODUCT_ID &&
        item.plataforma_id === SPECIAL_URGENT_PLATFORM_ID;
      const isMlOrganizador =
        isSpecial ||
        (pn === 'mercado_livre' &&
          (pd.includes(normalize(ML_KEYWORD)) || (pd.includes('organizador') && pd.includes('relogio'))));
      if (subTab === 'shopee') return pn.includes('shopee');
      if (subTab === 'tiktok') return pn.includes('tiktok');
      if (subTab === 'magalu') return pn.includes('magalu') || pn.includes('magazine');
      if (subTab === 'ml') return pn === 'mercado_livre' && !isMlOrganizador;
      if (subTab === 'ml_org')
        return isMlOrganizador;
      return true;
    });
  }

  return rawItems;
}

function UrgentesItemsDropdown({
  rawItems,
  allGroupedItems,
  mainTab,
  subTab,
  onSetMainTab,
  onSetSubTab,
  onProductClick,
}: {
  rawItems: ProducaoItem[];
  allGroupedItems: GroupedItem[];
  mainTab: UrgenteMainTab;
  subTab: string;
  onSetMainTab: (tab: UrgenteMainTab) => void;
  onSetSubTab: (subTab: string) => void;
  onProductClick?: (filter: ProductFilter, tabFilteredOrderIds: string[]) => void;
}) {
  const leadPlatformsInItems = useMemo(() => {
    const seen = new Map<string, string>();
    rawItems.forEach((item) => {
      if (LEADS_PLATFORM_IDS.has(item.plataforma_id ?? '')) {
        seen.set(item.plataforma_id!, item.plataforma_nome ?? item.plataforma_id!);
      }
    });
    return Array.from(seen.entries()).map(([id, nome]) => ({ id, nome }));
  }, [rawItems]);

  const filteredGrouped = useMemo(() => {
    return groupItems(filterUrgentesItems(rawItems, mainTab, subTab));
  }, [rawItems, mainTab, subTab]);

  const MAIN_TABS: { key: UrgenteMainTab; label: string }[] = [
    { key: 'comercial', label: 'Comercial' },
    { key: 'yampi', label: 'Yampi' },
    { key: 'ecommerce', label: 'Marketplace' },
  ];

  return (
    <div className="space-y-2">
      {/* Main tabs */}
      <div className="flex flex-wrap gap-2 border-b pb-2">
        {MAIN_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => { onSetMainTab(tab.key); onSetSubTab(''); }}
            className={`px-4 py-2 text-sm font-semibold rounded transition-colors ${
              mainTab === tab.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sub-tabs Comercial */}
      {mainTab === 'comercial' && leadPlatformsInItems.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onSetSubTab('')}
            className={`px-4 py-2 text-sm rounded border transition-colors ${
              !subTab ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            Todas
          </button>
          {leadPlatformsInItems.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSetSubTab(p.id)}
              className={`px-4 py-2 text-sm rounded border transition-colors ${
                subTab === p.id ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              {p.nome}
            </button>
          ))}
        </div>
      )}

      {/* Sub-tabs E-commerce */}
      {mainTab === 'ecommerce' && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onSetSubTab('')}
            className={`px-4 py-2 text-sm rounded border transition-colors ${
              !subTab ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            Todos
          </button>
          {ECOMMERCE_SUB_TABS.map((st) => (
            <button
              key={st.key}
              type="button"
              onClick={() => onSetSubTab(st.key)}
              className={`px-4 py-2 text-sm rounded border transition-colors ${
                subTab === st.key ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      )}

      <ItemsDropdown
        items={filteredGrouped}
        onProductClick={(filter) => {
          const tabFiltered = filterUrgentesItems(rawItems, mainTab, subTab);
          const tabIds = Array.from(
            new Set(tabFiltered.map((i) => i.id_externo).filter((id): id is string => !!id && id.trim().length > 0))
          );
          onProductClick?.(filter, tabIds);
        }}
      />
    </div>
  );
}

function DateRangeCard({ range, quantity, expanded, onToggle }: DateRangeCardProps) {
  return (
    <div>
      <Button
        type="button"
        variant="outline"
        onClick={onToggle}
        aria-pressed={expanded}
        className={`h-auto min-h-[74px] w-full justify-between rounded-md border-2 px-3 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
          expanded
            ? 'text-foreground shadow-sm'
            : 'hover:bg-muted/50'
        }`}
        style={expanded ? { backgroundColor: '#f5ebe0', borderColor: '#d6a77a' } : undefined}
      >
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">{range.label}</div>
          <div className="text-base font-bold tabular-nums">{quantity} PRODUTOS</div>
        </div>
        <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </Button>
    </div>
  );
}

function PlatformSection({
  section,
  ranges,
  totals,
  expandedKey,
  loadingByRange,
  itemsByRange,
  orderIdsByRange,
  onToggleRange,
  onOpenOrderIds,
  onOpenOrderIdsForProduct,
  imageUrl,
  urgentesRawItems,
  urgentesMainTab,
  urgentesSubTab,
  onUrgentesMainTabChange,
  onUrgentesSubTabChange,
}: PlatformSectionProps) {
  const selectedRangeLabel = ranges.find((range) => range.key === expandedKey)?.label;
  const cardStyle =
    section.key === 'yampi'
      ? { backgroundColor: '#ff88c30e', borderColor: '#ff0080' }
      : section.key === 'mercado_livre'
      ? { backgroundColor: '#ffd9000e', borderColor: '#ffd900' }
      : section.key === 'urgentes'
      ? { backgroundColor: '#ff00000e', borderColor: '#ff0000' }
      : section.key === 'leads'
      ? { backgroundColor: '#00a86b0e', borderColor: '#00a86b' }
      : undefined;

  return (
    <Card className="overflow-hidden" style={cardStyle}>
      <CardHeader className="pb-3 flex items-start justify-between gap-2">
        <div>
          <CardTitle
            style={
              section.key === 'yampi'
                ? { textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }
                : section.key === 'mercado_livre'
                ? { textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }
                : section.key === 'urgentes'
                ? { textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }
                : section.key === 'leads'
                ? { textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }
                : undefined
            }
            className="flex items-center gap-2 text-sm tracking-wide md:text-base"
          >
            {imageUrl && section.key !== 'urgentes' && (
              <img src={imageUrl} alt={`${section.label} icon`} className="h-5 w-5 object-contain" />
            )}
            {section.key === 'leads' && !imageUrl && <Users className="h-4 w-4 text-gray-700" />}
            {section.key === 'urgentes' && <TriangleAlert className="h-4 w-4 text-red-500" />}
            {section.label}
          </CardTitle>
          <p className="text-xs text-black">Selecione um intervalo para ver os itens detalhados.</p>
        </div>

        {/* header right (previously had a button) - intentionally left empty */}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className={`grid grid-cols-1 gap-3 ${ranges.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-4'}`}>
          {ranges.map((range) => (
            <DateRangeCard
              key={`${section.key}-${range.key}`}
              range={range}
              quantity={totals[range.key] || 0}
              expanded={expandedKey === range.key}
              onToggle={() => onToggleRange(range.key)}
            />
          ))}
        </div>

        {expandedKey && (
          <div className="rounded-lg border p-2">
            {selectedRangeLabel && (
              <div className="mb-2 flex items-center justify-between text-xs font-medium text-black">
                <span>Itens do intervalo {selectedRangeLabel}</span>
                <div className="flex items-center gap-2">
                  <span>{orderIdsByRange[expandedKey]?.length || 0} pedido(s)</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenOrderIds(expandedKey);
                    }}
                    title="ids gerais"
                    aria-label="Ids gerais"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            {loadingByRange[expandedKey] ? (
              <div className="flex items-center gap-2 rounded-md border bg-background p-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando itens...
              </div>
            ) : section.key === 'urgentes' && urgentesRawItems ? (
              <UrgentesItemsDropdown
                rawItems={urgentesRawItems}
                allGroupedItems={itemsByRange[expandedKey] || []}
                mainTab={urgentesMainTab ?? 'comercial'}
                subTab={urgentesSubTab ?? ''}
                onSetMainTab={(tab) => onUrgentesMainTabChange?.(tab)}
                onSetSubTab={(sub) => onUrgentesSubTabChange?.(sub)}
                onProductClick={(filter, tabIds) => onOpenOrderIdsForProduct(expandedKey, filter, tabIds)}
              />
            ) : (
              <ItemsDropdown
                items={itemsByRange[expandedKey] || []}
                onProductClick={(filter) => onOpenOrderIdsForProduct(expandedKey, filter)}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ProductionPage() {
  const [summaryItems, setSummaryItems] = useState<ProducaoItem[]>([]);
  const [mlSummaryItems, setMlSummaryItems] = useState<ProducaoItem[]>([]);
  const [comercialSummaryByRange, setComercialSummaryByRange] = useState<Partial<Record<DateRangeKey, ProducaoItem[]>>>({});
  const [urgentesSummaryByRange, setUrgentesSummaryByRange] = useState<Partial<Record<DateRangeKey, ProducaoItem[]>>>({});
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [platformImages, setPlatformImages] = useState<Record<string, string | null>>({});

  // Estados para cards de produto-mãe (na aba principal)
  type VariacaoResumo = {
    variacao_id: string | null;
    nome_variacao: string | null;
    img_url: string | null;
    quantidade_total: number;
  };

  type ProdutoMaeResumo = {
    produto_id: string;
    nome_produto: string;
    img_url: string | null;
    quantidade_total: number;
    variacoes: VariacaoResumo[];
  };

  const [produtoVariacoesModal, setProdutoVariacoesModal] = useState<{
    open: boolean;
    produto: ProdutoMaeResumo | null;
  }>({ open: false, produto: null });

  const [expandedBySection, setExpandedBySection] = useState<Record<SectionKey, DateRangeKey | null>>({
    yampi: null,
    mercado_livre: null,
    leads: null,
    urgentes: null,
  });

  const [loadingByCard, setLoadingByCard] = useState<
    Record<SectionKey, Partial<Record<DateRangeKey, boolean>>>
  >({
    yampi:          { r1_10: false, r11_20: false, r21_30: false, r31_plus: false },
    mercado_livre:  { ml_r1_5: false, ml_r6_11: false, ml_r11_20: false, ml_r20_plus: false },
    leads:          { r1_10: false, r11_20: false, r21_30: false, r31_plus: false },
    urgentes:       { r1_10: false, r11_20: false, r21_30: false },
  });

  const [itemsCache, setItemsCache] = useState<
    Record<SectionKey, Partial<Record<DateRangeKey, GroupedItem[]>>>
  >({
    yampi: {},
    mercado_livre: {},
    leads: {},
    urgentes: {},
  });

  const [orderIdsCache, setOrderIdsCache] = useState<
    Record<SectionKey, Partial<Record<DateRangeKey, string[]>>>
  >({
    yampi: {},
    mercado_livre: {},
    leads: {},
    urgentes: {},
  });

  // Busca rápida na página principal por id_externo
  const [pageSearchQuery, setPageSearchQuery] = useState('');
  const [pageSearchLoading, setPageSearchLoading] = useState(false);
  type PageSearchResult = {
    id_externo: string;
    pedido_id: string;
    plataforma: string | null;
    plataforma_img: string | null;
    isMl: boolean;
    items: Array<{ id: string; quantidade: number; nome: string; nomeVariacao: string | null; img_url: string | null }>;
  };
  const [pageSearchResult, setPageSearchResult] = useState<PageSearchResult | null | 'not_found' | 'already_processed'>(null);

  const [orderIdsModalOpen, setOrderIdsModalOpen] = useState(false);
  const [orderIdsModalData, setOrderIdsModalData] = useState<string[]>([]);
  const [orderIdsModalTitle, setOrderIdsModalTitle] = useState('');
  const [modalItemsByExternalId, setModalItemsByExternalId] = useState<Map<string, ProducaoItem[]>>(new Map());
  const [orderIdsPage, setOrderIdsPage] = useState(1);
  const [openOrderIds, setOpenOrderIds] = useState<Set<string>>(new Set());
  const [modalProductFilter, setModalProductFilter] = useState<ProductFilter | null>(null);
  const [modalTab, setModalTab] = useState<'only' | 'mixed'>('only');
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const { empresaId } = useAuth();
  const [processingLabels, setProcessingLabels] = useState<Set<string>>(new Set());
  const [mlEtiquetaMap, setMlEtiquetaMap] = useState<Record<string, boolean>>({});
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [progressItems, setProgressItems] = useState<ProgressItem[]>([]);
  const [singleLabelProgress, setSingleLabelProgress] = useState<SingleLabelProgress | null>(null);
  const [saldoMelhorEnvio, setSaldoMelhorEnvio] = useState<number | null>(null);
  const [loadingSaldo, setLoadingSaldo] = useState(false);

  // Modal de Pedidos do Produto (relação de pedidos)
  type ProdutoModalItem = { produto_id: string | null; variacao_id: string | null; nomeProduto: string; nomeVariacao: string | null; imgUrl: string | null };
  const [produtoPedidosModal, setProdutoPedidosModal] = useState<{ open: boolean; item: ProdutoModalItem | null; pedidos: any[]; loading: boolean }>({ open: false, item: null, pedidos: [], loading: false });
  const [copiedPedidoId, setCopiedPedidoId] = useState<string | null>(null);

  // Urgentes: raw items por range para filtragem por aba de plataforma
  const [urgentesRawByRange, setUrgentesRawByRange] = useState<Partial<Record<DateRangeKey, ProducaoItem[]>>>({});
  const [urgentesMainTabByRange, setUrgentesMainTabByRange] = useState<Partial<Record<DateRangeKey, UrgenteMainTab>>>({});
  const [urgentesSubTabByRange, setUrgentesSubTabByRange] = useState<Partial<Record<DateRangeKey, string>>>({});

  // Recarrega os itens da produção chamando a RPC `producao_get_itens` e limpa caches locais
  const reloadSummary = async () => {
    try {
      setLoadingSummary(true);
      setSummaryError(null);
      const now = new Date();
      const end = endOfDay(now);
      const [items, mlItems, com1_3, com3_5, com5plus, urg0, urg1, urg2] = await Promise.all([
        fetchProducaoItens({ start: null, end }),
        fetchProducaoItensMl({ diasMin: 1, diasMax: null }),
        fetchProducaoItensComercial({ faixa: 'r1_3' }),
        fetchProducaoItensComercial({ faixa: 'r3_5' }),
        fetchProducaoItensComercial({ faixa: 'r5_plus' }),
        fetchProducaoItensUrgentes({ diasParaEnvio: 0 }),
        fetchProducaoItensUrgentes({ diasParaEnvio: 1 }),
        fetchProducaoItensUrgentes({ diasParaEnvio: 2 }),
      ]);
      setSummaryItems(items);
      setMlSummaryItems(mlItems);
      setComercialSummaryByRange({
        r1_10: com1_3,
        r11_20: com3_5,
        r21_30: com5plus,
      });
      setUrgentesSummaryByRange({
        r1_10: urg0,
        r11_20: urg1,
        r21_30: urg2,
      });
      // limpar caches para garantir que os próximos acessos peguem dados atualizados
      setItemsCache({ yampi: {}, mercado_livre: {}, leads: {}, urgentes: {} });
      setOrderIdsCache({ yampi: {}, mercado_livre: {}, leads: {}, urgentes: {} });
    } catch (err: any) {
      console.warn('Falha ao recarregar resumo de produção:', err);
      setSummaryError(err?.message || String(err));
    } finally {
      setLoadingSummary(false);
    }
  };

  const fetchPedidosDoProduto = async (item: ProdutoModalItem) => {
    setProdutoPedidosModal({ open: true, item, pedidos: [], loading: true });
    try {
      const matchesProdutoFiltro = (row: ProducaoItem) => {
        if (item.variacao_id) return row.variacao_id === item.variacao_id;
        if (item.produto_id) return row.produto_id === item.produto_id && !row.variacao_id;
        return false;
      };

      const etapasPorPedidoId = new Map<string, Set<string>>();
      const registrarEtapa = (pedidoId: string | null, etapa: string) => {
        if (!pedidoId) return;
        const atual = etapasPorPedidoId.get(pedidoId) ?? new Set<string>();
        atual.add(etapa);
        etapasPorPedidoId.set(pedidoId, atual);
      };

      const now = new Date();

      for (const range of DATE_RANGES) {
        const rows = summaryItems.filter((row) => itemMatchesSection(row, 'yampi') && itemInRange(row, range, now) && matchesProdutoFiltro(row));
        rows.forEach((row) => registrarEtapa(row.pedido_id, `YAMPI • ${range.label}`));
      }

      for (const range of ML_DATE_RANGES) {
        const rows = mlSummaryItems.filter((row) => itemInRange(row, range, now) && matchesProdutoFiltro(row));
        rows.forEach((row) => registrarEtapa(row.pedido_id, `MERCADO LIVRE • ${range.label}`));
      }

      for (const range of COMERCIAL_DATE_RANGES) {
        const rows = (comercialSummaryByRange[range.key] || []).filter((row) => matchesProdutoFiltro(row));
        rows.forEach((row) => registrarEtapa(row.pedido_id, `COMERCIAL • ${range.label}`));
      }

      for (const range of URGENTES_DATE_RANGES) {
        const rows = (urgentesSummaryByRange[range.key] || []).filter((row) => matchesProdutoFiltro(row));
        rows.forEach((row) => registrarEtapa(row.pedido_id, `URGENTES • ${range.label}`));
      }

      // Usa a mesma origem dos cards (summaryItems + mlSummaryItems)
      // para garantir que os números do modal batam com "Itens a produzir".
      const allItems = [...summaryItems, ...mlSummaryItems];
      const itensDoProduto = allItems.filter((row) => {
        if (!row.pedido_id) return false;
        return matchesProdutoFiltro(row);
      });

      const quantMap = new Map<string, number>();
      for (const row of itensDoProduto) {
        if (!row.pedido_id) continue;
        quantMap.set(row.pedido_id, (quantMap.get(row.pedido_id) || 0) + Number(row.quantidade || 0));
      }

      const pedidoIds = Array.from(quantMap.keys());
      if (!pedidoIds.length) {
        setProdutoPedidosModal((prev) => ({ ...prev, pedidos: [], loading: false }));
        return;
      }

      // Busca metadados dos pedidos apenas para os IDs já filtrados pela base da Produção.
      let pedidosQuery: any = (supabase as any)
        .from('pedidos')
        .select('id, id_externo, criado_em, urgente, plataformas(id, nome, img_url)')
        .in('id', pedidoIds);
      if (empresaId) pedidosQuery = pedidosQuery.eq('empresa_id', empresaId);

      const { data: pedidosData, error: pedidosErr } = await pedidosQuery;
      if (pedidosErr) throw pedidosErr;

      const pedidosComQtd = (pedidosData || [])
        .filter((p: any) => quantMap.has(p.id))
        .map((p: any) => ({
          ...p,
          quantidade_item: quantMap.get(p.id) || 0,
          etapas_producao: Array.from(etapasPorPedidoId.get(p.id) || []),
        }))
        .sort((a: any, b: any) => {
          const da = a?.criado_em ? new Date(a.criado_em).getTime() : 0;
          const db = b?.criado_em ? new Date(b.criado_em).getTime() : 0;
          return db - da;
        });

      setProdutoPedidosModal((prev) => ({ ...prev, pedidos: pedidosComQtd, loading: false }));
    } catch (err) {
      console.error('Erro ao buscar pedidos do produto:', err);
      setProdutoPedidosModal((prev) => ({ ...prev, pedidos: [], loading: false }));
    }
  };

  const handleCopyPedidoId = (id: string) => {
    navigator.clipboard.writeText(id).then(() => {
      setCopiedPedidoId(id);
      setTimeout(() => setCopiedPedidoId(null), 2000);
    }).catch(() => {
      toast({ title: 'Erro', description: 'Não foi possível copiar o ID', variant: 'destructive' });
    });
  };

  const itemsByExternalId = useMemo(() => {
    const map = new Map<string, ProducaoItem[]>();
    for (const item of summaryItems) {
      if (!item.id_externo) continue;
      const existing = map.get(item.id_externo) ?? [];
      existing.push(item);
      map.set(item.id_externo, existing);
    }
    return map;
  }, [summaryItems]);

  const filteredByTab = useMemo(() => {
    if (!modalProductFilter) return { only: orderIdsModalData, mixed: [] };
    const only: string[] = [];
    const mixed: string[] = [];
    for (const orderId of orderIdsModalData) {
      const items = modalItemsByExternalId.get(orderId) ?? itemsByExternalId.get(orderId) ?? [];
      if (items.length === 0) {
        only.push(orderId);
        continue;
      }
      const hasTarget = items.some((i) =>
        modalProductFilter.variacao_id
          ? i.variacao_id === modalProductFilter.variacao_id
          : i.produto_id === modalProductFilter.produto_id,
      );
      if (!hasTarget) continue;
      const hasOthers = items.some((i) =>
        modalProductFilter.variacao_id
          ? i.variacao_id !== modalProductFilter.variacao_id
          : i.produto_id !== modalProductFilter.produto_id,
      );
      if (hasOthers) mixed.push(orderId);
      else only.push(orderId);
    }
    return { only, mixed };
  }, [modalProductFilter, orderIdsModalData, itemsByExternalId, modalItemsByExternalId]);

  const activeOrderIds = modalProductFilter ? filteredByTab[modalTab] : orderIdsModalData;

  const filteredActiveOrderIds = useMemo(() => {
    const term = searchTerm.trim();
    if (!term) return activeOrderIds;
    return activeOrderIds.filter((id) => id.toLowerCase().includes(term.toLowerCase()));
  }, [activeOrderIds, searchTerm]);

  const totalOrderIdsPages = useMemo(
    () => Math.max(1, Math.ceil(filteredActiveOrderIds.length / ORDER_IDS_PAGE_SIZE)),
    [filteredActiveOrderIds],
  );

  const paginatedOrderIds = useMemo(() => {
    const start = (orderIdsPage - 1) * ORDER_IDS_PAGE_SIZE;
    return filteredActiveOrderIds.slice(start, start + ORDER_IDS_PAGE_SIZE);
  }, [filteredActiveOrderIds, orderIdsPage]);

  useEffect(() => {
    if (!orderIdsModalData || orderIdsModalData.length === 0) {
      setMlEtiquetaMap({});
      return;
    }

    let mounted = true;
    (async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('pedidos')
          .select('id_externo,etiqueta_ml')
          .in('id_externo', orderIdsModalData);

        if (error) throw error;

        if (!mounted) return;
        const map: Record<string, boolean> = {};
        (data || []).forEach((row: any) => {
          if (row && row.id_externo) map[row.id_externo] = !!row.etiqueta_ml;
        });
        setMlEtiquetaMap(map);
      } catch (err) {
        console.warn('Erro ao buscar flags etiqueta_ml:', err);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [orderIdsModalData]);

  useEffect(() => {
    if (!orderIdsModalOpen || orderIdsModalData.length === 0) {
      setModalItemsByExternalId(new Map());
      return;
    }

    let mounted = true;
    (async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('pedidos')
          .select(`
            id_externo,
            itens_pedido(
              quantidade,
              produto_id,
              variacao_id,
              produto:produtos(nome, img_url),
              variacao:variacoes_produto(nome, img_url)
            )
          `)
          .in('id_externo', orderIdsModalData);

        if (error) throw error;
        if (!mounted) return;

        const map = new Map<string, ProducaoItem[]>();
        (data || []).forEach((row: any) => {
          const externalId = row?.id_externo;
          if (!externalId) return;

          const items: ProducaoItem[] = (row?.itens_pedido || []).map((it: any) => ({
            quantidade: Number(it?.quantidade || 0),
            pedido_id: null,
            produto_id: it?.produto_id ?? null,
            variacao_id: it?.variacao_id ?? null,
            nome_produto: it?.produto?.nome ?? null,
            img_url_produto: it?.produto?.img_url ?? null,
            nome_variacao: it?.variacao?.nome ?? null,
            img_url_variacao: it?.variacao?.img_url ?? null,
            criado_em: null,
            id_externo: externalId,
            status_id: null,
            urgente: null,
            plataforma_id: null,
            plataforma_nome: null,
          }));

          map.set(externalId, items);
        });

        setModalItemsByExternalId(map);
      } catch (err) {
        console.warn('Erro ao buscar itens dos pedidos do popup:', err);
        if (mounted) setModalItemsByExternalId(new Map());
      }
    })();

    return () => {
      mounted = false;
    };
  }, [orderIdsModalOpen, orderIdsModalData]);

  const toggleSelectOrder = (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId); else next.add(orderId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedOrderIds.size === filteredActiveOrderIds.length) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(filteredActiveOrderIds));
    }
  };

  // Busca o saldo atual do Melhor Envio e atualiza o estado local.
  // Retorna o saldo (número) ou null em caso de falha.
  const fetchSaldoMelhorEnvio = async (): Promise<number | null> => {
    setLoadingSaldo(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;
      const resp = await fetch('https://rllypkctvckeaczjesht.supabase.co/functions/v1/buscar_saldo_melhor_envio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      });
      if (!resp.ok) return null;
      const data = await resp.json().catch(() => null);
      const balance = data?.balance ?? null;
      if (balance !== null) setSaldoMelhorEnvio(balance);
      return balance;
    } catch {
      return null;
    } finally {
      setLoadingSaldo(false);
    }
  };

  const handleBatchGenerateLabels = async () => {
    if (selectedOrderIds.size === 0 || !empresaId) return;

    // Verificar saldo antes de processar
    const saldo = await fetchSaldoMelhorEnvio();
    if (saldo !== null && saldo < 500) {
      toast({
        title: 'Saldo insuficiente',
        description: `Saldo Melhor Envio: R$ ${saldo.toFixed(2)}. Mínimo de R$ 500,00 necessário para processar etiquetas.`,
        variant: 'destructive',
      });
      return;
    }

    const ids = Array.from(selectedOrderIds);

    // Inicializar itens de progresso e abrir modal
    const initialItems: ProgressItem[] = ids.map((id) => ({ orderId: id, status: 'pending' }));
    setProgressItems(initialItems);
    setProgressModalOpen(true);
    setBatchProcessing(true);

    let success = 0;
    let failed = 0;

    const markProgress = (externalIds: string[], status: ProgressItem['status'], message?: string) => {
      setProgressItems((prev) =>
        prev.map((item) =>
          externalIds.includes(item.orderId) ? { ...item, status, message } : item,
        ),
      );
    };

    try {
      const { data: rows, error } = await (supabase as any)
        .from('pedidos')
        .select('id,id_externo,remetente_id')
        .in('id_externo', ids);

      if (error) throw error;

      type GroupEntry = { primaryId: string; externalId: string };
      const groups = new Map<string | null, GroupEntry[]>();
      const externalToRow = new Map<string, { id: string; remetente_id: string | null }>();
      (rows || []).forEach((r: any) => { externalToRow.set(r.id_externo, r); });

      ids.forEach((externalId) => {
        const row = externalToRow.get(externalId);
        const rid = row?.remetente_id ?? null;
        const arr = groups.get(rid) ?? [];
        arr.push({ primaryId: row?.id ?? externalId, externalId });
        groups.set(rid, arr);
      });

      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      for (const [remetenteId, groupEntries] of groups.entries()) {
        const groupExternalIds = groupEntries.map((g) => g.externalId);
        const groupPrimaryIds = groupEntries.map((g) => g.primaryId);

        // Marcar como processando
        markProgress(groupExternalIds, 'processing');

        try {
          const body = { pedido_ids: groupPrimaryIds, empresa_id: empresaId, remetente_id: remetenteId };
          const resp = await fetch('https://rllypkctvckeaczjesht.supabase.co/functions/v1/processar_etiqueta_em_lote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supabaseKey}` },
            body: JSON.stringify(body),
          });
          if (!resp.ok) {
            const txt = await resp.text().catch(() => '');
            throw new Error(txt || `Status ${resp.status}`);
          }

          success += groupPrimaryIds.length;
          markProgress(groupExternalIds, 'success');

          // Atualizar etiqueta_envio_id e status_id
          try {
            const { data: matchedById } = await (supabase as any)
              .from('pedidos').select('id').in('id', groupPrimaryIds);
            const { data: matchedByExternal } = await (supabase as any)
              .from('pedidos').select('id').in('id_externo', groupPrimaryIds);
            const primaryIds = Array.from(
              new Set([
                ...(matchedById || []).map((r: any) => r.id),
                ...(matchedByExternal || []).map((r: any) => r.id),
              ]),
            );
            if (primaryIds.length > 0) {
              await (supabase as any)
                .from('pedidos')
                .update({ etiqueta_envio_id: '466958dd-e525-4e8d-95f1-067124a5ea7f', status_id: '3473cae9-47c8-4b85-96af-b41fe0e15fa9' })
                .in('id', primaryIds);
              try {
                await Promise.all(primaryIds.map((pid: string) => registrarHistoricoMovimentacao(pid, 'Etiqueta processada (lote)')));
              } catch (histErr) {
                console.warn('Falha ao registrar histórico:', histErr);
              }
            }
          } catch (updErr) {
            console.warn('Falha ao atualizar pedidos:', updErr);
          }
        } catch (err: any) {
          console.error('Erro ao processar lote para remetente', remetenteId, err);
          failed += groupPrimaryIds.length;
          markProgress(groupExternalIds, 'error', err?.message || String(err));
        }
      }
    } catch (err: any) {
      console.error('Erro ao agrupar pedidos para processamento em lote:', err);
      markProgress(ids, 'error', err?.message || String(err));
      failed += ids.length;
    }

    setBatchProcessing(false);
    setSelectedOrderIds(new Set());

    if (failed === 0) {
      toast({ title: 'Lote concluído', description: `${success} etiqueta(s) processada(s) com sucesso` });
    } else {
      toast({ title: 'Lote concluído com erros', description: `${success} sucesso(s) / ${failed} erro(s)`, variant: 'destructive' });
    }

    try {
      if (success > 0) {
        await reloadSummary();
        void fetchSaldoMelhorEnvio();
      }
    } catch (err) {
      console.warn('Erro ao recarregar produção após lote:', err);
    }
  };

  const handleGenerateLabel = async (pedidoId: string) => {
    if (!empresaId) {
      toast({ title: 'Erro', description: 'Empresa não identificada', variant: 'destructive' });
      return;
    }

    setProcessingLabels((prev) => { const next = new Set(prev); next.add(pedidoId); return next; });

    // Mostrar modal de progresso individual
    setSingleLabelProgress({ open: true, orderId: pedidoId, isMl: false, status: 'processing' });

    try {
      // Verificar se é Mercado Livre com etiqueta_ml = true
      const { data: pedidoRow, error: pedidoErr } = await (supabase as any)
        .from('pedidos')
        .select('id,shipping_id,etiqueta_ml')
        .eq('id_externo', pedidoId)
        .limit(1)
        .single();

      const primaryPedidoId = pedidoRow?.id as string | undefined;
      const isML = !pedidoErr && pedidoRow?.etiqueta_ml && pedidoRow?.shipping_id;

      // Atualizar modal para mostrar se é ML
      setSingleLabelProgress((prev) => prev ? { ...prev, isMl: !!isML } : prev);

      if (isML) {
        const mlEndpoint = 'https://rllypkctvckeaczjesht.supabase.co/functions/v1/gerar-etiqueta-ml';
        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        const resp = await fetch(mlEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supabaseKey}` },
          body: JSON.stringify({
            pedido_id: primaryPedidoId ?? pedidoId,
            id_externo: pedidoId,
          }),
        });

        if (!resp.ok) {
          const errText = await resp.text().catch(() => '');
          throw new Error(`Erro ao gerar etiqueta ML: ${resp.status} ${errText}`);
        }

        const json = await resp.json().catch(() => ({ pdf_base64: null }));
        const pdfBase64 = json?.pdf_base64;
        if (pdfBase64) {
          try {
            const binary = atob(pdfBase64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            const blob = new Blob([bytes.buffer], { type: 'application/pdf' });
            window.open(URL.createObjectURL(blob), '_blank');

            try {
              const updatePid = primaryPedidoId ?? pedidoId;
              await (supabase as any)
                .from('pedidos')
                .update({ status_id: '3473cae9-47c8-4b85-96af-b41fe0e15fa9', etiqueta_envio_id: '466958dd-e525-4e8d-95f1-067124a5ea7f' })
                [primaryPedidoId ? 'eq' : 'eq'](primaryPedidoId ? 'id' : 'id_externo', updatePid);
            } catch (updErr) {
              console.warn('Falha ao atualizar status/etiqueta do pedido ML:', updErr);
            }

            setSingleLabelProgress((prev) => prev ? { ...prev, status: 'success', message: 'Etiqueta ML gerada com sucesso!' } : prev);
            toast({ title: 'Sucesso', description: `Etiqueta ML gerada para ${pedidoId}` });
            void fetchSaldoMelhorEnvio();
            try { await registrarHistoricoMovimentacao(primaryPedidoId ?? pedidoId, 'Etiqueta gerada (Mercado Livre)'); } catch (_) {}
          } catch (openErr) {
            console.error('Erro ao abrir PDF ML:', openErr);
            setSingleLabelProgress((prev) => prev ? { ...prev, status: 'success', message: 'Etiqueta gerada (falha ao abrir PDF)' } : prev);
          }
        } else {
          throw new Error('Resposta da edge function ML não retornou pdf_base64');
        }

        setOpenOrderIds((prev) => { const next = new Set(prev); next.delete(pedidoId); return next; });
        return;
      }

      // Caso padrão — edge function melhor envio
      // Verificar saldo antes de chamar a edge function
      const saldo = await fetchSaldoMelhorEnvio();
      if (saldo !== null && saldo < 500) {
        throw new Error(`Saldo Melhor Envio insuficiente: R$ ${saldo.toFixed(2)} (mínimo R$ 500,00)`);
      }

      const { error: functionError } = await (supabase as any).functions.invoke('processar_etiqueta_em_envio_de_pedido', {
        body: { pedido_id: primaryPedidoId ?? pedidoId, empresa_id: empresaId },
      });

      if (functionError) throw functionError;

      try {
        const pid = primaryPedidoId ?? pedidoId;
        if (primaryPedidoId) {
          await (supabase as any).from('pedidos')
            .update({ status_id: '3473cae9-47c8-4b85-96af-b41fe0e15fa9', etiqueta_envio_id: '466958dd-e525-4e8d-95f1-067124a5ea7f' })
            .eq('id', pid);
        } else {
          await (supabase as any).from('pedidos')
            .update({ status_id: '3473cae9-47c8-4b85-96af-b41fe0e15fa9', etiqueta_envio_id: '466958dd-e525-4e8d-95f1-067124a5ea7f' })
            .eq('id_externo', pid);
        }
        try { await registrarHistoricoMovimentacao(pid, 'Etiqueta processada no Melhor Envio'); } catch (_) {}
      } catch (updErr) {
        console.warn('Falha ao atualizar etiqueta_envio_id:', updErr);
      }

      setSingleLabelProgress((prev) => prev ? { ...prev, status: 'success', message: 'Etiqueta processada com sucesso!' } : prev);
      toast({ title: 'Sucesso', description: `Etiqueta processada para ${pedidoId}` });
      void fetchSaldoMelhorEnvio();

      try { await reloadSummary(); } catch (_) {}

      setOpenOrderIds((prev) => { const next = new Set(prev); next.delete(pedidoId); return next; });
    } catch (err: any) {
      console.error('Erro ao gerar etiqueta:', err);
      setSingleLabelProgress((prev) => prev ? { ...prev, status: 'error', message: err?.message || String(err) } : prev);
      toast({ title: 'Erro', description: err?.message || String(err), variant: 'destructive' });
    } finally {
      setProcessingLabels((prev) => { const next = new Set(prev); next.delete(pedidoId); return next; });
    }
  };

  useEffect(() => {
    let mounted = true;

    const fetchSummary = async () => {
      setLoadingSummary(true);
      setSummaryError(null);
      try {
        const now = new Date();
        // start = null para incluir 31+ dias sem limite inferior
        const end = endOfDay(now);
        const [items, com1_3, com3_5, com5plus, urg0, urg1, urg2] = await Promise.all([
          fetchProducaoItens({ start: null, end }),
          fetchProducaoItensComercial({ faixa: 'r1_3' }),
          fetchProducaoItensComercial({ faixa: 'r3_5' }),
          fetchProducaoItensComercial({ faixa: 'r5_plus' }),
          fetchProducaoItensUrgentes({ diasParaEnvio: 0 }),
          fetchProducaoItensUrgentes({ diasParaEnvio: 1 }),
          fetchProducaoItensUrgentes({ diasParaEnvio: 2 }),
        ]);
        if (mounted) {
          setSummaryItems(items);
          setComercialSummaryByRange({
            r1_10: com1_3,
            r11_20: com3_5,
            r21_30: com5plus,
          });
          setUrgentesSummaryByRange({
            r1_10: urg0,
            r11_20: urg1,
            r21_30: urg2,
          });
        }
      } catch (err: any) {
        if (mounted) setSummaryError(err?.message || String(err));
      } finally {
        if (mounted) setLoadingSummary(false);
      }
    };

    void fetchSummary();

    // fetch ML summary
    const fetchMlSummary = async () => {
      try {
        const now = new Date();
        const end = endOfDay(now);
        const items = await fetchProducaoItensMl({ diasMin: 1, diasMax: null });
        if (mounted) setMlSummaryItems(items);
      } catch (err) {
        console.warn('Erro ao buscar itens ML:', err);
      }
    };

    void fetchMlSummary();

    // fetch plataformas imagens
    const fetchPlataformas = async () => {
      try {
        const { data, error } = await (supabase as any).from('plataformas').select('id,nome,img_url');
        if (error) throw error;
        if (!mounted) return;
        const map: Record<string, string | null> = {};
        (data || []).forEach((p: any) => {
          const key = normalize(p.nome);
          map[key] = p.img_url || null;
        });
        setPlatformImages(map);
      } catch (err) {
        console.warn('Erro ao buscar plataformas:', err);
      }
    };

    void fetchPlataformas();

    // Pré-carregar saldo para exibição/cache imediato
    void fetchSaldoMelhorEnvio();

    return () => {
      mounted = false;
    };
  }, []);

  const totalsBySection = useMemo(() => {
    const now = new Date();

    const standardEmpty: Partial<Record<DateRangeKey, number>> = {
      r1_10: 0, r11_20: 0, r21_30: 0, r31_plus: 0,
    };
    const mlEmpty: Partial<Record<DateRangeKey, number>> = {
      ml_r1_5: 0, ml_r6_11: 0, ml_r11_20: 0, ml_r20_plus: 0,
    };

    const base: Record<SectionKey, Partial<Record<DateRangeKey, number>>> = {
      yampi:          { ...standardEmpty },
      mercado_livre:  { ...mlEmpty },
      leads:          { r1_10: 0, r11_20: 0, r21_30: 0 },
      urgentes:       { r1_10: 0, r11_20: 0, r21_30: 0 },
    };

    // Seções não-ML/urgentes: usar summaryItems + DATE_RANGES
    for (const section of SECTION_CONFIGS.filter((s) => s.key !== 'mercado_livre' && s.key !== 'urgentes' && s.key !== 'leads')) {
      for (const range of DATE_RANGES) {
        const filtered = summaryItems.filter(
          (item) => itemMatchesSection(item, section.key) && itemInRange(item, range, now),
        );
        base[section.key][range.key] = filtered.reduce(
          (sum, item) => sum + Number(item.quantidade || 0), 0,
        );
      }
    }

    // Comercial: usar RPC dedicada por faixa
    for (const range of COMERCIAL_DATE_RANGES) {
      const filtered = comercialSummaryByRange[range.key] || [];
      base.leads[range.key] = filtered.reduce(
        (sum, item) => sum + Number(item.quantidade || 0), 0,
      );
    }

    // Urgentes: usar RPC dedicada por dias para envio
    for (const range of URGENTES_DATE_RANGES) {
      const filtered = urgentesSummaryByRange[range.key] || [];
      base.urgentes[range.key] = new Set(
        filtered
          .map((item) => item.id_externo)
          .filter((id): id is string => !!id && id.trim().length > 0),
      ).size;
    }

    // Mercado Livre: usar mlSummaryItems + ML_DATE_RANGES
    for (const range of ML_DATE_RANGES) {
      const filtered = mlSummaryItems.filter((item) => itemInRange(item, range, now));
      base.mercado_livre[range.key] = filtered.reduce(
        (sum, item) => sum + Number(item.quantidade || 0), 0,
      );
    }

    return base;
  }, [summaryItems, mlSummaryItems, comercialSummaryByRange, urgentesSummaryByRange]);

  const createdAtByExternalId = useMemo(() => {
    const map = new Map<string, number>();
    const sources: ProducaoItem[][] = [
      summaryItems,
      mlSummaryItems,
      ...Object.values(comercialSummaryByRange),
      ...Object.values(urgentesSummaryByRange),
      ...Object.values(urgentesRawByRange),
    ].filter((rows): rows is ProducaoItem[] => Array.isArray(rows));

    for (const rows of sources) {
      for (const row of rows) {
        const idExterno = row.id_externo?.trim();
        if (!idExterno || !row.criado_em) continue;
        const createdTs = new Date(row.criado_em).getTime();
        if (Number.isNaN(createdTs)) continue;
        const current = map.get(idExterno) ?? 0;
        if (createdTs > current) map.set(idExterno, createdTs);
      }
    }

    return map;
  }, [summaryItems, mlSummaryItems, comercialSummaryByRange, urgentesSummaryByRange, urgentesRawByRange]);

  const sortOrderIdsByOldest = (orderIds: string[]) => {
    const unique = Array.from(new Set(orderIds.filter((id) => !!id && id.trim().length > 0)));
    return unique.sort((a, b) => {
      const createdA = createdAtByExternalId.get(a) ?? 0;
      const createdB = createdAtByExternalId.get(b) ?? 0;
      if (createdA !== createdB) return createdA - createdB;
      return a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' });
    });
  };

  const getOrderCreatedAtLabel = (orderId: string) => {
    const createdTs = createdAtByExternalId.get(orderId);
    if (!createdTs || Number.isNaN(createdTs)) return null;
    return new Date(createdTs).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const loadDropdownItems = async (section: SectionKey, range: DateRangeConfig) => {
    setLoadingByCard((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [range.key]: true,
      },
    }));

    try {
      const now = new Date();
      const bounds = getRangeBounds(range, now);

      // Mercado Livre e Urgentes usam RPC dedicada
      const isMlSection = section === 'mercado_livre';
      const isComercialSection = section === 'leads';
      const isUrgentesSection = section === 'urgentes';
      let filteredRows: ProducaoItem[] = [];

      if (isMlSection) {
        filteredRows = await fetchProducaoItensMl({ diasMin: range.minDaysAgo, diasMax: range.maxDaysAgo });
      } else if (isComercialSection) {
        const faixa = COMERCIAL_FAIXA_BY_RANGE[range.key];
        if (faixa) {
          filteredRows = await fetchProducaoItensComercial({ faixa });
        }
      } else if (isUrgentesSection) {
        const day = URGENTES_DAY_BY_RANGE[range.key];
        if (day !== undefined) {
          filteredRows = await fetchProducaoItensUrgentes({ diasParaEnvio: day });
        }
      } else {
        const rawItems = await fetchProducaoItens({ start: bounds.start, end: bounds.end });
        filteredRows = rawItems.filter((item) => itemMatchesSection(item, section));
      }

      // Armazenar itens brutos para urgentes (necessário para filtragem por abas de plataforma)
      if (section === 'urgentes') {
        setUrgentesRawByRange((prev) => ({ ...prev, [range.key]: filteredRows }));
      }
      const grouped = groupItems(filteredRows);
      const uniqueOrderIds = sortOrderIdsByOldest(Array.from(
        new Set(
          filteredRows
            .map((item) => item.id_externo)
            .filter((id): id is string => !!id && id.trim().length > 0),
        ),
      ));

      setItemsCache((prev) => ({
        ...prev,
        [section]: {
          ...prev[section],
          [range.key]: grouped,
        },
      }));

      setOrderIdsCache((prev) => ({
        ...prev,
        [section]: {
          ...prev[section],
          [range.key]: uniqueOrderIds,
        },
      }));
    } catch (err) {
      console.error('Erro ao carregar itens do bloco:', err);
      setItemsCache((prev) => ({
        ...prev,
        [section]: {
          ...prev[section],
          [range.key]: [],
        },
      }));

      setOrderIdsCache((prev) => ({
        ...prev,
        [section]: {
          ...prev[section],
          [range.key]: [],
        },
      }));
    } finally {
      setLoadingByCard((prev) => ({
        ...prev,
        [section]: {
          ...prev[section],
          [range.key]: false,
        },
      }));
    }
  };

  const handleToggleRange = async (section: SectionKey, rangeKey: DateRangeKey) => {
    const current = expandedBySection[section];

    if (current === rangeKey) {
      setExpandedBySection((prev) => ({ ...prev, [section]: null }));
      return;
    }

    setExpandedBySection((prev) => ({ ...prev, [section]: rangeKey }));

    const allRanges = section === 'mercado_livre'
      ? ML_DATE_RANGES
      : section === 'urgentes'
      ? URGENTES_DATE_RANGES
      : section === 'leads'
      ? COMERCIAL_DATE_RANGES
      : DATE_RANGES;
    const range = allRanges.find((r) => r.key === rangeKey);
    if (!range) return;

    await loadDropdownItems(section, range);
  };

  const handleOpenOrderIds = (section: SectionKey, rangeKey: DateRangeKey) => {
    if (loadingByCard[section][rangeKey]) return;

    const orderIds = sortOrderIdsByOldest(orderIdsCache[section]?.[rangeKey] || []);
    const sectionLabel = SECTION_CONFIGS.find((item) => item.key === section)?.label || section;
    const allRanges = section === 'mercado_livre'
      ? ML_DATE_RANGES
      : section === 'urgentes'
      ? URGENTES_DATE_RANGES
      : section === 'leads'
      ? COMERCIAL_DATE_RANGES
      : DATE_RANGES;
    const rangeLabel = allRanges.find((item) => item.key === rangeKey)?.label || rangeKey;

    setOrderIdsModalTitle(`${sectionLabel} • ${rangeLabel}`);
    setOrderIdsModalData(orderIds);
    setModalProductFilter(null);
    setModalTab('only');
    setOrderIdsPage(1);
    setOrderIdsModalOpen(true);
  };

  const handleOpenOrderIdsForProduct = (section: SectionKey, rangeKey: DateRangeKey, filter: ProductFilter, overrideOrderIds?: string[]) => {
    if (loadingByCard[section][rangeKey]) return;

    const orderIds = sortOrderIdsByOldest(overrideOrderIds ?? orderIdsCache[section]?.[rangeKey] ?? []);
    const sectionLabel = SECTION_CONFIGS.find((item) => item.key === section)?.label || section;
    const allRangesForProduct = section === 'mercado_livre'
      ? ML_DATE_RANGES
      : section === 'urgentes'
      ? URGENTES_DATE_RANGES
      : section === 'leads'
      ? COMERCIAL_DATE_RANGES
      : DATE_RANGES;
    const rangeLabel = allRangesForProduct.find((item) => item.key === rangeKey)?.label || rangeKey;
    const productLabel = filter.nomeVariacao ? `${filter.nome} — ${filter.nomeVariacao}` : filter.nome;

    setOrderIdsModalTitle(`${sectionLabel} • ${rangeLabel} • ${productLabel}`);
    setOrderIdsModalData(orderIds);
    setModalProductFilter(filter);
    setModalTab('only');
    setOrderIdsPage(1);
    setOrderIdsModalOpen(true);
  };

  // removed: handleOpenAllOrderIds - now only per-range button opens modal

  const handlePageSearch = async () => {
    const query = pageSearchQuery.trim();
    if (!query) return;
    setPageSearchLoading(true);
    setPageSearchResult(null);
    try {
      const { data, error } = await (supabase as any)
        .from('pedidos')
        .select(`
          id,
          id_externo,
          etiqueta_ml,
          etiqueta_envio_id,
          plataforma:plataformas(nome, img_url),
          itens_pedido(
            id, quantidade,
            produto:produtos(id, nome, img_url),
            variacao:variacoes_produto(id, nome, img_url)
          )
        `)
        .eq('id_externo', query)
        .limit(1)
        .single();
      if (error || !data) {
        setPageSearchResult('not_found');
      } else if (data.etiqueta_envio_id === '466958dd-e525-4e8d-95f1-067124a5ea7f') {
        setPageSearchResult('already_processed');
      } else {
        const items = (data.itens_pedido || []).map((it: any) => ({
          id: it.id,
          quantidade: it.quantidade ?? 1,
          nome: it.produto?.nome || it.variacao?.nome || '—',
          nomeVariacao: it.variacao?.nome ?? null,
          img_url: it.variacao?.img_url || it.produto?.img_url || null,
        }));
        setPageSearchResult({
          id_externo: data.id_externo,
          pedido_id: data.id,
          plataforma: data.plataforma?.nome ?? null,
          plataforma_img: data.plataforma?.img_url ?? null,
          isMl: !!data.etiqueta_ml,
          items,
        });
      }
    } catch {
      setPageSearchResult('not_found');
    } finally {
      setPageSearchLoading(false);
    }
  };

  // ============================================
  // FUNÇÕES PARA CARDS DE PRODUTO-MÃE
  // ============================================
  

  const getProdutosMaeAgrupados = (): ProdutoMaeResumo[] => {
    const allItems = [...summaryItems, ...mlSummaryItems];
    const produtosMap = new Map<string, ProdutoMaeResumo>();

    for (const item of allItems) {
      if (!item.produto_id) continue;

      const qty = Number(item.quantidade || 0);
      const produtoAtual = produtosMap.get(item.produto_id);

      if (!produtoAtual) {
        produtosMap.set(item.produto_id, {
          produto_id: item.produto_id,
          nome_produto: item.nome_produto || 'Produto sem nome',
          img_url: item.img_url_produto || item.img_url_variacao || null,
          quantidade_total: qty,
          variacoes: [
            {
              variacao_id: item.variacao_id,
              nome_variacao: item.nome_variacao ?? null,
              img_url: item.img_url_variacao || item.img_url_produto || null,
              quantidade_total: qty,
            },
          ],
        });
        continue;
      }

      produtoAtual.quantidade_total += qty;
      if (!produtoAtual.img_url) {
        produtoAtual.img_url = item.img_url_produto || item.img_url_variacao || null;
      }

      const variacaoIdx = produtoAtual.variacoes.findIndex((v) => v.variacao_id === item.variacao_id);
      if (variacaoIdx >= 0) {
        produtoAtual.variacoes[variacaoIdx].quantidade_total += qty;
      } else {
        produtoAtual.variacoes.push({
          variacao_id: item.variacao_id,
          nome_variacao: item.nome_variacao ?? null,
          img_url: item.img_url_variacao || item.img_url_produto || null,
          quantidade_total: qty,
        });
      }
    }

    return Array.from(produtosMap.values())
      .map((produto) => ({
        ...produto,
        variacoes: produto.variacoes.sort((a, b) => {
          const nomeA = a.nome_variacao || '';
          const nomeB = b.nome_variacao || '';
          return nomeA.localeCompare(nomeB, 'pt-BR', { numeric: true, sensitivity: 'base' });
        }),
      }))
      .sort((a, b) => {
        const familiaA = getProdutoFamiliaKey(a.nome_produto);
        const familiaB = getProdutoFamiliaKey(b.nome_produto);

        if (familiaA !== familiaB) {
          return familiaA.localeCompare(familiaB, 'pt-BR');
        }

        const nomeCmp = (a.nome_produto || '').localeCompare((b.nome_produto || ''), 'pt-BR');
        if (nomeCmp !== 0) return nomeCmp;

        return a.quantidade_total - b.quantidade_total;
      });
  };

  const handleProdutoMaeClick = (produto: ProdutoMaeResumo) => {
    setProdutoVariacoesModal({ open: true, produto });
  };

  const handleSelectVariacao = (produto: ProdutoMaeResumo, variacao: VariacaoResumo) => {
    setProdutoVariacoesModal({ open: false, produto: null });
    void fetchPedidosDoProduto({
      produto_id: produto.produto_id,
      variacao_id: variacao.variacao_id,
      nomeProduto: produto.nome_produto,
      nomeVariacao: variacao.nome_variacao,
      imgUrl: variacao.img_url || produto.img_url,
    });
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Produção</h1>
            <p className="text-sm text-muted-foreground">Acompanhe volumes por plataforma e faixa de dias.</p>
          </div>

          {/* Saldo Melhor Envio */}
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Saldo Melhor Envio</div>
            <div className="text-2xl font-bold text-green-600">
              {loadingSaldo ? (
                <span className="text-base">Carregando...</span>
              ) : saldoMelhorEnvio !== null ? (
                new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(saldoMelhorEnvio)
              ) : (
                <span className="text-base text-muted-foreground">--</span>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* Busca rápida por ID do pedido */}
          <div className="flex flex-col gap-2 sm:w-80">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar por ID do pedido..."
                  value={pageSearchQuery}
                  onChange={(e) => { setPageSearchQuery(e.target.value); setPageSearchResult(null); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handlePageSearch(); }}
                  className="w-full rounded-md border bg-background pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => void handlePageSearch()}
                disabled={pageSearchLoading || !pageSearchQuery.trim()}
                className="shrink-0"
              >
                {pageSearchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>

            {/* "Não encontrado" inline */}
            {pageSearchResult === 'not_found' && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                Pedido não encontrado.
              </div>
            )}
            {/* "Já processado" inline */}
            {pageSearchResult === 'already_processed' && (
              <div className="rounded-md border border-yellow-400/60 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
                Etiqueta já gerada para este pedido.
              </div>
            )}
          </div>

        {/* Card de pedido encontrado — full width, igual à logística */}
        {pageSearchResult && pageSearchResult !== 'not_found' && pageSearchResult !== 'already_processed' && (
          <Card className="w-full shadow-md">
            {/* Cabeçalho */}
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {pageSearchResult.plataforma_img ? (
                    <img src={pageSearchResult.plataforma_img} alt={pageSearchResult.plataforma ?? ''} className="h-10 w-10 rounded-full border object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded-full border bg-muted flex items-center justify-center">
                      <Printer className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <p className="font-mono text-lg font-bold">{pageSearchResult.id_externo}</p>
                    <p className="text-sm text-muted-foreground">{pageSearchResult.plataforma ?? 'Plataforma desconhecida'}</p>
                  </div>
                  {pageSearchResult.isMl && (
                    <span className="rounded-full bg-yellow-100 border border-yellow-400 px-2 py-0.5 text-xs font-bold text-yellow-800 uppercase">ML</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setPageSearchResult(null)}
                  className="rounded-md p-1.5 hover:bg-muted transition-colors"
                  aria-label="Fechar"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </CardHeader>

            {/* Itens do pedido */}
            <CardContent className="space-y-3">
              {pageSearchResult.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum item encontrado.</p>
              ) : (
                pageSearchResult.items.map((it) => (
                  <div key={it.id} className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
                    {it.img_url ? (
                      <img src={it.img_url} alt={it.nome} className="h-12 w-12 rounded-full border-2 border-gray-200 object-cover flex-shrink-0" />
                    ) : (
                      <div className="h-12 w-12 rounded-full border-2 border-gray-200 bg-muted flex items-center justify-center flex-shrink-0">
                        <Printer className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{it.nome}</p>
                      {it.nomeVariacao && <p className="text-xs text-muted-foreground">{it.nomeVariacao}</p>}
                    </div>
                    <span className="text-sm font-semibold shrink-0">Qtd: {it.quantidade}</span>
                  </div>
                ))
              )}
            </CardContent>

            {/* Botão gerar etiqueta */}
            <div className="px-6 pb-6 flex justify-center">
              <button
                type="button"
                disabled={processingLabels.has(pageSearchResult.id_externo)}
                onClick={() => void handleGenerateLabel(pageSearchResult!.id_externo)}
                className={`flex items-center gap-2 px-8 py-3 rounded-md text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-wait ${
                  pageSearchResult.isMl
                    ? 'bg-yellow-400 hover:bg-yellow-500 text-yellow-900 focus:ring-yellow-400'
                    : 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500'
                }`}
              >
                {processingLabels.has(pageSearchResult.id_externo) ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Gerando...</>
                ) : pageSearchResult.isMl ? (
                  <><Truck className="h-4 w-4" />Gerar Etiqueta Mercado Livre</>
                ) : (
                  <><Printer className="h-4 w-4" />GERAR ETIQUETA</>
                )}
              </button>
            </div>
          </Card>
        )}

        {loadingSummary && !(pageSearchResult && pageSearchResult !== 'not_found' && pageSearchResult !== 'already_processed') && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando totais de produção...
          </div>
        )}

        {summaryError && !(pageSearchResult && pageSearchResult !== 'not_found' && pageSearchResult !== 'already_processed') && <div className="text-sm text-red-600">{summaryError}</div>}

        {!loadingSummary && !summaryError && !(pageSearchResult && pageSearchResult !== 'not_found' && pageSearchResult !== 'already_processed') && (
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Itens a produzir</CardTitle>
                <p className="text-xs text-muted-foreground">Clique no produto-mãe para escolher a variação e visualizar a quantidade.</p>
              </CardHeader>
              <CardContent>
                {(() => {
                  const produtosMae = getProdutosMaeAgrupados();
                  if (produtosMae.length === 0) {
                    return <div className="text-sm text-muted-foreground">Nenhum item encontrado.</div>;
                  }
                  return (
                    <div className="flex flex-wrap gap-2">
                      {produtosMae.map((produto, idx) => (
                        <div
                          key={`${produto.produto_id}-${idx}`}
                          className="relative flex flex-col items-center gap-1.5 rounded-lg border bg-card p-2 w-24 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                          onClick={() => handleProdutoMaeClick(produto)}
                          title="Selecionar variação"
                        >
                          <span className="absolute -top-1.5 -right-1.5 z-10 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-[10px] px-1.5 py-0.5 min-w-[1.25rem] shadow">
                            ×{produto.quantidade_total}
                          </span>

                          {produto.img_url ? (
                            <img
                              src={produto.img_url}
                              alt={produto.nome_produto}
                              className="h-14 w-14 rounded-md object-cover border"
                            />
                          ) : (
                            <div className="h-14 w-14 rounded-md border bg-muted flex items-center justify-center text-[9px] text-muted-foreground">
                              sem foto
                            </div>
                          )}

                          <p className="text-[10px] font-semibold text-center leading-tight line-clamp-2 w-full">
                            {produto.nome_produto}
                          </p>

                          <p className="text-[9px] text-muted-foreground text-center leading-tight w-full">
                            {produto.variacoes.length} variação(ões)
                          </p>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            {SECTION_CONFIGS.map((section) => (
              <PlatformSection
                key={section.key}
                section={section}
                ranges={section.key === 'mercado_livre' ? ML_DATE_RANGES : section.key === 'urgentes' ? URGENTES_DATE_RANGES : section.key === 'leads' ? COMERCIAL_DATE_RANGES : DATE_RANGES}
                totals={totalsBySection[section.key]}
                expandedKey={expandedBySection[section.key]}
                loadingByRange={loadingByCard[section.key]}
                itemsByRange={itemsCache[section.key]}
                orderIdsByRange={orderIdsCache[section.key]}
                imageUrl={platformImages[section.key]}
                onToggleRange={(rangeKey) => {
                  void handleToggleRange(section.key, rangeKey);
                }}
                onOpenOrderIds={(rangeKey) => {
                  handleOpenOrderIds(section.key, rangeKey);
                }}
                onOpenOrderIdsForProduct={(rangeKey, filter, overrideOrderIds) => {
                  handleOpenOrderIdsForProduct(section.key, rangeKey, filter, overrideOrderIds);
                }}
                {...(section.key === 'urgentes'
                  ? {
                      urgentesRawItems: urgentesRawByRange[expandedBySection['urgentes'] as DateRangeKey] ?? [],
                      urgentesMainTab: urgentesMainTabByRange[expandedBySection['urgentes'] as DateRangeKey] ?? 'comercial',
                      urgentesSubTab: urgentesSubTabByRange[expandedBySection['urgentes'] as DateRangeKey] ?? '',
                      onUrgentesMainTabChange: (tab: UrgenteMainTab) => {
                        const rk = expandedBySection['urgentes'];
                        if (rk) {
                          setUrgentesMainTabByRange((prev) => ({ ...prev, [rk]: tab }));
                          setUrgentesSubTabByRange((prev) => ({ ...prev, [rk]: '' }));
                        }
                      },
                      onUrgentesSubTabChange: (sub: string) => {
                        const rk = expandedBySection['urgentes'];
                        if (rk) setUrgentesSubTabByRange((prev) => ({ ...prev, [rk]: sub }));
                      },
                    }
                  : {})}
              />
            ))}
          </div>
        )}
            </div>
      </div>

      <Dialog open={orderIdsModalOpen} onOpenChange={(open) => { setOrderIdsModalOpen(open); if (!open) { setModalProductFilter(null); setModalTab('only'); setSelectedOrderIds(new Set()); setOpenOrderIds(new Set()); setSearchTerm(''); } }}>
        <DialogContent className="!w-[96vw] !max-w-[96vw] lg:!w-[92vw] lg:!max-w-[92vw] px-2 sm:px-3">
          <DialogHeader>
            <DialogTitle className="text-lg">Pedidos — Gerar Etiquetas</DialogTitle>
            <div className="text-sm text-muted-foreground mt-0.5">{orderIdsModalTitle}</div>
          </DialogHeader>

          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar pedido por ID..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setOrderIdsPage(1); }}
              className="w-full rounded-md border bg-background pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Contagem + filtro de produto */}
          <div className="flex items-center justify-between text-xs text-muted-foreground -mt-1">
            <span>{filteredActiveOrderIds.length} pedido(s) encontrado(s)</span>
            {selectedOrderIds.size > 0 && <span className="text-primary font-medium">{selectedOrderIds.size} selecionado(s)</span>}
          </div>

          {modalProductFilter && (
            <div className="flex rounded-md border overflow-hidden">
              <button
                type="button"
                onClick={() => { setModalTab('only'); setOrderIdsPage(1); }}
                className={`flex-1 px-3 py-1.5 text-md font-medium transition-colors ${
                  modalTab === 'only'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/40 text-muted-foreground hover:bg-muted'
                }`}
              >
                Apenas este produto ({filteredByTab.only.length})
              </button>
              <button
                type="button"
                onClick={() => { setModalTab('mixed'); setOrderIdsPage(1); }}
                className={`flex-1 px-3 py-1.5 text-md font-medium border-l transition-colors ${
                  modalTab === 'mixed'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/40 text-muted-foreground hover:bg-muted'
                }`}
              >
                Com outros produtos ({filteredByTab.mixed.length})
              </button>
            </div>
          )}

          <div className="h-[55vh] overflow-y-auto rounded-md border bg-muted/10 p-3">
            {filteredActiveOrderIds.length === 0 ? (
              <div className="p-2 text-sm text-muted-foreground">Nenhum pedido encontrado para este filtro.</div>
            ) : (
              <div className="space-y-1">
                {/* Linha: Selecionar todos */}
                <div
                  className="flex items-center gap-2.5 rounded-lg border border-dashed bg-background px-3 py-2 mb-2 cursor-pointer select-none hover:bg-muted/30 transition-colors"
                  onClick={toggleSelectAll}
                >
                  <Checkbox
                    checked={selectedOrderIds.size === filteredActiveOrderIds.length && filteredActiveOrderIds.length > 0}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Selecionar todos"
                    className="rounded-full"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="text-sm text-muted-foreground font-medium">
                    {selectedOrderIds.size === filteredActiveOrderIds.length && filteredActiveOrderIds.length > 0
                      ? 'Desmarcar todos'
                      : `Selecionar todos (${filteredActiveOrderIds.length})`}
                  </span>
                </div>

                {paginatedOrderIds.map((orderId) => {
                  const isOpen = openOrderIds.has(orderId);
                  const isSelected = selectedOrderIds.has(orderId);
                  const hasSelection = selectedOrderIds.size > 0;
                  const allProducts = modalItemsByExternalId.get(orderId) ?? itemsByExternalId.get(orderId) ?? [];
                  const products = isOpen ? allProducts : [];
                  const isProcessing = processingLabels.has(orderId);
                  const isMl = !!mlEtiquetaMap[orderId];
                  const createdAtLabel = getOrderCreatedAtLabel(orderId);
                  return (
                    <div
                      key={orderId}
                      onMouseEnter={() => {
                        if (!hasSelection) setOpenOrderIds((prev) => { const next = new Set(prev); next.add(orderId); return next; });
                      }}
                      onClick={() => {
                        if (!hasSelection) setOpenOrderIds((prev) => { const next = new Set(prev); if (next.has(orderId)) next.delete(orderId); else next.add(orderId); return next; });
                      }}
                    >
                      {/* Linha principal do pedido */}
                      <div
                        className={`rounded-lg border transition-all duration-150 cursor-default overflow-hidden ${
                          isSelected
                            ? 'border-primary/60 shadow-md'
                            : isOpen
                            ? 'border-accent-foreground/20 shadow-sm'
                            : 'border-border hover:border-accent-foreground/30 hover:shadow-sm'
                        }`}
                        style={{
                          backgroundColor: isSelected
                            ? 'hsl(var(--primary) / 0.06)'
                            : isOpen
                            ? 'hsl(var(--accent) / 0.5)'
                            : 'hsl(var(--background))',
                          borderRadius: isOpen && products.length > 0 ? '8px 8px 0 0' : undefined,
                        }}
                      >
                        {/* Barra colorida lateral */}
                        <div className="flex items-center gap-0">
                          <div
                            className="w-1 self-stretch shrink-0 rounded-l-lg"
                            style={{ backgroundColor: isMl ? '#eab308' : '#3b82f6' }}
                          />
                          <div className="flex items-center justify-between gap-2 px-3 py-2.5 flex-1 min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              {/* Checkbox redondo */}
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => {}}
                                onClick={(e) => toggleSelectOrder(orderId, e as React.MouseEvent)}
                                className="rounded-full flex-shrink-0"
                                aria-label={isSelected ? 'Desmarcar pedido' : 'Selecionar pedido'}
                              />

                              {/* ID do pedido + data de criação */}
                              <div className="min-w-0">
                                <button
                                  type="button"
                                  title="Clique para copiar o ID"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void navigator.clipboard.writeText(orderId).then(() => {
                                      toast({ description: `ID copiado: ${orderId}` });
                                    });
                                  }}
                                  className="flex items-center gap-1 group rounded px-1 -mx-1 hover:bg-muted transition-colors"
                                >
                                  <span className="font-mono text-sm font-semibold truncate">{orderId}</span>
                                  <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                </button>
                                {createdAtLabel && (
                                  <span className="block px-1 text-[11px] text-muted-foreground">
                                    {createdAtLabel}
                                  </span>
                                )}
                              </div>

                              {/* Badges */}
                              {isMl && (
                                <span className="shrink-0 rounded-full bg-yellow-100 border border-yellow-400 px-2 py-0.5 text-[10px] font-bold text-yellow-800 uppercase tracking-wide">ML</span>
                              )}
                              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                                {allProducts.length} {allProducts.length === 1 ? 'item' : 'itens'}
                              </span>
                            </div>

                            {/* Botão gerar etiqueta — ocultar quando há seleção */}
                            {!hasSelection && (
                              <button
                                type="button"
                                disabled={isProcessing}
                                onClick={(e) => { e.stopPropagation(); void handleGenerateLabel(orderId); }}
                                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                                  isProcessing
                                    ? 'opacity-60 cursor-wait'
                                    : isMl
                                    ? 'bg-yellow-400 hover:bg-yellow-500 text-yellow-900 focus:ring-yellow-400'
                                    : 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500'
                                }`}
                              >
                                {isProcessing ? (
                                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /><span>Gerando...</span></>
                                ) : isMl ? (
                                  <><Truck className="h-3.5 w-3.5" /><span>Etiqueta ML</span></>
                                ) : (
                                  <><Printer className="h-3.5 w-3.5" /><span>Gerar etiqueta</span></>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateRows: isOpen && products.length > 0 ? '1fr' : '0fr',
                          opacity: isOpen && products.length > 0 ? 1 : 0,
                          transition: 'grid-template-rows 200ms ease, opacity 200ms ease',
                        }}
                      >
                        <div style={{ overflow: 'hidden' }}>
                          <div
                            className="flex flex-wrap gap-2 border border-t-0 rounded-b bg-accent/30 px-2 py-2"
                          >
                            {products.map((item, idx) => {
                              const imgUrl = item.img_url_variacao || item.img_url_produto;
                              return (
                                <div key={idx} className="flex flex-col items-center gap-0.5 max-w-[60px]">
                                  {imgUrl ? (
                                    <img
                                      src={imgUrl}
                                      alt={item.nome_produto ?? ''}
                                      className="h-12 w-12 rounded object-cover border"
                                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                    />
                                  ) : (
                                    <div className="h-12 w-12 rounded border bg-muted flex items-center justify-center text-[10px] text-muted-foreground">sem foto</div>
                                  )}
                                  <span className="text-[10px] text-center leading-tight line-clamp-2 w-full">
                                    {item.nome_variacao || item.nome_produto || '—'}
                                  </span>
                                  {(item.quantidade ?? 1) > 1 && (
                                    <span className="text-[10px] font-semibold text-muted-foreground">×{item.quantidade}</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Toolbar de lote */}
          {selectedOrderIds.size > 0 && (
            <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10 px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <CheckSquare className="h-4 w-4 text-primary" />
                <span>{selectedOrderIds.size} pedido(s) selecionado(s)</span>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedOrderIds(new Set())} className="text-muted-foreground">
                  Limpar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={batchProcessing}
                  className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg font-semibold shadow-sm"
                  onClick={() => void handleBatchGenerateLabels()}
                >
                  {batchProcessing ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /><span>Processando...</span></>
                  ) : (
                    <><PackageCheck className="h-4 w-4" /><span>Emitir {selectedOrderIds.size} etiqueta(s)</span></>
                  )}
                </Button>
              </div>
            </div>
          )}

          {filteredActiveOrderIds.length > 0 && (
            <div className="flex items-center justify-between gap-2 pt-2">
              <div className="text-xs text-muted-foreground">
                Página {orderIdsPage} de {totalOrderIdsPages}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={orderIdsPage <= 1}
                  onClick={() => setOrderIdsPage((prev) => Math.max(1, prev - 1))}
                >
                  Anterior
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={orderIdsPage >= totalOrderIdsPages}
                  onClick={() => setOrderIdsPage((prev) => Math.min(totalOrderIdsPages, prev + 1))}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== Modal de progresso — etiqueta em lote ===== */}
      <Dialog open={progressModalOpen} onOpenChange={(open) => { if (!batchProcessing) setProgressModalOpen(open); }}>
        <DialogContent className="!w-[92vw] !max-w-[600px] px-0 pb-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-4 border-b bg-gradient-to-r from-primary/5 to-background">
            <DialogTitle className="flex items-center gap-2">
              {batchProcessing ? (
                <><Loader2 className="h-5 w-5 animate-spin text-primary" /><span>Processando etiquetas em lote...</span></>
              ) : (
                <><PackageCheck className="h-5 w-5 text-green-600" /><span>Resultado do lote</span></>
              )}
            </DialogTitle>
            {/* Barra de progresso */}
            {progressItems.length > 0 && (() => {
              const done = progressItems.filter((i) => i.status === 'success' || i.status === 'error').length;
              const pct = Math.round((done / progressItems.length) * 100);
              const successes = progressItems.filter((i) => i.status === 'success').length;
              const errors = progressItems.filter((i) => i.status === 'error').length;
              return (
                <div className="mt-3 space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{done}/{progressItems.length} processados</span>
                    <span className="flex items-center gap-3">
                      {successes > 0 && <span className="text-green-600 font-medium">✓ {successes} sucesso(s)</span>}
                      {errors > 0 && <span className="text-red-500 font-medium">✗ {errors} erro(s)</span>}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: errors > 0 ? '#f59e0b' : '#22c55e',
                      }}
                    />
                  </div>
                </div>
              );
            })()}
          </DialogHeader>

          <div className="max-h-[55vh] overflow-y-auto px-6 py-3 space-y-1.5">
            {progressItems.map((item) => (
              <div
                key={item.orderId}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                  item.status === 'success'
                    ? 'border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800'
                    : item.status === 'error'
                    ? 'border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800'
                    : item.status === 'processing'
                    ? 'border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800'
                    : 'border-border bg-muted/20'
                }`}
              >
                <span className="shrink-0">
                  {item.status === 'success' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                  {item.status === 'error' && <XCircle className="h-4 w-4 text-red-500" />}
                  {item.status === 'processing' && <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />}
                  {item.status === 'pending' && <Clock className="h-4 w-4 text-muted-foreground" />}
                </span>
                <span className="font-mono text-xs flex-1 truncate">{item.orderId}</span>
                <span className={`text-xs shrink-0 font-medium ${
                  item.status === 'success' ? 'text-green-700' :
                  item.status === 'error' ? 'text-red-600' :
                  item.status === 'processing' ? 'text-blue-600' :
                  'text-muted-foreground'
                }`}>
                  {item.status === 'success' && 'Sucesso'}
                  {item.status === 'error' && (item.message ? `Erro: ${item.message.slice(0, 40)}` : 'Erro')}
                  {item.status === 'processing' && 'Processando...'}
                  {item.status === 'pending' && 'Aguardando'}
                </span>
              </div>
            ))}
          </div>

          <div className="px-6 py-4 border-t bg-muted/20 flex justify-end">
            <Button
              type="button"
              disabled={batchProcessing}
              onClick={() => setProgressModalOpen(false)}
              className="px-6"
            >
              {batchProcessing ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Aguarde...</> : 'Fechar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== Modal de progresso — etiqueta individual ===== */}
      <Dialog open={!!singleLabelProgress?.open} onOpenChange={(open) => { if (!open && singleLabelProgress?.status !== 'processing') setSingleLabelProgress(null); }}>
        <DialogContent className="!max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {singleLabelProgress?.isMl ? (
                <Truck className="h-5 w-5 text-yellow-500" />
              ) : (
                <Printer className="h-5 w-5 text-blue-500" />
              )}
              {singleLabelProgress?.isMl ? 'Etiqueta Mercado Livre' : 'Gerar Etiqueta'}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4 py-6">
            {singleLabelProgress?.status === 'processing' && (
              <>
                <div className="relative">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Gerando etiqueta para<br />
                  <span className="font-mono font-semibold text-foreground">{singleLabelProgress.orderId}</span>
                </p>
              </>
            )}
            {singleLabelProgress?.status === 'success' && (
              <>
                <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-green-700 dark:text-green-400">Etiqueta gerada!</p>
                  <p className="text-xs text-muted-foreground mt-1">{singleLabelProgress.message}</p>
                </div>
              </>
            )}
            {singleLabelProgress?.status === 'error' && (
              <>
                <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <XCircle className="h-8 w-8 text-red-500" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-red-700 dark:text-red-400">Falha ao gerar etiqueta</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">{singleLabelProgress.message}</p>
                </div>
              </>
            )}
          </div>

          {singleLabelProgress?.status !== 'processing' && (
            <div className="flex justify-center pb-2">
              <Button type="button" onClick={() => setSingleLabelProgress(null)} className="px-8">
                Fechar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de seleção de variação (produto-mãe) */}
      <Dialog
        open={produtoVariacoesModal.open}
        onOpenChange={(open) => {
          if (!open) setProdutoVariacoesModal({ open: false, produto: null });
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex flex-col gap-1">
              <span>{produtoVariacoesModal.produto?.nome_produto}</span>
              <span className="text-sm text-muted-foreground font-normal">
                Selecione a variação para ver a quantidade e abrir os pedidos
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto space-y-2 pr-1">
            {(produtoVariacoesModal.produto?.variacoes || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma variação encontrada.</p>
            ) : (
              (produtoVariacoesModal.produto?.variacoes || []).map((variacao, idx) => (
                <button
                  key={`${variacao.variacao_id ?? 'sem-variacao'}-${idx}`}
                  type="button"
                  onClick={() => {
                    if (!produtoVariacoesModal.produto) return;
                    handleSelectVariacao(produtoVariacoesModal.produto, variacao);
                  }}
                  className="w-full flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {variacao.img_url ? (
                      <img src={variacao.img_url} alt={variacao.nome_variacao || 'Sem variação'} className="h-10 w-10 rounded-md object-cover border" />
                    ) : (
                      <div className="h-10 w-10 rounded-md border bg-muted flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{variacao.nome_variacao || 'Sem variação'}</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs px-2 py-0.5 min-w-[1.5rem]">
                    ×{variacao.quantidade_total}
                  </span>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Pedidos do Produto (relação) */}
      <Dialog open={produtoPedidosModal.open} onOpenChange={(open) => { if (!open) setProdutoPedidosModal((prev) => ({ ...prev, open: false })); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              <div className="flex items-center gap-3">
                {produtoPedidosModal.item?.imgUrl ? (
                  <img src={produtoPedidosModal.item.imgUrl} alt="" className="h-10 w-10 rounded-lg object-cover border flex-shrink-0" />
                ) : (
                  <div className="h-10 w-10 rounded-lg border bg-muted flex-shrink-0" />
                )}
                <div className="leading-tight">
                  <div className="text-base font-semibold">{produtoPedidosModal.item?.nomeProduto}</div>
                  {produtoPedidosModal.item?.nomeVariacao && (
                    <div className="text-sm font-normal text-muted-foreground">{produtoPedidosModal.item.nomeVariacao}</div>
                  )}
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="py-2">
            {produtoPedidosModal.loading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-12 rounded-lg bg-muted/40 animate-pulse" />
                ))}
              </div>
            ) : produtoPedidosModal.pedidos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum pedido encontrado para este produto.</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                <p className="text-xs text-muted-foreground mb-3">{produtoPedidosModal.pedidos.length} pedido(s) com este produto</p>
                {produtoPedidosModal.pedidos.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border px-3 py-2.5 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      {p.plataformas?.img_url ? (
                        <img src={p.plataformas.img_url} alt={p.plataformas.nome} className="h-6 w-6 rounded object-cover flex-shrink-0" />
                      ) : (
                        <div className="h-6 w-6 rounded bg-muted flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-sm font-medium truncate max-w-[10rem]">{p.id_externo || p.id}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyPedidoId(p.id_externo || p.id)}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            title="Copiar ID"
                          >
                            {copiedPedidoId === (p.id_externo || p.id) ? (
                              <Check className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                        {p.plataformas?.nome && (
                          <div className="text-[10px] text-muted-foreground">{p.plataformas.nome}</div>
                        )}
                        {Array.isArray(p.etapas_producao) && p.etapas_producao.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {p.etapas_producao.map((etapa: string, etapaIdx: number) => (
                              <span
                                key={`${p.id}-etapa-${etapaIdx}`}
                                className="inline-flex items-center rounded-full border bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-foreground"
                              >
                                {etapa}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {p.urgente && (
                        <span className="text-[10px] font-semibold text-red-500 uppercase">Urgente</span>
                      )}
                      <span className="inline-flex items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs px-2 py-0.5 min-w-[1.5rem]">
                        ×{p.quantidade_item}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}

export function Producao() {
  return <ProductionPage />;
}
