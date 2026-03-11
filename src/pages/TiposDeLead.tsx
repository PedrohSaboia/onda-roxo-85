import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import ComercialSidebar from '@/components/layout/ComercialSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Tags } from 'lucide-react';

export default function TiposDeLead() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [nome, setNome] = useState('');
  const [foto, setFoto] = useState('');
  const [isTypeBot, setIsTypeBot] = useState(false);
  const [idType, setIdType] = useState('');
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setNome('');
    setFoto('');
    setIsTypeBot(false);
    setIdType('');
  };

  const handleSave = async () => {
    if (!nome.trim()) {
      toast({ title: 'Campo obrigatório', description: 'Informe o nome do tipo de lead', variant: 'destructive' });
      return;
    }

    let parsedIdType: number | null = null;
    if (isTypeBot) {
      if (!idType.trim()) {
        toast({ title: 'Campo obrigatório', description: 'Informe o Id do type para tipo Type Bot', variant: 'destructive' });
        return;
      }

      const asNumber = Number(idType);
      if (!Number.isInteger(asNumber) || asNumber < -32768 || asNumber > 32767) {
        toast({ title: 'id_type inválido', description: 'Informe um número inteiro smallint válido', variant: 'destructive' });
        return;
      }

      parsedIdType = asNumber;
    }

    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from('tipo_de_lead')
        .insert({
          nome: nome.trim(),
          img_url: foto.trim() || null,
          id_type: parsedIdType,
        });

      if (error) throw error;

      toast({ title: 'Tipo de lead criado', description: `${nome.trim()} foi cadastrado com sucesso.` });
      resetForm();
    } catch (err: any) {
      toast({ title: 'Erro ao criar tipo de lead', description: err?.message || 'Não foi possível salvar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] bg-[hsl(var(--background))]">
      <ComercialSidebar />

      <div className="flex-1 overflow-y-auto p-6">
        <Card>
          <CardHeader className="space-y-4">
            <div className="flex items-center justify-between">
              <CardTitle>
                <button
                  type="button"
                  onClick={() => navigate('/leads')}
                  className="flex items-center gap-2 text-base font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Voltar para leads
                </button>
              </CardTitle>
            </div>
          </CardHeader>

          <CardContent>
            <div className="max-w-xl mx-auto space-y-6 py-2">
              <div className="text-center pb-2">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mb-3">
                  <Tags className="h-6 w-6 text-blue-600" />
                </div>
                <h2 className="text-xl font-bold">Criar Tipo de Lead</h2>
                <p className="text-sm text-muted-foreground mt-1">Cadastre um novo tipo para uso no formulário de leads</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Nome <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="Ex.: WhatsApp"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Foto (URL)</Label>
                  <Input
                    placeholder="https://..."
                    value={foto}
                    onChange={(e) => setFoto(e.target.value)}
                  />
                </div>

                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <Label className="text-sm font-medium">É Type Bot?</Label>
                    <p className="text-xs text-muted-foreground">Ative para informar o Id do type</p>
                  </div>
                  <Switch checked={isTypeBot} onCheckedChange={(v) => setIsTypeBot(Boolean(v))} />
                </div>

                {isTypeBot && (
                  <div className="space-y-1.5">
                    <Label>Id do type <span className="text-red-500">*</span></Label>
                    <Input
                      placeholder="Ex.: 4"
                      value={idType}
                      onChange={(e) => setIdType(e.target.value.replace(/[^0-9-]/g, ''))}
                      inputMode="numeric"
                    />
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={resetForm}
                    disabled={saving}
                  >
                    Limpar
                  </Button>
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    onClick={handleSave}
                    disabled={saving || !nome.trim()}
                  >
                    {saving ? 'Salvando...' : 'Criar Tipo'}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
