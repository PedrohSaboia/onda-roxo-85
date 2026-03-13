import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import ComercialSidebar from '@/components/layout/ComercialSidebar';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Tags, Plus, Trash2, Bot, ImageUp, X } from 'lucide-react';

type TipoLead = {
  id: number;
  nome: string;
  img_url: string | null;
  id_type: number | null;
};

export default function TiposDeLead() {
  const { toast } = useToast();

  const [nome, setNome] = useState('');
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState('');
  const [isTypeBot, setIsTypeBot] = useState(false);
  const [idType, setIdType] = useState('');
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tipos, setTipos] = useState<TipoLead[]>([]);
  const [loadingTipos, setLoadingTipos] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const resetForm = () => {
    setNome('');
    setFotoFile(null);
    setFotoPreview('');
    setIsTypeBot(false);
    setIdType('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const loadTipos = async () => {
    setLoadingTipos(true);
    try {
      const { data, error } = await (supabase as any)
        .from('tipo_de_lead')
        .select('id,nome,img_url,id_type')
        .order('id');
      if (error) throw error;
      setTipos(data || []);
    } catch (err: any) {
      console.error('Erro ao carregar tipos de lead:', err);
    } finally {
      setLoadingTipos(false);
    }
  };

  useEffect(() => { loadTipos(); }, []);

  const handleSave = async () => {
    if (!nome.trim()) {
      toast({ title: 'Campo obrigatório', description: 'Informe o nome do tipo de lead', variant: 'destructive' });
      return;
    }

    let parsedIdType: number | null = null;
    if (isTypeBot) {
      if (!idType.trim()) {
        toast({ title: 'Campo obrigatório', description: 'Informe o Id do type', variant: 'destructive' });
        return;
      }
      const asNumber = Number(idType);
      if (!Number.isInteger(asNumber) || asNumber < -32768 || asNumber > 32767) {
        toast({ title: 'Id inválido', description: 'Informe um número inteiro válido (smallint)', variant: 'destructive' });
        return;
      }
      parsedIdType = asNumber;
    }

    setSaving(true);
    try {
      let imgUrl: string | null = null;
      if (fotoFile) {
        const ext = fotoFile.name.split('.').pop();
        const fileName = `${Date.now()}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('tipos-lead')
          .upload(fileName, fotoFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('tipos-lead').getPublicUrl(uploadData.path);
        imgUrl = publicUrl;
      }

      const { error } = await (supabase as any)
        .rpc('insert_tipo_de_lead', {
          p_nome: nome.trim(),
          p_img_url: imgUrl,
          p_id_type: parsedIdType
        });
      if (error) throw error;
      toast({ title: 'Tipo criado', description: `"${nome.trim()}" foi cadastrado com sucesso.` });
      resetForm();
      loadTipos();
    } catch (err: any) {
      toast({ title: 'Erro ao criar tipo', description: err?.message || 'Não foi possível salvar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, nomeTipo: string) => {
    setDeletingId(id);
    try {
      const { data, error } = await (supabase as any).rpc('delete_tipo_de_lead', { p_id: id });
      if (error) throw error;
      if (!data) {
        throw new Error('Tipo de lead não encontrado');
      }
      toast({ title: 'Tipo removido', description: `"${nomeTipo}" foi excluído.` });
      setTipos(prev => prev.filter(t => t.id !== id));
    } catch (err: any) {
      toast({ title: 'Erro ao excluir', description: err?.message || 'Não foi possível excluir', variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] bg-[hsl(var(--background))]">
      <ComercialSidebar />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* ── Cabeçalho ── */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tipos de Lead</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie os tipos utilizados no formulário de leads</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">

          {/* ── Formulário ── */}
          <Card className="lg:col-span-2">
            <CardContent className="pt-6 space-y-5">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100">
                  <Plus className="h-4 w-4 text-blue-600" />
                </div>
                <span className="font-semibold text-sm">Novo tipo</span>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Nome <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="Ex.: WhatsApp"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <ImageUp className="h-3 w-3" /> Foto
                </Label>

                {fotoPreview ? (
                  <div className="relative w-full h-32 rounded-lg overflow-hidden border">
                    <img src={fotoPreview} alt="preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => { setFotoFile(null); setFotoPreview(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                      className="absolute top-1.5 right-1.5 flex items-center justify-center w-6 h-6 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div
                    className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted/20 hover:bg-muted/40 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files?.[0];
                      if (file && file.type.startsWith('image/')) {
                        setFotoFile(file);
                        setFotoPreview(URL.createObjectURL(file));
                      }
                    }}
                  >
                    <ImageUp className="h-6 w-6 text-muted-foreground/60 mb-1.5" />
                    <span className="text-xs text-muted-foreground font-medium">Clique ou arraste uma imagem</span>
                    <span className="text-[11px] text-muted-foreground/60 mt-0.5">PNG, JPG, WEBP</span>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setFotoFile(file);
                      setFotoPreview(URL.createObjectURL(file));
                    }
                  }}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Type Bot</p>
                    <p className="text-xs text-muted-foreground">Ative para informar o Id do type</p>
                  </div>
                </div>
                <Switch checked={isTypeBot} onCheckedChange={(v) => setIsTypeBot(Boolean(v))} />
              </div>

              {isTypeBot && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Id do type <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    placeholder="Ex.: 4"
                    value={idType}
                    onChange={(e) => setIdType(e.target.value.replace(/[^0-9-]/g, ''))}
                    inputMode="numeric"
                  />
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={resetForm} disabled={saving}>
                  Limpar
                </Button>
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handleSave}
                  disabled={saving || !nome.trim()}
                >
                  {saving ? 'Salvando...' : 'Criar Tipo'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ── Lista de tipos ── */}
          <div className="lg:col-span-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Tipos cadastrados</span>
              <Badge variant="secondary">{tipos.length}</Badge>
            </div>

            {loadingTipos ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-16 rounded-lg bg-muted/40 animate-pulse" />
                ))}
              </div>
            ) : tipos.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
                <Tags className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum tipo cadastrado ainda</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tipos.map((tipo) => (
                  <div
                    key={tipo.id}
                    className="flex items-center gap-3 rounded-lg border bg-white px-4 py-3 shadow-sm hover:shadow-md transition-shadow"
                  >
                    {tipo.img_url ? (
                      <img
                        src={tipo.img_url}
                        alt={tipo.nome}
                        className="h-9 w-9 rounded-lg object-cover border flex-shrink-0"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                    ) : (
                      <div className="h-9 w-9 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <Tags className="h-4 w-4 text-blue-600" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{tipo.nome}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {tipo.id_type !== null ? (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1.5 gap-1">
                            <Bot className="h-2.5 w-2.5" /> Type Bot · {tipo.id_type}
                          </Badge>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">ID #{tipo.id}</span>
                        )}
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50 flex-shrink-0"
                      disabled={deletingId === tipo.id}
                      onClick={() => handleDelete(tipo.id, tipo.nome)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
