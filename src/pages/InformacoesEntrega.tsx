import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from '@/integrations/supabase/client';
// use fetch instead of axios to avoid adding a dependency
import { useToast } from '@/hooks/use-toast';

type Cliente = {
  id: string;
  nome: string;
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
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const { toast } = useToast();

  // 🔹 Buscar cliente no Supabase
  useEffect(() => {
    const buscarCliente = async () => {
      if (!id) return;
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        toast({ title: 'Erro', description: 'Erro ao buscar cliente.', variant: 'destructive' });
        console.error(error);
      } else {
        setCliente(data as Cliente);
      }
      setCarregando(false);
    };
    buscarCliente();
  }, [id]);

  // 🔹 Atualiza o campo quando o usuário digita
  const handleChange = (campo: keyof Cliente, valor: string) => {
    if (!cliente) return;
    setCliente({ ...cliente, [campo]: valor } as Cliente);
  };

  // 🔹 Buscar endereço pelo CEP
  const handleBuscarCep = async () => {
    if (!cliente?.cep || cliente.cep.replace(/\D/g, "").length !== 8) {
      toast({ title: 'Erro', description: 'Digite um CEP válido com 8 números.', variant: 'destructive' });
      return;
    }

    try {
      setBuscandoCep(true);
      const resp = await fetch(`https://viacep.com.br/ws/${cliente.cep.replace(/\D/g, "")}/json/`);
      const data = await resp.json();

      if ((data as any).erro) {
        toast({ title: 'Erro', description: 'CEP não encontrado.', variant: 'destructive' });
      } else {
        setCliente({
          ...cliente,
          endereco: (data as any).logradouro || "",
          bairro: (data as any).bairro || "",
          cidade: (data as any).localidade || "",
          estado: (data as any).uf || "",
        } as Cliente);
        toast({ title: 'Sucesso', description: 'Endereço preenchido automaticamente!' });
      }
    } catch (err) {
      toast({ title: 'Erro', description: 'Erro ao buscar o CEP.', variant: 'destructive' });
      console.error(err);
    } finally {
      setBuscandoCep(false);
    }
  };

  // 🔹 Salvar alterações no Supabase
  const handleSalvar = async () => {
    if (!cliente) return;
    setSalvando(true);

    const { error } = await supabase
      .from('clientes')
      .update({
        nome: cliente.nome,
        telefone: cliente.telefone,
        cep: cliente.cep,
        endereco: cliente.endereco,
        numero: cliente.numero,
        complemento: cliente.complemento,
        bairro: cliente.bairro,
        cidade: cliente.cidade,
        estado: cliente.estado,
        atualizado_em: new Date().toISOString(),
      } as any)
      .eq('id', cliente.id);

    if (error) {
      toast({ title: 'Erro', description: 'Erro ao salvar informações.', variant: 'destructive' });
      console.error(error);
    } else {
      toast({ title: 'Sucesso', description: 'Informações atualizadas com sucesso!' });
    }

    setSalvando(false);
  };

  if (carregando)
    return (
      <div className="flex justify-center items-center h-screen">
        <p className="text-gray-500">Carregando informações...</p>
      </div>
    );

  if (!cliente)
    return (
      <div className="flex justify-center items-center h-screen">
        <p className="text-red-500">Cliente não encontrado.</p>
      </div>
    );

  return (
    <div className="max-w-lg mx-auto p-4 pb-20">
      <h1 className="text-2xl font-semibold mb-6 text-center">Informações de Entrega</h1>

      <form className="space-y-4">
        <Input
          label="Nome completo"
          value={cliente.nome || ""}
          onChange={(e) => handleChange("nome", e.target.value)}
        />

        <Input
          label="Telefone"
          value={cliente.telefone || ""}
          onChange={(e) => handleChange("telefone", e.target.value)}
        />

        <div className="flex gap-2">
          <Input
            label="CEP"
            value={cliente.cep || ""}
            onChange={(e) => handleChange("cep", e.target.value)}
          />
          <button
            type="button"
            onClick={handleBuscarCep}
            disabled={buscandoCep}
            className="bg-blue-600 text-white px-3 rounded-xl hover:bg-blue-700 transition"
          >
            {buscandoCep ? "..." : "Buscar"}
          </button>
        </div>

        <Input
          label="Endereço"
          value={cliente.endereco || ""}
          onChange={(e) => handleChange("endereco", e.target.value)}
        />

        <div className="flex gap-2">
          <Input
            label="Número"
            value={cliente.numero || ""}
            onChange={(e) => handleChange("numero", e.target.value)}
          />
          <Input
            label="Complemento"
            value={cliente.complemento || ""}
            onChange={(e) => handleChange("complemento", e.target.value)}
          />
        </div>

        <Input
          label="Bairro"
          value={cliente.bairro || ""}
          onChange={(e) => handleChange("bairro", e.target.value)}
        />

        <div className="flex gap-2">
          <Input
            label="Cidade"
            value={cliente.cidade || ""}
            onChange={(e) => handleChange("cidade", e.target.value)}
          />
          <Input
            label="Estado"
            value={cliente.estado || ""}
            onChange={(e) => handleChange("estado", e.target.value)}
          />
        </div>

        <button
          type="button"
          onClick={handleSalvar}
          disabled={salvando}
          className="w-full bg-green-600 text-white py-3 rounded-xl hover:bg-green-700 transition"
        >
          {salvando ? "Salvando..." : "Salvar informações"}
        </button>
      </form>
    </div>
  );
}

// 🔹 Componente reutilizável de input
const Input = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <input
      type="text"
      value={value}
      onChange={onChange}
      className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
    />
  </div>
);
