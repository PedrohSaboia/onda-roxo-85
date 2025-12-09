export function TermosServico() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Termos de Serviço</h1>
        
        <div className="space-y-6 text-muted-foreground">
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">1. Aceitação dos Termos</h2>
            <p>
              Ao acessar e usar o sistema Zeelux, você concorda em cumprir e estar vinculado aos seguintes 
              termos e condições de uso. Se você não concordar com qualquer parte destes termos, não deverá 
              usar nosso sistema.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">2. Descrição do Serviço</h2>
            <p>
              O Zeelux é uma plataforma de gestão de vendas que permite o gerenciamento de pedidos, produtos, 
              clientes, logística e outras funcionalidades relacionadas ao comércio eletrônico. O serviço é 
              fornecido "como está" e pode ser modificado ou descontinuado a qualquer momento.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">3. Uso Permitido</h2>
            <p className="mb-2">Você concorda em usar o sistema apenas para fins legítimos e de acordo com:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Todas as leis e regulamentos aplicáveis</li>
              <li>As diretrizes e políticas estabelecidas pela plataforma</li>
              <li>Os direitos de terceiros e outras partes</li>
              <li>As boas práticas comerciais</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">4. Conta de Usuário</h2>
            <p className="mb-2">Ao criar uma conta, você é responsável por:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Manter a confidencialidade de suas credenciais de acesso</li>
              <li>Todas as atividades que ocorrem em sua conta</li>
              <li>Notificar imediatamente sobre qualquer uso não autorizado</li>
              <li>Fornecer informações precisas e atualizadas</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">5. Propriedade Intelectual</h2>
            <p>
              Todo o conteúdo, recursos e funcionalidades do sistema Zeelux, incluindo mas não limitado a 
              textos, gráficos, logos, ícones, imagens, clipes de áudio, downloads digitais e compilações 
              de dados, são propriedade exclusiva da empresa e estão protegidos por leis de direitos autorais.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">6. Limitação de Responsabilidade</h2>
            <p>
              O sistema não se responsabiliza por quaisquer danos diretos, indiretos, incidentais, 
              consequenciais ou punitivos decorrentes do uso ou da impossibilidade de uso do serviço. 
              Não garantimos que o serviço será ininterrupto, seguro ou livre de erros.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">7. Modificações dos Termos</h2>
            <p>
              Reservamo-nos o direito de modificar estes termos a qualquer momento. As alterações entrarão 
              em vigor imediatamente após a publicação. É sua responsabilidade revisar periodicamente estes 
              termos para se manter informado sobre quaisquer mudanças.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">8. Cancelamento e Suspensão</h2>
            <p>
              Podemos suspender ou encerrar seu acesso ao sistema a qualquer momento, sem aviso prévio, 
              por violação destes termos ou por qualquer outra razão que consideremos apropriada.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">9. Lei Aplicável</h2>
            <p>
              Estes termos serão regidos e interpretados de acordo com as leis do Brasil, sem considerar 
              suas disposições sobre conflitos de leis.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">10. Contato</h2>
            <p>
              Se você tiver dúvidas sobre estes Termos de Serviço, entre em contato conosco através dos 
              canais de suporte disponíveis no sistema.
            </p>
          </section>

          <div className="pt-8 border-t border-border">
            <p className="text-sm">
              <strong>Última atualização:</strong> {new Date().toLocaleDateString('pt-BR', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
