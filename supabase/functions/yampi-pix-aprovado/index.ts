import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

Deno.serve(async (req) => {
  try {
    // Único método permitido
    if (req.method !== 'POST') {
      return new Response('Método não permitido', { status: 405 })
    }

    const body = await req.json()

    // Se pedido aprovado e pago
    if (body.resource.has_payment && body.resource.status_id === 4) {
      const { data: listaEsperaPix, error: listaEsperaPixErro } = await supabase
        .from('lista_espera_pix')
        .select('*')
        .eq('id_yampi', body.resource.number)
      
      if (listaEsperaPixErro) {
        throw listaEsperaPixErro
      }

      // Se existir na lista de espera pix, deletar
      if (listaEsperaPix && listaEsperaPix.length > 0) {
        const { error: deletarPixErro } = await supabase
          .from('lista_espera_pix')
          .delete()
          .eq('id_yampi', body.resource.number)

        if (deletarPixErro) {
          throw deletarPixErro
        }
      }
    }

    // Retornar o mapeamento como resposta
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
