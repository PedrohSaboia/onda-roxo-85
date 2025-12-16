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
  observacao: string;
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
  const [submitted, setSubmitted] = useState(false);
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
          observacao: (data as any).observacao || '',
          bairro: data.bairro || '',
          cidade: data.cidade || '',
          estado: data.estado || '',
        });
        // if this cliente already submitted the form, show confirmation immediately
        if ((data as any).formulario_enviado) {
          setSubmitted(true);
          setStep(2);
        }
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

  const [cepBuscado, setCepBuscado] = useState(false);

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
      
      // Marca que o CEP foi buscado para mostrar os campos
      setCepBuscado(true);
      
      if (data.logradouro && data.bairro) {
        toast({ title: 'Sucesso', description: 'Endereço preenchido automaticamente' });
      } else {
        toast({ title: 'Atenção', description: 'CEP encontrado. Preencha os campos manualmente.', variant: 'default' });
      }
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
        observacao: cliente.observacao || null,
        bairro: cliente.bairro,
        cidade: cliente.cidade,
        estado: cliente.estado,
        formulario_enviado: true,
        atualizado_em: new Date().toISOString()
      };

      const { error } = await supabase.from('clientes').update(payload as any).eq('id', cliente.id);
      if (error) {
        console.error(error);
        toast({ title: 'Erro', description: 'Não foi possível salvar os dados', variant: 'destructive' });
      } else {
        toast({ title: 'Sucesso', description: 'Dados salvos com sucesso' });
        // mark as submitted and remain on step 2 to show confirmation
        setSubmitted(true);
        setStep(2);
      }
    } finally {
      setSalvando(false);
    }
  };

  if (loading) return <div className="flex justify-center items-center min-h-screen p-4"><p>Carregando...</p></div>;
  if (!cliente) return <div className="flex justify-center items-center min-h-screen p-4"><p className="text-red-500">Cliente não encontrado</p></div>;

  return (
    <div className="max-w-full sm:max-w-md mx-auto p-4 sm:p-6">
      <h2 className="text-center text-2xl font-bold mb-4">FICHA CADASTRAL</h2>
      <p className="text-center text-sm text-muted-foreground mb-6">Informações necessárias para gerar etiqueta de envios das transportadoras.</p>

          {/* Stepper visual (2 steps) */}
          {!submitted && (
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-purple-700 text-white' : 'bg-gray-300 text-gray-600'}`}>1</div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${(step >= 2 || submitted) ? 'bg-purple-700 text-white' : 'bg-gray-300 text-gray-600'}`}>2</div>
            </div>
          )}

      <div className="bg-white rounded-xl shadow p-4 sm:p-6">
        {/* Tabbar Pessoa Física / Jurídica */}
        {!submitted && (
          <div className="flex flex-col sm:flex-row gap-2 bg-gray-100 rounded-md p-2 mb-4">
            <button
              onClick={() => updateField('tipo', 'pf')}
              className={`w-full sm:flex-1 text-center p-3 rounded ${cliente.tipo === 'pf' ? 'bg-white shadow' : ''}`}
            >
              Pessoa física
            </button>
            <button
              onClick={() => updateField('tipo', 'pj')}
              className={`w-full sm:flex-1 text-center p-3 rounded ${cliente.tipo === 'pj' ? 'bg-white shadow' : ''}`}
            >
              Pessoa Jurídica
            </button>
          </div>
        )}

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

            <div className="flex">
              <button
                type="button"
                onClick={() => {
                  if (!validateStep1()) {
                    toast({ title: 'Erro', description: 'Preencha todos os campos obrigatórios corretamente', variant: 'destructive' });
                    return;
                  }
                  // reset submitted flag when moving to address step
                  setSubmitted(false);
                  setStep(2);
                }}
                className="bg-purple-700 text-white px-6 py-3 rounded-md w-full sm:w-auto"
              >
                → Continuar
              </button>
            </div>
          </div>
        )}

  {step === 2 && !submitted && (
          <div>
            <h3 className="font-semibold mb-3">Entrega</h3>
            <label className="block text-sm font-medium text-gray-700">Digite seu CEP *</label>
            <div className="flex flex-col sm:flex-row gap-3 mb-1">
              <input className="flex-1 p-3 border rounded-md" value={formatCEP(cliente.cep || '')} onChange={(e) => updateField('cep', onlyDigits(e.target.value))} />
              <button type="button" onClick={handleBuscarCep} disabled={buscandoCep} className="bg-green-700 text-white px-6 rounded-md w-full sm:w-auto">
                {buscandoCep ? '...' : 'Buscar CEP'}
              </button>
            </div>
            {fieldErrors['cep'] && <div className="text-sm text-red-600 mb-2">{fieldErrors['cep']}</div>}
            {/* Show fields after CEP is searched, regardless of what data was returned */}
            {cepBuscado ? (
              <div>
                <label className="block text-sm font-medium text-gray-700">Cidade / UF</label>
                <input className="w-full p-3 border rounded-md mb-3" value={`${cliente.cidade || ''} / ${cliente.estado || ''}`} readOnly />

                <label className="block text-sm font-medium text-gray-700">Endereço *</label>
                <input className="w-full p-3 border rounded-md mb-3" value={cliente.endereco || ''} onChange={(e) => updateField('endereco', e.target.value)} />

                <div className="flex flex-col sm:flex-row gap-3 mb-3">
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

                <label className="block text-sm font-medium text-gray-700">Complemento <span className="text-sm text-gray-500">(opcional - máx. 17 caracteres)</span></label>
                <input className="w-full p-3 border rounded-md mb-1" maxLength={17} value={cliente.complemento || ''} onChange={(e) => updateField('complemento', e.target.value)} />
                <div className="text-xs text-gray-500 mb-4">{(cliente.complemento || '').length}/17 caracteres</div>

                <label className="block text-sm font-medium text-gray-700">Observação <span className="text-sm text-gray-500">(opcional - máx. 30 caracteres)</span></label>
                <textarea className="w-full p-3 border rounded-md mb-4" rows={3} maxLength={30} value={cliente.observacao || ''} onChange={(e) => updateField('observacao', e.target.value)} />
                <div className="text-xs text-gray-500 -mt-3 mb-4">{(cliente.observacao || '').length}/30 caracteres</div>

                <div className="flex flex-col sm:flex-row justify-between gap-3">
                  <button type="button" onClick={() => { setSubmitted(false); setCepBuscado(false); setStep(1); }} className="px-4 py-2 border rounded-md w-full sm:w-auto">Voltar</button>
                  <button type="button" onClick={handleSalvar} disabled={salvando} className="bg-purple-700 text-white px-6 py-3 rounded-md w-full sm:w-auto">
                    {salvando ? 'Salvando...' : 'Enviar Formulário'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500">Digite o CEP e clique em Buscar CEP para preencher o restante do endereço.</div>
            )}
          </div>
        )}

        {submitted && (
          <div className="text-center py-8">
            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-16 w-16 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="mt-4 text-lg font-semibold">Formulário enviado com sucesso</h3>
            <p className="text-sm text-muted-foreground mt-2">Obrigado — seus dados foram salvos.</p>
            {/* no action button after submit per request */}
          </div>
        )}
      </div>
    </div>
  );
}
