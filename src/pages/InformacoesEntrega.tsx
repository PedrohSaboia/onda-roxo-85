import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type Cliente = {
  id: string;
  nome: string;
  tipo: 'pf' | 'pj';
  documento: string; // CPF ou CNPJ
  email: string;
  telefone: string;
  cep: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
};

export default function InformacoesEntrega() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [cliente, setCliente] = useState<Partial<Cliente> | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchCliente = async () => {
      if (!id) return setLoading(false);
      const { data, error } = await supabase.from('clientes').select('*').eq('id', id).single();
      if (error) {
        console.error(error);
        toast({ title: 'Erro', description: 'Não foi possível carregar o cliente', variant: 'destructive' });
      } else {
        setCliente({
          id: data.id,
          nome: data.nome || '',
          // derive tipo locally from presence of cnpj (if table doesn't have 'tipo')
          tipo: (data as any)?.cnpj ? 'pj' : 'pf',
          documento: (data as any)?.cpf || (data as any)?.cnpj || '',
          email: data.email || '',
          telefone: data.telefone || '',
          cep: data.cep || '',
          endereco: data.endereco || '',
          numero: data.numero || '',
          complemento: data.complemento || '',
          bairro: data.bairro || '',
          cidade: data.cidade || '',
          estado: data.estado || '',
        });
      }
      setLoading(false);
    };
    fetchCliente();
  }, [id]);

  const updateField = (field: keyof Cliente, value: string) => {
    setCliente(prev => prev ? ({ ...prev, [field]: value }) : prev);
  };

  // formatting helpers
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

  // validators
  const isValidCPF = (v = '') => {
    const s = onlyDigits(v);
    if (s.length !== 11) return false;
    // basic invalid sequences
    if (/^(\d)\1+$/.test(s)) return false;
    // calc digits
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

  const fieldErrors: Record<string, string | null> = {};
  if (cliente) {
    // nome
    fieldErrors['nome'] = (!cliente.nome || cliente.nome.trim().length < 3) ? 'Nome inválido' : null;
    // documento
    const docDigits = onlyDigits(cliente.documento || '');
    if (cliente.tipo === 'pj') {
      fieldErrors['documento'] = docDigits.length === 14 && isValidCNPJ(docDigits) ? null : 'CNPJ inválido!';
    } else {
      fieldErrors['documento'] = docDigits.length === 11 && isValidCPF(docDigits) ? null : 'CPF inválido!';
    }
    // email
    fieldErrors['email'] = (cliente.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cliente.email)) ? null : 'E-mail inválido!';
    // telefone
    fieldErrors['telefone'] = (cliente.telefone && onlyDigits(cliente.telefone).length >= 10) ? null : 'Telefone inválido!';
    // cep
    fieldErrors['cep'] = (cliente.cep && onlyDigits(cliente.cep).length === 8) ? null : 'CEP inválido!';
  }

  const validateStep1 = () => {
    if (!cliente) return false;
    if (!cliente.nome || cliente.nome.trim().length < 3) return false;
    if (!cliente.documento || cliente.documento.replace(/\D/g, '').length < (cliente.tipo === 'pj' ? 14 : 11)) return false;
    if (!cliente.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cliente.email)) return false;
    if (!cliente.telefone || cliente.telefone.replace(/\D/g, '').length < 10) return false;
    return true;
  };

  const handleBuscarCep = async () => {
    if (!cliente) return;
    const cepLimpo = (cliente.cep || '').replace(/\D/g, '');
    if (cepLimpo.length !== 8) {
      toast({ title: 'Erro', description: 'Digite um CEP válido com 8 números.', variant: 'destructive' });
      return;
    }
    try {
      setBuscandoCep(true);
      const resp = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await resp.json();
      if (data.erro) {
        toast({ title: 'Erro', description: 'CEP não encontrado.', variant: 'destructive' });
        return;
      }
      updateField('endereco', data.logradouro || '');
      updateField('bairro', data.bairro || '');
      updateField('cidade', data.localidade || '');
      updateField('estado', data.uf || '');
      toast({ title: 'Sucesso', description: 'Endereço preenchido automaticamente' });
      // advance to step 2 so the user can fill number/complement and save
      setStep(2);
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro', description: 'Erro ao buscar CEP', variant: 'destructive' });
    } finally {
      setBuscandoCep(false);
    }
  };

  const handleSalvar = async () => {
    if (!cliente) return;
    // per-field validation for address
    const missing: string[] = [];
    if (!cliente.endereco) missing.push('Endereço');
    if (!cliente.numero) missing.push('Número');
    if (!cliente.bairro) missing.push('Bairro');
    if (!cliente.cidade) missing.push('Cidade');
    if (!cliente.estado) missing.push('Estado');
    if (missing.length) {
      const list = missing.join(', ');
      toast({ title: 'Erro', description: `Preencha os campos obrigatórios: ${list}`, variant: 'destructive' });
      return;
    }
    setSalvando(true);
    try {
      const payload: any = {
        nome: cliente.nome,
        // do not send 'tipo' to the DB; not all schemas have this column
        cpf: cliente.tipo === 'pf' ? cliente.documento : null,
        cnpj: cliente.tipo === 'pj' ? cliente.documento : null,
        email: cliente.email,
        telefone: cliente.telefone,
        cep: cliente.cep,
        endereco: cliente.endereco,
        numero: cliente.numero,
        complemento: cliente.complemento || null,
        bairro: cliente.bairro,
        cidade: cliente.cidade,
        estado: cliente.estado,
        atualizado_em: new Date().toISOString()
      };

      const { error } = await supabase.from('clientes').update(payload as any).eq('id', cliente.id);
      if (error) {
        console.error(error);
        toast({ title: 'Erro', description: 'Não foi possível salvar os dados', variant: 'destructive' });
      } else {
        toast({ title: 'Sucesso', description: 'Dados salvos com sucesso' });
        // go back to the order page if present
        navigate(-1);
      }
    } finally {
      setSalvando(false);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-screen"><p>Carregando...</p></div>;
  if (!cliente) return <div className="flex justify-center items-center h-screen"><p className="text-red-500">Cliente não encontrado</p></div>;

  return (
    <div className="max-w-md mx-auto p-6">
      <h2 className="text-center text-2xl font-bold mb-4">FICHA CADASTRAL</h2>
      <p className="text-center text-sm text-muted-foreground mb-6">Informações necessárias para gerar etiqueta de envios das transportadoras.</p>

      {/* Stepper visual (simple) */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-purple-700 text-white' : 'bg-gray-300 text-gray-600'}`}>1</div>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-purple-700 text-white' : 'bg-gray-300 text-gray-600'}`}>2</div>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 3 ? 'bg-purple-700 text-white' : 'bg-gray-300 text-gray-600'}`}>3</div>
      </div>

      <div className="bg-white rounded-xl shadow p-6">
        {/* Tabbar Pessoa Física / Jurídica */}
        <div className="flex gap-2 bg-gray-100 rounded-md p-2 mb-4">
          <button
            onClick={() => updateField('tipo', 'pf')}
            className={`flex-1 p-3 rounded ${cliente.tipo === 'pf' ? 'bg-white shadow' : ''}`}
          >
            Pessoa física
          </button>
          <button
            onClick={() => updateField('tipo', 'pj')}
            className={`flex-1 p-3 rounded ${cliente.tipo === 'pj' ? 'bg-white shadow' : ''}`}
          >
            Pessoa Jurídica
          </button>
        </div>

        {step === 1 && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Nome completo *</label>
            <input className="w-full p-3 border rounded-md mb-1" value={cliente.nome || ''} onChange={(e) => updateField('nome', e.target.value)} />
            {fieldErrors['nome'] && <div className="text-sm text-red-600 mb-2">{fieldErrors['nome']}</div>}

            <label className="block text-sm font-medium text-gray-700">{cliente.tipo === 'pj' ? 'CNPJ *' : 'CPF *'}</label>
            <input className="w-full p-3 border rounded-md mb-1" value={cliente.tipo === 'pj' ? formatCNPJ(cliente.documento || '') : formatCPF(cliente.documento || '')} onChange={(e) => updateField('documento', onlyDigits(e.target.value))} />
            {fieldErrors['documento'] && <div className="text-sm text-red-600 mb-2">{fieldErrors['documento']}</div>}

            <label className="block text-sm font-medium text-gray-700">E-mail *</label>
            <input className="w-full p-3 border rounded-md mb-1" value={cliente.email || ''} onChange={(e) => updateField('email', e.target.value)} />
            {fieldErrors['email'] && <div className="text-sm text-red-600 mb-2">{fieldErrors['email']}</div>}

            <label className="block text-sm font-medium text-gray-700">Celular / WhatsApp *</label>
            <input className="w-full p-3 border rounded-md mb-1" value={formatPhone(cliente.telefone || '')} onChange={(e) => updateField('telefone', onlyDigits(e.target.value))} />
            {fieldErrors['telefone'] && <div className="text-sm text-red-600 mb-3">{fieldErrors['telefone']}</div>}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  if (!validateStep1()) {
                    toast({ title: 'Erro', description: 'Preencha todos os campos obrigatórios corretamente', variant: 'destructive' });
                    return;
                  }
                  setStep(2);
                }}
                className="bg-purple-700 text-white px-6 py-3 rounded-md"
              >
                → Continuar
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h3 className="font-semibold mb-3">Entrega</h3>
            <label className="block text-sm font-medium text-gray-700">Digite seu CEP *</label>
            <div className="flex gap-3 mb-1">
              <input className="flex-1 p-3 border rounded-md" value={formatCEP(cliente.cep || '')} onChange={(e) => updateField('cep', onlyDigits(e.target.value))} />
              <button type="button" onClick={handleBuscarCep} disabled={buscandoCep} className="bg-green-700 text-white px-6 rounded-md">
                {buscandoCep ? '...' : 'Buscar CEP'}
              </button>
            </div>
            {fieldErrors['cep'] && <div className="text-sm text-red-600 mb-2">{fieldErrors['cep']}</div>}
            {/* Only show rest of fields after CEP lookup (endereco populated) */}
            {cliente.endereco ? (
              <div>
                <label className="block text-sm font-medium text-gray-700">Cidade / UF</label>
                <input className="w-full p-3 border rounded-md mb-3" value={`${cliente.cidade || ''} / ${cliente.estado || ''}`} readOnly />

                <label className="block text-sm font-medium text-gray-700">Endereço *</label>
                <input className="w-full p-3 border rounded-md mb-3" value={cliente.endereco || ''} onChange={(e) => updateField('endereco', e.target.value)} />

                <div className="flex gap-3 mb-3">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700">Número *</label>
                    <input className={`w-full p-3 border rounded-md ${!cliente.numero ? 'border-red-600' : ''}`} value={cliente.numero || ''} onChange={(e) => updateField('numero', e.target.value)} />
                    {!cliente.numero && <div className="text-sm text-red-600 mt-1">Número obrigatório</div>}
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700">Bairro *</label>
                    <input className={`w-full p-3 border rounded-md ${!cliente.bairro ? 'border-red-600' : ''}`} value={cliente.bairro || ''} onChange={(e) => updateField('bairro', e.target.value)} />
                    {!cliente.bairro && <div className="text-sm text-red-600 mt-1">Bairro obrigatório</div>}
                  </div>
                </div>

                <label className="block text-sm font-medium text-gray-700">Complemento <span className="text-sm text-gray-500">(opcional)</span></label>
                <input className="w-full p-3 border rounded-md mb-4" value={cliente.complemento || ''} onChange={(e) => updateField('complemento', e.target.value)} />

                <div className="flex justify-between">
                  <button type="button" onClick={() => setStep(1)} className="px-4 py-2 border rounded-md">Voltar</button>
                  <button type="button" onClick={handleSalvar} disabled={salvando} className="bg-purple-700 text-white px-6 py-3 rounded-md">
                    {salvando ? 'Salvando...' : '→ Continuar'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500">Digite o CEP e clique em Buscar CEP para preencher o restante do endereço.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
