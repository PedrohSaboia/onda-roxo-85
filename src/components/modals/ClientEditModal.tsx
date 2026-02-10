import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId: string | null | undefined;
  onSaved?: () => void;
};

const onlyDigits = (s = '') => (s || '').toString().replace(/\D/g, '');
const formatCPF = (v = '') => {
  const d = onlyDigits(v).slice(0,11);
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, (_, a,b,c,d2) => {
    return `${a}.${b}.${c}${d2 ? '-'+d2 : ''}`;
  });
};
const formatCNPJ = (v = '') => {
  const d = onlyDigits(v).slice(0,14);
  return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, (_, a,b,c,d2,e) => {
    return `${a}.${b}.${c}/${d2}${e ? '-'+e : ''}`;
  });
};
const formatPhone = (v = '') => {
  const d = onlyDigits(v).slice(0,11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, (_, a,b,c) => (c ? `(${a}) ${b}-${c}` : `(${a}) ${b}`));
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, (_, a,b,c) => (c ? `(${a}) ${b}-${c}` : `(${a}) ${b}`));
};
const formatCEP = (v = '') => onlyDigits(v).slice(0,8).replace(/(\d{5})(\d{0,3})/, (_, a,b) => (b ? `${a}-${b}` : a));

// Validators (copied/adapted from InformacoesEntrega)
const isValidCPF = (v = '') => {
  const s = onlyDigits(v);
  if (s.length !== 11) return false;
  if (/^(\d)\1+$/.test(s)) return false;
  const calc = (arr: number[], factor: number) => {
    const total = arr.reduce((acc, n) => acc + n * factor--, 0);
    const mod = (total * 10) % 11;
    return mod === 10 ? 0 : mod;
  };
  const nums = s.split('').map(n => parseInt(n, 10));
  const d1 = calc(nums.slice(0,9), 10);
  const d2 = calc(nums.slice(0,9).concat(d1), 11);
  return d1 === nums[9] && d2 === nums[10];
};
const isValidCNPJ = (v = '') => {
  const s = onlyDigits(v);
  if (s.length !== 14) return false;
  if (/^(\d)\1+$/.test(s)) return false;
  const t = s.split('').map(n => parseInt(n,10));
  const calc = (tarr: number[], pos: number) => {
    let sum = 0;
    let j = pos - 7;
    for (let i = pos; i >= 1; i--) {
      sum += tarr[pos - i] * j;
      j = j === 2 ? 9 : j - 1;
    }
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = calc(t.slice(0,12), 12);
  const d2 = calc(t.slice(0,12).concat(d1), 13);
  return d1 === t[12] && d2 === t[13];
};


export default function ClientEditModal({ open, onOpenChange, clienteId, onSaved }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [cliente, setCliente] = useState<any | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    const load = async () => {
      if (!clienteId) return;
      setLoading(true);
      try {
        const { data, error } = await supabase.from('clientes').select('*').eq('id', clienteId).single();
        if (error) throw error;
        if (!mounted) return;
        setCliente({
          id: data.id,
          nome: data.nome || '',
          tipo: (data as any)?.cnpj ? 'pj' : 'pf',
          documento: (data as any)?.cpf || (data as any)?.cnpj || '',
          email: data.email || '',
          telefone: data.telefone || '',
          cep: data.cep || '',
          endereco: data.endereco || '',
          numero: data.numero || '',
          complemento: data.complemento || '',
          observacao: (data as any).observacao || '',
          bairro: data.bairro || '',
          cidade: data.cidade || '',
          estado: data.estado || '',
        });
      } catch (err) {
        console.error(err);
        toast({ title: 'Erro', description: 'Não foi possível carregar o cliente', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => { mounted = false };
  }, [open, clienteId]);

  const updateField = (key: string, value: any) => setCliente((c: any) => c ? ({ ...c, [key]: value }) : c);

  const gerarTelefoneGenerico = () => {
    updateField('telefone', '99999999999'); // (99) 99999-9999
  };

  const gerarEmailGenerico = () => {
    if (!cliente?.nome) {
      toast({ title: 'Atenção', description: 'Preencha o nome primeiro', variant: 'destructive' });
      return;
    }
    
    // Normalizar nome: remover acentos e caracteres especiais
    const normalizarTexto = (texto: string) => {
      return texto
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '') // Remove caracteres especiais
        .trim();
    };
    
    const palavras = normalizarTexto(cliente.nome).split(/\s+/).filter(p => p.length > 0);
    
    if (palavras.length === 0) {
      toast({ title: 'Atenção', description: 'Nome inválido', variant: 'destructive' });
      return;
    }
    
    let emailBase = '';
    if (palavras.length === 1) {
      emailBase = palavras[0];
    } else {
      // Primeiro nome + último sobrenome
      emailBase = palavras[0] + '.' + palavras[palavras.length - 1];
    }
    
    const emailGerado = `${emailBase}@emailgenerico.com`;
    updateField('email', emailGerado);
  };

  const validateAll = (c: any) => {
    const errs: Record<string, string | null> = {};
    if (!c) return errs;
    // nome
    errs.nome = (!c.nome || c.nome.trim().length < 3) ? 'Nome inválido' : null;
    // documento (opcional, mas se preenchido deve ser válido)
    const docDigits = onlyDigits(c.documento || '');
    if (docDigits.length > 0) {
      if (c.tipo === 'pj') {
        errs.documento = docDigits.length === 14 && isValidCNPJ(docDigits) ? null : 'CNPJ inválido!';
      } else {
        errs.documento = docDigits.length === 11 && isValidCPF(docDigits) ? null : 'CPF inválido!';
      }
    }
    // email (opcional, mas se preenchido deve ser válido)
    if (c.email && c.email.trim().length > 0) {
      errs.email = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email) ? null : 'E-mail inválido!';
    }
    // telefone (opcional, mas se preenchido deve ter 10+ dígitos)
    if (c.telefone && onlyDigits(c.telefone).length > 0) {
      errs.telefone = onlyDigits(c.telefone).length >= 10 ? null : 'Telefone inválido!';
    }
    // cep (opcional, mas se preenchido deve ter 8 dígitos)
    if (c.cep && onlyDigits(c.cep).length > 0) {
      errs.cep = onlyDigits(c.cep).length === 8 ? null : 'CEP inválido!';
    }
    // Todos os campos de endereço são opcionais agora
    return errs;
  };

  useEffect(() => {
    setFieldErrors(validateAll(cliente));
  }, [cliente]);

  const handleSalvar = async () => {
    if (!cliente) return;
    // run validation
    const errs = validateAll(cliente);
    setFieldErrors(errs);
    const hasErrors = Object.values(errs).some(v => v);
    if (hasErrors) {
      toast({ title: 'Erro', description: 'Preencha corretamente os campos obrigatórios', variant: 'destructive' });
      return;
    }
    setSalvando(true);
    try {
      const payload: any = {
        nome: cliente.nome,
        cpf: cliente.tipo === 'pf' ? cliente.documento : null,
        cnpj: cliente.tipo === 'pj' ? cliente.documento : null,
        email: cliente.email,
        telefone: cliente.telefone,
        cep: cliente.cep,
        endereco: cliente.endereco,
        numero: cliente.numero,
        complemento: cliente.complemento || null,
        observacao: cliente.observacao || null,
        bairro: cliente.bairro,
        cidade: cliente.cidade,
        estado: cliente.estado,
        atualizado_em: new Date().toISOString(),
      };
      const { error } = await supabase.from('clientes').update(payload).eq('id', cliente.id);
      if (error) throw error;
      toast({ title: 'Sucesso', description: 'Dados salvos com sucesso' });
      onOpenChange(false);
      if (onSaved) onSaved();
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro', description: 'Não foi possível salvar os dados', variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Editar Cliente</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 overflow-y-auto pr-2 flex-1">
          <div>
            <label className="block text-sm text-muted-foreground">Nome</label>
            <Input value={cliente?.nome || ''} onChange={(e) => updateField('nome', e.target.value)} />
            {fieldErrors['nome'] && <div className="text-sm text-red-600 mt-1">{fieldErrors['nome']}</div>}
          </div>

          <div>
            <div className="flex gap-2">
              <button className={`px-3 py-2 rounded ${cliente?.tipo === 'pf' ? 'bg-white shadow' : 'bg-gray-100'}`} onClick={() => updateField('tipo', 'pf')}>Pessoa Física</button>
              <button className={`px-3 py-2 rounded ${cliente?.tipo === 'pj' ? 'bg-white shadow' : 'bg-gray-100'}`} onClick={() => updateField('tipo', 'pj')}>Pessoa Jurídica</button>
            </div>
          </div>

          <div>
            <label className="block text-sm text-muted-foreground">Documento</label>
            <Input value={cliente?.tipo === 'pj' ? formatCNPJ(cliente?.documento || '') : formatCPF(cliente?.documento || '')} onChange={(e) => updateField('documento', onlyDigits(e.target.value))} />
            {fieldErrors['documento'] && <div className="text-sm text-red-600 mt-1">{fieldErrors['documento']}</div>}
          </div>

          <div>
            <label className="block text-sm text-muted-foreground">E-mail</label>
            <div className="flex gap-2">
              <Input value={cliente?.email || ''} onChange={(e) => updateField('email', e.target.value.trim().toLowerCase())} className="flex-1" />
              <Button type="button" variant="outline" size="sm" onClick={gerarEmailGenerico} className="shrink-0">
                Gerar Email
              </Button>
            </div>
            {fieldErrors['email'] && <div className="text-sm text-red-600 mt-1">{fieldErrors['email']}</div>}
          </div>

          <div>
            <label className="block text-sm text-muted-foreground">Telefone</label>
            <div className="flex gap-2">
              <Input value={formatPhone(cliente?.telefone || '')} onChange={(e) => updateField('telefone', onlyDigits(e.target.value))} className="flex-1" />
              <Button type="button" variant="outline" size="sm" onClick={gerarTelefoneGenerico} className="shrink-0">
                Gerar Tel.
              </Button>
            </div>
            {fieldErrors['telefone'] && <div className="text-sm text-red-600 mt-1">{fieldErrors['telefone']}</div>}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-muted-foreground">CEP</label>
                <Input value={formatCEP(cliente?.cep || '')} onChange={(e) => updateField('cep', onlyDigits(e.target.value))} />
                {fieldErrors['cep'] && <div className="text-sm text-red-600 mt-1">{fieldErrors['cep']}</div>}
            </div>
            <div>
              <label className="block text-sm text-muted-foreground">Cidade</label>
              <Input value={cliente?.cidade || ''} onChange={(e) => updateField('cidade', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground">UF</label>
              <Input value={cliente?.estado || ''} onChange={(e) => updateField('estado', e.target.value.toUpperCase())} maxLength={2} />
            </div>
          </div>

          <div>
              <label className="block text-sm text-muted-foreground">Endereço</label>
            <Input value={cliente?.endereco || ''} onChange={(e) => updateField('endereco', e.target.value)} />
            {fieldErrors['endereco'] && <div className="text-sm text-red-600 mt-1">{fieldErrors['endereco']}</div>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-muted-foreground">Número</label>
              <Input value={cliente?.numero || ''} onChange={(e) => updateField('numero', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground">Bairro</label>
              <Input value={cliente?.bairro || ''} onChange={(e) => updateField('bairro', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-sm text-muted-foreground">Complemento (máx. 17 caracteres)</label>
            <Input maxLength={17} value={cliente?.complemento || ''} onChange={(e) => updateField('complemento', e.target.value)} />
            <div className="text-xs text-muted-foreground mt-1">{(cliente?.complemento || '').length}/17 caracteres</div>
          </div>

          <div>
            <label className="block text-sm text-muted-foreground">Observação (máx. 30 caracteres)</label>
            <textarea className="w-full p-2 border rounded-md" rows={3} maxLength={30} value={cliente?.observacao || ''} onChange={(e) => updateField('observacao', e.target.value)} />
            <div className="text-xs text-muted-foreground mt-1">{(cliente?.observacao || '').length}/30 caracteres</div>
          </div>
        </div>

        <DialogFooter>
          <div className="flex justify-between w-full">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button className="bg-custom-700 text-white" onClick={handleSalvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
